import { z } from "zod";
import { and, desc, eq, gte, inArray, like, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import {
  GroupLimits,
  RateLimits,
  type GroupRole,
} from "@contracts/constants";
import type { PublicUser } from "@contracts/types";
import { rateLimit } from "./utils/rateLimit";
import {
  canDeleteGroup,
  canModerateMember,
  inviteValidationError,
  requireGroupAccess,
  requireGroupRole,
} from "./utils/groupPermissions";
import { toPublicUser } from "./utils/permissions";
import { getVoiceParticipants, sendToUsers } from "./realtime";
import { assertCanInteract } from "./services/accountSafety";
import { buildMessageDTO } from "./messageRouter";
import {
  avatarUrlFromFile,
  blockedBetween,
  canBeAddedBy,
  hashToken,
  insertSystemMessage,
  inviteDto,
  loadMembers,
  resolveGroupName,
  userName,
  type Tx,
} from "./services/groupService";

function notifyGroupUpdate(conversationId: number, userIds: number[]) {
  sendToUsers(userIds, { t: "group:update", conversationId });
}

async function memberIdsOf(conversationId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ userId: schema.conversationMembers.userId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  return rows.map(r => r.userId);
}

/** Builds the full group details DTO for a member. */
async function buildGroupDetails(conversationId: number, viewerId: number) {
  const db = getDb();
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });
  if (!conversation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
  }
  const members = await loadMembers(conversationId);
  const me = members.find(m => m.user.id === viewerId);
  return {
    id: conversation.id,
    name: resolveGroupName(conversation, members.map(m => m.user)),
    customName: conversation.name,
    avatarUrl: conversation.avatarUrl,
    description: conversation.description,
    ownerId: conversation.ownerId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    memberCount: members.length,
    members: members.map(m => ({
      user: m.user,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    myRole: (me?.role ?? null) as GroupRole | null,
  };
}

const expirySchema = z.union([z.literal(3600), z.literal(86400), z.literal(604800), z.null()]);
const maxUsesSchema = z.union([z.literal(1), z.literal(5), z.literal(10), z.null()]);

/** Who may pin/unpin messages inside a group. */
function canModeratePin(role: GroupRole): boolean {
  return role === "owner" || role === "admin";
}

export const groupRouter = createRouter({
  // ── Creation ─────────────────────────────────────────────────
  create: authedQuery
    .input(
      z.object({
        memberIds: z
          .array(z.number())
          .min(GroupLimits.MIN_MEMBERS - 1)
          .max(GroupLimits.MAX_MEMBERS - 1),
        name: z.string().trim().max(GroupLimits.MAX_NAME_LENGTH).optional(),
        description: z.string().trim().max(GroupLimits.MAX_DESCRIPTION_LENGTH).optional(),
        avatarFileId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(
        `groupCreate:${ctx.user.id}`,
        RateLimits.groupCreate.limit,
        RateLimits.groupCreate.windowMs,
      );
      const db = getDb();

      const targetIds = [...new Set(input.memberIds)].filter(
        id => id !== ctx.user.id,
      );
      if (
        targetIds.length + 1 < GroupLimits.MIN_MEMBERS ||
        targetIds.length + 1 > GroupLimits.MAX_MEMBERS
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Selecione entre ${GroupLimits.MIN_MEMBERS - 1} e ${GroupLimits.MAX_MEMBERS - 1} amigos para criar um grupo.`,
        });
      }

      // Admission checks for every invited user.
      for (const targetId of targetIds) {
        const exists = await db.query.users.findFirst({
          where: eq(schema.users.id, targetId),
        });
        if (!exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Um dos usuários selecionados não existe.",
          });
        }
        if (await blockedBetween(ctx.user.id, targetId)) continue;
        if (!(await canBeAddedBy(ctx.user.id, targetId))) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Você precisa ser amigo de ${exists.name ?? exists.username ?? "todos os participantes"} para adicioná-lo.`,
          });
        }
      }

      const avatarUrl = await avatarUrlFromFile(input.avatarFileId, ctx.user.id);
      const myName = await userName(ctx.user.id);

      const conversationId = await db.transaction(async tx => {
        const [{ id }] = await tx
          .insert(schema.conversations)
          .values({
            isGroup: true,
            name: input.name?.trim() || null,
            description: input.description?.trim() || null,
            avatarUrl,
            ownerId: ctx.user.id,
          })
          .$returningId();
        await tx.insert(schema.conversationMembers).values([
          { conversationId: Number(id), userId: ctx.user.id, role: "owner" },
          ...targetIds.map(userId => ({
            conversationId: Number(id),
            userId,
            role: "member" as const,
          })),
        ]);
        await insertSystemMessage(
          tx as unknown as Tx,
          Number(id),
          ctx.user.id,
          `${myName} criou o grupo.`,
        );
        return Number(id);
      });

      // Notifications for added members (never to the creator).
      const added: number[] = [];
      for (const targetId of targetIds) {
        if (await blockedBetween(ctx.user.id, targetId)) continue;
        added.push(targetId);
      }
      if (added.length + 1 < GroupLimits.MIN_MEMBERS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Não foi possível criar o grupo: nenhum dos participantes selecionados pode ser adicionado.",
        });
      }
      await notifyConversationUsers({
        type: "group_added",
        actorId: ctx.user.id,
        conversationId,
        content: `${myName} adicionou você ao grupo.`,
        only: added,
      });
      notifyGroupUpdate(conversationId, [ctx.user.id, ...added]);
      return { conversationId };
    }),

  // ── Read ─────────────────────────────────────────────────────
  get: authedQuery.input(z.object({ conversationId: z.number() })).query(
    async ({ ctx, input }) => {
      await requireGroupAccess(ctx.user.id, input.conversationId);
      return buildGroupDetails(input.conversationId, ctx.user.id);
    },
  ),

  update: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        name: z.string().trim().max(GroupLimits.MAX_NAME_LENGTH).nullable().optional(),
        description: z.string().trim().max(GroupLimits.MAX_DESCRIPTION_LENGTH).nullable().optional(),
        avatarFileId: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(
        `groupManage:${ctx.user.id}`,
        RateLimits.groupMemberChange.limit,
        RateLimits.groupMemberChange.windowMs,
      );
      const { role } = await requireGroupAccess(ctx.user.id, input.conversationId);
      if (role !== "owner" && role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para realizar esta ação.",
        });
      }
      const db = getDb();
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, input.conversationId),
      });
      if (!conversation?.isGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
      }

      const patch: Partial<typeof schema.conversations.$inferInsert> = {};
      const events: string[] = [];
      const actor = await userName(ctx.user.id);

      if (input.name !== undefined && input.name !== null) {
        const nextName = input.name.trim();
        if (nextName !== (conversation.name ?? "")) {
          patch.name = nextName || null;
          events.push(
            nextName
              ? `${actor} alterou o nome do grupo para "${nextName}".`
              : `${actor} removeu o nome do grupo.`,
          );
        }
      }
      if (input.description !== undefined) {
        const nextDesc = input.description?.trim() || null;
        if (nextDesc !== (conversation.description ?? null)) {
          patch.description = nextDesc;
          events.push(`${actor} alterou a descrição do grupo.`);
        }
      }
      if (input.avatarFileId !== undefined) {
        let avatarUrl: string | null = null;
        try {
          avatarUrl = await avatarUrlFromFile(input.avatarFileId, ctx.user.id);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Imagem inválida.",
          });
        }
        if (avatarUrl !== conversation.avatarUrl) {
          patch.avatarUrl = avatarUrl;
          events.push(
            avatarUrl
              ? `${actor} alterou a imagem do grupo.`
              : `${actor} removeu a imagem do grupo.`,
          );
        }
      }

      if (Object.keys(patch).length > 0) {
        await db.transaction(async tx => {
          await tx
            .update(schema.conversations)
            .set(patch)
            .where(eq(schema.conversations.id, input.conversationId));
          for (const evt of events) {
            await insertSystemMessage(tx as unknown as Tx, input.conversationId, ctx.user.id, evt);
          }
        });
        notifyGroupUpdate(
          input.conversationId,
          await memberIdsOf(input.conversationId),
        );
      }
      return buildGroupDetails(input.conversationId, ctx.user.id);
    }),

  // ── Members management ───────────────────────────────────────
  addMembers: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        userIds: z.array(z.number()).min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(
        `groupMembers:${ctx.user.id}`,
        RateLimits.groupMemberChange.limit,
        RateLimits.groupMemberChange.windowMs,
      );
      const { role } = await requireGroupRole(
        ctx.user.id,
        input.conversationId,
        "admin",
      );
      void role;
      const db = getDb();
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, input.conversationId),
      });
      if (!conversation?.isGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
      }

      const existingRows = await db
        .select({ userId: schema.conversationMembers.userId })
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, input.conversationId));
      const existing = new Set(existingRows.map(r => r.userId));
      const candidates = [...new Set(input.userIds)].filter(
        id => !existing.has(id) && id !== ctx.user.id,
      );

      const capacity = GroupLimits.MAX_MEMBERS - existing.size;
      if (candidates.length > capacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            capacity <= 0
              ? "Esse grupo atingiu o limite de participantes."
              : `Este grupo comporta mais ${capacity} participante(s).`,
        });
      }

      const admitted: number[] = [];
      for (const userId of candidates) {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });
        if (!user) continue;
        if (await blockedBetween(ctx.user.id, userId)) continue;
        if (!(await canBeAddedBy(ctx.user.id, userId))) continue;
        admitted.push(userId);
      }

      const actor = await userName(ctx.user.id);
      for (const userId of admitted) {
        const memberName = await userName(userId);
        await db.transaction(async tx => {
          await tx.insert(schema.conversationMembers).values({
            conversationId: input.conversationId,
            userId,
            role: "member",
          });
          await insertSystemMessage(
            tx as unknown as Tx,
            input.conversationId,
            ctx.user.id,
            `${actor} adicionou ${memberName} ao grupo.`,
          );
        });
      }

      if (admitted.length > 0) {
        await notifyConversationUsers({
          type: "group_added",
          actorId: ctx.user.id,
          conversationId: input.conversationId,
          content: `${actor} adicionou você ao grupo.`,
          only: admitted,
        });
        notifyGroupUpdate(input.conversationId, [
          ...(await memberIdsOf(input.conversationId)),
        ]);
      }
      return { added: admitted };
    }),

  removeMember: authedQuery
    .input(z.object({ conversationId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(
        `groupMembers:${ctx.user.id}`,
        RateLimits.groupMemberChange.limit,
        RateLimits.groupMemberChange.windowMs,
      );
      const { role: actorRole } = await requireGroupRole(
        ctx.user.id,
        input.conversationId,
        "admin",
      );
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use “Sair do grupo” para deixar a conversa.",
        });
      }
      const db = getDb();
      const target = await db.query.conversationMembers.findFirst({
        where: and(
          eq(schema.conversationMembers.conversationId, input.conversationId),
          eq(schema.conversationMembers.userId, input.userId),
        ),
      });
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este usuário não participa do grupo.",
        });
      }
      if (!canModerateMember(actorRole, target.role as GroupRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para remover este participante.",
        });
      }

      const actor = await userName(ctx.user.id);
      const targetName = await userName(input.userId);
      await db.transaction(async tx => {
        await tx
          .delete(schema.conversationMembers)
          .where(eq(schema.conversationMembers.id, target.id));
        await insertSystemMessage(
          tx as unknown as Tx,
          input.conversationId,
          ctx.user.id,
          `${actor} removeu ${targetName} do grupo.`,
        );
      });

      sendToUsers([input.userId], { t: "group:update", conversationId: input.conversationId });
      await notifyConversationUsers({
        type: "group_removed",
        actorId: ctx.user.id,
        conversationId: input.conversationId,
        content: `Você foi removido do grupo por ${actor}.`,
        only: [input.userId],
      });
      notifyGroupUpdate(
        input.conversationId,
        await memberIdsOf(input.conversationId),
      );
      return { ok: true };
    }),

  promote: authedQuery
    .input(z.object({ conversationId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireGroupRole(ctx.user.id, input.conversationId, "owner");
      return changeMemberRole(
        input.conversationId,
        ctx.user.id,
        input.userId,
        "admin",
        "promovou",
      );
    }),

  demote: authedQuery
    .input(z.object({ conversationId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireGroupRole(ctx.user.id, input.conversationId, "owner");
      return changeMemberRole(
        input.conversationId,
        ctx.user.id,
        input.userId,
        "member",
        "removeu como administrador",
      );
    }),

  transferOwnership: authedQuery
    .input(z.object({ conversationId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { role } = await requireGroupRole(ctx.user.id, input.conversationId, "owner");
      void role;
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você já é o proprietário deste grupo.",
        });
      }
      const db = getDb();
      const target = await db.query.conversationMembers.findFirst({
        where: and(
          eq(schema.conversationMembers.conversationId, input.conversationId),
          eq(schema.conversationMembers.userId, input.userId),
        ),
      });
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "O novo proprietário precisa participar do grupo.",
        });
      }
      const actor = await userName(ctx.user.id);
      const targetName = await userName(input.userId);
      await db.transaction(async tx => {
        await tx
          .update(schema.conversations)
          .set({ ownerId: input.userId })
          .where(eq(schema.conversations.id, input.conversationId));
        await tx
          .update(schema.conversationMembers)
          .set({ role: "owner" })
          .where(eq(schema.conversationMembers.id, target.id));
        await tx
          .update(schema.conversationMembers)
          .set({ role: "admin" })
          .where(
            and(
              eq(schema.conversationMembers.conversationId, input.conversationId),
              eq(schema.conversationMembers.userId, ctx.user.id),
            ),
          );
        await insertSystemMessage(
          tx as unknown as Tx,
          input.conversationId,
          ctx.user.id,
          `${actor} transferiu a propriedade do grupo para ${targetName}.`,
        );
      });
      notifyGroupUpdate(
        input.conversationId,
        await memberIdsOf(input.conversationId),
      );
      return buildGroupDetails(input.conversationId, ctx.user.id);
    }),

  leave: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      const { member, role } = await requireGroupAccess(ctx.user.id, input.conversationId);
      if (role === "owner") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Antes de sair, escolha um novo proprietário.",
        });
      }
      void member;
      const db = getDb();
      const actor = await userName(ctx.user.id);
      await db.transaction(async tx => {
        await tx
          .delete(schema.conversationMembers)
          .where(
            and(
              eq(schema.conversationMembers.conversationId, input.conversationId),
              eq(schema.conversationMembers.userId, ctx.user.id),
            ),
          );
        await insertSystemMessage(
          tx as unknown as Tx,
          input.conversationId,
          ctx.user.id,
          `${actor} saiu do grupo.`,
        );
      });
      sendToUsers([ctx.user.id], { t: "group:update", conversationId: input.conversationId });
      notifyGroupUpdate(
        input.conversationId,
        await memberIdsOf(input.conversationId),
      );
      return { ok: true };
    }),

  delete: authedQuery
    .input(z.object({ conversationId: z.number(), confirmName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      const { role } = await requireGroupAccess(ctx.user.id, input.conversationId);
      if (!canDeleteGroup(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Somente o proprietário pode excluir o grupo.",
        });
      }
      const db = getDb();
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, input.conversationId),
      });
      if (!conversation?.isGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
      }
      const members = await loadMembers(input.conversationId);
      const displayName =
        resolveGroupName(conversation, members.map(m => m.user)) ?? "";
      if (input.confirmName.trim() !== displayName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O nome digitado não corresponde ao nome do grupo.",
        });
      }

      await db.transaction(async tx => {
        const msgIds = (
          await tx
            .select({ id: schema.messages.id })
            .from(schema.messages)
            .where(eq(schema.messages.conversationId, input.conversationId))
        ).map(r => r.id);
        if (msgIds.length > 0) {
          await tx.delete(schema.attachments).where(inArray(schema.attachments.messageId, msgIds));
          await tx.delete(schema.messageReactions).where(inArray(schema.messageReactions.messageId, msgIds));
        }
        await tx.delete(schema.messages).where(eq(schema.messages.conversationId, input.conversationId));
        await tx.delete(schema.pinnedMessages).where(eq(schema.pinnedMessages.conversationId, input.conversationId));
        await tx.delete(schema.groupInvites).where(eq(schema.groupInvites.conversationId, input.conversationId));
        await tx.delete(schema.channelReads).where(eq(schema.channelReads.conversationId, input.conversationId));
        await tx.delete(schema.notifications).where(eq(schema.notifications.conversationId, input.conversationId));
        await tx.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, input.conversationId));
        await tx.delete(schema.conversations).where(eq(schema.conversations.id, input.conversationId));
      });

      sendToUsers(members.map(m => m.user.id), {
        t: "group:update",
        conversationId: input.conversationId,
      });
      return { ok: true };
    }),

  // ── Notification preferences ─────────────────────────────────
  setNotifications: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        level: z.enum(["all", "mentions", "muted"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGroupAccess(ctx.user.id, input.conversationId);
      // Sair do "Silenciado" também cancela qualquer snooze temporário.
      await getDb()
        .update(schema.conversationMembers)
        .set({
          notificationLevel: input.level,
          ...(input.level !== "muted" ? { mutedUntil: null } : {}),
        })
        .where(
          and(
            eq(schema.conversationMembers.conversationId, input.conversationId),
            eq(schema.conversationMembers.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  mute: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        /** Minutes; null = unmute / até reativar handled by level. */
        minutes: z.number().int().min(1).max(60 * 24 * 30).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGroupAccess(ctx.user.id, input.conversationId);
      const mutedUntil = input.minutes
        ? new Date(Date.now() + input.minutes * 60_000)
        : null;
      await getDb()
        .update(schema.conversationMembers)
        .set({ mutedUntil })
        .where(
          and(
            eq(schema.conversationMembers.conversationId, input.conversationId),
            eq(schema.conversationMembers.userId, ctx.user.id),
          ),
        );
      return { mutedUntil };
    }),

  // ── Calls ────────────────────────────────────────────────────
  startCall: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(`call:${ctx.user.id}`, 5, 60_000);
      const { role } = await requireGroupAccess(ctx.user.id, input.conversationId);
      void role;
      const roomKey = `dm:${input.conversationId}`;
      const inRoom = new Set(getVoiceParticipants(roomKey).map(p => p.userId));
      const actor = await userName(ctx.user.id);
      await notifyConversationUsers({
        type: "call_started",
        actorId: ctx.user.id,
        conversationId: input.conversationId,
        content: `${actor} iniciou uma chamada.`,
        skip: [...inRoom],
      });
      return { ok: true };
    }),

  // ── Search inside the group (item 33) ───────────────────────
  search: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        query: z.string().trim().max(100).optional(),
        fromUserId: z.number().optional(),
        kind: z.enum(["all", "link", "image", "file"]).default("all"),
        limit: z.number().min(1).max(50).default(25),
        before: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireGroupAccess(ctx.user.id, input.conversationId);
      const db = getDb();
      const conditions = [
        eq(schema.messages.conversationId, input.conversationId),
        sql`(${schema.messages.tag} IS NULL OR ${schema.messages.tag} <> 'system')`,
      ];
      if (input.before) {
        conditions.push(sql`${schema.messages.id} < ${input.before}`);
      }
      if (input.query) {
        // Escapa curingas de LIKE para a busca ser literal.
        const escaped = input.query
          .replace(/[\\%_]/g, ch => `\\${ch}`)
          .slice(0, 100);
        conditions.push(
          sql`${schema.messages.content} LIKE ${`%${escaped}%`}`
        );
      }
      if (input.fromUserId) {
        conditions.push(eq(schema.messages.authorId, input.fromUserId));
      }
      if (input.kind === "link") {
        conditions.push(sql`${schema.messages.content} LIKE '%http%'`);
      } else if (input.kind === "image") {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM attachments a WHERE a.messageId = ${schema.messages.id} AND a.mimeType LIKE 'image/%')`
        );
      } else if (input.kind === "file") {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM attachments a WHERE a.messageId = ${schema.messages.id} AND a.mimeType NOT LIKE 'image/%' AND a.mimeType NOT LIKE 'video/%' AND a.mimeType NOT LIKE 'audio/%')`
        );
      }

      const rows = await db
        .select()
        .from(schema.messages)
        .where(and(...conditions))
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);

      const messages: Awaited<ReturnType<typeof buildMessageDTO>>[] = [];
      for (const row of rows) messages.push(await buildMessageDTO(row));
      return { messages, hasMore: rows.length === input.limit };
    }),

  // ── Read receipts ────────────────────────────────────────────
  readBy: authedQuery
    .input(z.object({ messageId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, input.messageId),
      });
      if (!msg?.conversationId) return { users: [] as PublicUser[] };
      await requireGroupAccess(ctx.user.id, msg.conversationId);
      // Privacidade (item 12): quem desligou recibos de leitura não aparece.
      const rows = await db
        .select({ user: schema.users })
        .from(schema.channelReads)
        .innerJoin(schema.users, eq(schema.users.id, schema.channelReads.userId))
        .where(
          and(
            eq(schema.channelReads.conversationId, msg.conversationId),
            gte(schema.channelReads.lastReadMessageId, input.messageId),
            ne(schema.channelReads.userId, msg.authorId),
            eq(schema.users.readReceipts, true)
          ),
        )
        .limit(50);
      return { users: rows.map(r => toPublicUser(r.user)) };
    }),

  // ── Pinned messages ──────────────────────────────────────────
  listPins: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireGroupAccess(ctx.user.id, input.conversationId);
      const db = getDb();
      const rows = await db
        .select({
          messageId: schema.pinnedMessages.messageId,
          pinnedByUserId: schema.pinnedMessages.pinnedByUserId,
          createdAt: schema.pinnedMessages.createdAt,
          message: schema.messages,
        })
        .from(schema.pinnedMessages)
        .leftJoin(schema.messages, eq(schema.messages.id, schema.pinnedMessages.messageId))
        .where(eq(schema.pinnedMessages.conversationId, input.conversationId))
        .orderBy(desc(schema.pinnedMessages.createdAt))
        .limit(50);
      const pins = [];
      for (const r of rows) {
        pins.push({
          messageId: r.messageId,
          pinnedByUserId: r.pinnedByUserId,
          createdAt: r.createdAt,
          message: r.message ? await buildMessageDTO(r.message) : null,
        });
      }
      return { pins };
    }),

  pinMessage: authedQuery
    .input(z.object({ conversationId: z.number(), messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(
        `pin:${ctx.user.id}`,
        RateLimits.reaction.limit,
        RateLimits.reaction.windowMs,
      );
      const { role } = await requireGroupAccess(ctx.user.id, input.conversationId);
      if (!canModeratePin(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Somente administradores podem fixar mensagens.",
        });
      }
      const db = getDb();
      const msg = await db.query.messages.findFirst({
        where: and(
          eq(schema.messages.id, input.messageId),
          eq(schema.messages.conversationId, input.conversationId),
        ),
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      }
      await db
        .insert(schema.pinnedMessages)
        .values({
          conversationId: input.conversationId,
          messageId: input.messageId,
          pinnedByUserId: ctx.user.id,
        })
        .onDuplicateKeyUpdate({ set: { messageId: input.messageId } });
      notifyGroupUpdate(
        input.conversationId,
        await memberIdsOf(input.conversationId),
      );
      return { ok: true };
    }),

  unpinMessage: authedQuery
    .input(z.object({ conversationId: z.number(), messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { role } = await requireGroupAccess(ctx.user.id, input.conversationId);
      if (!canModeratePin(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Somente administradores podem remover fixações.",
        });
      }
      await getDb()
        .delete(schema.pinnedMessages)
        .where(
          and(
            eq(schema.pinnedMessages.conversationId, input.conversationId),
            eq(schema.pinnedMessages.messageId, input.messageId),
          ),
        );
      notifyGroupUpdate(
        input.conversationId,
        await memberIdsOf(input.conversationId),
      );
      return { ok: true };
    }),

  // ── Shared media / files / links ─────────────────────────────
  sharedMedia: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        kind: z.enum(["image", "video", "audio", "file", "link"]),
        limit: z.number().min(1).max(100).default(60),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireGroupAccess(ctx.user.id, input.conversationId);
      const db = getDb();
      if (input.kind === "link") {
        const rows = await db
          .select({
            id: schema.messages.id,
            content: schema.messages.content,
            createdAt: schema.messages.createdAt,
          })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.conversationId, input.conversationId),
              sql`${schema.messages.content} LIKE '%http%'`,
              sql`(${schema.messages.tag} IS NULL OR ${schema.messages.tag} <> 'system')`,
            ),
          )
          .orderBy(desc(schema.messages.id))
          .limit(input.limit);
        return {
          links: rows.flatMap(r =>
            (r.content.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [])
              .slice(0, 5)
              .map(url => ({
                messageId: r.id,
                url,
                createdAt: r.createdAt,
              })),
          ),
          attachments: [],
        };
      }
      const prefix =
        input.kind === "file" ? null : `${input.kind}/`;
      const rows = await db
        .select({
          attachment: schema.attachments,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.attachments)
        .innerJoin(schema.messages, eq(schema.messages.id, schema.attachments.messageId))
        .where(
          prefix
            ? and(
                eq(schema.messages.conversationId, input.conversationId),
                like(schema.attachments.mimeType, `${prefix}%`),
              )
            : and(
                eq(schema.messages.conversationId, input.conversationId),
                sql`${schema.attachments.mimeType} NOT LIKE 'image/%' AND ${schema.attachments.mimeType} NOT LIKE 'video/%' AND ${schema.attachments.mimeType} NOT LIKE 'audio/%'`,
              ),
        )
        .orderBy(desc(schema.attachments.id))
        .limit(input.limit);
      return {
        links: [],
        attachments: rows.map(r => ({
          id: r.attachment.id,
          fileId: r.attachment.fileId,
          filename: r.attachment.filename,
          mimeType: r.attachment.mimeType,
          size: r.attachment.size,
          url: `/api/files/${r.attachment.fileId}`,
          spoiler: r.attachment.spoiler,
          createdAt: r.createdAt,
        })),
      };
    }),

  // ── Group invites ────────────────────────────────────────────
  createInvite: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        /** Seconds: 1h, 24h, 7d or null (nunca). */
        expiresInSeconds: expirySchema.optional(),
        maxUses: maxUsesSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(
        `groupInvite:${ctx.user.id}`,
        RateLimits.groupInviteCreate.limit,
        RateLimits.groupInviteCreate.windowMs,
      );
      await requireGroupRole(ctx.user.id, input.conversationId, "admin");
      const token = randomBytes(24).toString("base64url");
      const expiresAt = input.expiresInSeconds
        ? new Date(Date.now() + input.expiresInSeconds * 1000)
        : null;
      await getDb().insert(schema.groupInvites).values({
        conversationId: input.conversationId,
        tokenHash: hashToken(token),
        createdByUserId: ctx.user.id,
        expiresAt,
        maxUses: input.maxUses ?? null,
      });
      return { code: token, url: `/invite/group/${token}` };
    }),

  listInvites: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireGroupRole(ctx.user.id, input.conversationId, "admin");
      const rows = await getDb()
        .select()
        .from(schema.groupInvites)
        .where(
          and(
            eq(schema.groupInvites.conversationId, input.conversationId),
            sql`${schema.groupInvites.revokedAt} IS NULL`,
          ),
        )
        .orderBy(desc(schema.groupInvites.id));
      return { invites: rows.map(r => inviteDto(r)) };
    }),

  revokeInvite: authedQuery
    .input(z.object({ conversationId: z.number(), inviteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      await requireGroupRole(ctx.user.id, input.conversationId, "admin");
      const db = getDb();
      const invite = await db.query.groupInvites.findFirst({
        where: eq(schema.groupInvites.id, input.inviteId),
      });
      if (!invite || invite.conversationId !== input.conversationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Convite não encontrado." });
      }
      await db
        .update(schema.groupInvites)
        .set({ revokedAt: new Date() })
        .where(eq(schema.groupInvites.id, invite.id));
      return { ok: true };
    }),

  inviteInfo: publicQuery
    .input(z.object({ code: z.string().min(10).max(120) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const invite = await db.query.groupInvites.findFirst({
        where: eq(schema.groupInvites.tokenHash, hashToken(input.code)),
      });
      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite inválido ou expirado.",
        });
      }
      const validationError = inviteValidationError(invite);
      if (validationError) {
        throw new TRPCError({ code: "NOT_FOUND", message: validationError });
      }
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, invite.conversationId),
      });
      if (!conversation?.isGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
      }
      const members = await loadMembers(conversation.id);
      const name = resolveGroupName(conversation, members.map(m => m.user));
      const alreadyMember =
        !!ctx.user && members.some(m => m.user.id === ctx.user!.id);
      const creator = members.find(m => m.user.id === invite.createdByUserId);
      return {
        name,
        avatarUrl: conversation.avatarUrl,
        memberCount: members.length,
        description: conversation.description,
        inviterName: creator
          ? creator.user.name ?? creator.user.username ?? "Alguém"
          : "Um participante",
        alreadyMember,
        conversationId: alreadyMember ? conversation.id : null,
      };
    }),

  joinByInvite: publicQuery
    .input(z.object({ code: z.string().min(10).max(120) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
      }
      await assertCanInteract(ctx.user.id);
      rateLimit(`joinGroup:${ctx.user.id}`, 10, 60_000);
      const db = getDb();
      const invite = await db.query.groupInvites.findFirst({
        where: eq(schema.groupInvites.tokenHash, hashToken(input.code)),
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Convite inválido ou expirado." });
      }
      const validationError = inviteValidationError(invite);
      if (validationError) {
        throw new TRPCError({ code: "FORBIDDEN", message: validationError });
      }
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, invite.conversationId),
      });
      if (!conversation?.isGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Grupo não encontrado." });
      }
      const existing = await db.query.conversationMembers.findFirst({
        where: and(
          eq(schema.conversationMembers.conversationId, conversation.id),
          eq(schema.conversationMembers.userId, ctx.user.id),
        ),
      });
      if (existing) return { conversationId: conversation.id };

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, conversation.id));
      if (Number(count) >= GroupLimits.MAX_MEMBERS) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esse grupo atingiu o limite de participantes.",
        });
      }

      const myName = await userName(ctx.user.id);
      await db.transaction(async tx => {
        await tx.insert(schema.conversationMembers).values({
          conversationId: conversation.id,
          userId: ctx.user!.id,
          role: "member",
        });
        await tx
          .update(schema.groupInvites)
          .set({ uses: invite.uses + 1 })
          .where(eq(schema.groupInvites.id, invite.id));
        await insertSystemMessage(
          tx as unknown as Tx,
          conversation.id,
          ctx.user!.id,
          `${myName} entrou no grupo usando um convite.`,
        );
      });

      sendToUsers([ctx.user.id], { t: "group:update", conversationId: conversation.id });
      notifyGroupUpdate(conversation.id, await memberIdsOf(conversation.id));
      return { conversationId: conversation.id };
    }),
});

