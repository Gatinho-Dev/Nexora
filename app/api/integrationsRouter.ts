import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { rateLimit } from "./utils/rateLimit";
import { robloxConfigured } from "./integrations/roblox/client";
import {
  findRobloxConnection,
  disconnectRoblox,
  updatePrivacySettings,
} from "./integrations/roblox/service";
import { env } from "./lib/env";
import {
  disconnectExternalProvider,
  providerDbId,
} from "./integrations/connectionService";
import { listProviderDefinitions } from "./integrations/registry";
import {
  clearActivity,
  rebroadcastActivities,
  visibleActivitySummariesFor,
  visibleActivitiesFor,
} from "./integrations/presenceService";

const providerSchema = z.enum([
  "spotify",
  "youtube",
  "twitch",
  "github",
  "roblox",
]);

async function blockedBetweenUsers(a: number, b: number) {
  if (a === b) return false;
  const [row] = await getDb()
    .select({ id: schema.friendships.id })
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.status, "BLOCKED"),
        or(
          and(
            eq(schema.friendships.requesterId, a),
            eq(schema.friendships.addresseeId, b)
          ),
          and(
            eq(schema.friendships.requesterId, b),
            eq(schema.friendships.addresseeId, a)
          )
        )
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Metadados públicos; tokens permanecem criptografados e server-side. */
export const integrationsRouter = createRouter({
  providers: authedQuery.query(async ({ ctx }) => {
    const definitions = listProviderDefinitions();
    const connections = await getDb()
      .select({
        provider: schema.userConnections.provider,
        username: schema.userConnections.username,
        displayName: schema.userConnections.displayName,
        avatarUrl: schema.userConnections.avatarUrl,
        profileUrl: schema.userConnections.profileUrl,
        needsReauth: schema.userConnections.needsReauth,
        errorCode: schema.userConnections.errorCode,
        showOnProfile: schema.userConnections.showOnProfile,
        showActivity: schema.userConnections.showActivity,
        showDetails: schema.userConnections.showDetails,
        activityVisibility: schema.userConnections.activityVisibility,
        allowJoin: schema.userConnections.allowJoin,
        connectedAt: schema.userConnections.connectedAt,
      })
      .from(schema.userConnections)
      .where(eq(schema.userConnections.userId, ctx.user.id));
    return definitions.map(definition => {
      const connection = connections.find(
        item => item.provider === providerDbId(definition.id)
      );
      return {
        ...definition,
        connected: Boolean(connection),
        account: connection
          ? {
              username: connection.username,
              displayName: connection.displayName,
              avatarUrl: connection.avatarUrl,
              profileUrl: connection.profileUrl,
              needsReauth: connection.needsReauth,
              errorCode: connection.errorCode,
              connectedAt: connection.connectedAt,
            }
          : null,
        settings: connection
          ? {
              showOnProfile: connection.showOnProfile,
              showActivity: connection.showActivity,
              showDetails: connection.showDetails,
              activityVisibility: connection.activityVisibility,
              allowJoin: connection.allowJoin,
            }
          : null,
      };
    });
  }),

  providerDisconnect: authedQuery
    .input(z.object({ provider: providerSchema }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`providerDisconnect:${ctx.user.id}`, 10, 60_000);
      const ok =
        input.provider === "roblox"
          ? await disconnectRoblox(ctx.user.id)
          : await disconnectExternalProvider(ctx.user.id, input.provider);
      if (!ok) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Essa conexão já foi removida.",
        });
      }
      await clearActivity(ctx.user.id, input.provider);
      return { ok: true };
    }),

  providerSettings: authedQuery
    .input(
      z.object({
        provider: providerSchema,
        showOnProfile: z.boolean().optional(),
        showActivity: z.boolean().optional(),
        showDetails: z.boolean().optional(),
        activityVisibility: z
          .enum(["everyone", "friends", "private"])
          .optional(),
        allowJoin: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { provider, ...patch } = input;
      await getDb()
        .update(schema.userConnections)
        .set(patch)
        .where(
          and(
            eq(schema.userConnections.userId, ctx.user.id),
            eq(schema.userConnections.provider, providerDbId(provider))
          )
        );
      if (patch.showActivity === false) {
        await clearActivity(ctx.user.id, provider);
      } else {
        await rebroadcastActivities(ctx.user.id);
      }
      return { ok: true };
    }),

  userPresence: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      rateLimit(`userPresence:${ctx.user.id}`, 180, 60_000);
      return visibleActivitiesFor(input.userId, ctx.user.id);
    }),

  presenceSummary: authedQuery
    .input(
      z.object({
        userIds: z.array(z.number().int().positive()).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      rateLimit(`presenceSummary:${ctx.user.id}`, 120, 60_000);
      return visibleActivitySummariesFor(input.userIds, ctx.user.id);
    }),

  publicConnections: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (await blockedBetweenUsers(ctx.user.id, input.userId)) return [];
      const rows = await getDb()
        .select({
          provider: schema.userConnections.provider,
          username: schema.userConnections.username,
          displayName: schema.userConnections.displayName,
          avatarUrl: schema.userConnections.avatarUrl,
          profileUrl: schema.userConnections.profileUrl,
          connectedAt: schema.userConnections.connectedAt,
        })
        .from(schema.userConnections)
        .where(
          and(
            eq(schema.userConnections.userId, input.userId),
            eq(schema.userConnections.showOnProfile, true)
          )
        );
      return rows.map(row => ({
        ...row,
        provider: row.provider.toLowerCase(),
      }));
    }),

  // Compatibilidade com os componentes Roblox existentes durante a migração.
  roblox: authedQuery.query(async ({ ctx }) => {
    const conn = await findRobloxConnection(ctx.user.id);
    if (!conn) {
      return {
        connected: false as const,
        configured: robloxConfigured() && env.robloxIntegrationEnabled,
      };
    }
    const [activity] = await getDb()
      .select()
      .from(schema.robloxActivity)
      .where(eq(schema.robloxActivity.userId, ctx.user.id))
      .limit(1);
    return {
      connected: true as const,
      configured: true,
      needsReauth: conn.needsReauth,
      username: conn.username,
      displayName: conn.displayName,
      avatarUrl: conn.avatarUrl,
      profileUrl: conn.profileUrl,
      settings: {
        showOnProfile: conn.showOnProfile,
        showActivity: conn.showActivity,
        allowJoin: conn.allowJoin,
      },
      activity: activity
        ? {
            status: activity.status,
            name: activity.name,
            creatorName: activity.creatorName,
            thumbnailUrl: activity.thumbnailUrl,
            playUrl: activity.playUrl,
            startedAt: activity.startedAt,
            stale: activity.stale,
          }
        : null,
    };
  }),

  robloxDisconnect: authedQuery.mutation(async ({ ctx }) => {
    rateLimit(`robloxDisconnect:${ctx.user.id}`, 5, 60_000);
    const ok = await disconnectRoblox(ctx.user.id);
    if (!ok) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Nenhuma conta Roblox conectada.",
      });
    }
    await clearActivity(ctx.user.id, "roblox");
    return { ok: true };
  }),

  robloxSettings: authedQuery
    .input(
      z.object({
        showOnProfile: z.boolean().optional(),
        showActivity: z.boolean().optional(),
        allowJoin: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updatePrivacySettings(ctx.user.id, input);
      if (input.showActivity === false) {
        await clearActivity(ctx.user.id, "roblox");
      } else {
        await rebroadcastActivities(ctx.user.id);
      }
      return { ok: true };
    }),

  userActivity: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const activities = await visibleActivitiesFor(input.userId, ctx.user.id);
      const activity =
        activities.find(item => item.provider === "roblox") ?? null;
      const [conn] = await getDb()
        .select()
        .from(schema.userConnections)
        .where(
          and(
            eq(schema.userConnections.userId, input.userId),
            eq(schema.userConnections.provider, "ROBLOX"),
            eq(schema.userConnections.showOnProfile, true)
          )
        )
        .limit(1);
      if (!conn) return { connected: false as const };
      return {
        connected: true as const,
        username: conn.username,
        displayName: conn.displayName,
        avatarUrl: conn.avatarUrl,
        profileUrl: conn.profileUrl,
        allowJoin: conn.allowJoin,
        activity: activity
          ? {
              name: activity.title,
              creatorName: activity.state ?? null,
              thumbnailUrl: activity.largeImageUrl ?? null,
              startedAt: activity.startedAt ?? null,
              playUrl: activity.externalUrl ?? null,
              placeId: null,
            }
          : null,
      };
    }),
});
