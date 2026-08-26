import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { env } from "../../lib/env";
import { contactIds, sendToUsers, isUserOnline } from "../../realtime";
import {
  fetchPresenceBatch,
  fetchGameMetadata,
  fetchGameThumbnail,
  fetchUniverseCloudV2,
  RobloxApiError,
  type RobloxPresenceEntry,
} from "./client";

/**
 * RobloxPresenceWorker — polling adaptativo em lote.
 *
 * Roblox → Worker (batch) → roblox_activity (cache persistente)
 *        → WS `activity:update` para contactIds do usuário
 *
 * - Intervalo ~60s com jitter; usuários offline na Nexora são checados a
 *   cada 5 min; nunca 1 request por usuário.
 * - Rate limit 429: backoff exponencial com teto de 15 min.
 * - Circuit breaker: muitas falhas seguidas pausam o worker e marcam as
 *   atividades como stale (nunca exibir "Jogando X" eternamente).
 */

const BATCH_SIZE = 50;
let backoffUntil = 0;
let consecutiveFailures = 0;

export const robloxMetrics = {
  presenceRequests: 0,
  rateLimited: 0,
  errors: 0,
  activityUpdates: 0,
  activePlayers: 0,
};

export function robloxWorkerStatus() {
  return {
    configured:
      Boolean(env.robloxClientId && env.robloxClientSecret) &&
      env.robloxIntegrationEnabled,
    breakerOpen: Date.now() < backoffUntil,
    consecutiveFailures,
    ...robloxMetrics,
  };
}

type ActivityRow = typeof schema.robloxActivity.$inferSelect;

/** Audiência: amigos + co-membros de servidores (contactIds já faz isso). */
function broadcastActivity(
  userId: number,
  activity: {
    provider: "ROBLOX";
    status: string;
    name: string | null;
    creatorName: string | null;
    thumbnailUrl: string | null;
    startedAt: Date | null;
    universeId: number | null;
    placeId: number | null;
    playUrl: string | null;
  } | null
) {
  // Invisível na Nexora => não revelar atividade externa também.
  void (async () => {
    try {
      const [user] = await getDb()
        .select({ status: schema.users.status })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (!user || user.status === "invisible") return;
      if (activity && !activity.thumbnailUrl && activity.status === "IN_GAME") {
        // sem thumbnail ainda — segue com nome apenas
      }
      const audience = await contactIds(userId);
      sendToUsers(audience, { t: "activity:update", userId, activity });
    } catch {
      // best-effort
    }
  })();
}

async function applyPresence(entry: RobloxPresenceEntry): Promise<void> {
  const db = getDb();
  const [conn] = await db
    .select({
      userId: schema.userConnections.userId,
      showActivity: schema.userConnections.showActivity,
    })
    .from(schema.userConnections)
    .where(
      and(
        eq(schema.userConnections.provider, "ROBLOX"),
        eq(schema.userConnections.providerUserId, entry.robloxUserId)
      )
    )
    .limit(1);
  if (!conn) return;

  const [previous] = await db
    .select()
    .from(schema.robloxActivity)
    .where(eq(schema.robloxActivity.userId, conn.userId))
    .limit(1);

  // Sem mudança relevante → nada a fazer.
  const sameGame =
    previous?.universeId === entry.universeId &&
    previous?.status === entry.status;
  if (
    sameGame ||
    (entry.status === "OFFLINE" && !previous?.name && previous?.status === "OFFLINE")
  ) {
    return;
  }

  let name: string | null = null;
  let creatorName: string | null = null;
  let thumbnailUrl: string | null = previous?.thumbnailUrl ?? null;
  let playUrl: string | null = null;
  let startedAt: Date | null = null;

  const inGame = entry.status === "IN_GAME" && entry.universeId != null;
  if (inGame && entry.universeId != null) {
    // Nome: Open Cloud (opcional) → metadados → lastLocation do presence.
    const cloud = await fetchUniverseCloudV2(entry.universeId).catch(() => null);
    const gameMeta = await fetchGameMetadata(entry.universeId).catch(() => null);
    name =
      cloud?.displayName ??
      gameMeta?.name ??
      entry.lastLocation ??
      null;
    creatorName = gameMeta?.creatorName ?? null;
    playUrl =
      entry.placeId != null
        ? `https://www.roblox.com/games/${entry.placeId}`
        : null;
    // Mesmo universo => mantém startedAt original; novo jogo => agora.
    startedAt =
      previous?.universeId === entry.universeId && previous?.startedAt
        ? new Date(previous.startedAt)
        : new Date();
    if (name) {
      const thumb = await fetchGameThumbnail(entry.universeId).catch(() => null);
      thumbnailUrl = thumb ?? previous?.thumbnailUrl ?? null;
    }
  }

  const values = {
    userId: conn.userId,
    status: entry.status,
    universeId: entry.universeId ?? null,
    placeId: entry.placeId ?? null,
    name: inGame ? name : null,
    creatorName: inGame ? creatorName : null,
    thumbnailUrl: inGame ? thumbnailUrl : null,
    playUrl: inGame ? playUrl : null,
    startedAt: inGame ? startedAt : null,
    stale: false,
  };

  await db
    .insert(schema.robloxActivity)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });

  robloxMetrics.activityUpdates += 1;
  if (entry.status === "IN_GAME") robloxMetrics.activePlayers += 1;

  // Privacidade showActivity=false: persiste estado interno, não divulga.
  broadcastActivity(conn.userId, conn.showActivity ? { ...values, provider: "ROBLOX" as const } : null);
}

