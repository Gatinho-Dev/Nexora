import { z } from "zod";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import type { ConversationDTO } from "@contracts/types";
import { requireConversationAccess, toPublicUser } from "./utils/permissions";
import { getVoiceParticipants, sendToUsers } from "./realtime";
import { assertCanInteract } from "./services/accountSafety";
import { rateLimit } from "./utils/rateLimit";
import { notifyConversationUsers } from "./groupRouter";

type InboxConversationDTO = ConversationDTO & { _hidden?: boolean };

async function buildConversationDTOs(
  conversationIds: number[],
  viewerId: number,
): Promise<InboxConversationDTO[]> {
  const ids = [...new Set(conversationIds)];
  if (ids.length === 0) return [];
  const db = getDb();
  const [conversationRows, memberRows, latestIdRows, unreadRows, sentRows, preferenceRows, friendshipRows] =
    await Promise.all([
      db
        .select()
        .from(schema.conversations)
        .where(inArray(schema.conversations.id, ids)),
      db
        .select({
          conversationId: schema.conversationMembers.conversationId,
          user: schema.users,
          role: schema.conversationMembers.role,
          notificationLevel: schema.conversationMembers.notificationLevel,
          mutedUntil: schema.conversationMembers.mutedUntil,
        })
        .from(schema.conversationMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.conversationMembers.userId))
        .where(inArray(schema.conversationMembers.conversationId, ids)),
      db
        .select({
          conversationId: schema.messages.conversationId,
          id: sql<number>`max(${schema.messages.id})`,
        })
        .from(schema.messages)
        .where(inArray(schema.messages.conversationId, ids))
        .groupBy(schema.messages.conversationId),
      db
        .select({
          conversationId: schema.messages.conversationId,
          count: sql<number>`count(*)`,
          firstUnreadMessageId: sql<number>`min(${schema.messages.id})`,
        })
        .from(schema.messages)
        .where(
          and(
            inArray(schema.messages.conversationId, ids),
            ne(schema.messages.authorId, viewerId),
            sql`${schema.messages.id} > coalesce((select max(cr.lastReadMessageId) from channel_reads cr where cr.userId = ${viewerId} and cr.conversationId = ${schema.messages.conversationId}), 0)`,
          ),
        )
        .groupBy(schema.messages.conversationId),
      db
        .select({
          conversationId: schema.messages.conversationId,
          count: sql<number>`count(*)`,
        })
        .from(schema.messages)
        .where(
          and(
            inArray(schema.messages.conversationId, ids),
            eq(schema.messages.authorId, viewerId),
          ),
        )
        .groupBy(schema.messages.conversationId),
      db
        .select()
        .from(schema.conversationPreferences)
        .where(
          and(
            eq(schema.conversationPreferences.userId, viewerId),
            inArray(schema.conversationPreferences.conversationId, ids),
          ),
        ),
      db
        .select()
        .from(schema.friendships)
        .where(
          or(
            eq(schema.friendships.requesterId, viewerId),
            eq(schema.friendships.addresseeId, viewerId),
          ),
        ),
    ]);

  const latestIds = latestIdRows.map(row => Number(row.id)).filter(Boolean);
  const lastMessageRows = latestIds.length
    ? await db.select().from(schema.messages).where(inArray(schema.messages.id, latestIds))
    : [];

  const membersByConversation = new Map<number, typeof memberRows>();
  for (const row of memberRows) {
    const list = membersByConversation.get(row.conversationId) ?? [];
    list.push(row);
    membersByConversation.set(row.conversationId, list);
  }
  const lastByConversation = new Map(
    lastMessageRows
      .filter(row => row.conversationId != null)
      .map(row => [row.conversationId as number, row]),
  );
  const unreadByConversation = new Map(
    unreadRows
      .filter(row => row.conversationId != null)
      .map(row => [
        row.conversationId as number,
        {
          count: Number(row.count),
          firstUnreadMessageId: Number(row.firstUnreadMessageId),
        },
      ]),
  );
  const sentByConversation = new Map(
    sentRows
      .filter(row => row.conversationId != null)
      .map(row => [row.conversationId as number, Number(row.count)]),
  );
  const preferencesByConversation = new Map(
    preferenceRows.map(row => [row.conversationId, row]),
  );
  const friendshipByOther = new Map<number, (typeof friendshipRows)[number]>();
  for (const friendship of friendshipRows) {
    const otherId =
      friendship.requesterId === viewerId
        ? friendship.addresseeId
        : friendship.requesterId;
    friendshipByOther.set(otherId, friendship);
  }

  return conversationRows.map(conversation => {
    const membershipRows = membersByConversation.get(conversation.id) ?? [];
    const members = membershipRows.map(row => toPublicUser(row.user));
    const other = conversation.isGroup
      ? null
      : (members.find(member => member.id !== viewerId) ?? null);
    const me = membershipRows.find(row => row.user.id === viewerId);
    const lastMessage = lastByConversation.get(conversation.id);
    const unread = unreadByConversation.get(conversation.id);
    const preference = preferencesByConversation.get(conversation.id);
    const friendship = other ? friendshipByOther.get(other.id) : undefined;
    const blocked = friendship?.status === "BLOCKED";
    const requestState = preference?.requestState ?? null;
    const inferredRequest =
      !conversation.isGroup &&
      !!other &&
      friendship?.status !== "ACCEPTED" &&
      !blocked &&
      (sentByConversation.get(conversation.id) ?? 0) === 0;
    const isRequest =
      !conversation.isGroup &&
      !blocked &&
      (requestState === "pending" ||
        requestState === "spam" ||
        (requestState == null && inferredRequest));
    const hiddenAt = preference?.hiddenAt ?? null;
    const hasReopened =
      !!hiddenAt &&
      !!lastMessage &&
      new Date(lastMessage.createdAt).getTime() > new Date(hiddenAt).getTime();

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      members,
      otherUser: other,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content.slice(0, 80),
            createdAt: lastMessage.createdAt,
            authorId: lastMessage.authorId,
          }
        : null,
      unreadCount: unread?.count ?? 0,
      firstUnreadMessageId: unread?.firstUnreadMessageId ?? null,
      isRequest,
      isSpam: requestState === "spam",
      pinnedAt: preference?.pinnedAt ?? null,
      hiddenAt,
      mutedForever:
        preference?.mutedForever ?? me?.notificationLevel === "muted",
      privateNote: preference?.privateNote ?? null,
      friendNickname: preference?.friendNickname ?? null,
      name: conversation.name,
      avatarUrl: conversation.avatarUrl,
      description: conversation.description,
      ownerId: conversation.ownerId,
      memberCount: members.length,
      myRole: conversation.isGroup
        ? ((me?.role as ConversationDTO["myRole"]) ?? null)
        : null,
      updatedAt: conversation.updatedAt,
      notificationLevel: me?.notificationLevel ?? "all",
      mutedUntil: preference?.mutedUntil ?? me?.mutedUntil ?? null,
      _hidden:
        blocked ||
        requestState === "ignored" ||
        (!!hiddenAt && !hasReopened),
    } satisfies InboxConversationDTO;
  });
}

