import { z } from "zod";
import { and, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import type { ConversationDTO } from "@contracts/types";
import { requireConversationAccess, toPublicUser } from "./utils/permissions";
import { sendToUsers } from "./realtime";

async function buildConversationDTO(
  conversationId: number,
  viewerId: number,
): Promise<ConversationDTO | null> {
  const db = getDb();
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });
  if (!conversation) return null;

  const memberRows = await db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  const members = [];
  for (const m of memberRows) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, m.userId),
    });
    if (user) members.push(toPublicUser(user));
  }

  const [lastMessage] = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.id))
    .limit(1);

  const readRow = await db.query.channelReads.findFirst({
    where: and(
      eq(schema.channelReads.userId, viewerId),
      eq(schema.channelReads.conversationId, conversationId),
    ),
  });
  const lastRead = readRow?.lastReadMessageId ?? 0;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.conversationId, conversationId),
        gt(schema.messages.id, lastRead),
        ne(schema.messages.authorId, viewerId),
      ),
    );

  // Message request: 1:1 conversation with a non-friend where the viewer
  // never sent anything. Once the viewer replies it becomes a normal DM.
  let isRequest = false;
  if (!conversation.isGroup) {
    const other = members.find((m) => m.id !== viewerId);
    if (other) {
      const friendship = await db.query.friendships.findFirst({
        where: or(
          and(
            eq(schema.friendships.requesterId, viewerId),
            eq(schema.friendships.addresseeId, other.id),
          ),
          and(
            eq(schema.friendships.requesterId, other.id),
            eq(schema.friendships.addresseeId, viewerId),
          ),
        ),
      });
      const isFriend = friendship?.status === "ACCEPTED";
      if (!isFriend && friendship?.status !== "BLOCKED") {
        const [{ count: sentCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.conversationId, conversationId),
              eq(schema.messages.authorId, viewerId),
            ),
          );
        isRequest = Number(sentCount) === 0;
      }
    }
  }

  return {
    id: conversation.id,
    isGroup: conversation.isGroup,
    members,
    otherUser: members.find((m) => m.id !== viewerId) ?? null,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          content: lastMessage.content.slice(0, 80),
          createdAt: lastMessage.createdAt,
          authorId: lastMessage.authorId,
        }
      : null,
    unreadCount: Number(count),
    isRequest,
  };
}

export const dmRouter = createRouter({
  open: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
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
          if (conv && !conv.isGroup) return { conversationId: conv.id };
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
    const conversations: ConversationDTO[] = [];
    for (const r of rows) {
      const dto = await buildConversationDTO(r.conversationId, ctx.user.id);
      if (dto) conversations.push(dto);
    }
    conversations.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });
    return conversations;
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
});
