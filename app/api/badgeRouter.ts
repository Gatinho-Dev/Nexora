import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { toUserBadgeDTO } from "./utils/platformDtos";

async function badgesForUser(userId: number) {
  const rows = await getDb()
    .select({
      badge: schema.platformBadges,
      assignment: schema.userBadges,
    })
    .from(schema.userBadges)
    .innerJoin(
      schema.platformBadges,
      eq(schema.platformBadges.id, schema.userBadges.badgeId),
    )
    .where(eq(schema.userBadges.userId, userId))
    .orderBy(desc(schema.userBadges.assignedAt));

  return rows.map(row => toUserBadgeDTO(row.badge, row.assignment));
}

export const badgeRouter = createRouter({
  mine: authedQuery.query(({ ctx }) => badgesForUser(ctx.user.id)),

  forUser: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(({ input }) => badgesForUser(input.userId)),
});
