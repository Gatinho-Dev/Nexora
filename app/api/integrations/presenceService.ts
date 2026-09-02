import { createHash } from "node:crypto";
import { and, eq, gt, inArray, or } from "drizzle-orm";
import * as schema from "@db/schema";
import type { RichPresenceActivityDTO } from "@contracts/types";
import { getDb } from "../queries/connection";
import { contactIds, sendToUsers } from "../realtime";
import { providerDbId } from "./connectionService";
import type { IntegrationProviderId, NormalizedActivity } from "./types";

const PRIORITY: Record<string, number> = {
  gaming: 10,
  streaming: 20,
  music: 30,
  coding: 40,
  watching: 50,
  activity: 60,
};

function fingerprint(activity: NormalizedActivity) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: activity.provider,
        type: activity.type,
        title: activity.title,
        details: activity.details ?? null,
        state: activity.state ?? null,
        largeImageUrl: activity.largeImageUrl ?? null,
        externalUrl: activity.externalUrl ?? null,
        isLive: activity.isLive ?? false,
      })
    )
    .digest("hex");
}

function toDto(
  row: typeof schema.richPresenceActivities.$inferSelect
): RichPresenceActivityDTO {
  return {
    id: `${row.provider}:${row.id}`,
    provider: row.provider as RichPresenceActivityDTO["provider"],
    type: row.type as RichPresenceActivityDTO["type"],
    title: row.title,
    details: row.details,
    state: row.state,
    largeImageUrl: row.largeImageUrl,
    largeImageText: row.largeImageText,
    smallImageUrl: row.smallImageUrl,
    smallImageText: row.smallImageText,
    startedAt: row.startedAt,
    endsAt: row.endsAt,
    externalUrl: row.externalUrl,
    isLive: row.isLive,
    updatedAt: row.updatedAt,
  };
}

