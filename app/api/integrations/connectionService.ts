import { and, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { getExternalProvider } from "./registry";
import {
  ProviderApiError,
  type IntegrationProviderId,
  type ProviderProfile,
  type ProviderTokens,
} from "./types";

export const providerDbId = (provider: IntegrationProviderId) =>
  provider.toUpperCase();

export async function findConnection(
  userId: number,
  provider: IntegrationProviderId
) {
  const [row] = await getDb()
    .select()
    .from(schema.userConnections)
    .where(
      and(
        eq(schema.userConnections.userId, userId),
        eq(schema.userConnections.provider, providerDbId(provider))
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Garante a linha de conexão de um provider **sem OAuth** — hoje só o Cider.
 *
 * Todo o resto da presença parte de `user_connections`: `visibleActivitiesFor`
 * (o perfil) e `broadcastActivities` (os amigos) filtram a atividade pelo
 * `showOnProfile`/`showActivity`/`activityVisibility` da linha daquele provider.
 * Sem ela, o Cider gravava a faixa em `rich_presence_activities` e **nada**
 * aparecia — nem no próprio perfil. Era por isso que ouvir no `/cider` não
 * mostrava nada em lugar nenhum.
 *
 * A linha nasce com os padrões de quem quer ser visto (`true`, `true`,
 * `everyone`); quem quiser esconder desliga na tela de conexões, e a escolha
 * continua valendo porque esta função **cria se faltar** e nunca sobrescreve.
 *
 * `providerUserId` recebe o id da Nexora: não existe identidade externa aqui, e
 * a coluna é `not null` com índice único por (provider, providerUserId).
 */
export async function ensureSessionConnection(
  userId: number,
  provider: IntegrationProviderId
) {
  const existing = await findConnection(userId, provider);
  if (existing) return existing;
  const dbProvider = providerDbId(provider);
  await getDb()
    .insert(schema.userConnections)
    .values({
      userId,
      provider: dbProvider,
      providerUserId: String(userId),
      username: "Cider",
      displayName: null,
      scopes: [],
    })
    // Duas sessões do mesmo usuário podem publicar ao mesmo tempo: o segundo
    // insert não pode derrubar nada, e não deve reescrever as preferências.
    .onDuplicateKeyUpdate({ set: { provider: dbProvider } });
  return await findConnection(userId, provider);
}

export async function upsertExternalConnection(input: {
  userId: number;
  provider: Exclude<IntegrationProviderId, "roblox">;
  profile: ProviderProfile;
  tokens: ProviderTokens;
}): Promise<{ ok: true } | { ok: false; error: "already_linked" }> {
  const db = getDb();
  const dbProvider = providerDbId(input.provider);
  const [taken] = await db
    .select({ userId: schema.userConnections.userId })
    .from(schema.userConnections)
    .where(
      and(
        eq(schema.userConnections.provider, dbProvider),
        eq(schema.userConnections.providerUserId, input.profile.providerUserId)
      )
    )
    .limit(1);
  if (taken && taken.userId !== input.userId)
    return { ok: false, error: "already_linked" };

  const current = await findConnection(input.userId, input.provider);
  const values = {
    userId: input.userId,
    provider: dbProvider,
    providerUserId: input.profile.providerUserId,
    username: input.profile.username?.slice(0, 100) ?? null,
    displayName: input.profile.displayName?.slice(0, 100) ?? null,
    avatarUrl: input.profile.avatarUrl,
    profileUrl: input.profile.profileUrl,
    accessTokenEnc: encryptSecret(input.tokens.accessToken),
    refreshTokenEnc: input.tokens.refreshToken
      ? encryptSecret(input.tokens.refreshToken)
      : (current?.refreshTokenEnc ?? null),
    scopes: input.tokens.scopes,
    tokenExpiresAt: input.tokens.expiresInSeconds
      ? new Date(Date.now() + input.tokens.expiresInSeconds * 1000)
      : null,
    needsReauth: false,
    errorCode: null,
    lastSyncedAt: new Date(),
  };
  await db
    .insert(schema.userConnections)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
  return { ok: true };
}

export async function validAccessToken(
  userId: number,
  provider: Exclude<IntegrationProviderId, "roblox">
): Promise<string | null> {
  const connection = await findConnection(userId, provider);
  if (!connection?.accessTokenEnc || connection.needsReauth) return null;
  const accessToken = decryptSecret(connection.accessTokenEnc);
  if (!accessToken) return null;
  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (expiresAt - Date.now() > 60_000) return accessToken;
  const adapter = getExternalProvider(provider);
  const refreshToken = connection.refreshTokenEnc
    ? decryptSecret(connection.refreshTokenEnc)
    : null;
  if (!adapter?.refreshCredentials || !refreshToken) {
    await markConnectionError(userId, provider, "reauth_required");
    return null;
  }
  try {
    const tokens = await adapter.refreshCredentials(refreshToken);
    await getDb()
      .update(schema.userConnections)
      .set({
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken
          ? encryptSecret(tokens.refreshToken)
          : connection.refreshTokenEnc,
        scopes: tokens.scopes.length ? tokens.scopes : connection.scopes,
        tokenExpiresAt: tokens.expiresInSeconds
          ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
          : null,
        needsReauth: false,
        errorCode: null,
      })
      .where(eq(schema.userConnections.id, connection.id));
    return tokens.accessToken;
  } catch {
    await markConnectionError(userId, provider, "reauth_required");
    return null;
  }
}

export async function markConnectionError(
  userId: number,
  provider: IntegrationProviderId,
  errorCode: string
) {
  await getDb()
    .update(schema.userConnections)
    .set({
      needsReauth: errorCode === "reauth_required",
      errorCode: errorCode.slice(0, 64),
    })
    .where(
      and(
        eq(schema.userConnections.userId, userId),
        eq(schema.userConnections.provider, providerDbId(provider))
      )
    );
}

export async function disconnectExternalProvider(
  userId: number,
  provider: Exclude<IntegrationProviderId, "roblox">
) {
  const connection = await findConnection(userId, provider);
  if (!connection) return false;
  const accessToken = connection.accessTokenEnc
    ? decryptSecret(connection.accessTokenEnc)
    : null;
  const adapter = getExternalProvider(provider);
  if (accessToken && adapter?.revoke)
    void adapter.revoke(accessToken).catch(() => {});
  await getDb()
    .delete(schema.userConnections)
    .where(eq(schema.userConnections.id, connection.id));
  return true;
}

export function isAuthFailure(error: unknown) {
  return (
    error instanceof ProviderApiError &&
    (error.status === 401 || error.status === 403)
  );
}
