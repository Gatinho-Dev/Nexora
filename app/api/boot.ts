import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { appRouter } from "./router";
import { createContext } from "./context";
import { createOAuthCallbackHandler, authenticateRequest } from "./kimi/auth";
import { Paths, MAX_UPLOAD_MB, ALLOWED_UPLOAD_MIME_PREFIXES, RateLimits } from "@contracts/constants";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { rateLimit } from "./utils/rateLimit";

const app = new Hono<{ Bindings: HttpBindings }>();

const maxUploadMb = parseInt(process.env.MAX_UPLOAD_MB || String(MAX_UPLOAD_MB));

app.use(bodyLimit({ maxSize: (maxUploadMb + 2) * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// ── File upload (multipart) ───────────────────────────────────
app.post("/api/upload", async (c) => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Não autenticado." }, 401);
  }
  try {
    rateLimit(`upload:${user.id}`, RateLimits.upload.limit, RateLimits.upload.windowMs);
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
    return c.json({ error: `Arquivo excede o limite de ${maxUploadMb} MB.` }, 400);
  }
  const mimeType = file.type || "application/octet-stream";
  const allowed = ALLOWED_UPLOAD_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
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

  return c.json({ id, url: `/api/files/${id}`, filename, mimeType, size: buffer.length });
});

// ── File download ─────────────────────────────────────────────
app.get("/api/files/:id", async (c) => {
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
app.get("/api/rtc-config", (c) => {
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

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;
