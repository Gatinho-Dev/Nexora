import { z } from "zod";
import { env } from "../../lib/env";
import { basicAuthorization, providerFetch } from "../providerHttp";
import {
  ProviderApiError,
  type ExternalIntegrationProvider,
  type ProviderTokens,
} from "../types";

const HOSTS = new Set(["accounts.spotify.com", "api.spotify.com"]);

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional().default(""),
});

async function tokenRequest(body: URLSearchParams): Promise<ProviderTokens> {
  const response = await providerFetch(
    "spotify",
    HOSTS,
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthorization(
          env.spotifyClientId,
          env.spotifyClientSecret
        ),
      },
      body: body.toString(),
    }
  );
  const parsed = TokenResponse.safeParse(
    await response.json().catch(() => null)
  );
  if (!response.ok || !parsed.success) {
    throw new ProviderApiError(
      "spotify",
      response.status,
      "Não foi possível concluir o OAuth do Spotify."
    );
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresInSeconds: parsed.data.expires_in ?? 3600,
    scopes: parsed.data.scope.split(/\s+/).filter(Boolean),
  };
}

export const spotifyProvider: ExternalIntegrationProvider = {
  id: "spotify",
  label: "Spotify",
  capabilities: {
    accountConnection: true,
    livePresence: true,
    profileLink: true,
    artwork: true,
    timestamps: true,
  },
  configured: () =>
    Boolean(
      env.spotifyClientId && env.spotifyClientSecret && env.spotifyRedirectUri
    ),
  enabled: () => env.spotifyIntegrationEnabled,
  buildAuthorizeUrl: ({ state, codeChallenge }) => {
    const url = new URL("https://accounts.spotify.com/authorize");
    url.search = new URLSearchParams({
      client_id: env.spotifyClientId,
      response_type: "code",
      redirect_uri: env.spotifyRedirectUri,
      scope:
        "user-read-private user-read-currently-playing user-read-playback-state",
      state,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      show_dialog: "true",
    }).toString();
    return url.toString();
  },
  exchangeCode: ({ code, codeVerifier }) =>
    tokenRequest(
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.spotifyRedirectUri,
        code_verifier: codeVerifier,
      })
    ),
  refreshCredentials: refreshToken =>
    tokenRequest(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      })
    ),
  fetchProfile: async accessToken => {
    const response = await providerFetch(
      "spotify",
      HOSTS,
      "https://api.spotify.com/v1/me",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const parsed = z
      .object({
        id: z.string(),
        display_name: z.string().nullable().optional(),
        images: z.array(z.object({ url: z.string().url() })).optional(),
        external_urls: z
          .object({ spotify: z.string().url().optional() })
          .optional(),
      })
      .safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      throw new ProviderApiError(
        "spotify",
        response.status,
        "Não foi possível ler o perfil do Spotify."
      );
    }
    return {
      providerUserId: parsed.data.id,
      username: parsed.data.id,
      displayName: parsed.data.display_name ?? null,
      avatarUrl: parsed.data.images?.[0]?.url ?? null,
      profileUrl: parsed.data.external_urls?.spotify ?? null,
    };
  },
  fetchPresence: async accessToken => {
    const response = await providerFetch(
      "spotify",
      HOSTS,
      "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (response.status === 204) return null;
    const parsed = z
      .object({
        is_playing: z.boolean(),
        progress_ms: z.number().nullable().optional(),
        item: z
          .object({
            name: z.string(),
            duration_ms: z.number().positive(),
            artists: z.array(z.object({ name: z.string() })),
            album: z.object({
              name: z.string(),
              images: z.array(z.object({ url: z.string().url() })),
            }),
            external_urls: z
              .object({ spotify: z.string().url().optional() })
              .optional(),
          })
          .nullable(),
      })
      .safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      throw new ProviderApiError(
        "spotify",
        response.status,
        "Não foi possível consultar a reprodução do Spotify."
      );
    }
    if (!parsed.data.is_playing || !parsed.data.item) return null;
    const progress = Math.max(0, parsed.data.progress_ms ?? 0);
    const now = Date.now();
    return {
      provider: "spotify",
      type: "music",
      title: parsed.data.item.name,
      details: parsed.data.item.artists.map(artist => artist.name).join(", "),
      state: parsed.data.item.album.name,
      largeImageUrl: parsed.data.item.album.images[0]?.url ?? null,
      largeImageText: parsed.data.item.album.name,
      startedAt: new Date(now - progress),
      endsAt: new Date(
        now + Math.max(0, parsed.data.item.duration_ms - progress)
      ),
      externalUrl: parsed.data.item.external_urls?.spotify ?? null,
      ttlMs: 90_000,
    };
  },
};
