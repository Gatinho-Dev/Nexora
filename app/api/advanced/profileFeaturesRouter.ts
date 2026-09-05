import { z } from "zod";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import {
  requireChannelAccess,
  requireConversationAccess,
} from "../utils/permissions";
import { encryptPrivate, decryptPrivate } from "../lib/crypto";
import { broadcastPresence, sendToUsers } from "../realtime";

const visibilitySchema = z.enum([
  "everyone",
  "friends",
  "mutual_servers",
  "nobody",
]);
const preferencesSchema = z.record(z.string(), z.unknown());

function assertJsonSize(value: unknown, max = 64_000) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > max) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "As preferências excedem o limite permitido.",
    });
  }
}

async function relationship(viewerId: number, targetId: number) {
  if (viewerId === targetId) return { self: true, friend: true, mutual: true };
  const db = getDb();
  const friendship = await db.query.friendships.findFirst({
    where: sql`((${schema.friendships.requesterId} = ${viewerId} AND ${schema.friendships.addresseeId} = ${targetId})
      OR (${schema.friendships.requesterId} = ${targetId} AND ${schema.friendships.addresseeId} = ${viewerId}))
      AND ${schema.friendships.status} = 'ACCEPTED'`,
  });
  const mine = await db
    .select({ serverId: schema.serverMembers.serverId })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.userId, viewerId));
  const mutual = mine.length
    ? await db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.userId, targetId),
          inArray(schema.serverMembers.serverId, mine.map(row => row.serverId)),
        ),
      })
    : null;
  return { self: false, friend: Boolean(friendship), mutual: Boolean(mutual) };
}

function canSee(
  visibility: "everyone" | "friends" | "mutual_servers" | "nobody",
  relation: Awaited<ReturnType<typeof relationship>>,
) {
  return relation.self || visibility === "everyone" ||
    (visibility === "friends" && relation.friend) ||
    (visibility === "mutual_servers" && relation.mutual);
}

async function validateFavorite(userId: number, type: "server" | "channel" | "dm" | "thread", id: number) {
  if (type === "server") {
    const member = await getDb().query.serverMembers.findFirst({ where: and(
      eq(schema.serverMembers.serverId, id),
      eq(schema.serverMembers.userId, userId),
    ) });
    if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });
  } else if (type === "channel") await requireChannelAccess(userId, id);
  else if (type === "dm") await requireConversationAccess(userId, id);
  else {
    const thread = await getDb().query.threads.findFirst({ where: eq(schema.threads.id, id) });
    if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread não encontrada." });
    await requireChannelAccess(userId, thread.channelId);
  }
}

