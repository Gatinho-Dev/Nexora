import { env } from "../lib/env";
import { githubProvider } from "./providers/github";
import { spotifyProvider } from "./providers/spotify";
import { twitchProvider } from "./providers/twitch";
import { youtubeProvider } from "./providers/youtube";
import type {
  ExternalIntegrationProvider,
  IntegrationProviderId,
  ProviderCapabilities,
} from "./types";

const externalProviders = [
  spotifyProvider,
  youtubeProvider,
  twitchProvider,
  githubProvider,
] as const;

const byId = new Map(
  externalProviders.map(provider => [provider.id, provider])
);

export function getExternalProvider(
  id: string
): ExternalIntegrationProvider | null {
  return byId.get(id as ExternalIntegrationProvider["id"]) ?? null;
}

export function listProviderDefinitions(): Array<{
  id: IntegrationProviderId;
  label: string;
  configured: boolean;
  enabled: boolean;
  capabilities: ProviderCapabilities;
}> {
  return [
    ...externalProviders.map(provider => ({
      id: provider.id,
      label: provider.label,
      configured: provider.configured(),
      enabled: provider.enabled(),
      capabilities: provider.capabilities,
    })),
    {
      id: "roblox" as const,
      label: "Roblox",
      configured: Boolean(
        env.robloxClientId && env.robloxClientSecret && env.robloxRedirectUri
      ),
      enabled: env.robloxIntegrationEnabled,
      capabilities: {
        accountConnection: true as const,
        livePresence: true,
        profileLink: true,
        artwork: true,
        timestamps: true,
      },
    },
  ];
}

export const livePresenceProviders = externalProviders.filter(
  provider => provider.capabilities.livePresence && provider.fetchPresence
);
