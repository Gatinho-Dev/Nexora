import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { toOfficialAnnouncementDTO } from "./utils/platformDtos";

function visibleAnnouncementWhere(cursor?: number) {
  const now = new Date();
  return and(
    eq(schema.officialAnnouncements.isActive, true),
    or(
      isNull(schema.officialAnnouncements.expiresAt),
      gt(schema.officialAnnouncements.expiresAt, now),
    ),
    cursor ? lt(schema.officialAnnouncements.id, cursor) : undefined,
  );
}

async function unreadCount(userId: number): Promise<number> {
  const [{ count }] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.officialAnnouncements)
    .leftJoin(
      schema.officialAnnouncementReads,
      and(
        eq(
          schema.officialAnnouncementReads.announcementId,
          schema.officialAnnouncements.id,
        ),
        eq(schema.officialAnnouncementReads.userId, userId),
      ),
    )
    .where(
      and(
        visibleAnnouncementWhere(),
        isNull(schema.officialAnnouncementReads.id),
      ),
    );

  return Number(count);
}

export const officialRouter = createRouter({
  list: authedQuery
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const rows = await getDb()
        .select({
          announcement: schema.officialAnnouncements,
          readAt: schema.officialAnnouncementReads.readAt,
        })
        .from(schema.officialAnnouncements)
        .leftJoin(
          schema.officialAnnouncementReads,
          and(
            eq(
              schema.officialAnnouncementReads.announcementId,
              schema.officialAnnouncements.id,
            ),
            eq(schema.officialAnnouncementReads.userId, ctx.user.id),
          ),
        )
        .where(visibleAnnouncementWhere(input?.cursor))
        .orderBy(desc(schema.officialAnnouncements.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return {
        items: page.map(row =>
          toOfficialAnnouncementDTO(row.announcement, row.readAt),
        ),
        nextCursor: hasMore ? (page.at(-1)?.announcement.id ?? null) : null,
        unreadCount: await unreadCount(ctx.user.id),
      };
    }),

  unreadCount: authedQuery.query(async ({ ctx }) => ({
    count: await unreadCount(ctx.user.id),
  })),

  markRead: authedQuery
    .input(z.object({ announcementId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const announcement = await getDb().query.officialAnnouncements.findFirst({
        where: and(
          eq(schema.officialAnnouncements.id, input.announcementId),
          visibleAnnouncementWhere(),
        ),
      });
      if (!announcement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comunicado oficial não encontrado.",
        });
      }

      const readAt = new Date();
      await getDb()
        .insert(schema.officialAnnouncementReads)
        .values({
          announcementId: announcement.id,
          userId: ctx.user.id,
          readAt,
        })
        .onDuplicateKeyUpdate({ set: { readAt } });

      return { ok: true as const, readAt };
    }),
});
