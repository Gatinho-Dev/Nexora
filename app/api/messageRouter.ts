import { z } from "zod";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { publicFileUrl } from "./lib/urls";
import { attachPolls } from "./services/pollService";
import { attachEmbeds, enqueueEmbedsForMessage } from "./services/embeds/embedService";
import { RateLimits } from "@contracts/constants";
import type {
  MessageDTO,
  NotificationDTO,
  PublicUser,
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
import { assertCanInteract } from "./services/accountSafety";
import { runAutomodForMessage } from "./services/automod/service";
import { moderateTextMessage } from "./services/textModeration";
import { blockedBetween } from "./services/groupService";

// ── DTO assembly ──────────────────────────────────────────────
// ── DTO assembly ──────────────────────────────────────────────
/** Fallback para autor removido (nunca vaza dados de outra conta). */
function removedUser(): PublicUser {
  return {
    id: 0,
    username: null,
    name: "Usuário removido",
    avatar: null,
    banner: null,
    bio: null,
    status: "offline",
  };
}

function groupByMessage<T extends { messageId: number | null }>(
  rows: T[],
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    if (row.messageId == null) continue;
    const list = map.get(row.messageId) ?? [];
    list.push(row);
    map.set(row.messageId, list);
  }
  return map;
}

/**
 * Monta DTOs de MÚLTIPLAS mensagens com queries em lote (~8 queries
 * totais em vez de ~7 por mensagem). Usado por message.list e pelo
 * wrapper single abaixo.
 */