// The rest of the router (roles helper, notifications, calls, pins, media,
// read receipts, invites) continues below.
async function changeMemberRole(
  conversationId: number,
  actorId: number,
  userId: number,
  nextRole: Extract<GroupRole, "admin" | "member">,
  verb: string,
) {
  const db = getDb();
  const target = await db.query.conversationMembers.findFirst({
    where: and(
      eq(schema.conversationMembers.conversationId, conversationId),
      eq(schema.conversationMembers.userId, userId),
    ),
  });
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });
  }
  if (target.role === "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "O proprietário não pode ter o cargo alterado. Transfira a propriedade primeiro.",
    });
  }
  if (target.role === nextRole) {
    return buildGroupDetails(conversationId, actorId);
  }
  const actor = await userName(actorId);
  const targetName = await userName(userId);
  await db.transaction(async tx => {
    await tx
      .update(schema.conversationMembers)
      .set({ role: nextRole })
      .where(eq(schema.conversationMembers.id, target.id));
    await insertSystemMessage(
      tx as unknown as Tx,
      conversationId,
      actorId,
      nextRole === "admin"
        ? `${actor} promoveu ${targetName} a administrador.`
        : `${actor} ${verb} ${targetName}.`,
    );
  });
  notifyGroupUpdate(conversationId, await memberIdsOf(conversationId));
  return buildGroupDetails(conversationId, actorId);
}

