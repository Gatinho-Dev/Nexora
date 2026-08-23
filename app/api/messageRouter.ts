import { z } from "zod";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { publicFileUrl } from "./lib/urls";
import { RateLimits } from "@contracts/constants";
import type {
  MessageDTO,
  NotificationDTO,
  ReactionDTO,
} from "@contracts/types";
import { rateLimit } from "./utils/rateLimit";
import {
  requireChannelAccess,
  requireConversationAccess,
  toPublicUser,
} from "./utils/permissions";
import {
  broadcastToChannel,
  broadcastToConversation,
  sendToUsers,
} from "./realtime";

// ── DTO assembly ──────────────────────────────────────────────
async function buildMessageDTO(
  msg: typeof schema.messages.$inferSelect
): Promise<MessageDTO> {
  const db = getDb();
  const author = await db.query.users.findFirst({
    where: eq(schema.users.id, msg.authorId),
  });

  const attachmentRows = await db
    .select()
    .from(schema.attachments)
    .where(eq(schema.attachments.messageId, msg.id));

  const reactionRows = await db
    .select()
    .from(schema.messageReactions)
    .where(eq(schema.messageReactions.messageId, msg.id));
  const reactionMap = new Map<string, ReactionDTO>();
  for (const r of reactionRows) {
    const entry = reactionMap.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      userIds: [],
    };
    entry.count += 1;
    entry.userIds.push(r.userId);
    reactionMap.set(r.emoji, entry);
  }

  let replyTo: MessageDTO["replyTo"] = null;
  if (msg.replyToId) {
    const original = await db.query.messages.findFirst({
      where: eq(schema.messages.id, msg.replyToId),
    });
    if (original) {
      const originalAuthor = await db.query.users.findFirst({
        where: eq(schema.users.id, original.authorId),
      });
      replyTo = {
        id: original.id,
        content: original.content.slice(0, 200),
        author: originalAuthor
          ? toPublicUser(originalAuthor)
          : {
              id: 0,
              username: null,
              name: "Usuário removido",
              avatar: null,
              banner: null,
              bio: null,
              status: "offline",
            },
      };
    }
  }

  return {
    id: msg.id,
    channelId: msg.channelId,
    conversationId: msg.conversationId,
    authorId: msg.authorId,
    content: msg.content,
    replyToId: msg.replyToId,
    createdAt: msg.createdAt,
    editedAt: msg.editedAt,
    author: author
      ? toPublicUser(author)
      : {
          id: 0,
          username: null,
          name: "Usuário removido",
          avatar: null,
          banner: null,
          bio: null,
          status: "offline",
        },
    attachments: attachmentRows.map(a => ({
      id: a.id,
      fileId: a.fileId,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      url: publicFileUrl(a.fileId),
    })),
    reactions: [...reactionMap.values()],
    replyTo,
  };
}

async function notifyUsers(
  userIds: number[],
  data: {
    type: string;
    actorId: number;
    serverId?: number | null;
    channelId?: number | null;
    conversationId?: number | null;
    messageId?: number | null;
    content?: string | null;
  }
) {
  const db = getDb();
  for (const userId of userIds) {
    if (userId === data.actorId) continue;
    const [{ id }] = await db
      .insert(schema.notifications)
      .values({
        userId,
        type: data.type,
        actorId: data.actorId,
        serverId: data.serverId ?? null,
        channelId: data.channelId ?? null,
        conversationId: data.conversationId ?? null,
        messageId: data.messageId ?? null,
        content: data.content ?? null,
      })
      .$returningId();
    const row = await db.query.notifications.findFirst({
      where: eq(schema.notifications.id, id),
    });
    const actor = await db.query.users.findFirst({
      where: eq(schema.users.id, data.actorId),
    });
    if (row) {
      const dto: NotificationDTO = {
        id: row.id,
        type: row.type,
        actor: actor ? toPublicUser(actor) : null,
        serverId: row.serverId,
        channelId: row.channelId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        content: row.content,
        isRead: row.isRead,
        createdAt: row.createdAt,
      };
      sendToUsers([userId], { t: "notification", notification: dto });
    }
  }
}