async function broadcastActivities(userId: number) {
  const db = getDb();
  const [user] = await db
    .select({ status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user || user.status === "invisible") return;
  const audience = await contactIds(userId);
  if (!audience.size) return;
  const [rows, connections, relationships] = await Promise.all([
    db
      .select()
      .from(schema.richPresenceActivities)
      .where(
        and(
          eq(schema.richPresenceActivities.userId, userId),
          gt(schema.richPresenceActivities.expiresAt, new Date())
        )
      ),
    db
      .select()
      .from(schema.userConnections)
      .where(eq(schema.userConnections.userId, userId)),
    db
      .select({
        requesterId: schema.friendships.requesterId,
        addresseeId: schema.friendships.addresseeId,
        status: schema.friendships.status,
      })
      .from(schema.friendships)
      .where(
        or(
          eq(schema.friendships.requesterId, userId),
          eq(schema.friendships.addresseeId, userId)
        )
      ),
  ]);
  const blocked = new Set<number>();
  const friends = new Set<number>();
  for (const relation of relationships) {
    const other =
      relation.requesterId === userId
        ? relation.addresseeId
        : relation.requesterId;
    if (relation.status === "BLOCKED") blocked.add(other);
    if (relation.status === "ACCEPTED") friends.add(other);
  }
  for (const viewerId of audience) {
    const visible = blocked.has(viewerId)
      ? []
      : rows
          .filter(row => {
            const connection = connections.find(
              item =>
                item.provider ===
                providerDbId(row.provider as IntegrationProviderId)
            );
            if (!connection?.showOnProfile || !connection.showActivity)
              return false;
            if (connection.activityVisibility === "private") return false;
            return (
              connection.activityVisibility !== "friends" ||
              friends.has(viewerId)
            );
          })
          .sort((a, b) => (PRIORITY[a.type] ?? 99) - (PRIORITY[b.type] ?? 99))
          .slice(0, 2)
          .map(row => {
            const dto = toDto(row);
            const connection = connections.find(
              item =>
                item.provider ===
                providerDbId(row.provider as IntegrationProviderId)
            );
            if (connection && !connection.showDetails)
              redactActivity(dto, row.provider);
            return dto;
          });
    sendToUsers([viewerId], {
      t: "rich-presence:update",
      userId,
      activities: visible,
    });
  }
}

export async function rebroadcastActivities(userId: number) {
  await broadcastActivities(userId);
}

function redactActivity(dto: RichPresenceActivityDTO, provider: string) {
  dto.title =
    provider === "spotify"
      ? "Ouvindo Spotify"
      : provider === "twitch"
        ? "Ao vivo na Twitch"
        : `Atividade no ${provider}`;
  dto.details = null;
  dto.state = null;
  dto.largeImageUrl = null;
  dto.endsAt = null;
}

export async function persistActivity(
  userId: number,
  activity: NormalizedActivity | null
) {
  if (!activity) return clearActivity(userId);
  const hash = fingerprint(activity);
  const db = getDb();
  const [previous] = await db
    .select({ fingerprint: schema.richPresenceActivities.fingerprint })
    .from(schema.richPresenceActivities)
    .where(
      and(
        eq(schema.richPresenceActivities.userId, userId),
        eq(schema.richPresenceActivities.provider, activity.provider)
      )
    )
    .limit(1);
  const now = new Date();
  const values = {
    userId,
    provider: activity.provider,
    type: activity.type,
    title: activity.title.slice(0, 200),
    details: activity.details?.slice(0, 240) ?? null,
    state: activity.state?.slice(0, 240) ?? null,
    largeImageUrl: activity.largeImageUrl ?? null,
    largeImageText: activity.largeImageText?.slice(0, 200) ?? null,
    smallImageUrl: activity.smallImageUrl ?? null,
    smallImageText: activity.smallImageText?.slice(0, 200) ?? null,
    startedAt: activity.startedAt ?? null,
    endsAt: activity.endsAt ?? null,
    externalUrl: activity.externalUrl ?? null,
    isLive: activity.isLive ?? false,
    fingerprint: hash,
    fetchedAt: now,
    expiresAt: new Date(now.getTime() + activity.ttlMs),
  };
  await db
    .insert(schema.richPresenceActivities)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
  if (previous?.fingerprint !== hash)
    void broadcastActivities(userId).catch(() => {});
}

export async function clearActivity(
  userId: number,
  provider?: IntegrationProviderId
) {
  const db = getDb();
  const condition = provider
    ? and(
        eq(schema.richPresenceActivities.userId, userId),
        eq(schema.richPresenceActivities.provider, provider)
      )
    : eq(schema.richPresenceActivities.userId, userId);
  const existing = await db
    .select({ id: schema.richPresenceActivities.id })
    .from(schema.richPresenceActivities)
    .where(condition)
    .limit(1);
  if (!existing.length) return;
  await db.delete(schema.richPresenceActivities).where(condition);
  void broadcastActivities(userId).catch(() => {});
}

async function relationshipAllows(
  ownerId: number,
  viewerId: number,
  visibility: string
) {
  if (ownerId === viewerId || visibility === "everyone") return true;
  if (visibility === "private") return false;
  const [friend] = await getDb()
    .select({ id: schema.friendships.id })
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.status, "ACCEPTED"),
        or(
          and(
            eq(schema.friendships.requesterId, ownerId),
            eq(schema.friendships.addresseeId, viewerId)
          ),
          and(
            eq(schema.friendships.requesterId, viewerId),
            eq(schema.friendships.addresseeId, ownerId)
          )
        )
      )
    )
    .limit(1);
  return Boolean(friend);
}

export async function visibleActivitiesFor(ownerId: number, viewerId: number) {
  const db = getDb();
  if (ownerId !== viewerId) {
    const [owner] = await db
      .select({ status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, ownerId))
      .limit(1);
    if (!owner || owner.status === "invisible" || owner.status === "offline")
      return [];
    const [blocked] = await db
      .select({ id: schema.friendships.id })
      .from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.status, "BLOCKED"),
          or(
            and(
              eq(schema.friendships.requesterId, ownerId),
              eq(schema.friendships.addresseeId, viewerId)
            ),
            and(
              eq(schema.friendships.requesterId, viewerId),
              eq(schema.friendships.addresseeId, ownerId)
            )
          )
        )
      )
      .limit(1);
    if (blocked) return [];
  }

  const rows = await db
    .select()
    .from(schema.richPresenceActivities)
    .where(
      and(
        eq(schema.richPresenceActivities.userId, ownerId),
        gt(schema.richPresenceActivities.expiresAt, new Date())
      )
    );
  const connections = await db
    .select()
    .from(schema.userConnections)
    .where(eq(schema.userConnections.userId, ownerId));
  const visible: RichPresenceActivityDTO[] = [];
  for (const row of rows) {
    const connection = connections.find(
      item =>
        item.provider === providerDbId(row.provider as IntegrationProviderId)
    );
    if (!connection?.showOnProfile || !connection.showActivity) continue;
    if (
      !(await relationshipAllows(
        ownerId,
        viewerId,
        connection.activityVisibility
      ))
    )
      continue;
    const dto = toDto(row);
    if (!connection.showDetails && ownerId !== viewerId) {
      redactActivity(dto, row.provider);
    }
    visible.push(dto);
  }
  return visible
    .sort((a, b) => (PRIORITY[a.type] ?? 99) - (PRIORITY[b.type] ?? 99))
    .slice(0, 2);
}