export async function buildMessageDTOs(
  rows: (typeof schema.messages.$inferSelect)[]
): Promise<MessageDTO[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const messageIds = rows.map(r => r.id);
  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const replyToIds = [
    ...new Set(
      rows.filter(r => r.replyToId != null).map(r => r.replyToId as number),
    ),
  ];
  const threadIds = [
    ...new Set(
      rows.filter(r => r.threadId != null).map(r => r.threadId as number),
    ),
  ];

  const [userRows, attachmentRows, reactionRows, replyRows] =
    await Promise.all([
      db
        .select()
        .from(schema.users)
        .where(inArray(schema.users.id, authorIds)),
      db
        .select()
        .from(schema.attachments)
        .where(inArray(schema.attachments.messageId, messageIds)),
      db
        .select()
        .from(schema.messageReactions)
        .where(inArray(schema.messageReactions.messageId, messageIds)),
      replyToIds.length > 0
        ? db
            .select()
            .from(schema.messages)
            .where(inArray(schema.messages.id, replyToIds))
        : Promise.resolve([] as (typeof schema.messages.$inferSelect)[]),
    ]);

  // Autores das mensagens respondidas (segunda passada só se faltar).
  const replyAuthorIds = [
    ...new Set(
      replyRows.map(r => r.authorId).filter(id => !authorIds.includes(id)),
    ),
  ];
  const replyAuthorRows =
    replyAuthorIds.length > 0
      ? await db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, replyAuthorIds))
      : [];
  const usersById = new Map(
    [...userRows, ...replyAuthorRows].map(u => [u.id, u]),
  );

  const moderationRows =
    attachmentRows.length > 0
      ? await db
          .select()
          .from(schema.mediaModeration)
          .where(
            inArray(
              schema.mediaModeration.fileId,
              attachmentRows.map(a => a.fileId),
            ),
          )
      : [];
  const moderationByFile = new Map(moderationRows.map(m => [m.fileId, m]));
  const attachmentsByMessage = groupByMessage(attachmentRows);
  const reactionsByMessage = groupByMessage(reactionRows);
  const replyById = new Map(replyRows.map(r => [r.id, r]));

  // Contagem de respostas de threads: UMA query agrupada.
  const countByThread = new Map<number, number>();
  if (threadIds.length > 0) {
    const counts = await db
      .select({
        threadId: schema.messages.threadId,
        count: sql<number>`count(*)`,
      })
      .from(schema.messages)
      .where(inArray(schema.messages.threadId, threadIds))
      .groupBy(schema.messages.threadId);
    for (const c of counts) {
      if (c.threadId != null) countByThread.set(c.threadId, Number(c.count));
    }
  }

  const buildReplyTo = (
    msg: typeof schema.messages.$inferSelect
  ): MessageDTO["replyTo"] => {
    if (!msg.replyToId) return null;
    const original = replyById.get(msg.replyToId);
    if (!original) return null;
    const originalAuthor = usersById.get(original.authorId);
    return {
      id: original.id,
      content: original.tag === "removed" ? "" : original.content.slice(0, 200),
      author: originalAuthor
        ? toPublicUser(originalAuthor)
        : removedUser(),
    };
  };

  const dtos: MessageDTO[] = rows.map(msg => {
    const author = usersById.get(msg.authorId);
    const attachmentList = attachmentsByMessage.get(msg.id) ?? [];
    const reactionList = reactionsByMessage.get(msg.id) ?? [];
    const reactionMap = new Map<string, ReactionDTO>();
    for (const r of reactionList) {
      const entry = reactionMap.get(r.emoji) ?? {
        emoji: r.emoji,
        count: 0,
        userIds: [],
      };
      entry.count += 1;
      entry.userIds.push(r.userId);
      reactionMap.set(r.emoji, entry);
    }
    const dto: MessageDTO = {
      id: msg.id,
      channelId: msg.channelId,
      conversationId: msg.conversationId,
      authorId: msg.authorId,
      content: msg.tag === "removed" ? "" : msg.content,
      replyToId: msg.replyToId,
      tag: msg.tag ?? null,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt,
      author: author ? toPublicUser(author) : removedUser(),
      attachments: attachmentList.map(a => {
        const moderation = moderationByFile.get(a.fileId);
        return {
          id: a.id,
          fileId: a.fileId,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: publicFileUrl(a.fileId),
          spoiler: a.spoiler,
          moderationStatus:
            moderation?.status === "processing" ||
            moderation?.status === "approved" ||
            moderation?.status === "sensitive" ||
            moderation?.status === "blocked" || moderation?.status === "review_required"
              ? moderation.status
              : a.mimeType.startsWith("image/") ? ("review_required" as const) : ("approved" as const),
          sensitive: moderation?.sensitive ?? false,
          adultOnly: moderation?.adultOnly ?? false,
          allowReveal: moderation?.allowReveal ?? true,
        };
      }),
      reactions: [...reactionMap.values()],
      replyTo: buildReplyTo(msg),
    };
    if (msg.threadId != null) {
      dto.threadReplyCount = countByThread.get(msg.threadId) ?? 0;
    }
    return dto;
  });

  // Enquetes e embeds em lote (helpers já existentes).
  await attachPolls(dtos, null);
  await attachEmbeds(dtos);
  return dtos;
}

