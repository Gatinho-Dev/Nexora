import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import {
  DEFAULT_MEMBER_PERMISSIONS,
  MODERATOR_PERMISSIONS,
  PERMISSIONS,
  RateLimits,
} from "@contracts/constants";
import type { MemberDTO, RoleDTO, ServerDetailsDTO } from "@contracts/types";
import { rateLimit } from "./utils/rateLimit";
import {
  getMemberPermissions,
  requirePermission,
  toPublicUser,
} from "./utils/permissions";
import { broadcastToServer, sendToUsers, setLiveStageSpeaker } from "./realtime";

const permissionEnum = z.enum(PERMISSIONS);

async function getServerOr404(serverId: number) {
  const server = await getDb().query.servers.findFirst({
    where: eq(schema.servers.id, serverId),
  });
  if (!server) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });
  }
  return server;
}

async function requireOwner(userId: number, serverId: number) {
  const server = await getServerOr404(serverId);
  if (server.ownerId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente o dono do servidor pode fazer isso.",
    });
  }
  return server;
}

async function refreshServer(serverId: number) {
  await broadcastToServer(serverId, { t: "server:refresh", serverId });
}

export const serverRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const memberships = await db
      .select({ serverId: schema.serverMembers.serverId })
      .from(schema.serverMembers)
      .where(eq(schema.serverMembers.userId, ctx.user.id));
    if (memberships.length === 0) return [];
    const result = [];
    for (const m of memberships) {
      const server = await db.query.servers.findFirst({
        where: eq(schema.servers.id, m.serverId),
      });
      if (server) result.push(server);
    }
    return result;
  }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1, "Dê um nome ao servidor.").max(100),
        iconUrl: z.string().max(500).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`serverCreate:${ctx.user.id}`, RateLimits.serverCreate.limit, RateLimits.serverCreate.windowMs);
      const db = getDb();

      const [{ id: serverId }] = await db
        .insert(schema.servers)
        .values({
          name: input.name,
          iconUrl: input.iconUrl ?? null,
          description: input.description ?? null,
          ownerId: ctx.user.id,
        })
        .$returningId();

      await db.insert(schema.serverMembers).values({
        serverId,
        userId: ctx.user.id,
      });

      // Default categories + channels
      const [{ id: textCatId }] = await db
        .insert(schema.categories)
        .values({ serverId, name: "Canais de Texto", kind: "text", position: 0 })
        .$returningId();
      const [{ id: voiceCatId }] = await db
        .insert(schema.categories)
        .values({ serverId, name: "Canais de Voz", kind: "voice", position: 1 })
        .$returningId();
      await db.insert(schema.channels).values([
        { serverId, categoryId: textCatId, name: "geral", type: "TEXT", position: 0 },
        { serverId, categoryId: voiceCatId, name: "Geral", type: "VOICE", position: 1 },
      ]);

      // Default roles
      const [{ id: adminRoleId }] = await db
        .insert(schema.roles)
        .values({
          serverId,
          name: "Administrador",
          color: "#f59e0b",
          position: 3,
          permissions: ["ADMINISTRATOR"],
          isDefault: false,
        })
        .$returningId();
      await db.insert(schema.roles).values([
        {
          serverId,
          name: "Moderador",
          color: "#34d399",
          position: 2,
          permissions: [...MODERATOR_PERMISSIONS],
          isDefault: false,
        },
        {
          serverId,
          name: "Membro",
          color: "#94a3b8",
          position: 1,
          permissions: [...DEFAULT_MEMBER_PERMISSIONS],
          isDefault: true,
        },
      ]);
      await db.insert(schema.memberRoles).values({
        serverId,
        userId: ctx.user.id,
        roleId: adminRoleId,
      });

      const server = await getServerOr404(serverId);
      return { server };
    }),

  get: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }): Promise<ServerDetailsDTO> => {
      const db = getDb();
      const server = await getServerOr404(input.serverId);
      const myPermissions = await getMemberPermissions(ctx.user.id, input.serverId);
      if (!myPermissions) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não é membro deste servidor.",
        });
      }

      const [channelRows, categoryRows, roleRows, memberRows, memberRoleRows] =
        await Promise.all([
          db.select().from(schema.channels).where(eq(schema.channels.serverId, input.serverId)),
          db.select().from(schema.categories).where(eq(schema.categories.serverId, input.serverId)),
          db.select().from(schema.roles).where(eq(schema.roles.serverId, input.serverId)),
          db.select().from(schema.serverMembers).where(eq(schema.serverMembers.serverId, input.serverId)),
          db.select().from(schema.memberRoles).where(eq(schema.memberRoles.serverId, input.serverId)),
        ]);

      const roles: RoleDTO[] = roleRows
        .map((r) => ({
          id: r.id,
          serverId: r.serverId,
          name: r.name,
          color: r.color,
          position: r.position,
          permissions: (r.permissions ?? []) as string[],
          isDefault: r.isDefault,
        }))
        .sort((a, b) => b.position - a.position);

      const members: MemberDTO[] = [];
      for (const m of memberRows) {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, m.userId),
        });
        if (!user) continue;
        const roleIds = new Set(
          memberRoleRows.filter((mr) => mr.userId === m.userId).map((mr) => mr.roleId),
        );
        members.push({
          user: toPublicUser(user),
          nickname: m.nickname,
          joinedAt: m.joinedAt,
          roles: roles.filter((r) => roleIds.has(r.id)),
          isOwner: server.ownerId === m.userId,
        });
      }

      return {
        server,
        channels: channelRows.sort((a, b) => a.position - b.position),
        categories: categoryRows.sort((a, b) => a.position - b.position),
        members,
        roles,
        myPermissions: [...myPermissions],
      };
    }),

  update: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        name: z.string().min(1).max(100).optional(),
        iconUrl: z.string().max(500).nullable().optional(),
        description: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_SERVER");
      const patch: Partial<typeof schema.servers.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.iconUrl !== undefined) patch.iconUrl = input.iconUrl;
      if (input.description !== undefined) patch.description = input.description;
      await getDb()
        .update(schema.servers)
        .set(patch)
        .where(eq(schema.servers.id, input.serverId));
      await refreshServer(input.serverId);
      return { ok: true };
    }),

  delete: authedQuery
    .input(z.object({ serverId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwner(ctx.user.id, input.serverId);
      const db = getDb();

      const channelRows = await db
        .select({ id: schema.channels.id })
        .from(schema.channels)
        .where(eq(schema.channels.serverId, input.serverId));
      for (const ch of channelRows) {
        const msgRows = await db
          .select({ id: schema.messages.id })
          .from(schema.messages)
          .where(eq(schema.messages.channelId, ch.id));
        for (const msg of msgRows) {
          await db.delete(schema.attachments).where(eq(schema.attachments.messageId, msg.id));
          await db.delete(schema.messageReactions).where(eq(schema.messageReactions.messageId, msg.id));
        }
        await db.delete(schema.messages).where(eq(schema.messages.channelId, ch.id));
        await db.delete(schema.channelReads).where(eq(schema.channelReads.channelId, ch.id));
      }
      await db.delete(schema.channels).where(eq(schema.channels.serverId, input.serverId));
      await db.delete(schema.categories).where(eq(schema.categories.serverId, input.serverId));
      await db.delete(schema.roles).where(eq(schema.roles.serverId, input.serverId));
      await db.delete(schema.memberRoles).where(eq(schema.memberRoles.serverId, input.serverId));
      await db.delete(schema.serverMembers).where(eq(schema.serverMembers.serverId, input.serverId));
      await db.delete(schema.invites).where(eq(schema.invites.serverId, input.serverId));
      await db.delete(schema.bans).where(eq(schema.bans.serverId, input.serverId));
      await db.delete(schema.servers).where(eq(schema.servers.id, input.serverId));
      return { ok: true };
    }),

  leave: authedQuery
    .input(z.object({ serverId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const server = await getServerOr404(input.serverId);
      if (server.ownerId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O dono não pode sair do próprio servidor. Exclua o servidor ou transfira a propriedade.",
        });
      }
      const db = getDb();
      await db
        .delete(schema.serverMembers)
        .where(
          and(
            eq(schema.serverMembers.serverId, input.serverId),
            eq(schema.serverMembers.userId, ctx.user.id),
          ),
        );
      await db
        .delete(schema.memberRoles)
        .where(
          and(
            eq(schema.memberRoles.serverId, input.serverId),
            eq(schema.memberRoles.userId, ctx.user.id),
          ),
        );
      await refreshServer(input.serverId);
      return { ok: true };
    }),

  // ── Channels & categories ───────────────────────────────────
  createChannel: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        name: z.string().min(1, "Dê um nome ao canal.").max(64),
        type: z.enum(["TEXT", "VOICE", "FORUM", "STAGE"]),
        categoryId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_CHANNELS");
      const db = getDb();
      const cleanName =
        input.type === "TEXT" || input.type === "FORUM"
          ? input.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "")
          : input.name;
      if (!cleanName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nome de canal inválido." });
      }
      const existing = await db
        .select({ position: schema.channels.position })
        .from(schema.channels)
        .where(eq(schema.channels.serverId, input.serverId));
      const position = existing.length;
      const [{ id }] = await db
        .insert(schema.channels)
        .values({
          serverId: input.serverId,
          categoryId: input.categoryId ?? null,
          name: cleanName,
          type: input.type,
          position,
        })
        .$returningId();
      await refreshServer(input.serverId);
      const channel = await db.query.channels.findFirst({
        where: eq(schema.channels.id, id),
      });
      return { channel };
    }),

  deleteChannel: authedQuery
    .input(z.object({ channelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const channel = await db.query.channels.findFirst({
        where: eq(schema.channels.id, input.channelId),
      });
      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Canal não encontrado." });
      }
      await requirePermission(ctx.user.id, channel.serverId, "MANAGE_CHANNELS");

      const msgRows = await db
        .select({ id: schema.messages.id })
        .from(schema.messages)
        .where(eq(schema.messages.channelId, input.channelId));
      for (const msg of msgRows) {
        await db.delete(schema.attachments).where(eq(schema.attachments.messageId, msg.id));
        await db.delete(schema.messageReactions).where(eq(schema.messageReactions.messageId, msg.id));
      }
      await db.delete(schema.messages).where(eq(schema.messages.channelId, input.channelId));
      await db.delete(schema.channelReads).where(eq(schema.channelReads.channelId, input.channelId));
      await db.delete(schema.channels).where(eq(schema.channels.id, input.channelId));
      await refreshServer(channel.serverId);
      return { ok: true, serverId: channel.serverId };
    }),

  createCategory: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        name: z.string().min(1).max(64),
        kind: z.enum(["text", "voice"]).default("text"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_CHANNELS");
      const db = getDb();
      const rows = await db
        .select({ position: schema.categories.position })
        .from(schema.categories)
        .where(eq(schema.categories.serverId, input.serverId));
      const [{ id }] =       await db
        .insert(schema.categories)
        .values({
          serverId: input.serverId,
          name: input.name,
          kind: input.kind,
          position: rows.length,
        })
        .$returningId();
      await refreshServer(input.serverId);
      return { id };
    }),

  updateCategory: authedQuery
    .input(
      z.object({
        categoryId: z.number(),
        name: z.string().min(1, "Dê um nome à categoria.").max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const category = await db.query.categories.findFirst({
        where: eq(schema.categories.id, input.categoryId),
      });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Categoria não encontrada." });
      }
      await requirePermission(ctx.user.id, category.serverId, "MANAGE_CHANNELS");
      await db
        .update(schema.categories)
        .set({ name: input.name })
        .where(eq(schema.categories.id, input.categoryId));
      await refreshServer(category.serverId);
      return { ok: true };
    }),

  deleteCategory: authedQuery
    .input(z.object({ categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const category = await db.query.categories.findFirst({
        where: eq(schema.categories.id, input.categoryId),
      });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Categoria não encontrada." });
      }
      await requirePermission(ctx.user.id, category.serverId, "MANAGE_CHANNELS");
      // Channels inside the category are kept and become uncategorized.
      await db
        .update(schema.channels)
        .set({ categoryId: null })
        .where(eq(schema.channels.categoryId, input.categoryId));
      await db
        .delete(schema.categories)
        .where(eq(schema.categories.id, input.categoryId));
      await refreshServer(category.serverId);
      return { ok: true };
    }),

  // ── Stage speakers ──────────────────────────────────────────
  stageSetSpeaker: authedQuery
    .input(
      z.object({
        channelId: z.number(),
        userId: z.number(),
        speaker: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const channel = await db.query.channels.findFirst({
        where: eq(schema.channels.id, input.channelId),
      });
      if (!channel || channel.type !== "STAGE") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Canal de palco não encontrado." });
      }
      const perms = await getMemberPermissions(ctx.user.id, channel.serverId);
      if (!perms) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro deste servidor." });
      }
      const isSelf = ctx.user.id === input.userId;
      const canManage = perms.has("MANAGE_CHANNELS") || perms.has("ADMINISTRATOR");
      // Self-promotion requires SPEAK; promoting others requires manage.
      if (!canManage && !(isSelf && perms.has("SPEAK"))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para alterar o palco.",
        });
      }
      if (input.speaker) {
        await db
          .insert(schema.stageSpeakers)
          .values({
            channelId: input.channelId,
            userId: input.userId,
            grantedByUserId: ctx.user.id,
          })
          .onDuplicateKeyUpdate({ set: { grantedByUserId: ctx.user.id } });
      } else if (!canManage && !isSelf) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não pode remover outros palestrantes.",
        });
      } else {
        await db
          .delete(schema.stageSpeakers)
          .where(
            and(
              eq(schema.stageSpeakers.channelId, input.channelId),
              eq(schema.stageSpeakers.userId, input.userId),
            ),
          );
      }
      // If the user is connected right now, flip them live.
      await setLiveStageSpeaker(input.channelId, input.userId, input.speaker);
      await refreshServer(channel.serverId);
      return { ok: true };
    }),

  stageSpeakers: authedQuery
    .input(z.object({ channelId: z.number() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select({ userId: schema.stageSpeakers.userId })
        .from(schema.stageSpeakers)
        .where(eq(schema.stageSpeakers.channelId, input.channelId));
      return rows.map(r => r.userId);
    }),

  // ── Server events ───────────────────────────────────────────
  createEvent: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        channelId: z.number().optional(),
        name: z.string().min(1, "Dê um nome ao evento.").max(120),
        description: z.string().max(2000).optional(),
        startsAt: z.string(),
        endsAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`eventCreate:${ctx.user.id}`, 10, 60 * 60_000);
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_CHANNELS");
      const startsAt = new Date(input.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Data de início inválida." });
      }
      const [{ id }] = await getDb()
        .insert(schema.serverEvents)
        .values({
          serverId: input.serverId,
          channelId: input.channelId ?? null,
          createdByUserId: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          startsAt,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        })
        .$returningId();
      await broadcastToServer(input.serverId, { t: "events:refresh", serverId: input.serverId });
      return { id };
    }),

  listEvents: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(schema.serverEvents)
        .where(eq(schema.serverEvents.serverId, input.serverId));
      return rows
        .filter(e => e.status !== "CANCELLED")
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }),

  cancelEvent: authedQuery
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const event = await db.query.serverEvents.findFirst({
        where: eq(schema.serverEvents.id, input.eventId),
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      }
      await requirePermission(ctx.user.id, event.serverId, "MANAGE_CHANNELS");
      await db
        .update(schema.serverEvents)
        .set({ status: "CANCELLED" })
        .where(eq(schema.serverEvents.id, input.eventId));
      await broadcastToServer(event.serverId, { t: "events:refresh", serverId: event.serverId });
      return { ok: true };
    }),

  // ── Invites ─────────────────────────────────────────────────
  createInvite: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        maxUses: z.number().int().min(1).max(1000).optional(),
        expiresInHours: z.number().min(1).max(24 * 30).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`inviteCreate:${ctx.user.id}`, RateLimits.inviteCreate.limit, RateLimits.inviteCreate.windowMs);
      const perms = await getMemberPermissions(ctx.user.id, input.serverId);
      if (!perms) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro deste servidor." });
      }
      const code = nanoid(10);
      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 3_600_000)
        : null;
      await getDb().insert(schema.invites).values({
        serverId: input.serverId,
        code,
        creatorId: ctx.user.id,
        expiresAt,
        maxUses: input.maxUses ?? null,
      });
      return { code, url: `/invite/${code}` };
    }),

  listInvites: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_SERVER");
      return getDb()
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.serverId, input.serverId));
    }),

  revokeInvite: authedQuery
    .input(z.object({ inviteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const invite = await db.query.invites.findFirst({
        where: eq(schema.invites.id, input.inviteId),
      });
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Convite não encontrado." });
      await requirePermission(ctx.user.id, invite.serverId, "MANAGE_SERVER");
      await db.delete(schema.invites).where(eq(schema.invites.id, input.inviteId));
      return { ok: true };
    }),

  getInviteInfo: authedQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const invite = await db.query.invites.findFirst({
        where: eq(schema.invites.code, input.code),
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Convite inválido ou expirado." });
      }
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Este convite expirou." });
      }
      if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Este convite atingiu o limite de usos." });
      }
      const server = await getServerOr404(invite.serverId);
      const memberCount = (
        await db
          .select({ id: schema.serverMembers.id })
          .from(schema.serverMembers)
          .where(eq(schema.serverMembers.serverId, invite.serverId))
      ).length;
      const alreadyMember = !!(await db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, invite.serverId),
          eq(schema.serverMembers.userId, ctx.user.id),
        ),
      }));
      return { server, memberCount, alreadyMember };
    }),

  joinByCode: authedQuery
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const invite = await db.query.invites.findFirst({
        where: eq(schema.invites.code, input.code),
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Convite inválido ou expirado." });
      }
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Este convite expirou." });
      }
      if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Este convite atingiu o limite de usos." });
      }
      const banned = await db.query.bans.findFirst({
        where: and(
          eq(schema.bans.serverId, invite.serverId),
          eq(schema.bans.userId, ctx.user.id),
        ),
      });
      if (banned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você está banido deste servidor." });
      }
      const existing = await db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, invite.serverId),
          eq(schema.serverMembers.userId, ctx.user.id),
        ),
      });
      if (!existing) {
        await db.insert(schema.serverMembers).values({
          serverId: invite.serverId,
          userId: ctx.user.id,
        });
        await db
          .update(schema.invites)
          .set({ uses: invite.uses + 1 })
          .where(eq(schema.invites.id, invite.id));
        await refreshServer(invite.serverId);
      }
      return { serverId: invite.serverId };
    }),

  // ── Moderation ──────────────────────────────────────────────
  kick: authedQuery
    .input(z.object({ serverId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "KICK_MEMBERS");
      const server = await getServerOr404(input.serverId);
      if (input.userId === server.ownerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode expulsar o dono do servidor." });
      }
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use 'Sair do servidor' para sair." });
      }
      const db = getDb();
      await db
        .delete(schema.serverMembers)
        .where(
          and(
            eq(schema.serverMembers.serverId, input.serverId),
            eq(schema.serverMembers.userId, input.userId),
          ),
        );
      await db
        .delete(schema.memberRoles)
        .where(
          and(
            eq(schema.memberRoles.serverId, input.serverId),
            eq(schema.memberRoles.userId, input.userId),
          ),
        );
      sendToUsers([input.userId], { t: "server:refresh", serverId: input.serverId });
      await refreshServer(input.serverId);
      return { ok: true };
    }),

  ban: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        userId: z.number(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "BAN_MEMBERS");
      const server = await getServerOr404(input.serverId);
      if (input.userId === server.ownerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode banir o dono do servidor." });
      }
      const db = getDb();
      await db
        .insert(schema.bans)
        .values({ serverId: input.serverId, userId: input.userId, reason: input.reason ?? null })
        .onDuplicateKeyUpdate({ set: { reason: input.reason ?? null } });
      await db
        .delete(schema.serverMembers)
        .where(
          and(
            eq(schema.serverMembers.serverId, input.serverId),
            eq(schema.serverMembers.userId, input.userId),
          ),
        );
      await db
        .delete(schema.memberRoles)
        .where(
          and(
            eq(schema.memberRoles.serverId, input.serverId),
            eq(schema.memberRoles.userId, input.userId),
          ),
        );
      sendToUsers([input.userId], { t: "server:refresh", serverId: input.serverId });
      await refreshServer(input.serverId);
      return { ok: true };
    }),

  unban: authedQuery
    .input(z.object({ serverId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "BAN_MEMBERS");
      await getDb()
        .delete(schema.bans)
        .where(
          and(
            eq(schema.bans.serverId, input.serverId),
            eq(schema.bans.userId, input.userId),
          ),
        );
      return { ok: true };
    }),

  listBans: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "BAN_MEMBERS");
      const db = getDb();
      const banRows = await db
        .select()
        .from(schema.bans)
        .where(eq(schema.bans.serverId, input.serverId));
      const result = [];
      for (const ban of banRows) {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, ban.userId),
        });
        if (user) result.push({ ban, user: toPublicUser(user) });
      }
      return result;
    }),

  // ── Roles ───────────────────────────────────────────────────
  createRole: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        name: z.string().min(1).max(64),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#94a3b8"),
        permissions: z.array(permissionEnum).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_ROLES");
      const db = getDb();
      const rows = await db
        .select({ position: schema.roles.position })
        .from(schema.roles)
        .where(eq(schema.roles.serverId, input.serverId));
      const maxPos = Math.max(0, ...rows.map((r) => r.position));
      const [{ id }] = await db
        .insert(schema.roles)
        .values({
          serverId: input.serverId,
          name: input.name,
          color: input.color,
          position: maxPos + 1,
          permissions: input.permissions,
          isDefault: false,
        })
        .$returningId();
      await refreshServer(input.serverId);
      return { id };
    }),

  updateRole: authedQuery
    .input(
      z.object({
        roleId: z.number(),
        name: z.string().min(1).max(64).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        permissions: z.array(permissionEnum).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const role = await db.query.roles.findFirst({
        where: eq(schema.roles.id, input.roleId),
      });
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Cargo não encontrado." });
      await requirePermission(ctx.user.id, role.serverId, "MANAGE_ROLES");
      const patch: Partial<typeof schema.roles.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      if (input.permissions !== undefined) patch.permissions = input.permissions;
      await db.update(schema.roles).set(patch).where(eq(schema.roles.id, input.roleId));
      await refreshServer(role.serverId);
      return { ok: true };
    }),

  deleteRole: authedQuery
    .input(z.object({ roleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const role = await db.query.roles.findFirst({
        where: eq(schema.roles.id, input.roleId),
      });
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Cargo não encontrado." });
      if (role.isDefault) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O cargo padrão não pode ser excluído." });
      }
      await requirePermission(ctx.user.id, role.serverId, "MANAGE_ROLES");
      await db.delete(schema.memberRoles).where(eq(schema.memberRoles.roleId, input.roleId));
      await db.delete(schema.roles).where(eq(schema.roles.id, input.roleId));
      await refreshServer(role.serverId);
      return { ok: true };
    }),

  assignRole: authedQuery
    .input(z.object({ serverId: z.number(), userId: z.number(), roleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_ROLES");
      const db = getDb();
      const role = await db.query.roles.findFirst({
        where: eq(schema.roles.id, input.roleId),
      });
      if (!role || role.serverId !== input.serverId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cargo não encontrado." });
      }
      await db
        .insert(schema.memberRoles)
        .values({ serverId: input.serverId, userId: input.userId, roleId: input.roleId })
        .onDuplicateKeyUpdate({ set: { roleId: input.roleId } });
      await refreshServer(input.serverId);
      return { ok: true };
    }),

  unassignRole: authedQuery
    .input(z.object({ serverId: z.number(), userId: z.number(), roleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_ROLES");
      await getDb()
        .delete(schema.memberRoles)
        .where(
          and(
            eq(schema.memberRoles.serverId, input.serverId),
            eq(schema.memberRoles.userId, input.userId),
            eq(schema.memberRoles.roleId, input.roleId),
          ),
        );
      await refreshServer(input.serverId);
      return { ok: true };
    }),
});
