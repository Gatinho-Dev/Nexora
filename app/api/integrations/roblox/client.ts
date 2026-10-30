import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { env } from "../../lib/env";

/**
 * RobloxClient — ÚNICO ponto de contato com as APIs do Roblox.
 *
 * Endpoints (verificados ao vivo em 2026-08):
 * - OIDC discovery: apis.roblox.com/oauth/.well-known/openid-configuration
 *   authorize /oauth/v1/authorize · token /oauth/v1/token · userinfo /oauth/v1/userinfo
 * - Presence (legacy público, sem cookies): POST presence.roblox.com/v1/presence/users
 *   → aceita BATCH de userIds. Documentado como legacy nesta integração.
 * - Metadados: GET games.roblox.com/v1/games?universeIds=
 * - Thumbnails: GET thumbnails.roblox.com/v1/games/multiget/thumbnails
 *
 * Regras: allowlist de hosts, timeout, erros tipados, Zod nas respostas,
 * nenhum segredo em logs.
 */

const HOSTS = new Set([
  "apis.roblox.com",
  "authorize.roblox.com",
  "presence.roblox.com",
  "games.roblox.com",
  "thumbnails.roblox.com",
  "users.roblox.com",
]);

export class RobloxApiError extends Error {
  status: number;
  retryAfterMs: number | null;
  constructor(
    status: number,
    message: string,
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

async function robloxFetch(url: string, init?: RequestInit): Promise<Response> {
  const u = new URL(url);
  if (!HOSTS.has(u.hostname)) {
    throw new RobloxApiError(400, "Host não permitido (SSRF guard).");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(u.toString(), {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after") ?? "") || null;
      throw new RobloxApiError(
        429,
        "Rate limit do Roblox.",
        ra ? ra * 1000 : null
      );
    }
    return res;
  } catch (e) {
    if (e instanceof RobloxApiError) throw e;
    if ((e as Error)?.name === "AbortError") {
      throw new RobloxApiError(0, "Timeout no Roblox.");
    }
    throw new RobloxApiError(0, "Falha de rede no Roblox.");
  } finally {
    clearTimeout(timer);
  }
}

// ── OAuth ─────────────────────────────────────────────────────

export function robloxConfigured(): boolean {
  return Boolean(
    env.robloxClientId && env.robloxClientSecret && env.robloxRedirectUri
  );
}

export function buildAuthorizeUrl(input: {
  state: string;
  codeVerifier: string;
  nonce: string;
}): { url: string; challenge: string } {
  const challenge = createHash("sha256")
    .update(input.codeVerifier)
    .digest("base64url");
  const params = new URLSearchParams({
    client_id: env.robloxClientId,
    redirect_uri: env.robloxRedirectUri,
    response_type: "code",
    scope: "openid profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Roblox requires both screens for this third-party OIDC flow. OIDC prompt
    // values share one space-delimited parameter; sending either value alone
    // yields account_selection_required or consent_required respectively.
    prompt: "select_account consent",
  });
  const url = new URL("https://apis.roblox.com/oauth/v1/authorize");
  url.search = params.toString();
  return {
    url: url.toString(),
    challenge,
  };
}

export function generatePkcePair(): {
  verifier: string;
  nonce: string;
  state: string;
} {
  return {
    verifier: randomBytes(32).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    state: randomBytes(24).toString("base64url"),
  };
}

const TokenResponse = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().min(10).optional(),
  expires_in: z.number().positive().default(3600),
});

async function tokenRequest(body: URLSearchParams) {
  const res = await robloxFetch("https://apis.roblox.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${env.robloxClientId}:${env.robloxClientSecret}`
      ).toString("base64")}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new RobloxApiError(res.status, `Token troca falhou (${res.status}).`);
  }
  const json = await res.json().catch(() => null);
  const parsed = TokenResponse.safeParse(json);
  if (!parsed.success) {
    throw new RobloxApiError(res.status || 500, "Resposta de token inválida.");
  }
  return parsed.data;
}

