import { z } from "zod";
import { env } from "../../lib/env";
import { providerFetch } from "../providerHttp";
import {
  ProviderApiError,
  type ExternalIntegrationProvider,
  type ProviderTokens,
} from "../types";

const HOSTS = new Set(["id.twitch.tv", "api.twitch.tv"]);
const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive().optional(),
  scope: z.array(z.string()).optional().default([]),
});

async function tokenRequest(body: URLSearchParams): Promise<ProviderTokens> {
  const response = await providerFetch(
    "twitch",
    HOSTS,
    "https://id.twitch.tv/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );
  const parsed = TokenResponse.safeParse(
    await response.json().catch(() => null)
  );
  if (!response.ok || !parsed.success) {
    throw new ProviderApiError(
      "twitch",
      response.status,
      "Não foi possível concluir o OAuth da Twitch."
    );
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresInSeconds: parsed.data.expires_in ?? 14_400,
    scopes: parsed.data.scope,
  };
}

function helixHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": env.twitchClientId,
  };
}

export const twitchProvider: ExternalIntegrationProvider = {
  id: "twitch",
  label: "Twitch",
  capabilities: {
    accountConnection: true,
    livePresence: true,
    profileLink: true,
    artwork: true,
    timestamps: true,
  },
  configured: () =>
    Boolean(
      env.twitchClientId && env.twitchClientSecret && env.twitchRedirectUri
    ),
  enabled: () => env.twitchIntegrationEnabled,
  buildAuthorizeUrl: ({ state }) => {
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: env.twitchClientId,
      redirect_uri: env.twitchRedirectUri,
      response_type: "code",
      scope: "",
      state,
      force_verify: "true",
    }).toString();
    return url.toString();
  },
  exchangeCode: ({ code }) =>
    tokenRequest(
      new URLSearchParams({
        client_id: env.twitchClientId,
        client_secret: env.twitchClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: env.twitchRedirectUri,
      })
    ),
  refreshCredentials: refreshToken =>
    tokenRequest(
      new URLSearchParams({
        client_id: env.twitchClientId,
        client_secret: env.twitchClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      })
    ),
  fetchProfile: async accessToken => {
    const response = await providerFetch(
      "twitch",
      HOSTS,
      "https://api.twitch.tv/helix/users",
      {
        headers: helixHeaders(accessToken),
      }
    );
    const parsed = z
      .object({
        data: z.array(
          z.object({
            id: z.string(),
            login: z.string(),
            display_name: z.string(),
            profile_image_url: z.string().url().or(z.literal("")),
          })
        ),
      })
      .safeParse(await response.json().catch(() => null));
    const user = parsed.success ? parsed.data.data[0] : null;
    if (!response.ok || !user) {
      throw new ProviderApiError(
        "twitch",
        response.status,
        "Não foi possível ler o canal da Twitch."
      );
    }
    return {
      providerUserId: user.id,
      username: user.login,
      displayName: user.display_name,
      avatarUrl: user.profile_image_url || null,
      profileUrl: `https://www.twitch.tv/${user.login}`,
    };
  },
  fetchPresence: async (accessToken, profile) => {
    const url = new URL("https://api.twitch.tv/helix/streams");
    url.searchParams.set("user_id", profile.providerUserId);
    const response = await providerFetch("twitch", HOSTS, url, {
      headers: helixHeaders(accessToken),
    });
    const parsed = z
      .object({
        data: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            game_name: z.string(),
            started_at: z.string(),
            thumbnail_url: z.string(),
            type: z.string(),
          })
        ),
      })
      .safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      throw new ProviderApiError(
        "twitch",
        response.status,
        "Não foi possível consultar a live da Twitch."
      );
    }
    const stream = parsed.data.data[0];
    if (!stream || stream.type !== "live") return null;
    return {
      provider: "twitch",
      type: "streaming",
      title: stream.title,
      details: stream.game_name || "Ao vivo na Twitch",
      state: `@${profile.username ?? profile.displayName ?? "twitch"}`,
      largeImageUrl: stream.thumbnail_url
        .replace("{width}", "640")
        .replace("{height}", "360"),
      startedAt: new Date(stream.started_at),
      externalUrl: profile.profileUrl,
      isLive: true,
      ttlMs: 150_000,
    };
  },
};
