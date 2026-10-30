import { z } from "zod";
import {
  and,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import {
  requireChannelAccess,
  requireConversationAccess,
  filterVisibleChannels,
} from "../utils/permissions";
import { buildMessageDTO, buildMessageDTOs } from "../messageRouter";
import { broadcastToChannel, broadcastToConversation } from "../realtime";
import { logServerAudit } from "../services/serverAudit";
import { rateLimit } from "../utils/rateLimit";
import { RateLimits } from "@contracts/constants";
import { assertCanInteract } from "../services/accountSafety";

async function accessibleMessage(userId: number, messageId: number) {
  const message = await getDb().query.messages.findFirst({
    where: eq(schema.messages.id, messageId),
  });
  if (!message) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
  }
  if (message.channelId) await requireChannelAccess(userId, message.channelId);
  else if (message.conversationId)
    await requireConversationAccess(userId, message.conversationId);
  else throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
  return message;
}

export function parseNaturalSearch(raw: string) {
  const filters: {
    text: string;
    from?: string;
    in?: string;
    server?: string;
    before?: Date;
    after?: Date;
    has?: "image" | "file" | "link" | "video" | "audio";
    mentions?: string;
  } = { text: raw };
  const token = /(?:^|\s)(from|in|server|before|after|has|mentions):("[^"]+"|\S+)/gi;
  filters.text = raw.replace(token, (_full, key: string, value: string) => {
    const clean = value.replace(/^"|"$/g, "");
    if (key === "before" || key === "after") {
      const parsed = new Date(clean);
      if (!Number.isNaN(parsed.getTime())) filters[key] = parsed;
    } else if (key === "has") {
      if (["image", "file", "link", "video", "audio"].includes(clean)) {
        filters.has = clean as typeof filters.has;
      }
    } else if (["from", "in", "server", "mentions"].includes(key)) {
      filters[key as "from" | "in" | "server" | "mentions"] = clean;
    }
    return " ";
  }).replace(/\s+/g, " ").trim();

  const naturalFrom = filters.text.match(/mensagens?\s+(?:do|da|de)\s+([\p{L}\d_.-]+)/iu);
  if (!filters.from && naturalFrom) {
    filters.from = naturalFrom[1];
    filters.text = filters.text.replace(naturalFrom[0], " ");
  }
  const naturalImages = filters.text.match(/(?:com|que tenham?)\s+imagens?/iu);
  if (!filters.has && naturalImages) {
    filters.has = "image";
    filters.text = filters.text.replace(naturalImages[0], " ");
  }
  const naturalFiles = filters.text.match(/(?:com|que tenham?)\s+arquivos?/iu);
  if (!filters.has && naturalFiles) {
    filters.has = "file";
    filters.text = filters.text.replace(naturalFiles[0], " ");
  }
  const months: Record<string, number> = {
    janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4,
    junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9,
    novembro: 10, dezembro: 11,
  };
  for (const [name, month] of Object.entries(months)) {
    if (new RegExp(`\\b${name}\\b`, "iu").test(raw)) {
      const year = new Date().getFullYear();
      filters.after = new Date(Date.UTC(year, month, 1));
      filters.before = new Date(Date.UTC(year, month + 1, 1));
      filters.text = filters.text.replace(
        new RegExp(`(?:em|de|durante)?\\s*\\b${name}\\b`, "iu"),
        " ",
      );
      break;
    }
  }
  filters.text = filters.text.replace(/\s+/g, " ").trim();
  return filters;
}

