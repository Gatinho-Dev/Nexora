import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import {
  ALL_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  type Permission,
} from "@contracts/constants";
import type { PublicUser } from "@contracts/types";

export function toPublicUser(u: typeof schema.users.$inferSelect): PublicUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    banner: u.banner,
    bio: u.bio,
    status: u.status,
  };
}

/** Returns the effective permission set of a user inside a server, or null if not a member. */
export async function getMemberPermissions(
  userId: number,
  serverId: number,
): Promise<Set<Permission> | null> {
  const db = getDb();
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverId),
  });
  if (!server) return null;

  const member = await db.query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.serverId, serverId),
      eq(schema.serverMembers.userId, userId),
    ),
  });
  if (!member) return null;
  if (server.ownerId === userId) return new Set(ALL_PERMISSIONS);

  const allRoles = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.serverId, serverId));
  const myRoleRows = await db
    .select()
    .from(schema.memberRoles)
    .where(
      and(
        eq(schema.memberRoles.serverId, serverId),
        eq(schema.memberRoles.userId, userId),
      ),
    );
  const myRoleIds = new Set(myRoleRows.map((r) => r.roleId));

  const perms = new Set<Permission>();
  for (const role of allRoles) {
    if (role.isDefault || myRoleIds.has(role.id)) {
      for (const p of role.permissions ?? []) perms.add(p as Permission);
    }
  }
  if (perms.has("ADMINISTRATOR")) return new Set(ALL_PERMISSIONS);
  // Servidores criados antes da feature de permissões podem não ter cargo
  // nenhum (ou cargos sem as flags básicas). Sem isso, membros comuns ficariam
  // sem VIEW_CHANNEL e veriam o servidor "vazio". Overrides de canal continuam
  // podendo negar tudo depois — o fallback só restaura o comportamento antigo.
  if (perms.size === 0) return new Set(DEFAULT_MEMBER_PERMISSIONS);
  return perms;
}

/** Throws FORBIDDEN unless the user is a member holding the given permission. */
export async function requirePermission(
  userId: number,
  serverId: number,
  permission: Permission,
): Promise<Set<Permission>> {
  const perms = await getMemberPermissions(userId, serverId);
  if (!perms) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não é membro deste servidor.",
    });
  }
  if (!perms.has(permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem permissão para fazer isso.",
    });
  }
  return perms;
}

/** Verifies channel access: user must be a member of the channel's server. Returns the channel. */
/**
 * Effective permissions for a specific channel:
 * member roles → category overrides (when synced) → channel overrides
 * (when the channel has its own rules). Pure allow/deny application.
 */
export async function getEffectiveChannelPermissions(
  userId: number,
  channel: typeof schema.channels.$inferSelect
): Promise<Set<Permission> | null> {
  const db = getDb();
  const serverId = channel.serverId;
  const base = await getMemberPermissions(userId, serverId);
  if (!base) return null;
  const perms = new Set<Permission>(base);

  // Get user's role IDs for this server
  const myRoleRows = await db
    .select({ roleId: schema.memberRoles.roleId })
    .from(schema.memberRoles)
    .where(
      and(
        eq(schema.memberRoles.serverId, serverId),
        eq(schema.memberRoles.userId, userId),
      ),
    );
  const myRoleIds = new Set(myRoleRows.map(r => r.roleId));

  const targets: Array<"category" | "channel"> = [];
  if (channel.categoryId && channel.syncedWithCategory) targets.push("category");
  if (!channel.syncedWithCategory) targets.push("channel");

  for (const targetType of targets) {
    const targetId = targetType === "category" ? channel.categoryId! : channel.id;
    const overrides = await db
      .select()
      .from(schema.permissionOverrides)
      .where(
        and(
          eq(schema.permissionOverrides.targetType, targetType),
          eq(schema.permissionOverrides.targetId, targetId),
        ),
      );
    for (const ov of overrides) {
      let applies = false;
      if (ov.roleId === null && ov.memberId === null) {
        applies = true; // @everyone
      } else if (ov.roleId !== null) {
        applies = myRoleIds.has(ov.roleId);
      } else if (ov.memberId !== null) {
        applies = ov.memberId === userId;
      }
      if (!applies) continue;
      for (const d of ov.deny ?? []) perms.delete(d as Permission);
      for (const a of ov.allow ?? []) perms.add(a as Permission);
    }
  }
  return perms;
}

/** Loads a channel enforcing VIEW_CHANNEL — hidden channels are invisible. */
export async function requireChannelAccess(userId: number, channelId: number) {
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelId),
  });
  if (!channel) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Canal não encontrado." });
  }
  const perms = await getEffectiveChannelPermissions(userId, channel);
  if (!perms || !perms.has("VIEW_CHANNEL")) {
    // Hidden means hidden: indistinguishable from a nonexistent channel.
    throw new TRPCError({ code: "NOT_FOUND", message: "Canal não encontrado." });
  }
  return { channel, perms };
}

/** Verifies the user belongs to a DM conversation. */
export async function requireConversationAccess(
  userId: number,
  conversationId: number,
) {
  const db = getDb();
  const member = await db.query.conversationMembers.findFirst({
    where: and(
      eq(schema.conversationMembers.conversationId, conversationId),
      eq(schema.conversationMembers.userId, userId),
    ),
  });
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não participa desta conversa.",
    });
  }
  return member;
}
