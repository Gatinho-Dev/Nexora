import { createHash } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { Session } from "@contracts/constants";
import { parseUserAgent, friendlyDeviceName, type ParsedUserAgent } from "./userAgent";
import { logSafetyEvent } from "../services/safetyAudit";

/**
 * Sessões de dispositivo — permitem ver "onde minha conta está conectada"
 * e logout remoto real.
 *
 * SEGURANÇA:
 * - O cookie carrega o JWT; o banco guarda apenas sha256(token) — nunca o
 *   token bruto.
 * - Revogar a sessão invalida o token no próximo request (e derruba os
 *   WebSockets daquela sessão).
 * - `lastSeenAt` é atualizado com throttle em memória (flush a cada 30s),
 *   nunca um UPDATE por request.
 */

const SESSION_TTL_MS = Session.maxAgeMs;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Extrai o sid da sessão atual a partir do header cookie do request. */
export async function currentSessionIdFromCookie(
  cookieHeader: string | null
): Promise<string | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${Session.cookieName}=`));
  const token = match?.split("=").slice(1).join("=");
  if (!token) return null;
  const { verifySessionToken } = await import("./token");
  const claim = await verifySessionToken(token);
  return claim?.sid ?? null;
}

export type CreatedSession = {
  sid: string;
  tokenHash: string;
  parsed: ParsedUserAgent;
};

/** Cria a linha da sessão para um sid já embutido no JWT do chamador. */
export async function createSession(input: {
  userId: number;
  sid: string;
  token: string;
  userAgent?: string | null;
  secChUa?: string | null;
  ip?: string | null;
}): Promise<CreatedSession> {
  const db = getDb();
  const now = new Date();
  const parsed = parseUserAgent(input.userAgent ?? "", input.secChUa);
  await db.insert(schema.accountSessions).values({
    id: input.sid,
    userId: input.userId,
    tokenHash: hashToken(input.token),
    userAgent: input.userAgent?.slice(0, 250) ?? null,
    browser: parsed.browser,
    os: parsed.os,
    deviceType: parsed.deviceType,
    friendlyName: friendlyDeviceName(parsed).slice(0, 80),
    ipAddress: input.ip ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  void logSafetyEvent({
    event: "session_created",
    targetUserId: input.userId,
    metadata: { sessionId: input.sid, deviceType: parsed.deviceType },
  }).catch(() => {});
  return { sid: input.sid, tokenHash: hashToken(input.token), parsed };
}

/** Busca sessão válida (não revogada, não expirada) por sid. */
export async function resolveActiveSession(sid: string) {
  const [row] = await getDb()
    .select()
    .from(schema.accountSessions)
    .where(eq(schema.accountSessions.id, sid))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  touchLastSeenThrottled(sid);
  return row;
}

// ── Throttle de última atividade ─────────────────────────────
const pendingTouch = new Map<string, number>();
let flushTimer: NodeJS.Timeout | null = null;

function touchLastSeenThrottled(sid: string): void {
  const now = Date.now();
  if (now - (pendingTouch.get(sid) ?? 0) < 30_000) return;
  pendingTouch.set(sid, now);
  if (!flushTimer) {
    flushTimer = setInterval(flushTouches, 30_000);
    flushTimer.unref?.();
  }
}

async function flushTouches(): Promise<void> {
  if (pendingTouch.size === 0) return;
  const entries = [...pendingTouch.entries()];
  pendingTouch.clear();
  try {
    const db = getDb();
    await Promise.all(
      entries.map(([sid, at]) =>
        db
          .update(schema.accountSessions)
          .set({ lastSeenAt: new Date(at) })
          .where(eq(schema.accountSessions.id, sid))
      )
    );
  } catch {
    // best-effort
  }
}

/** Revoga uma sessão pertencente ao usuário (ownership validado aqui). */
export async function revokeSession(
  sessionId: string,
  userId: number
): Promise<boolean> {
  const result = await getDb()
    .update(schema.accountSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.accountSessions.id, sessionId),
        eq(schema.accountSessions.userId, userId),
        isNull(schema.accountSessions.revokedAt)
      )
    );
  const affected = (result as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
  if (affected > 0) {
    void logSafetyEvent({
      event: "session_revoked",
      actorUserId: userId,
      targetUserId: userId,
      metadata: { sessionId },
    }).catch(() => {});
  }
  return affected > 0;
}

/** Encerra todas as outras sessões do usuário; retorna os sids revogados. */
export async function revokeAllOthers(
  userId: number,
  currentSid: string
): Promise<string[]> {
  const before = await getDb()
    .select({ id: schema.accountSessions.id })
    .from(schema.accountSessions)
    .where(
      and(
        eq(schema.accountSessions.userId, userId),
        isNull(schema.accountSessions.revokedAt),
        sql`${schema.accountSessions.id} <> ${currentSid}`
      )
    );
  const ids = before.map(r => r.id);
  if (ids.length === 0) return [];
  await getDb()
    .update(schema.accountSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.accountSessions.userId, userId),
        isNull(schema.accountSessions.revokedAt),
        sql`${schema.accountSessions.id} <> ${currentSid}`
      )
    );
  void logSafetyEvent({
    event: "sessions_revoked_others",
    actorUserId: userId,
    targetUserId: userId,
    metadata: { count: ids.length },
  }).catch(() => {});
  return ids;
}

/** Lista sessões ativas do usuário (revogadas/expiradas fora). */
export async function listActiveSessions(userId: number) {
  const rows = await getDb()
    .select({
      id: schema.accountSessions.id,
      friendlyName: schema.accountSessions.friendlyName,
      browser: schema.accountSessions.browser,
      os: schema.accountSessions.os,
      deviceType: schema.accountSessions.deviceType,
      ipAddress: schema.accountSessions.ipAddress,
      createdAt: schema.accountSessions.createdAt,
      lastSeenAt: schema.accountSessions.lastSeenAt,
    })
    .from(schema.accountSessions)
    .where(
      and(
        eq(schema.accountSessions.userId, userId),
        isNull(schema.accountSessions.revokedAt),
        sql`${schema.accountSessions.expiresAt} > NOW()`
      )
    )
    .orderBy(sql`${schema.accountSessions.lastSeenAt} DESC`)
    .limit(50);
  return rows;
}

/** Job periódico: remove sessões expiradas/revogadas antigas (>7 dias). */
export function startSessionCleanupJob(): void {
  setInterval(
    () => {
      void getDb()
        .delete(schema.accountSessions)
        .where(
          or(
            lt(schema.accountSessions.expiresAt, new Date(Date.now() - 7 * 86_400_000)),
            and(
              sql`${schema.accountSessions.revokedAt} IS NOT NULL`,
              lt(schema.accountSessions.revokedAt, new Date(Date.now() - 7 * 86_400_000))
            )
          )
        )
        .catch(() => {});
    },
    60 * 60 * 1000
  ).unref();
}
