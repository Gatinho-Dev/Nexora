import { z } from "zod";
import { env } from "../../lib/env";
import { providerFetch } from "../providerHttp";
import { ProviderApiError, type ExternalIntegrationProvider } from "../types";

const HOSTS = new Set(["github.com", "api.github.com"]);

export const githubProvider: ExternalIntegrationProvider = {
  id: "github",
  label: "GitHub",
  capabilities: {
    accountConnection: true,
    livePresence: false,
    profileLink: true,
    artwork: true,
    timestamps: false,
  },
  configured: () =>
    Boolean(
      env.githubClientId && env.githubClientSecret && env.githubRedirectUri
    ),
  enabled: () => env.githubIntegrationEnabled,
  buildAuthorizeUrl: ({ state, codeChallenge }) => {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: env.githubClientId,
      redirect_uri: env.githubRedirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    return url.toString();
  },
  exchangeCode: async ({ code, codeVerifier }) => {
    const response = await providerFetch(
      "github",
      HOSTS,
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.githubClientId,
          client_secret: env.githubClientSecret,
          code,
          redirect_uri: env.githubRedirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      }
    );
    const parsed = z
      .object({
        access_token: z.string().min(1),
        scope: z.string().optional().default(""),
      })
      .safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      throw new ProviderApiError(
        "github",
        response.status,
        "Não foi possível concluir o OAuth do GitHub."
      );
    }
    return {
      accessToken: parsed.data.access_token,
      refreshToken: null,
      expiresInSeconds: null,
      scopes: parsed.data.scope
        .split(",")
        .map(scope => scope.trim())
        .filter(Boolean),
    };
  },
  fetchProfile: async accessToken => {
    const response = await providerFetch(
      "github",
      HOSTS,
      "https://api.github.com/user",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Nexora-Rich-Presence",
        },
      }
    );
    const parsed = z
      .object({
        id: z.number(),
        login: z.string(),
        name: z.string().nullable().optional(),
        avatar_url: z.string().url(),
        html_url: z.string().url(),
      })
      .safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      throw new ProviderApiError(
        "github",
        response.status,
        "Não foi possível ler o perfil do GitHub."
      );
    }
    return {
      providerUserId: String(parsed.data.id),
      username: parsed.data.login,
      displayName: parsed.data.name ?? parsed.data.login,
      avatarUrl: parsed.data.avatar_url,
      profileUrl: parsed.data.html_url,
    };
  },
};