export function exchangeCode(input: { code: string; codeVerifier: string }) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: env.robloxRedirectUri,
      code_verifier: input.codeVerifier,
    })
  );
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

/** Best-effort — falha de revoke não bloqueia desconexão local. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await robloxFetch(
      "https://apis.roblox.com/oauth/v1/token/revoke",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${env.robloxClientId}:${env.robloxClientSecret}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({ token }).toString(),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Userinfo ─────────────────────────────────────────────────

export const RobloxUserInfo = z.object({
  sub: z.string().min(1),
  preferred_username: z.string().min(1).nullable().optional(),
  name: z.string().min(1).nullable().optional(),
  nickname: z.string().min(1).nullable().optional(),
  // O Roblox pode retornar `picture: null`; isso não invalida a identidade
  // OAuth e não deve fazer o callback cair no erro genérico.
  picture: z.string().url().nullable().optional(),
  profile: z.string().url().nullable().optional(),
});
export type RobloxUserInfoT = z.infer<typeof RobloxUserInfo>;

export async function fetchUserInfo(
  accessToken: string
): Promise<RobloxUserInfoT> {
  const res = await robloxFetch("https://apis.roblox.com/oauth/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new RobloxApiError(res.status, "Userinfo falhou.");
  const parsed = RobloxUserInfo.safeParse(await res.json().catch(() => null));
  if (!parsed.success)
    throw new RobloxApiError(res.status || 500, "Userinfo inválida.");
  return parsed.data;
}

const RobloxPublicUser = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
});

async function fetchPublicUser(userId: string) {
  if (!/^\d+$/.test(userId)) return null;
  try {
    const res = await robloxFetch(
      `https://users.roblox.com/v1/users/${userId}`
    );
    if (!res.ok) return null;
    const parsed = RobloxPublicUser.safeParse(
      await res.json().catch(() => null)
    );
    return parsed.success && String(parsed.data.id) === userId
      ? parsed.data
      : null;
  } catch {
    // Esta consulta apenas enriquece o perfil. O `sub` ainda é uma prova de
    // identidade válida se o endpoint público estiver indisponível.
    return null;
  }
}

/**
 * O `sub` do userinfo é a identidade estável confirmada pelo OAuth. Alguns
 * apps recebem somente esse campo quando `profile` não foi habilitado no
 * painel do Roblox; nesse caso, completamos nome público sem invalidar uma
 * autorização legítima.
 */
export async function resolveRobloxIdentity(accessToken: string): Promise<{
  providerUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string;
}> {
  const info = await fetchUserInfo(accessToken);
  const publicUser = info.preferred_username
    ? null
    : await fetchPublicUser(info.sub);
  const username =
    info.preferred_username ?? publicUser?.name ?? `roblox-${info.sub}`;
  return {
    providerUserId: info.sub,
    username,
    displayName:
      info.name ??
      info.nickname ??
      publicUser?.displayName ??
      publicUser?.name ??
      null,
    avatarUrl: info.picture ?? null,
    profileUrl:
      info.profile ?? `https://www.roblox.com/users/${info.sub}/profile`,
  };
}

// ── Presence (legacy público, batch) ─────────────────────────

export const PRESENCE_TYPE_MAP = {
  0: "OFFLINE",
  1: "ONLINE",
  2: "IN_GAME",
  3: "IN_STUDIO",
} as const;

export type RobloxPresenceStatus =
  (typeof PRESENCE_TYPE_MAP)[keyof typeof PRESENCE_TYPE_MAP] | "UNKNOWN";

export type RobloxPresenceEntry = {
  robloxUserId: string;
  status: RobloxPresenceStatus;
  lastLocation: string | null;
  placeId: number | null;
  rootPlaceId: number | null;
  universeId: number | null;
  gameId: string | null;
};