async function buildConversationDTO(
  conversationId: number,
  viewerId: number,
): Promise<ConversationDTO | null> {
  const [conversation] = await buildConversationDTOs([conversationId], viewerId);
  if (!conversation) return null;
  const dto = { ...conversation };
  delete dto._hidden;
  return dto;
}

async function setConversationPreferences(
  userId: number,
  conversationId: number,
  patch: Partial<typeof schema.conversationPreferences.$inferInsert>,
) {
  await getDb()
    .insert(schema.conversationPreferences)
    .values({ userId, conversationId, ...patch })
    .onDuplicateKeyUpdate({ set: { ...patch, updatedAt: new Date() } });
}

export const dmRouter = createRouter({
  open: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      const db = getDb();
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode conversar consigo mesmo." });
      }
      const target = await db.query.users.findFirst({
        where: eq(schema.users.id, input.userId),
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      // Require friendship or a shared server
      const friendship = await db.query.friendships.findFirst({
        where: or(
          and(
            eq(schema.friendships.requesterId, ctx.user.id),
            eq(schema.friendships.addresseeId, input.userId),
          ),
          and(
            eq(schema.friendships.requesterId, input.userId),
            eq(schema.friendships.addresseeId, ctx.user.id),
          ),
        ),
      });
      let allowed = friendship?.status === "ACCEPTED";
      if (!allowed && friendship?.status !== "BLOCKED") {
        const myServers = await db
          .select({ serverId: schema.serverMembers.serverId })
          .from(schema.serverMembers)
          .where(eq(schema.serverMembers.userId, ctx.user.id));
        for (const s of myServers) {
          const shared = await db.query.serverMembers.findFirst({
            where: and(
              eq(schema.serverMembers.serverId, s.serverId),
              eq(schema.serverMembers.userId, input.userId),
            ),
          });
          if (shared) {
            allowed = true;
            break;
          }
        }
      }
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você precisa ser amigo deste usuário (ou dividir um servidor) para conversar.",
        });
      }

      // Reuse an existing 1:1 conversation if present
      const myConvs = await db
        .select({ conversationId: schema.conversationMembers.conversationId })
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.userId, ctx.user.id));
      for (const c of myConvs) {
        const other = await db.query.conversationMembers.findFirst({
          where: and(
            eq(schema.conversationMembers.conversationId, c.conversationId),
            eq(schema.conversationMembers.userId, input.userId),
          ),
        });
        if (other) {
          const conv = await db.query.conversations.findFirst({
            where: eq(schema.conversations.id, c.conversationId),
          });
          if (conv && !conv.isGroup) {
            await setConversationPreferences(ctx.user.id, conv.id, {
              hiddenAt: null,
              ...(friendship?.status === "ACCEPTED"
                ? { requestState: "accepted" as const }
                : {}),
            });
            sendToUsers([ctx.user.id], { t: "dm:refresh" });
            return { conversationId: conv.id };
          }
        }
      }

      const [{ id: conversationId }] = await db
        .insert(schema.conversations)
        .values({ isGroup: false })
        .$returningId();
      await db.insert(schema.conversationMembers).values([
        { conversationId, userId: ctx.user.id },
        { conversationId, userId: input.userId },
      ]);
      sendToUsers([ctx.user.id, input.userId], { t: "dm:refresh" });
      return { conversationId };
    }),

  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({ conversationId: schema.conversationMembers.conversationId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, ctx.user.id));
    const conversations = (
      await buildConversationDTOs(
        rows.map(row => row.conversationId),
        ctx.user.id,
      )
    ).filter(conversation => !conversation._hidden);
    conversations.sort((a, b) => {
      const pinA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const pinB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      if (!!pinA !== !!pinB) return pinB - pinA;
      if (pinA && pinB) return pinB - pinA;
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });
    return conversations.map(conversation => {
      const dto = { ...conversation };
      delete dto._hidden;
      return dto;
    });
  }),

  get: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      const dto = await buildConversationDTO(input.conversationId, ctx.user.id);
      if (!dto) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      return dto;
    }),

  delete: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      const db = getDb();
      // Groups are left or deleted through the group router instead.
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, input.conversationId),
      });
      if (conversation?.isGroup) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Grupos são gerenciados pelo próprio grupo.",
        });
      }
      // Only allow removing empty request-style 1:1 conversations.
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, input.conversationId));
      if (Number(count) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Conversas com mensagens não podem ser excluídas.",
        });
      }
      await db
        .delete(schema.conversationMembers)
        .where(
          and(
            eq(schema.conversationMembers.conversationId, input.conversationId),
            eq(schema.conversationMembers.userId, ctx.user.id),
          ),
        );
      sendToUsers([ctx.user.id], { t: "dm:refresh" });
      return { ok: true };
    }),

  setPinned: authedQuery
    .input(z.object({ conversationId: z.number(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      await setConversationPreferences(ctx.user.id, input.conversationId, {
        pinnedAt: input.pinned ? new Date() : null,
      });
      sendToUsers([ctx.user.id], { t: "dm:refresh" });
      return { ok: true };
    }),

  close: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      await setConversationPreferences(ctx.user.id, input.conversationId, {
        pinnedAt: null,
        hiddenAt: new Date(),
      });
      sendToUsers([ctx.user.id], { t: "dm:refresh" });
      return { ok: true };
    }),

  mute: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        minutes: z.number().int().min(1).max(60 * 24 * 30).nullable(),
        forever: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      const mutedUntil = input.minutes
        ? new Date(Date.now() + input.minutes * 60_000)
        : null;
      await setConversationPreferences(ctx.user.id, input.conversationId, {
        mutedUntil,
        mutedForever: input.forever,
      });
      sendToUsers([ctx.user.id], { t: "dm:refresh" });
      return { mutedUntil, mutedForever: input.forever };
    }),

  updatePrivateDetails: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        privateNote: z.string().trim().max(500).nullable().optional(),
        friendNickname: z.string().trim().max(64).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      await setConversationPreferences(ctx.user.id, input.conversationId, {
        ...(input.privateNote !== undefined
          ? { privateNote: input.privateNote || null }
          : {}),
        ...(input.friendNickname !== undefined
          ? { friendNickname: input.friendNickname || null }
          : {}),
      });
      sendToUsers([ctx.user.id], { t: "dm:refresh" });
      return { ok: true };
    }),

  requestAction: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        action: z.enum(["accept", "ignore", "spam", "block"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      const db = getDb();
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, input.conversationId),
      });
      if (!conversation || conversation.isGroup) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta ação só está disponível em mensagens diretas.",
        });
      }
      const otherMember = await db.query.conversationMembers.findFirst({
        where: and(
          eq(schema.conversationMembers.conversationId, input.conversationId),
          ne(schema.conversationMembers.userId, ctx.user.id),
        ),
      });
      if (!otherMember) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      }

      if (input.action === "block") {
        const existing = await db.query.friendships.findFirst({
          where: or(
            and(
              eq(schema.friendships.requesterId, ctx.user.id),
              eq(schema.friendships.addresseeId, otherMember.userId),
            ),
            and(
              eq(schema.friendships.requesterId, otherMember.userId),
              eq(schema.friendships.addresseeId, ctx.user.id),
            ),
          ),
        });
        if (existing) {
          await db
            .update(schema.friendships)
            .set({
              status: "BLOCKED",
              requesterId: ctx.user.id,
              addresseeId: otherMember.userId,
            })
            .where(eq(schema.friendships.id, existing.id));
        } else {
          await db.insert(schema.friendships).values({
            requesterId: ctx.user.id,
            addresseeId: otherMember.userId,
            status: "BLOCKED",
          });
        }
      }

      const requestState =
        input.action === "accept"
          ? "accepted"
          : input.action === "spam"
            ? "spam"
            : "ignored";
      await setConversationPreferences(ctx.user.id, input.conversationId, {
        requestState,
        hiddenAt:
          input.action === "ignore" || input.action === "block"
            ? new Date()
            : null,
      });
      sendToUsers([ctx.user.id, otherMember.userId], { t: "dm:refresh" });
      if (input.action === "block") {
        sendToUsers([ctx.user.id, otherMember.userId], { t: "friends:refresh" });
      }
      return { ok: true };
    }),

  markUnread: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      const db = getDb();
      const [lastMessage] = await db
        .select({ id: schema.messages.id })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, input.conversationId),
            ne(schema.messages.authorId, ctx.user.id),
          ),
        )
        .orderBy(desc(schema.messages.id))
        .limit(1);
      if (!lastMessage) return { ok: true, lastMessageId: 0 };
      const lastMessageId = Math.max(0, lastMessage.id - 1);
      await db
        .insert(schema.channelReads)
        .values({
          userId: ctx.user.id,
          conversationId: input.conversationId,
          lastReadMessageId: lastMessageId,
        })
        .onDuplicateKeyUpdate({
          set: { lastReadMessageId: lastMessageId, updatedAt: new Date() },
        });
      sendToUsers([ctx.user.id], {
        t: "read:update",
        userId: ctx.user.id,
        conversationId: input.conversationId,
        lastMessageId,
      });
      return { ok: true, lastMessageId };
    }),

  // ── Calls ────────────────────────────────────────────────────
  // Toca o telefone dos outros participantes quando uma chamada DM começa
  // (o grupo já tinha isso; sem isto, a outra pessoa nunca fica sabendo).
  notifyCallStart: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversationAccess(ctx.user.id, input.conversationId);
      await assertCanInteract(ctx.user.id);
      rateLimit(`call:${ctx.user.id}`, 5, 60_000);
      const roomKey = `dm:${input.conversationId}`;
      const inRoom = new Set(getVoiceParticipants(roomKey).map(p => p.userId));
      const actor = await getDb().query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
      });
      await notifyConversationUsers({
        type: "call_started",
        actorId: ctx.user.id,
        conversationId: input.conversationId,
        content: `${actor?.name ?? actor?.username ?? "Alguém"} iniciou uma chamada.`,
        skip: [...inRoom],
      });
      return { ok: true };
    }),
});
