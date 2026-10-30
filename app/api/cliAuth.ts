/**
 * Device authorization flow do Nexora CLI.
 *
 * Fluxo:
 *  1. CLI chama POST /api/cli/device/start → recebe { deviceCode, userCode, verifyUrl }
 *  2. Usuário abre nexorachat.cloud/cli/login e digita o código (já autenticado no Web)
 *  3. Usuário aprova no navegador → POST /api/cli/device/approve (cookie de sessão do Web)
 *  4. CLI faz polling em POST /api/cli/device/poll → recebe o token de sessão
 *     (mesmo formato do cookie do Web: JWT assinado com sid em account_sessions)
 *
 * O token emitido é uma sessão real do Nexora (mesma tabela, mesmo JWT), então o
 * CLI aparece em "Dispositivos conectados" e pode ser revogado de lá. Nenhuma
 * senha trafega; o userCode é de uso único, expira em 15 min e tem rate limit.
 */

import { Hono } from "hono";
import * as cookie from "cookie";
import { and, eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { Session } from "@contracts/constants";
import { signSessionToken } from "./auth/token";
import { createSession } from "./auth/sessions";
import { authenticateRequest } from "./auth/middleware";
import { getClientIp } from "./lib/ip";
import { logSafetyEvent } from "./services/safetyAudit";
import { randomBytes, createHash } from "crypto";

export const cliAuth = new Hono();

// ── Sessões de pareamento em memória ─────────────────────────
type DevicePairing = {
  deviceCodeHash: string;
  userCode: string;
  status: "pending" | "approved" | "denied";
  /** userId do aprovador (preenchido na aprovação). */
  approvedBy?: number;
  approvedToken?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
};

const pairings = new Map<string, DevicePairing>();

const PAIRING_TTL_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_ATTEMPTS = 120; // ~15 min de polling a cada 3s

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L). */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateUserCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

function hashDeviceCode(code: string): string {
  return createHash("sha256").update(`nexora-cli:${code}`).digest("hex");
}

function cleanupExpired() {
  const now = Date.now();
  for (const [deviceCodeHash, p] of pairings) {
    if (now > p.expiresAt || p.attempts > MAX_ATTEMPTS) {
      pairings.delete(deviceCodeHash);
    }
  }
}

/** Extrai o userId do cookie de sessão do Web (aprovação vem do navegador). */
async function userFromCookie(req: Request): Promise<number | null> {
  const cookies = cookie.parse(req.headers.get("cookie") ?? "");
  const token = cookies[Session.cookieName];
  if (!token) return null;
  // authenticateRequest valida o JWT + resolve a sessão ativa no banco.
  try {
    const { user } = await authenticateRequest(req.headers);
    return user.id;
  } catch {
    return null;
  }
}

// ── 1. Início do pareamento (chamado pelo CLI) ───────────────
cliAuth.post("/device/start", async c => {
  cleanupExpired();
  // Limite global de pareamentos ativos para evitar spam.
  if (pairings.size > 500) {
    return c.json({ error: "too_many_pairings" }, 429);
  }

  const deviceCode = randomBytes(32).toString("hex");
  let userCode = generateUserCode();
  // Garante userCode único entre pareamentos ativos.
  while (
    [...pairings.values()].some(p => p.userCode === userCode)
  ) {
    userCode = generateUserCode();
  }

  const now = Date.now();
  pairings.set(hashDeviceCode(deviceCode), {
    deviceCodeHash: hashDeviceCode(deviceCode),
    userCode,
    status: "pending",
    createdAt: now,
    expiresAt: now + PAIRING_TTL_MS,
    attempts: 0,
  });

  return c.json({
    deviceCode,
    userCode,
    verifyUrl: "/cli/login",
    expiresIn: PAIRING_TTL_MS / 1000,
    interval: POLL_INTERVAL_MS / 1000,
  });
});

