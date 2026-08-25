import { and, eq } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { encryptSecret, decryptSecret } from "../../lib/crypto";
import { logSafetyEvent } from "../../services/safetyAudit";
import {
  refreshTokens,
  revokeToken,
  RobloxApiError,
} from "./client";

/**
 * RobloxConnectionService — CRUD do vínculo Roblox ↔ Nexora.
 * Tokens existem SOMENTE criptografados no banco; nunca retornam ao cliente.
 */

const PROVIDER = "ROBLOX";

export async function findRobloxConnection(userId: number) {
  const [row] = await getDb()
    .select()
    .from(schema.userConnections)
    .where(
      and(
        eq(schema.userConnections.userId, userId),
        eq(schema.userConnections.provider, PROVIDER)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function upsertRobloxConnection(input: {
  userId: number;
  providerUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds: number;
}): Promise<{ ok: true } | { ok: false; error: "already_linked" }> {
  const db = getDb();
  // Uma conta Roblox só pode pertencer a uma conta Nexora.
  const [taken] = await db
    .select({ userId: schema.userConnections.userId })
    .from(schema.userConnections)
    .where(
      and(
        eq(schema.userConnections.provider, PROVIDER),
        eq(schema.userConnections.providerUserId, input.providerUserId)
      )
    )
    .limit(1);
  if (taken && taken.userId !== input.userId) {
    return { ok: false, error: "already_linked" };
  }

  const values = {
    userId: input.userId,
    provider: PROVIDER,
    providerUserId: input.providerUserId,
    username: input.username.slice(0, 100),
    displayName: input.displayName?.slice(0, 100) ?? null,
    avatarUrl: input.avatarUrl,
    profileUrl:
      input.profileUrl ??
      `https://www.roblox.com/users/${input.providerUserId}/profile`,
    accessTokenEnc: encryptSecret(input.accessToken),
    refreshTokenEnc: input.refreshToken
      ? encryptSecret(input.refreshToken)
      : null,
    tokenExpiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    needsReauth: false,
  };

  await db
    .insert(schema.userConnections)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });

  void logSafetyEvent({
    event: "roblox_connection_added",
    actorUserId: input.userId,
    targetUserId: input.userId,
    metadata: { providerUserId: input.providerUserId },
  }).catch(() => {});
  return { ok: true };
}

/** Access token válido — renova automaticamente quando expirado. */
export async function getValidAccessToken(userId: number): Promise<string | null> {
  const conn = await findRobloxConnection(userId);
  if (!conn || !conn.accessTokenEnc || conn.needsReauth) return null;

  const access = decryptSecret(conn.accessTokenEnc);
  const expiresAt = conn.tokenExpiresAt
    ? new Date(conn.tokenExpiresAt).getTime()
    : 0;
  if (access && expiresAt - Date.now() > 60_000) return access;

  const refresh = conn.refreshTokenEnc
    ? decryptSecret(conn.refreshTokenEnc)
    : null;
  if (!refresh) return null;
  try {
    const tokens = await refreshTokens(refresh);
    await getDb()
      .update(schema.userConnections)
      .set({
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : conn.refreshTokenEnc,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .where(eq(schema.userConnections.id, conn.id));
    return tokens.access_token;
  } catch (e) {
    if (e instanceof RobloxApiError && (e.status === 400 || e.status === 401)) {
      // Refresh token inválido → pede reconexão.
      await getDb()
        .update(schema.userConnections)
        .set({ needsReauth: true })
        .where(eq(schema.userConnections.id, conn.id));
    }
    return null;
  }
}

export async function disconnectRoblox(userId: number): Promise<boolean> {
  const conn = await findRobloxConnection(userId);
  if (!conn) return false;
  // Best-effort: revoga no Roblox; falha não bloqueia desconexão local.
  const access = conn.accessTokenEnc ? decryptSecret(conn.accessTokenEnc) : null;
  if (access) void revokeToken(access).catch(() => {});

  await getDb()
    .delete(schema.userConnections)
    .where(eq(schema.userConnections.id, conn.id));
  await getDb()
    .delete(schema.robloxActivity)
    .where(eq(schema.robloxActivity.userId, userId));

  void logSafetyEvent({
    event: "roblox_connection_removed",
    actorUserId: userId,
    targetUserId: userId,
  }).catch(() => {});
  return true;
}

export async function updatePrivacySettings(
  userId: number,
  patch: {
    showOnProfile?: boolean;
    showActivity?: boolean;
    allowJoin?: boolean;
  }
): Promise<void> {
  await getDb()
    .update(schema.userConnections)
    .set(patch)
    .where(
      and(
        eq(schema.userConnections.userId, userId),
        eq(schema.userConnections.provider, PROVIDER)
      )
    );
}