export const messageFeaturesRouter = createRouter({
  pins: authedQuery
    .input(z.object({ channelId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireChannelAccess(ctx.user.id, input.channelId);
      const rows = await getDb()
        .select({ pin: schema.channelPinnedMessages, message: schema.messages })
        .from(schema.channelPinnedMessages)
        .innerJoin(
          schema.messages,
          eq(schema.messages.id, schema.channelPinnedMessages.messageId),
        )
        .where(eq(schema.channelPinnedMessages.channelId, input.channelId))
        .orderBy(desc(schema.channelPinnedMessages.id))
        .limit(100);
      const messages = await buildMessageDTOs(rows.map(row => row.message));
      return rows.map((row, index) => ({ ...row.pin, message: messages[index] }));
    }),

  setPinned: authedQuery
    .input(z.object({ messageId: z.number(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const message = await accessibleMessage(ctx.user.id, input.messageId);
      if (!message.channelId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use as fixações da conversa para DMs." });
      }
      const { channel, perms } = await requireChannelAccess(ctx.user.id, message.channelId);
      if (!perms.has("ADMINISTRATOR") && !perms.has("PIN_MESSAGES")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode gerenciar mensagens fixadas." });
      }
      if (input.pinned) {
        await getDb().insert(schema.channelPinnedMessages).values({
          channelId: channel.id,
          messageId: message.id,
          pinnedByUserId: ctx.user.id,
        }).onDuplicateKeyUpdate({ set: { pinnedByUserId: ctx.user.id } });
      } else {
        await getDb().delete(schema.channelPinnedMessages).where(and(
          eq(schema.channelPinnedMessages.channelId, channel.id),
          eq(schema.channelPinnedMessages.messageId, message.id),
        ));
      }
      await logServerAudit({
        serverId: channel.serverId,
        actorUserId: ctx.user.id,
        action: input.pinned ? "MESSAGE_PIN" : "MESSAGE_UNPIN",
        targetType: "message",
        targetId: message.id,
      });
      await broadcastToChannel(channel.id, { t: "pins:refresh", channelId: channel.id });
      return { ok: true };
    }),

  saved: authedQuery
    .input(z.object({ folderId: z.number().nullable().optional(), query: z.string().max(200).default("") }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(schema.savedMessages.userId, ctx.user.id)];
      if (input.folderId !== undefined) {
        conditions.push(input.folderId === null
          ? sql`${schema.savedMessages.folderId} IS NULL`
          : eq(schema.savedMessages.folderId, input.folderId));
      }
      const rows = await getDb()
        .select({ saved: schema.savedMessages, message: schema.messages })
        .from(schema.savedMessages)
        .innerJoin(schema.messages, eq(schema.messages.id, schema.savedMessages.messageId))
        .where(and(
          ...conditions,
          input.query ? like(schema.messages.content, `%${input.query}%`) : undefined,
        ))
        .orderBy(desc(schema.savedMessages.id))
        .limit(200);
      const visible: typeof rows = [];
      for (const row of rows) {
        try {
          await accessibleMessage(ctx.user.id, row.message.id);
          visible.push(row);
        } catch {
          // A saved entry remains private but inaccessible source content is not returned.
        }
      }
      const messages = await buildMessageDTOs(visible.map(row => row.message));
      return visible.map((row, index) => ({ ...row.saved, message: messages[index] }));
    }),

  save: authedQuery
    .input(z.object({
      messageId: z.number(),
      folderId: z.number().nullable().optional(),
      tags: z.array(z.string().min(1).max(32)).max(10).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      await accessibleMessage(ctx.user.id, input.messageId);
      if (input.folderId) {
        const folder = await getDb().query.savedMessageFolders.findFirst({
          where: and(
            eq(schema.savedMessageFolders.id, input.folderId),
            eq(schema.savedMessageFolders.userId, ctx.user.id),
          ),
        });
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Pasta não encontrada." });
      }
      await getDb().insert(schema.savedMessages).values({
        userId: ctx.user.id,
        messageId: input.messageId,
        folderId: input.folderId ?? null,
        tags: [...new Set(input.tags.map(tag => tag.trim().toLowerCase()))],
      }).onDuplicateKeyUpdate({ set: {
        folderId: input.folderId ?? null,
        tags: [...new Set(input.tags.map(tag => tag.trim().toLowerCase()))],
      } });
      return { ok: true };
    }),

  unsave: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getDb().delete(schema.savedMessages).where(and(
        eq(schema.savedMessages.userId, ctx.user.id),
        eq(schema.savedMessages.messageId, input.messageId),
      ));
      return { ok: true };
    }),

  folders: authedQuery.query(async ({ ctx }) => getDb()
    .select()
    .from(schema.savedMessageFolders)
    .where(eq(schema.savedMessageFolders.userId, ctx.user.id))
    .orderBy(schema.savedMessageFolders.position, schema.savedMessageFolders.id)),

  upsertFolder: authedQuery
    .input(z.object({ id: z.number().optional(), name: z.string().min(1).max(64), color: z.string().regex(/^#[0-9a-f]{6}$/i) }))
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        await getDb().update(schema.savedMessageFolders).set({ name: input.name, color: input.color }).where(and(
          eq(schema.savedMessageFolders.id, input.id),
          eq(schema.savedMessageFolders.userId, ctx.user.id),
        ));
        return { id: input.id };
      }
      const [{ id }] = await getDb().insert(schema.savedMessageFolders).values({
        userId: ctx.user.id,
        name: input.name,
        color: input.color,
      }).$returningId();
      return { id };
    }),

  search: authedQuery
    .input(z.object({ query: z.string().min(1).max(500), cursor: z.number().optional(), limit: z.number().min(1).max(50).default(25) }))
    .query(async ({ ctx, input }) => {
      rateLimit(`search:${ctx.user.id}`, RateLimits.search.limit, RateLimits.search.windowMs);
      const db = getDb();
      const memberships = await db.select({ serverId: schema.serverMembers.serverId }).from(schema.serverMembers).where(eq(schema.serverMembers.userId, ctx.user.id));
      const conversations = await db.select({ conversationId: schema.conversationMembers.conversationId }).from(schema.conversationMembers).where(eq(schema.conversationMembers.userId, ctx.user.id));
      const serverIds = memberships.map(row => row.serverId);
      const conversationIds = conversations.map(row => row.conversationId);
      const channels = serverIds.length
        ? await db.select().from(schema.channels).where(inArray(schema.channels.serverId, serverIds))
        : [];
      const visibleChannels = await filterVisibleChannels(ctx.user.id, channels, "READ_MESSAGES");
      const readableChannelIds = visibleChannels.map(channel => channel.id);
      if (!readableChannelIds.length && !conversationIds.length) return { items: [], nextCursor: null };

      const parsed = parseNaturalSearch(input.query);
      const conditions = [
        or(
          readableChannelIds.length ? inArray(schema.messages.channelId, readableChannelIds) : undefined,
          conversationIds.length ? inArray(schema.messages.conversationId, conversationIds) : undefined,
        )!,
      ];
      if (input.cursor) conditions.push(sql`${schema.messages.id} < ${input.cursor}`);
      if (parsed.text) conditions.push(like(schema.messages.content, `%${parsed.text}%`));
      if (parsed.before) conditions.push(sql`${schema.messages.createdAt} < ${parsed.before}`);
      if (parsed.after) conditions.push(sql`${schema.messages.createdAt} >= ${parsed.after}`);
      if (parsed.mentions) conditions.push(like(schema.messages.content, `%@${parsed.mentions}%`));
      if (parsed.from) {
        const authors = await db.select({ id: schema.users.id }).from(schema.users).where(or(
          like(schema.users.username, parsed.from),
          like(schema.users.name, parsed.from),
        ));
        if (!authors.length) return { items: [], nextCursor: null };
        conditions.push(inArray(schema.messages.authorId, authors.map(author => author.id)));
      }
      if (parsed.in) {
        const ids = channels.filter(channel => channel.name.toLowerCase() === parsed.in!.toLowerCase() || String(channel.id) === parsed.in).map(channel => channel.id);
        if (!ids.length) return { items: [], nextCursor: null };
        conditions.push(inArray(schema.messages.channelId, ids));
      }
      if (parsed.server) {
        const ids = channels.filter(channel => {
          const serverId = serverIds.find(id => id === channel.serverId);
          return serverId && (String(serverId) === parsed.server);
        }).map(channel => channel.id);
        if (!ids.length) {
          const matchingServers = await db.select({ id: schema.servers.id }).from(schema.servers).where(like(schema.servers.name, parsed.server));
          const allowedServers = matchingServers.map(row => row.id).filter(id => serverIds.includes(id));
          const fallbackIds = channels.filter(channel => allowedServers.includes(channel.serverId)).map(channel => channel.id);
          if (!fallbackIds.length) return { items: [], nextCursor: null };
          conditions.push(inArray(schema.messages.channelId, fallbackIds));
        } else conditions.push(inArray(schema.messages.channelId, ids));
      }
      if (parsed.has === "link") conditions.push(sql`${schema.messages.content} REGEXP 'https?://'`);
      if (parsed.has && parsed.has !== "link") {
        const prefix = parsed.has === "file" ? "%" : `${parsed.has}/%`;
        conditions.push(sql`EXISTS (SELECT 1 FROM attachments a WHERE a.messageId = ${schema.messages.id} AND a.mimeType LIKE ${prefix})`);
      }

      const rows = await db.select().from(schema.messages).where(and(...conditions)).orderBy(desc(schema.messages.id)).limit(input.limit + 1);
      const page = rows.slice(0, input.limit);
      const messages = await buildMessageDTOs(page);
      const channelById = new Map(channels.map(channel => [channel.id, channel]));
      return {
        items: messages.map(message => {
          const channel = message.channelId ? channelById.get(message.channelId) : null;
          return {
            message,
            context: channel
              ? { serverId: channel.serverId, channelId: channel.id, channelName: channel.name, conversationId: null }
              : { serverId: null, channelId: null, channelName: null, conversationId: message.conversationId },
          };
        }),
        nextCursor: rows.length > input.limit ? page.at(-1)?.id ?? null : null,
      };
    }),

  threadSubscription: authedQuery
    .input(z.object({ threadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const thread = await getDb().query.threads.findFirst({ where: eq(schema.threads.id, input.threadId) });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread não encontrada." });
      await requireChannelAccess(ctx.user.id, thread.channelId);
      const subscription = await getDb().query.threadSubscriptions.findFirst({ where: and(
        eq(schema.threadSubscriptions.threadId, thread.id),
        eq(schema.threadSubscriptions.userId, ctx.user.id),
      ) });
      return subscription ?? { threadId: thread.id, userId: ctx.user.id, level: "none" as const };
    }),

  followThread: authedQuery
    .input(z.object({ threadId: z.number(), level: z.enum(["all", "mentions", "none"]) }))
    .mutation(async ({ ctx, input }) => {
      const thread = await getDb().query.threads.findFirst({ where: eq(schema.threads.id, input.threadId) });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread não encontrada." });
      await requireChannelAccess(ctx.user.id, thread.channelId);
      await getDb().insert(schema.threadSubscriptions).values({
        threadId: thread.id,
        userId: ctx.user.id,
        level: input.level,
      }).onDuplicateKeyUpdate({ set: { level: input.level, updatedAt: new Date() } });
      return { ok: true };
    }),

  followedThreads: authedQuery.query(async ({ ctx }) => getDb()
    .select({ subscription: schema.threadSubscriptions, thread: schema.threads, channel: schema.channels })
    .from(schema.threadSubscriptions)
    .innerJoin(schema.threads, eq(schema.threads.id, schema.threadSubscriptions.threadId))
    .innerJoin(schema.channels, eq(schema.channels.id, schema.threads.channelId))
    .where(and(
      eq(schema.threadSubscriptions.userId, ctx.user.id),
      sql`${schema.threadSubscriptions.level} <> 'none'`,
    ))
    .orderBy(desc(schema.threadSubscriptions.updatedAt))
    .limit(200)),

  forward: authedQuery
    .input(z.object({ messageId: z.number(), channelId: z.number().optional(), conversationId: z.number().optional() }).refine(value => (value.channelId != null) !== (value.conversationId != null), "Escolha um destino."))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      const source = await accessibleMessage(ctx.user.id, input.messageId);
      const author = await getDb().query.users.findFirst({ where: eq(schema.users.id, source.authorId) });
      let originLabel = "Conversa privada";
      if (source.channelId) {
        const channel = await getDb().query.channels.findFirst({ where: eq(schema.channels.id, source.channelId) });
        originLabel = channel ? `#${channel.name}` : "Canal removido";
      }
      if (input.channelId) {
        const { perms } = await requireChannelAccess(ctx.user.id, input.channelId);
        if (!perms.has("SEND_MESSAGES")) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode enviar nesse canal." });
      } else await requireConversationAccess(ctx.user.id, input.conversationId!);
      const [{ id }] = await getDb().insert(schema.messages).values({
        channelId: input.channelId ?? null,
        conversationId: input.conversationId ?? null,
        authorId: ctx.user.id,
        content: source.content,
      }).$returningId();
      await getDb().insert(schema.messageForwards).values({
        messageId: id,
        sourceMessageId: source.id,
        forwardedByUserId: ctx.user.id,
        sourceSnapshot: {
          authorName: author?.name ?? author?.username ?? "Usuário removido",
          authorAvatar: author?.avatar ?? null,
          content: source.content,
          originLabel,
          createdAt: source.createdAt.toISOString(),
        },
      });
      const row = await getDb().query.messages.findFirst({ where: eq(schema.messages.id, id) });
      const message = await buildMessageDTO(row!);
      if (input.channelId) await broadcastToChannel(input.channelId, { t: "message:new", message });
      else await broadcastToConversation(input.conversationId!, { t: "message:new", message });
      return { message };
    }),

  scheduled: authedQuery.query(async ({ ctx }) => getDb()
    .select()
    .from(schema.scheduledMessages)
    .where(and(
      eq(schema.scheduledMessages.userId, ctx.user.id),
      inArray(schema.scheduledMessages.state, ["PENDING", "PROCESSING", "FAILED"]),
    ))
    .orderBy(schema.scheduledMessages.scheduledFor)
    .limit(200)),

  schedule: authedQuery
    .input(z.object({
      id: z.number().optional(),
      channelId: z.number().optional(),
      conversationId: z.number().optional(),
      content: z.string().min(1).max(4000),
      attachmentIds: z.array(z.number()).max(10).default([]),
      scheduledFor: z.string().datetime(),
      timezone: z.string().min(1).max(64),
    }).refine(value => (value.channelId != null) !== (value.conversationId != null), "Escolha um destino."))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`scheduled:${ctx.user.id}`, RateLimits.scheduledMessage.limit, RateLimits.scheduledMessage.windowMs);
      const when = new Date(input.scheduledFor);
      if (when.getTime() < Date.now() + 30_000 || when.getTime() > Date.now() + 365 * 86_400_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um horário entre 30 segundos e 1 ano." });
      }
      if (input.channelId) await requireChannelAccess(ctx.user.id, input.channelId);
      else await requireConversationAccess(ctx.user.id, input.conversationId!);
      if (input.attachmentIds.length) {
        const owned = await getDb().select({ id: schema.files.id }).from(schema.files).where(and(
          eq(schema.files.uploaderId, ctx.user.id),
          inArray(schema.files.id, input.attachmentIds),
        ));
        if (owned.length !== input.attachmentIds.length) throw new TRPCError({ code: "FORBIDDEN", message: "Um anexo não pertence à sua conta." });
      }
      if (input.id) {
        await getDb().update(schema.scheduledMessages).set({
          channelId: input.channelId ?? null,
          conversationId: input.conversationId ?? null,
          content: input.content.trim(),
          attachmentIds: input.attachmentIds,
          scheduledFor: when,
          timezone: input.timezone,
          state: "PENDING",
          failureReason: null,
        }).where(and(
          eq(schema.scheduledMessages.id, input.id),
          eq(schema.scheduledMessages.userId, ctx.user.id),
          inArray(schema.scheduledMessages.state, ["PENDING", "FAILED"]),
        ));
        return { id: input.id };
      }
      const [{ id }] = await getDb().insert(schema.scheduledMessages).values({
        userId: ctx.user.id,
        channelId: input.channelId ?? null,
        conversationId: input.conversationId ?? null,
        content: input.content.trim(),
        attachmentIds: input.attachmentIds,
        scheduledFor: when,
        timezone: input.timezone,
      }).$returningId();
      return { id };
    }),

  cancelScheduled: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getDb().update(schema.scheduledMessages).set({ state: "CANCELLED" }).where(and(
        eq(schema.scheduledMessages.id, input.id),
        eq(schema.scheduledMessages.userId, ctx.user.id),
        inArray(schema.scheduledMessages.state, ["PENDING", "FAILED"]),
      ));
      return { ok: true };
    }),
});