const PresenceResponse = z.object({
  userPresences: z.array(
    z.object({
      userId: z.number(),
      userPresenceType: z.number(),
      lastLocation: z.string().nullable().optional(),
      placeId: z.number().nullable().optional(),
      rootPlaceId: z.number().nullable().optional(),
      universeId: z.number().nullable().optional(),
      gameId: z.string().nullable().optional(),
      lastOnline: z.string().nullable().optional(),
    })
  ),
});

/**
 * Consulta presença em LOTE. Endpoint legacy público (sem cookies).
 * Retorna apenas entradas reconhecidas; usuários ausentes ficam UNKNOWN.
 */
export async function fetchPresenceBatch(
  robloxUserIds: number[]
): Promise<RobloxPresenceEntry[]> {
  const res = await robloxFetch(
    "https://presence.roblox.com/v1/presence/users",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: robloxUserIds.slice(0, 100) }),
    }
  );
  if (!res.ok) {
    throw new RobloxApiError(res.status, `Presence falhou (${res.status}).`);
  }
  const parsed = PresenceResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    throw new RobloxApiError(
      res.status || 500,
      "Resposta de presence inválida."
    );
  }
  return parsed.data.userPresences.map(p => ({
    robloxUserId: String(p.userId),
    status:
      PRESENCE_TYPE_MAP[p.userPresenceType as keyof typeof PRESENCE_TYPE_MAP] ??
      "UNKNOWN",
    lastLocation: p.lastLocation ?? null,
    placeId: p.placeId ?? null,
    rootPlaceId: p.rootPlaceId ?? null,
    universeId: p.universeId ?? null,
    gameId: p.gameId ?? null,
  }));
}

// ── Experiência + thumbnail ──────────────────────────────────

export const GameMetadata = z.object({
  data: z
    .array(
      z.object({
        id: z.number(),
        rootPlaceId: z.number().nullable().optional(),
        name: z.string().nullable().optional(),
        creator: z
          .object({ name: z.string().nullable().optional() })
          .optional(),
      })
    )
    .min(1),
});

export async function fetchGameMetadata(universeId: number): Promise<{
  name: string;
  creatorName: string | null;
  rootPlaceId: number | null;
} | null> {
  const res = await robloxFetch(
    `https://games.roblox.com/v1/games?universeIds=${universeId}`
  );
  if (!res.ok) return null;
  const parsed = GameMetadata.safeParse(await res.json().catch(() => null));
  const g = parsed.success ? parsed.data.data[0] : null;
  // Sem autenticação o Roblox responde "[TITLE UNAVAILABLE]" — não é dado real.
  if (!g || !g.name || g.name.startsWith("[")) return null;
  return {
    name: g.name,
    creatorName: g.creator?.name ?? null,
    rootPlaceId: g.rootPlaceId ?? null,
  };
}

/**
 * Enriquecimento OPCIONAL via Open Cloud (requer ROBLOX_OPEN_CLOUD_API_KEY).
 * Sem a chave, o nome vem do campo `lastLocation` do presence (dado oficial
 * retornado pelo próprio endpoint de presença).
 */
export async function fetchUniverseCloudV2(universeId: number): Promise<{
  displayName: string;
} | null> {
  if (!env.robloxOpenCloudKey) return null;
  try {
    const res = await robloxFetch(
      `https://apis.roblox.com/cloud/v2/universes/${universeId}`,
      { headers: { "x-api-key": env.robloxOpenCloudKey } }
    );
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      displayName?: string;
    } | null;
    return json?.displayName ? { displayName: json.displayName } : null;
  } catch {
    return null;
  }
}

export async function fetchGameThumbnail(
  universeId: number
): Promise<string | null> {
  const res = await robloxFetch(
    `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`
  );
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: { thumbnails?: { imageUrl?: string; state?: string }[] }[];
  } | null;
  const url = json?.data?.[0]?.thumbnails?.[0];
  return url?.state === "Completed" && url.imageUrl ? url.imageUrl : null;
}