/** Compact list summary without one query per friend or direct message. */
export async function visibleActivitySummariesFor(
  requestedOwnerIds: number[],
  viewerId: number
) {
  const ownerIds = [...new Set(requestedOwnerIds)]
    .filter(id => Number.isInteger(id) && id > 0)
    .slice(0, 100);
  const result: Record<number, RichPresenceActivityDTO | null> = {};
  for (const id of ownerIds) result[id] = null;
  if (!ownerIds.length) return result;

  const db = getDb();
  const [owners, rows, connections, relationships] = await Promise.all([
    db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(inArray(schema.users.id, ownerIds)),
    db
      .select()
      .from(schema.richPresenceActivities)
      .where(
        and(
          inArray(schema.richPresenceActivities.userId, ownerIds),
          gt(schema.richPresenceActivities.expiresAt, new Date())
        )
      ),
    db
      .select()
      .from(schema.userConnections)
      .where(inArray(schema.userConnections.userId, ownerIds)),
    db
      .select({
        requesterId: schema.friendships.requesterId,
        addresseeId: schema.friendships.addresseeId,
        status: schema.friendships.status,
      })
      .from(schema.friendships)
      .where(
        or(
          and(
            eq(schema.friendships.requesterId, viewerId),
            inArray(schema.friendships.addresseeId, ownerIds)
          ),
          and(
            eq(schema.friendships.addresseeId, viewerId),
            inArray(schema.friendships.requesterId, ownerIds)
          )
        )
      ),
  ]);

  const ownerStatus = new Map(owners.map(owner => [owner.id, owner.status]));
  const friends = new Set<number>();
  const blocked = new Set<number>();
  for (const relationship of relationships) {
    const otherId =
      relationship.requesterId === viewerId
        ? relationship.addresseeId
        : relationship.requesterId;
    if (relationship.status === "ACCEPTED") friends.add(otherId);
    if (relationship.status === "BLOCKED") blocked.add(otherId);
  }

  for (const ownerId of ownerIds) {
    if (
      ownerId !== viewerId &&
      (blocked.has(ownerId) ||
        ownerStatus.get(ownerId) === "offline" ||
        ownerStatus.get(ownerId) === "invisible")
    ) {
      continue;
    }
    const visible = rows
      .filter(row => row.userId === ownerId)
      .filter(row => {
        const connection = connections.find(
          item =>
            item.userId === ownerId &&
            item.provider ===
              providerDbId(row.provider as IntegrationProviderId)
        );
        if (!connection?.showOnProfile || !connection.showActivity)
          return false;
        if (ownerId === viewerId) return true;
        if (connection.activityVisibility === "private") return false;
        return (
          connection.activityVisibility !== "friends" || friends.has(ownerId)
        );
      })
      .sort((a, b) => (PRIORITY[a.type] ?? 99) - (PRIORITY[b.type] ?? 99));
    const primary = visible[0];
    if (!primary) continue;
    const dto = toDto(primary);
    const connection = connections.find(
      item =>
        item.userId === ownerId &&
        item.provider ===
          providerDbId(primary.provider as IntegrationProviderId)
    );
    if (connection && !connection.showDetails && ownerId !== viewerId)
      redactActivity(dto, primary.provider);
    result[ownerId] = dto;
  }
  return result;
}
