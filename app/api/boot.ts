import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { appRouter } from "./router";
import { createContext } from "./context";
import { createOAuthCallbackHandler, authenticateRequest } from "./kimi/auth";
import {
  Paths,
  MAX_UPLOAD_MB,
  ALLOWED_UPLOAD_MIME_PREFIXES,
  RateLimits,
} from "@contracts/constants";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { rateLimit } from "./utils/rateLimit";
import { env } from "./lib/env";
import { publicFileUrl } from "./lib/urls";
import {
  enqueueModeration,
  isRealImage,
  moderationMetrics,
  moderationStatusForUploader,
  metricsSnapshot,
  processMedia,
  retryModeration,
  shouldModerate,
} from "./services/mediaModeration";
import { isPlatformAdmin } from "./utils/platformAuth";
import { assertCanInteract } from "./services/accountSafety";
import { createHash, randomUUID } from "node:crypto";

const app = new Hono<{ Bindings: HttpBindings }>();

const maxUploadMb = parseInt(
  process.env.MAX_UPLOAD_MB || String(MAX_UPLOAD_MB)
);

app.use(
  "/api/*",
  cors({
    origin: origin => {
      if (!origin) return "";
      return env.allowedOrigins.includes(origin.replace(/\/$/, ""))
        ? origin
        : "";
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.get("/api/health", c => c.json({ status: "ok", service: "nexora" }));

app.use(bodyLimit({ maxSize: (maxUploadMb + 2) * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// ── File upload (multipart) ───────────────────────────────────
app.post("/api/upload", async c => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Não autenticado." }, 401);
  }
  // Suspended / banned accounts cannot upload media.
  try {
    await assertCanInteract(user.id);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Conta restrita." }, 403);
  }
  try {
    rateLimit(
      `upload:${user.id}`,
      RateLimits.upload.limit,
      RateLimits.upload.windowMs
    );
  } catch {
    return c.json({ error: "Muitos uploads. Aguarde um momento." }, 429);
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    return c.json({ error: "Nenhum arquivo enviado." }, 400);
  }
  if (file.size <= 0) {
    return c.json({ error: "Arquivo vazio." }, 400);
  }
  if (file.size > maxUploadMb * 1024 * 1024) {
    return c.json(
      { error: `Arquivo excede o limite de ${maxUploadMb} MB.` },
      400
    );
  }
  const mimeType = file.type || "application/octet-stream";
  const allowed = ALLOWED_UPLOAD_MIME_PREFIXES.some(p =>
    mimeType.startsWith(p)
  );
  if (!allowed) {
    return c.json({ error: `Tipo de arquivo não permitido: ${mimeType}` }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = (file.name || "arquivo").slice(0, 255);
  const [{ id }] = await getDb()
    .insert(schema.files)
    .values({
      uploaderId: user.id,
      filename,
      mimeType,
      size: buffer.length,
      data: buffer,
    })
    .$returningId();

  // Images go through content-safety analysis before becoming public.
  let moderationStatus: string | null = null;
  if (shouldModerate(mimeType)) {
    // Magic-byte validation: a renamed .txt is not an image.
    if (!isRealImage(buffer)) {
      return c.json(
        { error: "Arquivo inválido: o conteúdo não corresponde a uma imagem." },
        400
      );
    }
    const requestId = randomUUID();
    await enqueueModeration(id, user.id);
    void processMedia(id, requestId).catch(() => {});
    moderationMetrics.uploadsTotal += 1;
    console.log(
      JSON.stringify({
        event: "image_upload",
        requestId,
        userId: `***${String(user.id).slice(-2)}`,
        mime: mimeType,
        size: buffer.length,
        upload: "success",
        moderationProvider: "pending",
      })
    );
    moderationStatus = "processing";
  }

  return c.json({
    id,
    url: publicFileUrl(id, c.req.url),
    filename,
    mimeType,
    size: buffer.length,
    moderationStatus,
  });
});

// ── Upload moderation status (poll from the sender's chips) ───
app.get("/api/moderation/status", async c => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Não autenticado." }, 401);
  }
  const idsParam = c.req.query("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map(v => parseInt(v, 10))
    .filter(v => Number.isFinite(v) && v > 0)
    .slice(0, 20);
  const statuses = await moderationStatusForUploader(user.id, ids);
  return c.json({ statuses });
});

// ── File download ─────────────────────────────────────────────
app.get("/api/files/:id", async c => {
  try {
    await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Não autenticado." }, 401);
  }
  const id = parseInt(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "ID inválido." }, 400);

  const file = await getDb().query.files.findFirst({
    where: eq(schema.files.id, id),
  });
  if (!file) return c.json({ error: "Arquivo não encontrado." }, 404);

  // Moderation gate: blocked media is never served to anyone.
  const [moderation] = await getDb()
    .select()
    .from(schema.mediaModeration)
    .where(eq(schema.mediaModeration.fileId, id));
  if (moderation) {
    if (moderation.status === "blocked") {
      return c.json({ error: "Esta mídia foi bloqueada pela segurança do Nexora." }, 403);
    }
    if (moderation.status === "processing" || moderation.status === "review_required") {
      // While unverified, only the uploader may fetch the bytes.
      let viewer;
      try {
        viewer = await authenticateRequest(c.req.raw.headers);
      } catch {
        return c.json({ error: "Não autenticado." }, 401);
      }
      const privileged =
        viewer.id === file.uploaderId || isPlatformAdmin(viewer);
      if (!privileged) {
        return c.json({ error: "Verificando mídia..." }, 403);
      }
    }
  }

  const safeName = file.filename.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// ── WebRTC ICE configuration (STUN by default, TURN via env) ──
app.get("/api/rtc-config", c => {
  let iceServers: unknown[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  if (process.env.ICE_SERVERS) {
    try {
      iceServers = JSON.parse(process.env.ICE_SERVERS);
    } catch {
      // keep defaults
    }
  }
  return c.json({ iceServers });
});

// ── Webhooks públicos (integrações externas) ──────────────────
app.post("/api/webhooks/:id/:token", async c => {
  const id = parseInt(c.req.param("id"));
  const token = c.req.param("token");
  if (!Number.isFinite(id) || !/^[a-f0-9]{48}$/.test(token)) {
    return c.json({ error: "Webhook inválido." }, 400);
  }
  // Rate limit por webhook para evitar abuso.
  try {
    rateLimit(`webhook:${id}`, 20, 10_000);
  } catch {
    return c.json({ error: "Muitas requisições." }, 429);
  }

  const [wh] = [
    await getDb().query.webhooks.findFirst({
      where: eq(schema.webhooks.id, id),
    }),
  ];
  if (!wh || wh.tokenHash !== createHash("sha256").update(token).digest("hex")) {
    return c.json({ error: "Não autorizado." }, 401);
  }

  const body = (await c.req.parseBody().catch(() => null)) as unknown;
  const payload = body as {
    content?: unknown;
    username?: unknown;
    imageUrl?: unknown;
  };
  const content =
    typeof payload?.content === "string" ? payload.content.trim().slice(0, 2000) : "";
  const imageUrl =
    typeof payload?.imageUrl === "string" && /^https?:\/\//.test(payload.imageUrl)
      ? payload.imageUrl
      : "";
  if (!content && !imageUrl) {
    return c.json({ error: "Mensagem vazia." }, 400);
  }
  const name =
    typeof payload?.username === "string" && payload.username.trim()
      ? payload.username.trim().slice(0, 80)
      : wh.name;
  void name;
  const full = imageUrl ? `${content}${content ? "\n" : ""}${imageUrl}` : content;
  const [{ id: messageId }] = await getDb()
    .insert(schema.messages)
    .values({
      channelId: wh.channelId,
      authorId: wh.createdById,
      content: full,
    })
    .$returningId();
  void messageId;

  return c.json({ ok: true });
});

// Owner retries a media that hit MODERATION_UNAVAILABLE.
app.post("/api/moderation/retry/:fileId", async c => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Não autenticado." }, 401);
  }
  const fileId = parseInt(c.req.param("fileId"));
  if (!Number.isFinite(fileId)) return c.json({ error: "ID inválido." }, 400);
  const ok = await retryModeration(fileId, user.id);
  return ok
    ? c.json({ ok: true })
    : c.json({ error: "Mídia não encontrada ou fora do estado de retry." }, 404);
});

// Technical moderation metrics — platform admins only, no private media.
app.get("/api/moderation/metrics", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    if (!isPlatformAdmin(user)) return c.json({ error: "Sem permissão." }, 403);
  } catch {
    return c.json({ error: "Não autenticado." }, 401);
  }
  return c.json(metricsSnapshot());
});

// ── KLIPY GIF proxy (server-side API key, never exposed) ──────
// KLIPY exposes a Tenor-compatible migration API (api.klipy.com/v2) with the
// same search/featured endpoints and response shape, so GIFs keep working
// after the Tenor shutdown.
// Get a key at https://partner.klipy.com/api-keys
const gifsApiKey = process.env.KLIPY_API_KEY ?? process.env.TENOR_API_KEY ?? "";
const gifsClientKey = process.env.KLIPY_CLIENT_KEY || "nexora";
const GIFS_API_BASE = "https://api.klipy.com/v2";

type GifItem = { id: string; url: string; preview: string; desc: string };

async function gifsFetch(
  endpoint: "search" | "featured",
  params: Record<string, string>
): Promise<GifItem[]> {
  const url = new URL(`${GIFS_API_BASE}/${endpoint}`);
  url.searchParams.set("key", gifsApiKey);
  url.searchParams.set("client_key", gifsClientKey);
  url.searchParams.set("media_filter", "gif,tinygif");
  url.searchParams.set("contentfilter", "high");
  url.searchParams.set("locale", "pt_BR");
  url.searchParams.set("country", "BR");
  url.searchParams.set("limit", "24");
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KLIPY respondeu ${res.status}`);
  const data = (await res.json()) as {
    results?: {
      id: string;
      title?: string;
      content_description?: string;
      itemurl?: string;
      media_formats?: Record<string, { url?: string } | undefined>;
    }[];
  };
  return (data.results ?? [])
    .map(r => {
      const gif = r.media_formats?.gif?.url;
      const preview = r.media_formats?.tinygif?.url ?? gif;
      if (!gif) return null;
      return {
        id: r.id,
        url: gif,
        preview,
        desc: r.content_description || r.title || "",
      };
    })
    .filter((g): g is GifItem => g !== null);
}

app.get("/api/gifs/trending", async c => {
  if (!gifsApiKey) {
    return c.json(
      { error: "GIFs indisponíveis: configure KLIPY_API_KEY no servidor." },
      503
    );
  }
  try {
    return c.json({ results: await gifsFetch("featured", {}) });
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : "Erro no provedor de GIFs." },
      502
    );
  }
});

app.get("/api/gifs/search", async c => {
  if (!gifsApiKey) {
    return c.json(
      { error: "GIFs indisponíveis: configure KLIPY_API_KEY no servidor." },
      503
    );
  }
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  if (!q) return c.json({ error: "Informe uma busca." }, 400);
  try {
    return c.json({ results: await gifsFetch("search", { q }) });
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : "Erro no provedor de GIFs." },
      502
    );
  }
});

app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;
