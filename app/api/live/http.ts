import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import {
  LIVE_RATE_LIMITS,
  isValidRoomCode,
  normalizeRoomCode,
  validateRoomName,
} from "@contracts/live";
import { rateLimit } from "../utils/rateLimit";
import { createRoom, getRoomInfo } from "./rooms";

/**
 * Rotas REST públicas do Nexora Live — não exigem login.
 *
 * POST /api/live/rooms        → cria uma sala; devolve {code, hostToken}.
 * GET  /api/live/rooms/:code  → estado público mínimo (existe/cheia/nicks).
 * GET  /api/live/ice          → servidores ICE (STUN/TURN) p/ o frontend.
 *
 * O hostToken é a prova de "eu criei esta sala" e só é usado no join WS para
 * reassumir o host (ex.: refresh da aba do criador). Nada de PII circula
 * aqui: nicks só são listados quando a sala existe, por conveniência do
 * lobby, e nunca são persistidos.
 */

function clientKey(c: {
  req: { header: (n: string) => string | undefined };
}) {
  // Sem PII: chave derivada do IP, nunca o IP cru em logs/banco.
  const fwd = c.req.header("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || c.req.header("x-real-ip") || "local";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

const app = new Hono<{ Bindings: HttpBindings }>();

// ── Criar sala ────────────────────────────────────────────────
app.post("/api/live/rooms", async c => {
  const key = clientKey(c);
  try {
    rateLimit(
      `live:create:${key}`,
      LIVE_RATE_LIMITS.createRoom.limit,
      LIVE_RATE_LIMITS.createRoom.windowMs
    );
  } catch {
    return c.json(
      { error: "Muitas salas criadas. Aguarde alguns minutos." },
      429
    );
  }
  // Nome da sala: opcional, limitado e sanitizado no servidor. Corpo mal
  // formado ou não-JSON é tratado como sem nome (comportamento antigo).
  let name: string | null = null;
  try {
    const body = (await c.req.json()) as { name?: unknown };
    if (typeof body?.name === "string") {
      const validation = validateRoomName(body.name);
      if (!validation.ok) {
        return c.json({ error: validation.error }, 400);
      }
      name = validation.value;
    }
  } catch {
    // Sem corpo/JSON inválido: cria sem nome.
  }
  const result = await createRoom(name);
  if (!result.ok) {
    return c.json({ error: "Servidor ocupado. Tente novamente." }, 503);
  }
  return c.json(
    { code: result.code, hostToken: result.hostToken, name: result.name },
    201,
    { "Cache-Control": "no-store" }
  );
});

// ── Estado público da sala (para o lobby /live/:code) ─────────
app.get("/api/live/rooms/:code", async c => {
  const key = clientKey(c);
  try {
    rateLimit(
      `live:check:${key}`,
      LIVE_RATE_LIMITS.checkRoom.limit,
      LIVE_RATE_LIMITS.checkRoom.windowMs
    );
  } catch {
    return c.json({ error: "Muitas verificações. Aguarde." }, 429);
  }
  const code = normalizeRoomCode(c.req.param("code") ?? "");
  if (!isValidRoomCode(code)) {
    return c.json({ exists: false });
  }
  const info = getRoomInfo(code);
  return c.json(info, 200, { "Cache-Control": "no-store" });
});

// ── ICE servers (STUN/TURN) — mesmas credenciais das chamadas ─
app.get("/api/live/ice", c => {
  // Mesma config pública de /api/rtc-config: STUN padrão e ICE_SERVERS (env)
  // quando configurado. Segredos de TURN nunca vão para o build do frontend.
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

export default app;