async function processMentions(
  content: string,
  authorId: number,
  msg: typeof schema.messages.$inferSelect
) {
  const db = getDb();
  const mentionedIds = new Set<number>();

  if (msg.channelId) {
    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, msg.channelId),
    });
    if (!channel) return;
    const members = await db
      .select({ userId: schema.serverMembers.userId })
      .from(schema.serverMembers)
      .where(eq(schema.serverMembers.serverId, channel.serverId));

    if (content.includes("@everyone")) {
      for (const m of members) mentionedIds.add(m.userId);
    } else {
      const usernames = [...content.matchAll(/@([a-zA-Z0-9_.-]+)/g)].map(m =>
        m[1].toLowerCase()
      );
      if (usernames.length > 0) {
        for (const m of members) {
          const user = await db.query.users.findFirst({
            where: eq(schema.users.id, m.userId),
          });
          if (
            user?.username &&
            usernames.includes(user.username.toLowerCase())
          ) {
            mentionedIds.add(m.userId);
          }
        }
      }
    }
    mentionedIds.delete(authorId);
    if (mentionedIds.size > 0) {
      await notifyUsers([...mentionedIds].slice(0, 20), {
        type: "mention",
        actorId: authorId,
        serverId: channel.serverId,
        channelId: msg.channelId,
        messageId: msg.id,
        content: content.slice(0, 140),
      });
    }
  } else if (msg.conversationId) {
    const members = await db
      .select({ userId: schema.conversationMembers.userId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, msg.conversationId));
    await notifyUsers(
      members.map(m => m.userId).filter(id => id !== authorId),
      {
        type: "dm",
        actorId: authorId,
        conversationId: msg.conversationId,
        messageId: msg.id,
        content: content.slice(0, 140),
      }
    );
  }
}

const targetSchema = z
  .object({
    channelId: z.number().optional(),
    conversationId: z.number().optional(),
  })
  .refine(v => (v.channelId != null) !== (v.conversationId != null), {
    message: "Informe um canal ou uma conversa.",
  });