export const profileFeaturesRouter = createRouter({
  status: authedQuery.query(async ({ ctx }) => {
    const row = await getDb().query.userCustomStatuses.findFirst({
      where: eq(schema.userCustomStatuses.userId, ctx.user.id),
    });
    if (row?.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
    return row ?? null;
  }),

  setStatus: authedQuery
    .input(z.object({
      text: z.string().max(128).nullable(),
      emoji: z.string().max(64).nullable(),
      presence: z.enum(["online", "idle", "dnd", "invisible"]),
      expiresAt: z.string().datetime().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      if (expiresAt && (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 365 * 86_400_000)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha uma duração válida." });
      }
      await getDb().insert(schema.userCustomStatuses).values({
        userId: ctx.user.id,
        text: input.text?.trim() || null,
        emoji: input.emoji?.trim() || null,
        presence: input.presence,
        expiresAt,
      }).onDuplicateKeyUpdate({ set: {
        text: input.text?.trim() || null,
        emoji: input.emoji?.trim() || null,
        presence: input.presence,
        expiresAt,
        updatedAt: new Date(),
      } });
      // Compatibility fields keep old clients and profile cards current.
      await getDb().update(schema.users).set({
        customStatus: input.text?.trim() || null,
        status: input.presence,
      }).where(eq(schema.users.id, ctx.user.id));
      await broadcastPresence(ctx.user.id);
      return { ok: true };
    }),

  myProfile: authedQuery.query(async ({ ctx }) => {
    const [details, fields] = await Promise.all([
      getDb().query.userProfileDetails.findFirst({ where: eq(schema.userProfileDetails.userId, ctx.user.id) }),
      getDb().select().from(schema.profileFields).where(eq(schema.profileFields.userId, ctx.user.id)).orderBy(asc(schema.profileFields.position)),
    ]);
    return { details: details ?? null, fields };
  }),

  publicProfile: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [user, details, fields, relation] = await Promise.all([
        getDb().query.users.findFirst({ where: eq(schema.users.id, input.userId) }),
        getDb().query.userProfileDetails.findFirst({ where: eq(schema.userProfileDetails.userId, input.userId) }),
        getDb().select().from(schema.profileFields).where(eq(schema.profileFields.userId, input.userId)).orderBy(asc(schema.profileFields.position)),
        relationship(ctx.user.id, input.userId),
      ]);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      const summary = { id: user.id, username: user.username, displayName: user.name, avatar: user.avatar };
      if (!details) return { user: summary, details: null, fields: [] };
      const privacy = details.privacy ?? {};
      const visible = <T,>(key: string, value: T) =>
        canSee(privacy[key] ?? "everyone", relation) ? value : null;
      return {
        user: summary,
        details: {
          displayName: visible("displayName", details.displayName),
          pronouns: visible("pronouns", details.pronouns),
          location: visible("location", details.location),
          website: visible("website", details.website),
          about: visible("about", details.about),
        },
        fields: fields.filter(field => canSee(field.visibility, relation)),
      };
    }),

  updateProfile: authedQuery
    .input(z.object({
      displayName: z.string().min(1).max(64).nullable(),
      pronouns: z.string().max(64).nullable(),
      location: z.string().max(120).nullable(),
      website: z.string().url().max(500).nullable(),
      about: z.string().max(1000).nullable(),
      privacy: z.record(z.string(), visibilitySchema),
      fields: z.array(z.object({
        label: z.string().min(1).max(40),
        value: z.string().min(1).max(300),
        visibility: visibilitySchema,
      })).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      await getDb().insert(schema.userProfileDetails).values({
        userId: ctx.user.id,
        displayName: input.displayName,
        pronouns: input.pronouns,
        location: input.location,
        website: input.website,
        about: input.about,
        privacy: input.privacy,
      }).onDuplicateKeyUpdate({ set: {
        displayName: input.displayName,
        pronouns: input.pronouns,
        location: input.location,
        website: input.website,
        about: input.about,
        privacy: input.privacy,
        updatedAt: new Date(),
      } });
      await getDb().delete(schema.profileFields).where(eq(schema.profileFields.userId, ctx.user.id));
      if (input.fields.length) await getDb().insert(schema.profileFields).values(input.fields.map((field, position) => ({
        userId: ctx.user.id,
        ...field,
        position,
      })));
      if (input.displayName) {
        await getDb().update(schema.users).set({ name: input.displayName }).where(eq(schema.users.id, ctx.user.id));
      }
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "profile" });
      return { ok: true };
    }),

  note: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await getDb().query.userNotes.findFirst({ where: and(
        eq(schema.userNotes.authorUserId, ctx.user.id),
        eq(schema.userNotes.targetUserId, input.userId),
      ) });
      return { content: row ? decryptPrivate(row.encryptedContent, `user-note:${ctx.user.id}`) : null };
    }),

  setNote: authedQuery
    .input(z.object({ userId: z.number(), content: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Use suas mensagens salvas para notas pessoais." });
      const content = input.content.trim();
      if (!content) {
        await getDb().delete(schema.userNotes).where(and(
          eq(schema.userNotes.authorUserId, ctx.user.id),
          eq(schema.userNotes.targetUserId, input.userId),
        ));
      } else {
        const encryptedContent = encryptPrivate(content, `user-note:${ctx.user.id}`);
        await getDb().insert(schema.userNotes).values({
          authorUserId: ctx.user.id,
          targetUserId: input.userId,
          encryptedContent,
        }).onDuplicateKeyUpdate({ set: { encryptedContent, updatedAt: new Date() } });
      }
      return { ok: true };
    }),

  favorites: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const favorites = await db
      .select()
      .from(schema.userFavorites)
      .where(eq(schema.userFavorites.userId, ctx.user.id))
      .orderBy(asc(schema.userFavorites.position), asc(schema.userFavorites.id));
    const ids = (type: typeof favorites[number]["targetType"]) =>
      favorites.filter(item => item.targetType === type).map(item => item.targetId);
    const serverIds = ids("server");
    const channelIds = ids("channel");
    const conversationIds = ids("dm");
    const threadIds = ids("thread");

    const [serverRows, channelRows, conversationRows, conversationUsers, threadRows] =
      await Promise.all([
        serverIds.length
          ? db
              .select({ id: schema.servers.id, name: schema.servers.name, iconUrl: schema.servers.iconUrl })
              .from(schema.servers)
              .innerJoin(schema.serverMembers, and(
                eq(schema.serverMembers.serverId, schema.servers.id),
                eq(schema.serverMembers.userId, ctx.user.id),
              ))
              .where(inArray(schema.servers.id, serverIds))
          : [],
        channelIds.length
          ? db
              .select({
                id: schema.channels.id,
                name: schema.channels.name,
                serverId: schema.channels.serverId,
                serverName: schema.servers.name,
                type: schema.channels.type,
              })
              .from(schema.channels)
              .innerJoin(schema.servers, eq(schema.servers.id, schema.channels.serverId))
              .innerJoin(schema.serverMembers, and(
                eq(schema.serverMembers.serverId, schema.channels.serverId),
                eq(schema.serverMembers.userId, ctx.user.id),
              ))
              .where(inArray(schema.channels.id, channelIds))
          : [],
        conversationIds.length
          ? db
              .select({
                id: schema.conversations.id,
                name: schema.conversations.name,
                avatarUrl: schema.conversations.avatarUrl,
                isGroup: schema.conversations.isGroup,
              })
              .from(schema.conversations)
              .innerJoin(schema.conversationMembers, and(
                eq(schema.conversationMembers.conversationId, schema.conversations.id),
                eq(schema.conversationMembers.userId, ctx.user.id),
              ))
              .where(inArray(schema.conversations.id, conversationIds))
          : [],
        conversationIds.length
          ? db
              .select({
                conversationId: schema.conversationMembers.conversationId,
                userId: schema.users.id,
                name: schema.users.name,
                avatar: schema.users.avatar,
              })
              .from(schema.conversationMembers)
              .innerJoin(schema.users, eq(schema.users.id, schema.conversationMembers.userId))
              .where(and(
                inArray(schema.conversationMembers.conversationId, conversationIds),
                sql`${schema.conversationMembers.userId} <> ${ctx.user.id}`,
              ))
          : [],
        threadIds.length
          ? db
              .select({
                id: schema.threads.id,
                name: schema.threads.name,
                channelId: schema.threads.channelId,
                channelName: schema.channels.name,
                serverId: schema.channels.serverId,
                serverName: schema.servers.name,
              })
              .from(schema.threads)
              .innerJoin(schema.channels, eq(schema.channels.id, schema.threads.channelId))
              .innerJoin(schema.servers, eq(schema.servers.id, schema.channels.serverId))
              .innerJoin(schema.serverMembers, and(
                eq(schema.serverMembers.serverId, schema.channels.serverId),
                eq(schema.serverMembers.userId, ctx.user.id),
              ))
              .where(inArray(schema.threads.id, threadIds))
          : [],
      ]);

    const serversById = new Map(serverRows.map(row => [row.id, row]));
    const channelsById = new Map(channelRows.map(row => [row.id, row]));
    const conversationsById = new Map(conversationRows.map(row => [row.id, row]));
    const threadsById = new Map(threadRows.map(row => [row.id, row]));

    return favorites.flatMap(favorite => {
      if (favorite.targetType === "server") {
        const server = serversById.get(favorite.targetId);
        return server ? [{
          ...favorite,
          label: server.name,
          context: "Servidor",
          iconUrl: server.iconUrl,
          href: `/channels/${server.id}/first`,
        }] : [];
      }
      if (favorite.targetType === "channel") {
        const channel = channelsById.get(favorite.targetId);
        return channel ? [{
          ...favorite,
          label: channel.name,
          context: channel.serverName,
          iconUrl: null,
          href: `/channels/${channel.serverId}/${channel.id}`,
        }] : [];
      }
      if (favorite.targetType === "thread") {
        const thread = threadsById.get(favorite.targetId);
        return thread ? [{
          ...favorite,
          label: thread.name,
          context: `${thread.serverName} · #${thread.channelName}`,
          iconUrl: null,
          href: `/channels/${thread.serverId}/${thread.channelId}/t/${thread.id}`,
        }] : [];
      }
      const conversation = conversationsById.get(favorite.targetId);
      if (!conversation) return [];
      const members = conversationUsers.filter(row => row.conversationId === conversation.id);
      return [{
        ...favorite,
        label: conversation.name || members.map(row => row.name).join(", ") || "Mensagem direta",
        context: conversation.isGroup ? "Grupo" : "Mensagem direta",
        iconUrl: conversation.avatarUrl || members[0]?.avatar || null,
        href: `/channels/@me/${conversation.id}`,
      }];
    });
  }),

  setFavorite: authedQuery
    .input(z.object({ targetType: z.enum(["server", "channel", "dm", "thread"]), targetId: z.number(), favorite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.favorite) {
        await validateFavorite(ctx.user.id, input.targetType, input.targetId);
        const [{ next }] = await getDb().select({ next: sql<number>`coalesce(max(${schema.userFavorites.position}), -1) + 1` }).from(schema.userFavorites).where(eq(schema.userFavorites.userId, ctx.user.id));
        await getDb().insert(schema.userFavorites).values({
          userId: ctx.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
          position: Number(next),
        }).onDuplicateKeyUpdate({ set: { targetId: input.targetId } });
      } else {
        await getDb().delete(schema.userFavorites).where(and(
          eq(schema.userFavorites.userId, ctx.user.id),
          eq(schema.userFavorites.targetType, input.targetType),
          eq(schema.userFavorites.targetId, input.targetId),
        ));
      }
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "favorites" });
      return { ok: true };
    }),

  reorderFavorites: authedQuery
    .input(z.object({ ids: z.array(z.number()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const owned = await getDb().select({ id: schema.userFavorites.id }).from(schema.userFavorites).where(eq(schema.userFavorites.userId, ctx.user.id));
      if (owned.length !== input.ids.length || owned.some(row => !input.ids.includes(row.id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A ordem dos favoritos está desatualizada." });
      }
      await Promise.all(input.ids.map((id, position) => getDb().update(schema.userFavorites).set({ position }).where(and(
        eq(schema.userFavorites.id, id),
        eq(schema.userFavorites.userId, ctx.user.id),
      ))));
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "favorites" });
      return { ok: true };
    }),

  folders: authedQuery.query(async ({ ctx }) => {
    const folders = await getDb().select().from(schema.serverFolders).where(eq(schema.serverFolders.userId, ctx.user.id)).orderBy(asc(schema.serverFolders.position));
    const items = folders.length ? await getDb().select().from(schema.serverFolderItems).where(inArray(schema.serverFolderItems.folderId, folders.map(folder => folder.id))).orderBy(asc(schema.serverFolderItems.position)) : [];
    return folders.map(folder => ({ ...folder, serverIds: items.filter(item => item.folderId === folder.id).map(item => item.serverId) }));
  }),

  upsertFolder: authedQuery
    .input(z.object({ id: z.number().optional(), name: z.string().min(1).max(64), color: z.string().regex(/^#[0-9a-f]{6}$/i), collapsed: z.boolean(), serverIds: z.array(z.number()).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const uniqueServers = [...new Set(input.serverIds)];
      if (uniqueServers.length) {
        const memberships = await getDb().select({ serverId: schema.serverMembers.serverId }).from(schema.serverMembers).where(and(
          eq(schema.serverMembers.userId, ctx.user.id),
          inArray(schema.serverMembers.serverId, uniqueServers),
        ));
        if (memberships.length !== uniqueServers.length) throw new TRPCError({ code: "FORBIDDEN", message: "Um servidor não pertence à sua lista." });
      }
      let folderId = input.id;
      if (folderId) {
        const owned = await getDb().query.serverFolders.findFirst({ where: and(eq(schema.serverFolders.id, folderId), eq(schema.serverFolders.userId, ctx.user.id)) });
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Pasta não encontrada." });
        await getDb().update(schema.serverFolders).set({ name: input.name, color: input.color, collapsed: input.collapsed }).where(eq(schema.serverFolders.id, folderId));
        await getDb().delete(schema.serverFolderItems).where(eq(schema.serverFolderItems.folderId, folderId));
      } else {
        const [{ next }] = await getDb().select({ next: sql<number>`coalesce(max(${schema.serverFolders.position}), -1) + 1` }).from(schema.serverFolders).where(eq(schema.serverFolders.userId, ctx.user.id));
        [{ id: folderId }] = await getDb().insert(schema.serverFolders).values({ userId: ctx.user.id, name: input.name, color: input.color, collapsed: input.collapsed, position: Number(next) }).$returningId();
      }
      // A server belongs to at most one visual folder for a given user.
      if (uniqueServers.length) {
        const ownedFolders = await getDb()
          .select({ id: schema.serverFolders.id })
          .from(schema.serverFolders)
          .where(eq(schema.serverFolders.userId, ctx.user.id));
        if (ownedFolders.length) {
          await getDb().delete(schema.serverFolderItems).where(and(
            inArray(schema.serverFolderItems.folderId, ownedFolders.map(folder => folder.id)),
            inArray(schema.serverFolderItems.serverId, uniqueServers),
          ));
        }
      }
      if (uniqueServers.length) await getDb().insert(schema.serverFolderItems).values(uniqueServers.map((serverId, position) => ({ folderId: folderId!, serverId, position })));
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "server-folders" });
      return { id: folderId! };
    }),

  reorderFolders: authedQuery
    .input(z.object({ ids: z.array(z.number()).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const owned = await getDb()
        .select({ id: schema.serverFolders.id })
        .from(schema.serverFolders)
        .where(eq(schema.serverFolders.userId, ctx.user.id));
      if (
        owned.length !== input.ids.length ||
        owned.some(folder => !input.ids.includes(folder.id))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A ordem das pastas está desatualizada.",
        });
      }
      await Promise.all(input.ids.map((id, position) =>
        getDb().update(schema.serverFolders).set({ position }).where(and(
          eq(schema.serverFolders.id, id),
          eq(schema.serverFolders.userId, ctx.user.id),
        ))
      ));
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "server-folders" });
      return { ok: true };
    }),

  deleteFolder: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await getDb().query.serverFolders.findFirst({ where: and(eq(schema.serverFolders.id, input.id), eq(schema.serverFolders.userId, ctx.user.id)) });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Pasta não encontrada." });
      await getDb().delete(schema.serverFolderItems).where(eq(schema.serverFolderItems.folderId, folder.id));
      await getDb().delete(schema.serverFolders).where(eq(schema.serverFolders.id, folder.id));
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "server-folders" });
      return { ok: true };
    }),

  serverOrder: authedQuery.query(async ({ ctx }) => getDb()
    .select()
    .from(schema.userServerOrder)
    .where(eq(schema.userServerOrder.userId, ctx.user.id))
    .orderBy(asc(schema.userServerOrder.position))),

  setServerOrder: authedQuery
    .input(z.object({ serverIds: z.array(z.number()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const unique = [...new Set(input.serverIds)];
      if (unique.length !== input.serverIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "A ordem contém servidores duplicados." });
      const memberships = unique.length ? await getDb().select({ serverId: schema.serverMembers.serverId }).from(schema.serverMembers).where(and(eq(schema.serverMembers.userId, ctx.user.id), inArray(schema.serverMembers.serverId, unique))) : [];
      if (memberships.length !== unique.length) throw new TRPCError({ code: "FORBIDDEN", message: "A ordem contém um servidor inacessível." });
      await getDb().delete(schema.userServerOrder).where(eq(schema.userServerOrder.userId, ctx.user.id));
      if (unique.length) await getDb().insert(schema.userServerOrder).values(unique.map((serverId, position) => ({ userId: ctx.user.id, serverId, position })));
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "server-order" });
      return { ok: true };
    }),

  preferences: authedQuery.query(async ({ ctx }) => {
    const row = await getDb().query.userPreferences.findFirst({ where: eq(schema.userPreferences.userId, ctx.user.id) });
    return row ?? { userId: ctx.user.id, data: {}, version: 0, updatedAt: new Date(0) };
  }),

  updatePreferences: authedQuery
    .input(z.object({ expectedVersion: z.number().int().min(0), data: preferencesSchema }))
    .mutation(async ({ ctx, input }) => {
      assertJsonSize(input.data);
      const current = await getDb().query.userPreferences.findFirst({ where: eq(schema.userPreferences.userId, ctx.user.id) });
      const currentVersion = current?.version ?? 0;
      if (input.expectedVersion !== currentVersion) {
        throw new TRPCError({ code: "CONFLICT", message: "As preferências foram alteradas em outro dispositivo. Atualize e tente novamente." });
      }
      const version = currentVersion + 1;
      if (current) await getDb().update(schema.userPreferences).set({ data: input.data, version, updatedAt: new Date() }).where(and(eq(schema.userPreferences.userId, ctx.user.id), eq(schema.userPreferences.version, currentVersion)));
      else await getDb().insert(schema.userPreferences).values({ userId: ctx.user.id, data: input.data, version });
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "user" });
      return { version, data: input.data };
    }),

  devicePreferences: authedQuery
    .input(z.object({ deviceId: z.string().min(8).max(96) }))
    .query(async ({ ctx, input }) => {
      const row = await getDb().query.devicePreferences.findFirst({ where: and(eq(schema.devicePreferences.userId, ctx.user.id), eq(schema.devicePreferences.deviceId, input.deviceId)) });
      return row ?? { deviceId: input.deviceId, data: {}, version: 0, updatedAt: new Date(0) };
    }),

  updateDevicePreferences: authedQuery
    .input(z.object({ deviceId: z.string().min(8).max(96), expectedVersion: z.number().int().min(0), data: preferencesSchema }))
    .mutation(async ({ ctx, input }) => {
      assertJsonSize(input.data, 32_000);
      const current = await getDb().query.devicePreferences.findFirst({ where: and(eq(schema.devicePreferences.userId, ctx.user.id), eq(schema.devicePreferences.deviceId, input.deviceId)) });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedVersion) throw new TRPCError({ code: "CONFLICT", message: "As preferências deste dispositivo foram alteradas. Atualize e tente novamente." });
      const version = currentVersion + 1;
      await getDb().insert(schema.devicePreferences).values({ userId: ctx.user.id, deviceId: input.deviceId, data: input.data, version }).onDuplicateKeyUpdate({ set: { data: input.data, version, updatedAt: new Date() } });
      return { version, data: input.data };
    }),
});
