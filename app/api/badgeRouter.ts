import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { listForUser } from "./services/badgeService";
import { toBadgeDTO, toUserBadgeDTO } from "./utils/badgeDtos";

export const badgeRouter = createRouter({
  /** Badges visíveis do usuário logado (perfil próprio). */
  mine: authedQuery.query(async ({ ctx }) => {
    const rows = await listForUser(ctx.user.id);
    return rows.map(row => toUserBadgeDTO(row.badge, row.userBadge));
  }),

  /** Badges visíveis de qualquer usuário (perfis públicos). */
  forUser: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const rows = await listForUser(input.userId);
      return rows.map(row => toUserBadgeDTO(row.badge, row.userBadge));
    }),

  /** Catálogo completo (para modais de detalhe e painel admin). */
  catalog: authedQuery.query(async () => {
    const badges = await getDb()
      .select()
      .from(schema.badges)
      .orderBy(schema.badges.displayOrder);
    return badges.map(toBadgeDTO);
  }),

  /** Usuário oculta/exibe uma badge que permite ocultação (canHide). */
  setHidden: authedQuery
    .input(z.object({ badgeId: z.number().int().positive(), hidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await getDb()
        .select({ ub: schema.userBadges, badge: schema.badges })
        .from(schema.userBadges)
        .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
        .where(
          and(
            eq(schema.userBadges.userId, ctx.user.id),
            eq(schema.userBadges.badgeId, input.badgeId),
          ),
        )
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge não encontrada." });
      }
      if (!row.badge.canHide) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta badge não pode ser ocultada.",
        });
      }
      await getDb()
        .update(schema.userBadges)
        .set({ hiddenByUser: input.hidden })
        .where(eq(schema.userBadges.id, row.ub.id));
      return { ok: true as const };
    }),
});
