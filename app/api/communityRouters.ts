import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { requireChannelAccess } from "./utils/permissions";
import {
  broadcastToChannel,
  broadcastToServer,
} from "./realtime";

// ── Threads (sub-canais de texto) ─────────────────────────────

export const threadRouter = createRouter({
  create: authedQuery
    .input(
      z.object({
        channelId: z.number(),
        name: z.string().min(1).max(100),
        seedMessageId: z.number().optional(),
        private: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireChannelAccess(ctx.user.id, input.channelId);
      const db = getDb();
      const [{ id }] = await db
        .insert(schema.threads)
        .values({
          channelId: input.channelId,
          name: input.name.trim(),
          createdById: ctx.user.id,
          private: input.private ?? false,
        })
        .$returningId();

      if (input.seedMessageId) {
        // Bind the originating message to the thread as its opener.
        await db
          .update(schema.messages)
          .set({ threadId: id })
          .where(
            and(
              eq(schema.messages.id, input.seedMessageId),
              eq(schema.messages.authorId, ctx.user.id),
            ),
          );
      }
      broadcastToChannel(input.channelId, { t: "server:refresh", serverId: 0 });
      return { id };
    }),

  list: authedQuery
    .input(z.object({ channelId: z.number(), includeArchived: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      await requireChannelAccess(ctx.user.id, input.channelId);
      const db = getDb();
      const conditions = [eq(schema.threads.channelId, input.channelId)];
      if (!input.includeArchived)
        conditions.push(isNull(schema.threads.archivedAt));
      return db
        .select()
        .from(schema.threads)
        .where(and(...conditions))
        .orderBy(desc(schema.threads.createdAt))
        .limit(100);
    }),

  archive: authedQuery
    .input(z.object({ threadId: z.number(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [thread] = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.id, input.threadId));
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread não encontrada." });
      await requireChannelAccess(ctx.user.id, thread.channelId);
      if (thread.createdById !== ctx.user.id) {
        // Only the author or a moderator may archive.
        const ch = await db.query.channels.findFirst({
          where: eq(schema.channels.id, thread.channelId),
        });
        if (ch) {
          const perms = await requireChannelAccess(ctx.user.id, ch.id);
          if (!perms.perms.has("MANAGE_MESSAGES") && thread.createdById !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para arquivar." });
          }
        }
      }
      await db
        .update(schema.threads)
        .set({ archivedAt: input.archived ? new Date() : null })
        .where(eq(schema.threads.id, input.threadId));
      return { ok: true };
    }),
});

// ── Announcement follows & publishing ─────────────────────────

export const announceRouter = createRouter({
  follow: authedQuery
    .input(
      z.object({
        sourceChannelId: z.number(),
        targetChannelId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const source = await requireChannelAccess(ctx.user.id, input.sourceChannelId);
      if (source.channel.type !== "ANNOUNCEMENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Só canais de anúncio podem ser seguidos." });
      }
      const target = await requireChannelAccess(ctx.user.id, input.targetChannelId);
      if (target.channel.serverId === source.channel.serverId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um canal de outro servidor." });
      }
      if (!target.perms.has("SEND_MESSAGES")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão no canal de destino." });
      }
      await getDb()
        .insert(schema.channelFollows)
        .values({
          sourceChannelId: input.sourceChannelId,
          followerServerId: target.channel.serverId,
          targetChannelId: input.targetChannelId,
          createdByUserId: ctx.user.id,
        })
        .onDuplicateKeyUpdate({ set: { targetChannelId: input.targetChannelId } });
      return { ok: true };
    }),

  unfollow: authedQuery
    .input(z.object({ sourceChannelId: z.number(), followerServerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      void ctx;
      await getDb()
        .delete(schema.channelFollows)
        .where(
          and(
            eq(schema.channelFollows.sourceChannelId, input.sourceChannelId),
            eq(schema.channelFollows.followerServerId, input.followerServerId),
          ),
        );
      return { ok: true };
    }),

  listFollowers: authedQuery
    .input(z.object({ sourceChannelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await requireChannelAccess(ctx.user.id, input.sourceChannelId);
      if (!access.perms.has("MANAGE_MESSAGES")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão." });
      }
      return getDb()
        .select({
          follow: schema.channelFollows,
          serverName: schema.servers.name,
        })
        .from(schema.channelFollows)
        .leftJoin(schema.servers, eq(schema.servers.id, schema.channelFollows.followerServerId))
        .where(eq(schema.channelFollows.sourceChannelId, input.sourceChannelId));
    }),

  /** Copies an announcement post into every follower's target channel. */
  publish: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [msg] = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, input.messageId));
      if (!msg || !msg.channelId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      }
      const channel = await requireChannelAccess(ctx.user.id, msg.channelId);
      if (channel.channel.type !== "ANNOUNCEMENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível publicar de canais de anúncio." });
      }
      if (!channel.perms.has("MANAGE_MESSAGES")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Somente moderadores podem publicar." });
      }

      const follows = await db
        .select()
        .from(schema.channelFollows)
        .where(eq(schema.channelFollows.sourceChannelId, msg.channelId));
      if (follows.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum servidor segue este canal ainda." });
      }

      const server = await db.query.servers.findFirst({
        where: eq(schema.servers.id, channel.channel.serverId),
      });
      let published = 0;
      for (const f of follows) {
        const [{ id }] = await db
          .insert(schema.messages)
          .values({
            channelId: f.targetChannelId,
            authorId: ctx.user.id,
            content:
              `**📢 Publicado de ${server?.name ?? "um servidor"} · #${channel.channel.name}**\n\n${msg.content}`,
          })
          .$returningId();
        published++;
        void id;
      }
      return { published };
    }),
});

// ── Webhooks ──────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const webhookRouter = createRouter({
  list: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePermissionLocal(ctx.user.id, input.serverId, "MANAGE_SERVER");
      return getDb()
        .select({
          webhook: schema.webhooks,
          channelName: schema.channels.name,
        })
        .from(schema.webhooks)
        .leftJoin(schema.channels, eq(schema.channels.id, schema.webhooks.channelId))
        .where(eq(schema.webhooks.serverId, input.serverId));
    }),

  create: authedQuery
    .input(
      z.object({
        channelId: z.number(),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await requireChannelAccess(ctx.user.id, input.channelId);
      if (!access.perms.has("MANAGE_MESSAGES")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão neste canal." });
      }
      const token = randomBytes(24).toString("hex");
      const [{ id }] = await getDb()
        .insert(schema.webhooks)
        .values({
          channelId: input.channelId,
          serverId: access.channel.serverId,
          name: input.name.trim(),
          tokenHash: hashToken(token),
          createdById: ctx.user.id,
        })
        .$returningId();
      // Raw token is returned exactly once.
      return { id, token, url: `/api/webhooks/${id}/${token}` };
    }),

  remove: authedQuery
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [wh] = await db
        .select()
        .from(schema.webhooks)
        .where(eq(schema.webhooks.id, input.webhookId));
      if (!wh) return { ok: true };
      await requirePermissionLocal(ctx.user.id, wh.serverId, "MANAGE_SERVER");
      await db.delete(schema.webhooks).where(eq(schema.webhooks.id, wh.id));
      return { ok: true };
    }),
});

async function requirePermissionLocal(userId: number, serverId: number, perm: string) {
  const { getMemberPermissions } = await import("./utils/permissions");
  const { TRPCError } = await import("@trpc/server");
  const perms = await getMemberPermissions(userId, serverId);
  if (!perms?.has(perm as never)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão." });
  }
}

void broadcastToServer;
void broadcastToChannel;