/** Wrapper single-message (send, edits, forum, background jobs). */
export async function buildMessageDTO(
  msg: typeof schema.messages.$inferSelect
): Promise<MessageDTO> {
  const [dto] = await buildMessageDTOs([msg]);
  return dto;
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
    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, msg.conversationId),
    });
    if (!conversation) return;
    const memberRows = await db
      .select({
        userId: schema.conversationMembers.userId,
        role: schema.conversationMembers.role,
        level: schema.conversationMembers.notificationLevel,
        mutedUntil: schema.conversationMembers.mutedUntil,
      })
      .from(schema.conversationMembers)
      .where(
        eq(schema.conversationMembers.conversationId, msg.conversationId)
      );

    // Direct-message popups honor per-account mute and request decisions.
    // The unread state is independent and continues to update in the inbox.
    if (!conversation.isGroup) {
      const preferences = await db
        .select()
        .from(schema.conversationPreferences)
        .where(
          eq(
            schema.conversationPreferences.conversationId,
            msg.conversationId,
          ),
        );
      const preferenceByUser = new Map(
        preferences.map(preference => [preference.userId, preference]),
      );
      const now = Date.now();
      await notifyUsers(
        memberRows
          .map(member => member.userId)
          .filter(userId => {
            if (userId === authorId) return false;
            const preference = preferenceByUser.get(userId);
            if (preference?.mutedForever) return false;
            if (
              preference?.mutedUntil &&
              new Date(preference.mutedUntil).getTime() > now
            ) {
              return false;
            }
            return !["ignored", "spam"].includes(
              preference?.requestState ?? "",
            );
          }),
        {
          type: "dm",
          actorId: authorId,
          conversationId: msg.conversationId,
          messageId: msg.id,
          content: content.slice(0, 140),
        }
      );
      return;
    }

    // Groups: honor per-member notification settings and @mention rules.
    const usernames = [...content.matchAll(/@([a-zA-Z0-9_.-]+)/g)].map(m =>
      m[1].toLowerCase()
    );
    const mentionAll = /@(everyone|todos)\b/i.test(content);
    const authorIsManager =
      conversation.ownerId === authorId ||
      memberRows.some(
        m => m.userId === authorId && (m.role === "owner" || m.role === "admin")
      );

    const mentionedIds = new Set<number>();
    if (usernames.length > 0 || mentionAll) {
      for (const m of memberRows) {
        if (mentionAll && authorIsManager) {
          mentionedIds.add(m.userId);
          continue;
        }
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
    mentionedIds.delete(authorId);

    const now = Date.now();
    const targets: Array<{ userId: number; mention: boolean }> = [];
    for (const m of memberRows) {
      if (m.userId === authorId) continue;
      if (m.mutedUntil && new Date(m.mutedUntil).getTime() > now) continue;
      const isMentioned = mentionedIds.has(m.userId);
      if (m.level === "muted") continue;
      if (m.level === "mentions" && !isMentioned) continue;
      targets.push({ userId: m.userId, mention: isMentioned });
    }

    for (const t of targets) {
      await notifyUsers([t.userId], {
        type: t.mention ? "mention" : "dm",
        actorId: authorId,
        conversationId: msg.conversationId,
        channelId: null,
        messageId: msg.id,
        content: content.slice(0, 140),
      });
    }
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

// ── Forum channels ────────────────────────────────────────────
// A post is any top-level message in a FORUM channel; replies are regular
// messages whose replyToId points at the post.
export const forumRouter = createRouter({
  posts: authedQuery
    .input(
      z.object({
        channelId: z.number(),
        before: z.number().optional(),
        tag: z.string().max(24).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const { perms } = await requireChannelAccess(ctx.user.id, input.channelId);
      if (!perms.has("READ_MESSAGES")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não pode ver este canal.",
        });
      }
      const db = getDb();
      const conditions = [
        eq(schema.messages.channelId, input.channelId),
        sql`${schema.messages.replyToId} IS NULL`,
      ];
      if (input.tag)
        conditions.push(eq(schema.messages.tag, input.tag));
      if (input.before)
        conditions.push(sql`${schema.messages.id} < ${input.before}`);

      const rows = await db
        .select()
        .from(schema.messages)
        .where(and(...conditions))
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);

      // Reply counts in one grouped query
      const postIds = rows.map(r => r.id);
      const replyCounts: Record<number, number> = {};
      if (postIds.length > 0) {
        const counts = await db
          .select({
            replyToId: schema.messages.replyToId,
            count: sql<number>`count(*)`,
          })
          .from(schema.messages)
          .where(inArray(schema.messages.replyToId, postIds))
          .groupBy(schema.messages.replyToId);
        for (const c of counts) {
          if (c.replyToId != null) replyCounts[c.replyToId] = Number(c.count);
        }
      }

      const posts: MessageDTO[] = [];
      for (const row of rows) {
        posts.push(await buildMessageDTO(row));
      }
      return { posts, replyCounts };
    }),

  thread: authedQuery
    .input(z.object({ channelId: z.number(), postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { perms } = await requireChannelAccess(ctx.user.id, input.channelId);
      if (!perms.has("READ_MESSAGES")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não pode ver este canal.",
        });
      }
      const db = getDb();
      const [post] = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.id, input.postId),
            eq(schema.messages.channelId, input.channelId)
          )
        )
        .limit(1);
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado." });
      }
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.replyToId, input.postId))
        .orderBy(schema.messages.id);
      const replies: MessageDTO[] = [];
      for (const row of rows) {
        replies.push(await buildMessageDTO(row));
      }
      return { post: await buildMessageDTO(post), replies };
    }),
});

