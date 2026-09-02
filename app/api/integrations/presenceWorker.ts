import { and, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { env } from "../lib/env";
import { getDb } from "../queries/connection";
import { isUserOnline } from "../realtime";
import {
  isAuthFailure,
  markConnectionError,
  validAccessToken,
} from "./connectionService";
import { livePresenceProviders } from "./registry";
import { clearActivity, persistActivity } from "./presenceService";
import { ProviderApiError } from "./types";

const backoffUntil = new Map<string, number>();
let timer: NodeJS.Timeout | null = null;
let running = false;

export const externalPresenceMetrics = {
  refreshes: 0,
  updates: 0,
  rateLimited: 0,
  errors: 0,
};

async function refreshProvider(
  provider: (typeof livePresenceProviders)[number]
) {
  if (!provider.enabled() || !provider.configured()) return;
  if ((backoffUntil.get(provider.id) ?? 0) > Date.now()) return;
  const rows = await getDb()
    .select({
      userId: schema.userConnections.userId,
      providerUserId: schema.userConnections.providerUserId,
      username: schema.userConnections.username,
      displayName: schema.userConnections.displayName,
      avatarUrl: schema.userConnections.avatarUrl,
      profileUrl: schema.userConnections.profileUrl,
      lastSeenAt: schema.users.lastSeenAt,
    })
    .from(schema.userConnections)
    .innerJoin(schema.users, eq(schema.users.id, schema.userConnections.userId))
    .where(
      and(
        eq(schema.userConnections.provider, provider.id.toUpperCase()),
        eq(schema.userConnections.needsReauth, false),
        eq(schema.userConnections.showActivity, true)
      )
    )
    .limit(300);
  const targets = rows.filter(row => {
    if (isUserOnline(row.userId)) return true;
    const lastSeen = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : 0;
    return (
      Date.now() - lastSeen < 10 * 60_000 &&
      Math.floor(Date.now() / 60_000) % 5 === 0
    );
  });
  for (let index = 0; index < targets.length; index += 5) {
    await Promise.all(
      targets.slice(index, index + 5).map(async row => {
        try {
          const token = await validAccessToken(row.userId, provider.id);
          if (!token || !provider.fetchPresence) return;
          const activity = await provider.fetchPresence(token, {
            providerUserId: row.providerUserId,
            username: row.username,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            profileUrl: row.profileUrl,
          });
          if (activity) await persistActivity(row.userId, activity);
          else await clearActivity(row.userId, provider.id);
          externalPresenceMetrics.updates += 1;
        } catch (error) {
          externalPresenceMetrics.errors += 1;
          if (isAuthFailure(error)) {
            await markConnectionError(
              row.userId,
              provider.id,
              "reauth_required"
            );
            await clearActivity(row.userId, provider.id);
          }
          if (error instanceof ProviderApiError && error.status === 429) {
            externalPresenceMetrics.rateLimited += 1;
            backoffUntil.set(
              provider.id,
              Date.now() + (error.retryAfterMs ?? 120_000)
            );
          }
        }
      })
    );
  }
  externalPresenceMetrics.refreshes += 1;
}

export async function refreshExternalPresenceOnce() {
  if (running) return;
  running = true;
  try {
    for (const provider of livePresenceProviders)
      await refreshProvider(provider);
  } finally {
    running = false;
  }
}

export function startExternalPresenceWorker() {
  if (timer) return;
  const schedule = () => {
    const jitter = Math.round(
      env.externalPresenceIntervalMs * (0.9 + Math.random() * 0.2)
    );
    timer = setTimeout(() => {
      void refreshExternalPresenceOnce().finally(schedule);
    }, jitter);
    timer.unref?.();
  };
  schedule();
}
