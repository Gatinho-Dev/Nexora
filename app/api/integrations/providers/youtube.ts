import { z } from "zod";
import { env } from "../../lib/env";
import { providerFetch } from "../providerHttp";
import {
  ProviderApiError,
  type ExternalIntegrationProvider,
  type ProviderTokens,
} from "../types";

const HOSTS = new Set(["oauth2.googleapis.com", "www.googleapis.com"]);
const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional().default(""),
});

async function tokenRequest(body: URLSearchParams): Promise<ProviderTokens> {
  const response = await providerFetch(
    "youtube",
    HOSTS,
    "https://oauth2.googleapis.com/token",
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
      "youtube",
      response.status,
      "Não foi possível concluir o OAuth do YouTube."
    );
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresInSeconds: parsed.data.expires_in ?? 3600,
    scopes: parsed.data.scope.split(/\s+/).filter(Boolean),
  };
}

export const youtubeProvider: ExternalIntegrationProvider = {
  id: "youtube",
  label: "YouTube",
  capabilities: {
    accountConnection: true,
    livePresence: false,
    profileLink: true,
    artwork: true,
    timestamps: false,
  },
  configured: () =>
    Boolean(
      env.googleClientId && env.googleClientSecret && env.googleRedirectUri
    ),
  enabled: () => env.youtubeIntegrationEnabled,
  buildAuthorizeUrl: ({ state, codeChallenge }) => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: env.googleRedirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      state,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent select_account",
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
    }).toString();
    return url.toString();
  },
  exchangeCode: ({ code, codeVerifier }) =>
    tokenRequest(
      new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: env.googleRedirectUri,
      })
    ),
  refreshCredentials: refreshToken =>
    tokenRequest(
      new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      })
    ),
  fetchProfile: async accessToken => {
    const response = await providerFetch(
      "youtube",
      HOSTS,
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const parsed = z
      .object({
        items: z.array(
          z.object({
            id: z.string(),
            snippet: z.object({
              title: z.string(),
              customUrl: z.string().optional(),
              thumbnails: z
                .record(z.string(), z.object({ url: z.string().url() }))
                .optional(),
            }),
          })
        ),
      })
      .safeParse(await response.json().catch(() => null));
    const channel = parsed.success ? parsed.data.items[0] : null;
    if (!response.ok || !channel) {
      throw new ProviderApiError(
        "youtube",
        response.status,
        "Nenhum canal do YouTube foi encontrado nessa conta."
      );
    }
    const thumbnails = channel.snippet.thumbnails
      ? Object.values(channel.snippet.thumbnails)
      : [];
    return {
      providerUserId: channel.id,
      username: channel.snippet.customUrl ?? channel.id,
      displayName: channel.snippet.title,
      avatarUrl: thumbnails.at(-1)?.url ?? thumbnails[0]?.url ?? null,
      profileUrl: `https://www.youtube.com/channel/${channel.id}`,
    };
  },
};