export const messageRouter = createRouter({
  list: authedQuery
    .input(
      targetSchema.extend({
        before: z.number().optional(),
        threadId: z.number().optional(),
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
      if (input.threadId != null) {
        conditions.push(
          input.threadId === 0
            ? sql`${schema.messages.threadId} IS NULL`
            : eq(schema.messages.threadId, input.threadId)
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

      // Batch: ~8 queries totais em vez de ~7 por mensagem (N+1 eliminado).
      const messages = await buildMessageDTOs(rows);
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
        threadId: z.number().optional(),
        tag: z.string().min(1).max(24).optional(),
        attachmentIds: z.array(z.number()).max(10).optional(),
        spoilerIds: z.array(z.number()).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(
        `message:${ctx.user.id}`,
        RateLimits.message.limit,
        RateLimits.message.windowMs
      );
      const db = getDb();

      // Suspended / banned accounts cannot send messages.
      await assertCanInteract(ctx.user.id);

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
        const conversation = await db.query.conversations.findFirst({
          where: eq(schema.conversations.id, input.conversationId!),
        });
        if (conversation && !conversation.isGroup) {
          const otherMember = await db.query.conversationMembers.findFirst({
            where: and(
              eq(
                schema.conversationMembers.conversationId,
                input.conversationId!,
              ),
              ne(schema.conversationMembers.userId, ctx.user.id),
            ),
          });
          if (
            otherMember &&
            (await blockedBetween(ctx.user.id, otherMember.userId))
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Esta conversa não pode receber novas mensagens.",
            });
          }
        }
      }

      let validatedFiles: (typeof schema.files.$inferSelect)[] = [];
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        validatedFiles = await db.select().from(schema.files).where(inArray(schema.files.id, input.attachmentIds));
        if (validatedFiles.length !== input.attachmentIds.length || validatedFiles.some(file => file.uploaderId !== ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Um dos anexos não existe ou não pertence à sua conta." });
        }
        const imageIds = validatedFiles.filter(file => file.mimeType.startsWith("image/")).map(file => file.id);
        if (imageIds.length) {
          const mods = await db.select().from(schema.mediaModeration).where(inArray(schema.mediaModeration.fileId, imageIds));
          const byId = new Map(mods.map(row => [row.fileId, row]));
          for (const imageId of imageIds) {
            const moderation = byId.get(imageId);
            if (!moderation || !["approved", "sensitive"].includes(moderation.status)) {
              throw new TRPCError({ code: "FORBIDDEN", message: moderation?.status === "blocked" ? "Uma das mídias foi bloqueada pela segurança do Nexora." : "Verificando mídia... Aguarde a análise antes de enviar." });
            }
          }
        }
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

      // Attach previously uploaded files — only media already cleared by
      // content-safety may be published.
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        for (const file of validatedFiles) {
          await db.insert(schema.attachments).values({
            messageId: id,
            fileId: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
            spoiler: (input.spoilerIds ?? []).includes(file.id),
          });
        }
      }

      // Author has implicitly read up to their own message. The atomic upsert
      // prevents an older request from moving the read cursor backwards.
      await db
        .insert(schema.channelReads)
        .values({
          userId: ctx.user.id,
          channelId: input.channelId ?? null,
          conversationId: input.conversationId ?? null,
          lastReadMessageId: id,
        })
        .onDuplicateKeyUpdate({
          set: {
            lastReadMessageId: sql`greatest(lastReadMessageId, values(lastReadMessageId))`,
            updatedAt: new Date(),
          },
        });
      sendToUsers([ctx.user.id], {
        t: "read:update",
        userId: ctx.user.id,
        channelId: input.channelId,
        conversationId: input.conversationId,
        lastMessageId: id,
      });

      // Embeds de links: cria as linhas processing ANTES do DTO (skeleton
      // aparece para TODOS no message:new) e resolve em background.
      await enqueueEmbedsForMessage(
        id,
        content,
        input.channelId ?? null,
        input.conversationId ?? null,
      ).catch(() => {});

      if (input.channelId) {
        // AutoMod do servidor roda ANTES de publicar (regras locais rápidas).
        const channel = await db.query.channels.findFirst({
          where: eq(schema.channels.id, input.channelId),
        });
        if (channel) {
          const automod = await runAutomodForMessage({
            serverId: channel.serverId,
            channelId: input.channelId,
            authorId: ctx.user.id,
            content,
          });
          if (automod.blocked) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: automod.reason ?? "Mensagem bloqueada pelo AutoMod.",
            });
          }
        }
      }

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

      // Moderação de texto por IA — assíncrona, nunca bloqueia o envio.
      void moderateTextMessage({
        id,
        authorId: ctx.user.id,
        channelId: input.channelId ?? null,
        conversationId: input.conversationId ?? null,
        content,
      }).catch(() => {});

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
      await assertCanInteract(ctx.user.id);
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
      if (input.channelId) {
        await requireChannelAccess(ctx.user.id, input.channelId);
      } else {
        await requireConversationAccess(ctx.user.id, input.conversationId!);
      }
      const message = await db.query.messages.findFirst({
        where: and(
          eq(schema.messages.id, input.lastMessageId),
          input.channelId
            ? eq(schema.messages.channelId, input.channelId)
            : eq(schema.messages.conversationId, input.conversationId!),
        ),
      });
      if (!message) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A mensagem informada não pertence a esta conversa.",
        });
      }
      await db
        .insert(schema.channelReads)
        .values({
          userId: ctx.user.id,
          channelId: input.channelId ?? null,
          conversationId: input.conversationId ?? null,
          lastReadMessageId: input.lastMessageId,
        })
        .onDuplicateKeyUpdate({
          set: {
            lastReadMessageId: sql`greatest(lastReadMessageId, values(lastReadMessageId))`,
            updatedAt: new Date(),
          },
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
      sendToUsers([ctx.user.id], {
        t: "read:update",
        userId: ctx.user.id,
        channelId: input.channelId,
        conversationId: input.conversationId,
        lastMessageId: input.lastMessageId,
      });
      return { ok: true };
    }),

  unread: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const readRows = await db
      .select()
      .from(schema.channelReads)
      .where(eq(schema.channelReads.userId, ctx.user.id));
    const readByChannel = new Map<number, number>();
    for (const r of readRows) {
      if (r.channelId) readByChannel.set(r.channelId, r.lastReadMessageId);
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
    const conversationIds = convRows.map(row => row.conversationId);
    if (conversationIds.length > 0) {
      const unreadConversationRows = await db
        .select({
          conversationId: schema.messages.conversationId,
          count: sql<number>`count(*)`,
        })
        .from(schema.messages)
        .where(
          and(
            inArray(schema.messages.conversationId, conversationIds),
            ne(schema.messages.authorId, ctx.user.id),
            sql`${schema.messages.id} > coalesce((select max(cr.lastReadMessageId) from channel_reads cr where cr.userId = ${ctx.user.id} and cr.conversationId = ${schema.messages.conversationId}), 0)`,
          ),
        )
        .groupBy(schema.messages.conversationId);
      for (const row of unreadConversationRows) {
        const conversationId = Number(row.conversationId);
        if (conversationId > 0 && Number(row.count) > 0) {
          conversations[conversationId] = Number(row.count);
        }
      }
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
