import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import type { NotificationDTO } from "@contracts/types";
import { toPublicUser } from "./utils/permissions";

export const notificationRouter = createRouter({
  list: authedQuery.query(async ({ ctx }): Promise<NotificationDTO[]> => {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, ctx.user.id))
      .orderBy(desc(schema.notifications.id))
      .limit(50);

    const result: NotificationDTO[] = [];
    for (const row of rows) {
      const actor = row.actorId
        ? await db.query.users.findFirst({ where: eq(schema.users.id, row.actorId) })
        : null;
      result.push({
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
      });
    }
    return result;
  }),

  unreadCount: authedQuery.query(async ({ ctx }) => {
    const [{ count }] = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, ctx.user.id),
          eq(schema.notifications.isRead, false),
        ),
      );
    return { count: Number(count) };
  }),

  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    await getDb()
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.userId, ctx.user.id));
    return { ok: true };
  }),

  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(schema.notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(schema.notifications.id, input.id),
            eq(schema.notifications.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),
});
