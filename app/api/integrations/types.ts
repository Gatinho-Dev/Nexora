export type IntegrationProviderId =
  "spotify" | "youtube" | "twitch" | "github" | "roblox";

export type ProviderCapabilities = {
  accountConnection: true;
  livePresence: boolean;
  profileLink: boolean;
  artwork: boolean;
  timestamps: boolean;
};

export type ProviderTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  scopes: string[];
};

export type ProviderProfile = {
  providerUserId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

export type NormalizedActivity = {
  provider: IntegrationProviderId;
  type: "music" | "gaming" | "streaming" | "watching" | "coding" | "activity";
  title: string;
  details?: string | null;
  state?: string | null;
  largeImageUrl?: string | null;
  largeImageText?: string | null;
  smallImageUrl?: string | null;
  smallImageText?: string | null;
  startedAt?: Date | null;
  endsAt?: Date | null;
  externalUrl?: string | null;
  isLive?: boolean;
  ttlMs: number;
};

export interface ExternalIntegrationProvider {
  id: Exclude<IntegrationProviderId, "roblox">;
  label: string;
  capabilities: ProviderCapabilities;
  configured(): boolean;
  enabled(): boolean;
  buildAuthorizeUrl(input: {
    state: string;
    codeChallenge: string;
    nonce: string;
  }): string;
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
  }): Promise<ProviderTokens>;
  refreshCredentials?(refreshToken: string): Promise<ProviderTokens>;
  fetchProfile(accessToken: string): Promise<ProviderProfile>;
  fetchPresence?(
    accessToken: string,
    profile: ProviderProfile
  ): Promise<NormalizedActivity | null>;
  revoke?(accessToken: string): Promise<void>;
}

export class ProviderApiError extends Error {
  readonly provider: IntegrationProviderId;
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(
    provider: IntegrationProviderId,
    status: number,
    message: string,
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.provider = provider;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}