// ── 2. Polling do CLI ────────────────────────────────────────
cliAuth.post("/device/poll", async c => {
  const body = await c.req.json().catch(() => null);
  const deviceCode = body?.deviceCode;
  if (typeof deviceCode !== "string" || deviceCode.length < 16) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const key = hashDeviceCode(deviceCode);
  const pairing = pairings.get(key);
  if (!pairing) {
    return c.json({ error: "expired_token" }, 400);
  }

  pairing.attempts += 1;
  if (pairing.attempts > MAX_ATTEMPTS) {
    pairings.delete(key);
    return c.json({ error: "expired_token" }, 400);
  }
  if (Date.now() > pairing.expiresAt) {
    pairings.delete(key);
    return c.json({ error: "expired_token" }, 400);
  }

  if (pairing.status === "denied") {
    pairings.delete(key);
    return c.json({ error: "access_denied" }, 403);
  }

  if (pairing.status === "pending") {
    return c.json({ error: "authorization_pending" }, 400);
  }

  // Aprovado: entrega o token e invalida o pareamento (uso único).
  pairings.delete(key);
  return c.json({
    accessToken: pairing.approvedToken,
    tokenType: "Bearer",
    expiresIn: Session.maxAgeMs / 1000,
  });
});

// ── 3. Aprovação (navegador autenticado no Web) ──────────────
cliAuth.post("/device/approve", async c => {
  const userId = await userFromCookie(c.req.raw);
  if (userId == null) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const userCode = typeof body?.userCode === "string" ? body.userCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{6,16}$/.test(userCode)) {
    return c.json({ error: "invalid_user_code" }, 400);
  }

  cleanupExpired();
  const pairing = [...pairings.values()].find(p => p.userCode === userCode);
  if (!pairing || Date.now() > pairing.expiresAt) {
    return c.json({ error: "invalid_user_code" }, 400);
  }
  if (pairing.status !== "pending") {
    return c.json({ error: "already_used" }, 400);
  }

  // Emite uma sessão real do Nexora (mesma tabela do Web).
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const sid = randomBytes(18).toString("base64url");
  const token = await signSessionToken({
    unionId: user.unionId,
    clientId: "nexora-cli",
    sid,
  });
  await createSession({
    userId: user.id,
    sid,
    token,
    userAgent: c.req.header("user-agent") + " (Nexora CLI)",
    ip: getClientIp(c.req.raw.headers),
  });

  pairing.status = "approved";
  pairing.approvedBy = user.id;
  pairing.approvedToken = token;
  // Token fica disponível por 5 min para o CLI buscar; depois some.
  pairing.expiresAt = Math.min(pairing.expiresAt, Date.now() + 5 * 60_000);

  void logSafetyEvent({
    event: "login_success",
    actorUserId: user.id,
    targetUserId: user.id,
    metadata: { sessionId: sid, via: "cli_device_flow" },
  }).catch(() => {});

  return c.json({ success: true });
});

// ── 4. Recusa (navegador autenticado) ────────────────────────
cliAuth.post("/device/deny", async c => {
  const userId = await userFromCookie(c.req.raw);
  if (userId == null) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  const userCode = typeof body?.userCode === "string" ? body.userCode.trim().toUpperCase() : "";
  const pairing = [...pairings.values()].find(p => p.userCode === userCode);
  if (pairing && pairing.status === "pending") {
    pairing.status = "denied";
  }
  return c.json({ success: true });
});

// ── 5. Info do userCode (para a página de autorização) ───────
cliAuth.get("/device/info/:userCode", async c => {
  cleanupExpired();
  const userCode = c.req.param("userCode").toUpperCase();
  const pairing = [...pairings.values()].find(p => p.userCode === userCode);
  if (!pairing || Date.now() > pairing.expiresAt) {
    return c.json({ error: "invalid_user_code" }, 404);
  }
  return c.json({
    status: pairing.status,
    createdAt: new Date(pairing.createdAt).toISOString(),
    expiresAt: new Date(pairing.expiresAt).toISOString(),
  });
});

// ── 6. Logout do CLI (revoga a sessão) ───────────────────────
cliAuth.post("/logout", async c => {
  const body = await c.req.json().catch(() => null);
  const token = typeof body?.accessToken === "string" ? body.accessToken : "";
  if (!token) return c.json({ error: "invalid_request" }, 400);
  try {
    // Valida o token e revoga a sessão correspondente.
    const claim = await (await import("./auth/token")).verifySessionToken(token);
    if (!claim) return c.json({ error: "invalid_token" }, 400);
    const db = getDb();
    await db
      .update(schema.accountSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.accountSessions.id, claim.sid)));
    return c.json({ success: true });
  } catch {
    return c.json({ error: "invalid_token" }, 400);
  }
});

export function startCliPairingSweeper(): void {
  setInterval(() => cleanupExpired(), 60_000).unref();
}
