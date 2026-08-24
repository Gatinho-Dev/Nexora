import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { publicFileUrl } from "../lib/urls";
import type { GroupRole } from "@contracts/constants";
import type { PublicUser } from "@contracts/types";
import { buildFallbackGroupName } from "../utils/groupPermissions";
import { toPublicUser } from "../utils/permissions";

type DbExecutor = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<DbExecutor["transaction"]>[0]>[0];

/** Loads all members (with users) of a conversation in one batched query. */
export async function loadMembers(conversationId: number): Promise<
  Array<{ user: PublicUser; role: GroupRole; joinedAt: Date }>
> {
  const db = getDb();
  const rows = await db
    .select({
      role: schema.conversationMembers.role,
      joinedAt: schema.conversationMembers.joinedAt,
      user: schema.users,
    })
    .from(schema.conversationMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.conversationMembers.userId))
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  return rows.map(r => ({
    user: toPublicUser(r.user),
    role: r.role as GroupRole,
    joinedAt: r.joinedAt,
  }));
}

/** Display name: custom name or generated from participant names. */
export function resolveGroupName(
  conversation: { name: string | null },
  memberUsers: Array<{ name: string | null; username: string | null }>,
): string | null {
  if (conversation.name?.trim()) return conversation.name.trim();
  if (memberUsers.length === 0) return null;
  return buildFallbackGroupName(
    memberUsers.map(u => u.name ?? u.username ?? "Usuário"),
  );
}

/** Inserts a discreet system event message (tag="system"). */
export async function insertSystemMessage(
  executor: DbExecutor | Tx,
  conversationId: number,
  authorId: number,
  content: string,
) {
  await executor.insert(schema.messages).values({
    conversationId,
    authorId,
    content: content.slice(0, 4000),
    tag: "system",
  });
}

export async function userName(userId: number): Promise<string> {
  const u = await getDb().query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  return u?.name ?? u?.username ?? "Alguém";
}

/**
 * Same admission rule as DMs: an ACCEPTED friendship or a shared server.
 * Blocked relationships never allow adding (groups must not bypass blocks).
 */
export async function canBeAddedBy(creatorId: number, targetId: number): Promise<boolean> {
  const db = getDb();
  const friendship = await db.query.friendships.findFirst({
    where: sql`(${schema.friendships.requesterId} = ${creatorId} AND ${schema.friendships.addresseeId} = ${targetId})
      OR (${schema.friendships.requesterId} = ${targetId} AND ${schema.friendships.addresseeId} = ${creatorId})`,
  });
  if (!friendship) {
    const myServers = await db
      .select({ serverId: schema.serverMembers.serverId })
      .from(schema.serverMembers)
      .where(eq(schema.serverMembers.userId, creatorId));
    for (const s of myServers) {
      const shared = await db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, s.serverId),
          eq(schema.serverMembers.userId, targetId),
        ),
      });
      if (shared) return true;
    }
    return false;
  }
  return friendship.status === "ACCEPTED";
}

/** True when a BLOCKED row exists between two users in either direction. */
export async function blockedBetween(a: number, b: number): Promise<boolean> {
  const row = await getDb().query.friendships.findFirst({
    where: sql`(${schema.friendships.requesterId} = ${a} AND ${schema.friendships.addresseeId} = ${b})
      OR (${schema.friendships.requesterId} = ${b} AND ${schema.friendships.addresseeId} = ${a})`,
  });
  return row?.status === "BLOCKED";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteDto(
  row: typeof schema.groupInvites.$inferSelect,
  code?: string,
) {
  return {
    id: row.id,
    code,
    url: code ? `/invite/group/${code}` : undefined,
    createdByUserId: row.createdByUserId,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses,
    uses: row.uses,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

/** Validates that the file exists, belongs to the uploader and is an image. */
export async function avatarUrlFromFile(
  fileId: number | undefined | null,
  uploaderId: number,
): Promise<string | null> {
  if (!fileId) return null;
  const file = await getDb().query.files.findFirst({
    where: eq(schema.files.id, fileId),
  });
  if (!file || file.uploaderId !== uploaderId) {
    throw new Error("Arquivo de imagem inválido.");
  }
  if (!file.mimeType.startsWith("image/")) {
    throw new Error("A imagem do grupo deve ser um arquivo de imagem.");
  }
  return publicFileUrl(file.id);
}
