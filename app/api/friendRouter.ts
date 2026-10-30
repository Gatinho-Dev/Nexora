import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { assertCanInteract } from "./services/accountSafety";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { RateLimits } from "@contracts/constants";
import type { FriendDTO } from "@contracts/types";
import { rateLimit } from "./utils/rateLimit";
import { toPublicUser } from "./utils/permissions";
import { sendToUsers } from "./realtime";

async function friendshipBetween(a: number, b: number) {
  const db = getDb();
  return db.query.friendships.findFirst({
    where: or(
      and(
        eq(schema.friendships.requesterId, a),
        eq(schema.friendships.addresseeId, b)
      ),
      and(
        eq(schema.friendships.requesterId, b),
        eq(schema.friendships.addresseeId, a)
      )
    ),
  });
}

function refreshFriends(...userIds: number[]) {
  sendToUsers(userIds, { t: "friends:refresh" });
}

function refreshRichPresence(...userIds: number[]) {
  void import("./integrations/presenceService")
    .then(async ({ rebroadcastActivities }) => {
      await Promise.all(userIds.map(userId => rebroadcastActivities(userId)));
    })
    .catch(() => {});
}

export const friendRouter = createRouter({
  search: authedQuery
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.username, input.username),
      });
      if (!user || user.id === ctx.user.id) return null;
      return toPublicUser(user);
    }),

  sendRequest: authedQuery
    .input(z.object({ username: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCanInteract(ctx.user.id);
      rateLimit(
        `friendRequest:${ctx.user.id}`,
        RateLimits.friendRequest.limit,
        RateLimits.friendRequest.windowMs
      );
      const db = getDb();
      const target = await db.query.users.findFirst({
        where: eq(schema.users.username, input.username),
      });
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Nenhum usuário encontrado com o nome "${input.username}".`,
        });
      }
      if (target.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode adicionar a si mesmo.",
        });
      }

      const existing = await friendshipBetween(ctx.user.id, target.id);
      if (existing) {
        if (existing.status === "ACCEPTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vocês já são amigos.",
          });
        }
        if (existing.status === "BLOCKED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Não foi possível enviar o pedido de amizade.",
          });
        }
        if (existing.requesterId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Você já enviou um pedido para este usuário.",
          });
        }
        // The other user already requested → auto-accept.
        await db
          .update(schema.friendships)
          .set({ status: "ACCEPTED" })
          .where(eq(schema.friendships.id, existing.id));
        refreshFriends(ctx.user.id, target.id);
        refreshRichPresence(ctx.user.id, target.id);
        return { status: "ACCEPTED" as const };
      }

      await db.insert(schema.friendships).values({
        requesterId: ctx.user.id,
        addresseeId: target.id,
        status: "PENDING",
      });

      // Notification for the addressee
      const [{ id: notifId }] = await db
        .insert(schema.notifications)
        .values({
          userId: target.id,
          type: "friend_request",
          actorId: ctx.user.id,
          content: `${ctx.user.name ?? ctx.user.username} enviou um pedido de amizade.`,
        })
        .$returningId();
      const notif = await db.query.notifications.findFirst({
        where: eq(schema.notifications.id, notifId),
      });
      if (notif) {
        sendToUsers([target.id], {
          t: "notification",
          notification: {
            id: notif.id,
            type: notif.type,
            actor: toPublicUser(ctx.user),
            serverId: null,
            channelId: null,
            conversationId: null,
            messageId: null,
            content: notif.content,
            isRead: notif.isRead,
            createdAt: notif.createdAt,
          },
        });
      }
      refreshFriends(ctx.user.id, target.id);
      return { status: "PENDING" as const };
    }),

  accept: authedQuery
    .input(z.object({ friendshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const friendship = await db.query.friendships.findFirst({
        where: eq(schema.friendships.id, input.friendshipId),
      });
      if (!friendship || friendship.addresseeId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido de amizade não encontrado.",
        });
      }
      await db
        .update(schema.friendships)
        .set({ status: "ACCEPTED" })
        .where(eq(schema.friendships.id, friendship.id));
      refreshFriends(ctx.user.id, friendship.requesterId);
      refreshRichPresence(ctx.user.id, friendship.requesterId);
      return { ok: true };
    }),

  decline: authedQuery
    .input(z.object({ friendshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const friendship = await db.query.friendships.findFirst({
        where: eq(schema.friendships.id, input.friendshipId),
      });
      if (!friendship || friendship.addresseeId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido de amizade não encontrado.",
        });
      }
      await db
        .delete(schema.friendships)
        .where(eq(schema.friendships.id, friendship.id));
      refreshFriends(ctx.user.id, friendship.requesterId);
      return { ok: true };
    }),

  cancel: authedQuery
    .input(z.object({ friendshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const friendship = await db.query.friendships.findFirst({
        where: eq(schema.friendships.id, input.friendshipId),
      });
      if (!friendship || friendship.requesterId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido de amizade não encontrado.",
        });
      }
      await db
        .delete(schema.friendships)
        .where(eq(schema.friendships.id, friendship.id));
      refreshFriends(ctx.user.id, friendship.addresseeId);
      return { ok: true };
    }),

  remove: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const friendship = await friendshipBetween(ctx.user.id, input.userId);
      if (friendship) {
        await db
          .delete(schema.friendships)
          .where(eq(schema.friendships.id, friendship.id));
      }
      refreshFriends(ctx.user.id, input.userId);
      refreshRichPresence(ctx.user.id, input.userId);
      return { ok: true };
    }),

  block: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await friendshipBetween(ctx.user.id, input.userId);
      if (existing) {
        await db
          .update(schema.friendships)
          .set({
            status: "BLOCKED",
            requesterId: ctx.user.id,
            addresseeId: input.userId,
          })
          .where(eq(schema.friendships.id, existing.id));
      } else {
        await db.insert(schema.friendships).values({
          requesterId: ctx.user.id,
          addresseeId: input.userId,
          status: "BLOCKED",
        });
      }
      refreshFriends(ctx.user.id, input.userId);
      refreshRichPresence(ctx.user.id, input.userId);
      return { ok: true };
    }),

  unblock: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.friendships)
        .where(
          and(
            eq(schema.friendships.requesterId, ctx.user.id),
            eq(schema.friendships.addresseeId, input.userId),
            eq(schema.friendships.status, "BLOCKED")
          )
        );
      refreshFriends(ctx.user.id, input.userId);
      refreshRichPresence(ctx.user.id, input.userId);
      return { ok: true };
    }),

  list: authedQuery.query(async ({ ctx }): Promise<FriendDTO[]> => {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.friendships)
      .where(
        or(
          eq(schema.friendships.requesterId, ctx.user.id),
          eq(schema.friendships.addresseeId, ctx.user.id)
        )
      );

    const result: FriendDTO[] = [];
    for (const f of rows) {
      const otherId =
        f.requesterId === ctx.user.id ? f.addresseeId : f.requesterId;
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, otherId),
      });
      if (!user) continue;
      result.push({
        friendshipId: f.id,
        user: toPublicUser(user),
        status: f.status,
        direction:
          f.status === "PENDING"
            ? f.requesterId === ctx.user.id
              ? "outgoing"
              : "incoming"
            : "none",
      });
    }
    return result;
  }),
});