export const messageRouter = createRouter({
  list: authedQuery
    .input(
      targetSchema.extend({
        before: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [];
      if (input.channelId) {
        await requireChannelAccess(ctx.user.id, input.channelId);
        conditions.push(eq(schema.messages.channelId, input.channelId));
      } else {
        await requireConversationAccess(ctx.user.id, input.conversationId!);
        conditions.push(
          eq(schema.messages.conversationId, input.conversationId!)
        );
      }
      if (input.before)
        conditions.push(sql`${schema.messages.id} < ${input.before}`);

      const rows = await db
        .select()
        .from(schema.messages)
        .where(and(...conditions))
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);

      const messages: MessageDTO[] = [];
      for (const row of rows) {
        messages.push(await buildMessageDTO(row));
      }
      return {
        messages: messages.reverse(),
        hasMore: rows.length === input.limit,
      };
    }),

  send: authedQuery
    .input(
      targetSchema.extend({
        content: z.string().max(4000),
        replyToId: z.number().optional(),
        attachmentIds: z.array(z.number()).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(
        `message:${ctx.user.id}`,
        RateLimits.message.limit,
        RateLimits.message.windowMs
      );
      const db = getDb();

      const content = input.content.trim();
      if (
        !content &&
        (!input.attachmentIds || input.attachmentIds.length === 0)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A mensagem está vazia.",
        });
      }

      if (input.channelId) {
        const { perms } = await requireChannelAccess(
          ctx.user.id,
          input.channelId
        );
        if (!perms.has("SEND_MESSAGES")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não pode enviar mensagens neste canal.",
          });
        }
      } else {
        await requireConversationAccess(ctx.user.id, input.conversationId!);
      }

      const [{ id }] = await db
        .insert(schema.messages)
        .values({
          channelId: input.channelId ?? null,
          conversationId: input.conversationId ?? null,
          authorId: ctx.user.id,
          content,
          replyToId: input.replyToId ?? null,
        })
        .$returningId();

      // Attach previously uploaded files
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        const fileRows = await db
          .select()
          .from(schema.files)
          .where(inArray(schema.files.id, input.attachmentIds));
        for (const file of fileRows) {
          if (file.uploaderId !== ctx.user.id) continue;
          await db.insert(schema.attachments).values({
            messageId: id,
            fileId: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
          });
        }
      }

      // Author has implicitly read up to their own message
      await db
        .delete(schema.channelReads)
        .where(
          and(
            eq(schema.channelReads.userId, ctx.user.id),
            input.channelId
              ? eq(schema.channelReads.channelId, input.channelId)
              : eq(schema.channelReads.conversationId, input.conversationId!)
          )
        );
      await db.insert(schema.channelReads).values({
        userId: ctx.user.id,
        channelId: input.channelId ?? null,
        conversationId: input.conversationId ?? null,
        lastReadMessageId: id,
      });

      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, id),
      });
      const dto = await buildMessageDTO(msg!);

      if (input.channelId) {
        await broadcastToChannel(input.channelId, {
          t: "message:new",
          message: dto,
        });
      } else {
        await broadcastToConversation(input.conversationId!, {
          t: "message:new",
          message: dto,
        });
        sendToUsers([], { t: "dm:refresh" }); // no-op, kept for clarity
        const members = await db
          .select({ userId: schema.conversationMembers.userId })
          .from(schema.conversationMembers)
          .where(
            eq(schema.conversationMembers.conversationId, input.conversationId!)
          );
        sendToUsers(
          members.map(m => m.userId),
          { t: "dm:refresh" }
        );
      }

      // Notifications (mentions / dm / reply) - fire and forget
      processMentions(content, ctx.user.id, msg!).catch(() => {});
      if (input.replyToId) {
        const original = await db.query.messages.findFirst({
          where: eq(schema.messages.id, input.replyToId),
        });
        if (original && original.authorId !== ctx.user.id) {
          notifyUsers([original.authorId], {
            type: "reply",
            actorId: ctx.user.id,
            channelId: input.channelId ?? null,
            conversationId: input.conversationId ?? null,
            messageId: id,
            content: content.slice(0, 140),
          }).catch(() => {});
        }
      }

      return { message: dto };
    }),

  edit: authedQuery
    .input(
      z.object({
        messageId: z.number(),
        content: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, input.messageId),
      });
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada.",
        });
      if (msg.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você só pode editar suas próprias mensagens.",
        });
      }
      await db
        .update(schema.messages)
        .set({ content: input.content.trim(), editedAt: new Date() })
        .where(eq(schema.messages.id, input.messageId));
      const updated = await db.query.messages.findFirst({
        where: eq(schema.messages.id, input.messageId),
      });
      const dto = await buildMessageDTO(updated!);
      if (msg.channelId) {
        await broadcastToChannel(msg.channelId, {
          t: "message:update",
          message: dto,
        });
      } else if (msg.conversationId) {
        await broadcastToConversation(msg.conversationId, {
          t: "message:update",
          message: dto,
        });
      }
      return { message: dto };
    }),

  delete: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, input.messageId),
      });
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada.",
        });

      let allowed = msg.authorId === ctx.user.id;
      if (!allowed && msg.channelId) {
        const { perms } = await requireChannelAccess(
          ctx.user.id,
          msg.channelId
        );
        allowed = perms.has("MANAGE_MESSAGES");
      }
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não pode excluir esta mensagem.",
        });
      }

      await db
        .delete(schema.attachments)
        .where(eq(schema.attachments.messageId, msg.id));
      await db
        .delete(schema.messageReactions)
        .where(eq(schema.messageReactions.messageId, msg.id));
      await db.delete(schema.messages).where(eq(schema.messages.id, msg.id));

      const event = {
        t: "message:delete" as const,
        id: msg.id,
        channelId: msg.channelId,
        conversationId: msg.conversationId,
      };
      if (msg.channelId) await broadcastToChannel(msg.channelId, event);
      else if (msg.conversationId)
        await broadcastToConversation(msg.conversationId, event);
      return { ok: true };
    }),

  addReaction: authedQuery
    .input(
      z.object({ messageId: z.number(), emoji: z.string().min(1).max(32) })
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(
        `reaction:${ctx.user.id}`,
        RateLimits.reaction.limit,
        RateLimits.reaction.windowMs
      );
      const db = getDb();
      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, input.messageId),
      });
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada.",
        });
      if (msg.channelId) await requireChannelAccess(ctx.user.id, msg.channelId);
      else if (msg.conversationId)
        await requireConversationAccess(ctx.user.id, msg.conversationId);

      await db
        .insert(schema.messageReactions)
        .values({ messageId: msg.id, userId: ctx.user.id, emoji: input.emoji })
        .onDuplicateKeyUpdate({ set: { emoji: input.emoji } });

      const reactions = await getReactions(msg.id);
      const event = {
        t: "reaction" as const,
        messageId: msg.id,
        channelId: msg.channelId,
        conversationId: msg.conversationId,
        reactions,
      };
      if (msg.channelId) await broadcastToChannel(msg.channelId, event);
      else if (msg.conversationId)
        await broadcastToConversation(msg.conversationId, event);
      return { reactions };
    }),

  removeReaction: authedQuery
    .input(
      z.object({ messageId: z.number(), emoji: z.string().min(1).max(32) })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, input.messageId),
      });
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada.",
        });
      await db
        .delete(schema.messageReactions)
        .where(
          and(
            eq(schema.messageReactions.messageId, msg.id),
            eq(schema.messageReactions.userId, ctx.user.id),
            eq(schema.messageReactions.emoji, input.emoji)
          )
        );
      const reactions = await getReactions(msg.id);
      const event = {
        t: "reaction" as const,
        messageId: msg.id,
        channelId: msg.channelId,
        conversationId: msg.conversationId,
        reactions,
      };
      if (msg.channelId) await broadcastToChannel(msg.channelId, event);
      else if (msg.conversationId)
        await broadcastToConversation(msg.conversationId, event);
      return { reactions };
    }),

  // ── Read state / unread badges ──────────────────────────────
  markRead: authedQuery
    .input(targetSchema.extend({ lastMessageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.channelReads)
        .where(
          and(
            eq(schema.channelReads.userId, ctx.user.id),
            input.channelId
              ? eq(schema.channelReads.channelId, input.channelId)
              : eq(schema.channelReads.conversationId, input.conversationId!)
          )
        );
      await db.insert(schema.channelReads).values({
        userId: ctx.user.id,
        channelId: input.channelId ?? null,
        conversationId: input.conversationId ?? null,
        lastReadMessageId: input.lastMessageId,
      });
      // Clear related notifications
      if (input.channelId) {
        await db
          .update(schema.notifications)
          .set({ isRead: true })
          .where(
            and(
              eq(schema.notifications.userId, ctx.user.id),
              eq(schema.notifications.channelId, input.channelId)
            )
          );
      } else {
        await db
          .update(schema.notifications)
          .set({ isRead: true })
          .where(
            and(
              eq(schema.notifications.userId, ctx.user.id),
              eq(schema.notifications.conversationId, input.conversationId!)
            )
          );
      }
      return { ok: true };
    }),

  unread: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const readRows = await db
      .select()
      .from(schema.channelReads)
      .where(eq(schema.channelReads.userId, ctx.user.id));
    const readByChannel = new Map<number, number>();
    const readByConversation = new Map<number, number>();
    for (const r of readRows) {
      if (r.channelId) readByChannel.set(r.channelId, r.lastReadMessageId);
      if (r.conversationId)
        readByConversation.set(r.conversationId, r.lastReadMessageId);
    }

    const channels: Record<number, number> = {};
    const conversations: Record<number, number> = {};

    // Channels from my servers
    const memberships = await db
      .select({ serverId: schema.serverMembers.serverId })
      .from(schema.serverMembers)
      .where(eq(schema.serverMembers.userId, ctx.user.id));
    for (const m of memberships) {
      const channelRows = await db
        .select()
        .from(schema.channels)
        .where(
          and(
            eq(schema.channels.serverId, m.serverId),
            eq(schema.channels.type, "TEXT")
          )
        );
      for (const ch of channelRows) {
        const lastRead = readByChannel.get(ch.id) ?? 0;
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.channelId, ch.id),
              gt(schema.messages.id, lastRead),
              ne(schema.messages.authorId, ctx.user.id)
            )
          );
        if (Number(count) > 0) channels[ch.id] = Number(count);
      }
    }

    // DM conversations
    const convRows = await db
      .select({ conversationId: schema.conversationMembers.conversationId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, ctx.user.id));
    for (const c of convRows) {
      const lastRead = readByConversation.get(c.conversationId) ?? 0;
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, c.conversationId),
            gt(schema.messages.id, lastRead),
            ne(schema.messages.authorId, ctx.user.id)
          )
        );
      if (Number(count) > 0) conversations[c.conversationId] = Number(count);
    }

    return { channels, conversations };
  }),
});

async function getReactions(messageId: number): Promise<ReactionDTO[]> {
  const rows = await getDb()
    .select()
    .from(schema.messageReactions)
    .where(eq(schema.messageReactions.messageId, messageId));
  const map = new Map<string, ReactionDTO>();
  for (const r of rows) {
    const entry = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [] };
    entry.count += 1;
    entry.userIds.push(r.userId);
    map.set(r.emoji, entry);
  }
  return [...map.values()];
}
