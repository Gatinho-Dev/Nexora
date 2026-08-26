import { z } from "zod";
import { and, eq } from "drizzle-orm";
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

/**
 * Integrações externas — Roblox.
 * Tokens nunca retornam ao cliente; apenas metadados públicos do vínculo.
 */

export const integrationsRouter = createRouter({
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
    // Remove a atividade dos clientes imediatamente.
    const { sendToUsers, contactIds } = await import("./realtime");
    const audience = await contactIds(ctx.user.id);
    sendToUsers([...audience, ctx.user.id], {
      t: "activity:update",
      userId: ctx.user.id,
      activity: null,
    });
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
      return { ok: true };
    }),

  /** Atividade Roblox pública de outro usuário (com privacidade). */
  userActivity: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      rateLimit(`userActivity:${ctx.user.id}`, 120, 60_000);
      const [conn] = await getDb()
        .select({
          showOnProfile: schema.userConnections.showOnProfile,
          showActivity: schema.userConnections.showActivity,
          username: schema.userConnections.username,
          displayName: schema.userConnections.displayName,
          avatarUrl: schema.userConnections.avatarUrl,
          profileUrl: schema.userConnections.profileUrl,
          allowJoin: schema.userConnections.allowJoin,
          providerUserId: schema.userConnections.providerUserId,
        })
        .from(schema.userConnections)
        .where(
          and(
            eq(schema.userConnections.userId, input.userId),
            eq(schema.userConnections.provider, "ROBLOX")
          )
        )
        .limit(1);

      if (!conn || !conn.showOnProfile) {
        return { connected: false as const };
      }

      // Bloqueado? Não recebe nada.
      if (ctx.user.id !== input.userId && conn.providerUserId) {
        const [block] = await getDb()
          .select({ requesterId: schema.friendships.requesterId })
          .from(schema.friendships)
          .where(
            and(
              eq(schema.friendships.status, "BLOCKED"),
              eq(schema.friendships.addresseeId, input.userId),
              eq(schema.friendships.requesterId, ctx.user.id)
            )
          )
          .limit(1);
        if (block) return { connected: false as const };
      }

      let activity = null;
      if (conn.showActivity) {
        const [row] = await getDb()
          .select()
          .from(schema.robloxActivity)
          .where(eq(schema.robloxActivity.userId, input.userId))
          .limit(1);
        if (row && !row.stale && row.status === "IN_GAME" && row.name) {
          activity = {
            name: row.name,
            creatorName: row.creatorName,
            thumbnailUrl: row.thumbnailUrl,
            startedAt: row.startedAt,
            playUrl: row.playUrl,
            placeId: row.placeId,
          };
        }
      }

      return {
        connected: true as const,
        username: conn.username,
        displayName: conn.displayName,
        avatarUrl: conn.avatarUrl,
        profileUrl:
          conn.profileUrl ??
          `https://www.roblox.com/users/${conn.providerUserId}/profile`,
        activity,
        allowJoin: conn.allowJoin,
      };
    }),
});
