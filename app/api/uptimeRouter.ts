import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { rateLimit } from "./utils/rateLimit";
import { getUptimeSnapshot } from "./services/uptimeRobot";

/**
 * Administração → Monitoramento (UptimeRobot).
 * Admin-only: dados operacionais da plataforma não são públicos.
 */
export const uptimeRouter = createRouter({
  snapshot: adminQuery
    .input(
      z
        .object({
          /** Força a quebra do cache interno (limitado). */
          refresh: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      rateLimit(`uptime:snapshot:${ctx.user.id}`, 30, 60_000);
      return getUptimeSnapshot({ forceRefresh: input?.refresh === true });
    }),
});