type NotifyInput = {
  type: string;
  actorId: number;
  conversationId: number;
  messageId?: number;
  content?: string | null;
  /** Only notify these users (defaults to all members except skip). */
  only?: number[];
  /** Never notify these users. */
  skip?: number[];
};

/**
 * Creates notifications for conversation members honoring each member's
 * notification settings (all / mentions / muted + temporary snooze).
 */
export async function notifyConversationUsers(input: NotifyInput) {
  const db = getDb();
  const rows = await db
    .select({
      userId: schema.conversationMembers.userId,
      level: schema.conversationMembers.notificationLevel,
      mutedUntil: schema.conversationMembers.mutedUntil,
    })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, input.conversationId));

  const now = Date.now();
  const targets = rows.filter(r => {
    if (r.userId === input.actorId) return false;
    if (input.only && !input.only.includes(r.userId)) return false;
    if (input.skip?.includes(r.userId)) return false;
    if (r.mutedUntil && new Date(r.mutedUntil).getTime() > now) return false;
    if (r.level === "muted") return false;
    return true;
  });

  const actor = await db.query.users.findFirst({
    where: eq(schema.users.id, input.actorId),
  });
  for (const t of targets) {
    const [{ id }] = await db
      .insert(schema.notifications)
      .values({
        userId: t.userId,
        type: input.type.slice(0, 32),
        actorId: input.actorId,
        conversationId: input.conversationId,
        messageId: input.messageId ?? null,
        content: input.content?.slice(0, 500) ?? null,
      })
      .$returningId();
    const row = await db.query.notifications.findFirst({
      where: eq(schema.notifications.id, id),
    });
    if (row) {
      sendToUsers([t.userId], {
        t: "notification",
        notification: {
          id: row.id,
          type: row.type,
          actor: actor ? toPublicUser(actor) : null,
          serverId: null,
          channelId: null,
          conversationId: row.conversationId,
          messageId: row.messageId,
          content: row.content,
          isRead: row.isRead,
          createdAt: row.createdAt,
        },
      });
    }
  }
}