/** Seleção inteligente: online agora → 1 tick; offline → a cada 5 ticks. */
async function pickRobloxTargets(): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({
      robloxUserId: schema.userConnections.providerUserId,
      userId: schema.userConnections.userId,
      lastSeenAt: schema.users.lastSeenAt,
    })
    .from(schema.userConnections)
    .innerJoin(schema.users, eq(schema.users.id, schema.userConnections.userId))
    .where(
      and(
        eq(schema.userConnections.provider, "ROBLOX"),
        eq(schema.userConnections.needsReauth, false),
        eq(schema.userConnections.showActivity, true),
        isNotNull(schema.userConnections.providerUserId)
      )
    )
    .limit(500);

  const nowTick = Math.floor(Date.now() / 60_000);
  return rows
    .filter(r => {
      if (isUserOnline(r.userId)) return true;
      const seen = r.lastSeenAt ? new Date(r.lastSeenAt).getTime() : 0;
      if (nowTick % 5 !== 0) return false; // offline: 1 em cada 5 ticks (~5min)
      return Date.now() - seen < 7 * 86_400_000; // offline há dias: para
    })
    .map(r => Number(r.robloxUserId))
    .filter(n => Number.isFinite(n) && n > 0)
    .slice(0, BATCH_SIZE * 4);
}

async function pollOnce(forceIds?: number[]): Promise<void> {
  const targets = forceIds ?? await pickRobloxTargets();
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    if (Date.now() < backoffUntil) return;
    const chunk = targets.slice(i, i + BATCH_SIZE);
    try {
      const entries = await fetchPresenceBatch(chunk);
      robloxMetrics.presenceRequests += 1;
      consecutiveFailures = 0;
      for (const entry of entries) {
        if (entry.status === "UNKNOWN") continue;
        await applyPresence(entry).catch(() => {});
      }
    } catch (e) {
      if (e instanceof RobloxApiError && e.status === 429) {
        robloxMetrics.rateLimited += 1;
        consecutiveFailures += 1;
        const wait = Math.min(
          e.retryAfterMs ?? 60_000 * Math.pow(2, consecutiveFailures - 1),
          15 * 60_000
        );
        backoffUntil = Date.now() + wait + Math.floor(Math.random() * 10_000);
      } else {
        robloxMetrics.errors += 1;
        consecutiveFailures += 1;
        if (consecutiveFailures >= 5) {
          backoffUntil = Date.now() + 5 * 60_000 + Math.floor(Math.random() * 30_000);
          // Atividades ficam stale (UI pode indicar indisponibilidade).
          await markAllStale().catch(() => {});
        }
      }
    }
  }
}

async function markAllStale(): Promise<void> {
  await getDb()
    .update(schema.robloxActivity)
    .set({ stale: true })
    .where(inArray(schema.robloxActivity.status, ["IN_GAME", "ONLINE"]));
}

/** Nunca derruba o servidor principal se Roblox estiver indisponível. */
export { pollOnce };

export function startRobloxPresenceWorker(): void {
  if (!env.robloxIntegrationEnabled || !env.robloxClientId) return;
  const base = env.robloxPresenceIntervalMs;
  const schedule = () => {
    const jitter = Math.floor(Math.random() * (base * 0.2));
    setTimeout(async () => {
      try {
        await pollOnce();
      } catch {
        // worker isolado — falhas já contabilizadas
      }
      schedule();
    }, base + jitter);
  };
  schedule();
}
