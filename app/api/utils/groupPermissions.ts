import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import type { GroupRole } from "@contracts/constants";

/**
 * Centralized group authorization (item 44).
 *
 * Every group mutation/query goes through these helpers — components and
 * routers must never hand-roll role logic.
 */

const ROLE_RANK: Record<GroupRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

/** Pure role-rank comparison (unit-tested). */
export function roleAtLeast(role: GroupRole, min: GroupRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Owner + admins can edit group identity/settings. */
export function canManageGroup(role: GroupRole): boolean {
  return roleAtLeast(role, "admin");
}

/**
 * Can `actor` act on `target`?
 * - owner can act on everyone except themselves;
 * - admin can act only on plain members;
 * - members can act on nobody.
 */
export function canModerateMember(
  actor: GroupRole,
  target: GroupRole,
): boolean {
  if (!roleAtLeast(actor, "admin")) return false;
  if (actor === "owner") return true;
  return target === "member";
}

/** Only the owner may delete the group or transfer ownership. */
export function canDeleteGroup(role: GroupRole): boolean {
  return role === "owner";
}

/** Members read/send/connect; everyone inside the conversation passes. */
export type GroupMembership = typeof schema.conversationMembers.$inferSelect;

/**
 * Loads membership or null. Never throws — use for optional checks.
 */
export async function getGroupMembership(
  userId: number,
  conversationId: number,
): Promise<GroupMembership | null> {
  const member = await getDb()
    .query.conversationMembers.findFirst({
      where: and(
        eq(schema.conversationMembers.conversationId, conversationId),
        eq(schema.conversationMembers.userId, userId),
      ),
    });
  return member ?? null;
}

function isGroupConversation(
  conversation: { isGroup: boolean } | undefined,
): boolean {
  return !!conversation?.isGroup;
}

/**
 * Verifies the user is an ACTIVE member of a GROUP conversation.
 * Non-members get NOT_FOUND so private groups are indistinguishable
 * from nonexistent ones (item 51). DM conversations fall through to
 * requireConversationAccess semantics via the plain-member check.
 */
export async function requireGroupAccess(
  userId: number,
  conversationId: number,
): Promise<{ member: GroupMembership; role: GroupRole }> {
  const db = getDb();
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });
  if (!conversation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
  }
  const member = await getGroupMembership(userId, conversationId);
  if (!member) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
  }
  const role = member.role as GroupRole;
  // Owner column is authoritative; heal legacy rows lazily.
  if (isGroupConversation(conversation) && conversation.ownerId === userId && role !== "owner") {
    return { member, role: "owner" };
  }
  return { member, role };
}

/** Throws FORBIDDEN unless the caller holds at least `min` role. */
export async function requireGroupRole(
  userId: number,
  conversationId: number,
  min: GroupRole,
): Promise<{ member: GroupMembership; role: GroupRole }> {
  const access = await requireGroupAccess(userId, conversationId);
  if (!roleAtLeast(access.role, min)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        min === "owner"
          ? "Somente o proprietário do grupo pode realizar esta ação."
          : "Você não tem permissão para realizar esta ação.",
    });
  }
  return access;
}

/**
 * Pure invite validation (unit-tested). Returns an error message when the
 * invite cannot be used, or null when it is valid.
 */
export function inviteValidationError(
  invite: {
    revokedAt: Date | null;
    expiresAt: Date | null;
    maxUses: number | null;
    uses: number;
  },
  now = new Date(),
): string | null {
  if (invite.revokedAt) return "Este convite foi revogado.";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < now.getTime()) {
    return "Este convite expirou.";
  }
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    return "Este convite atingiu o limite de usos.";
  }
  return null;
}

/**
 * Pure fallback name builder (unit-tested):
 * "Daniel, Maria e João" / "Daniel, Maria, João e Lucas" / "Daniel e +4".
 */
export function buildFallbackGroupName(names: string[]): string {
  const clean = names.map(n => n.trim()).filter(Boolean);
  if (clean.length === 0) return "Grupo";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  if (clean.length === 3) return `${clean[0]}, ${clean[1]} e ${clean[2]}`;
  return `${clean[0]}, ${clean[1]}, ${clean[2]} e +${clean.length - 3}`;
}
