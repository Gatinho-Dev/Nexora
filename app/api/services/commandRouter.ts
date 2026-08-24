import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { requireChannelAccess } from "../utils/permissions";
import { rateLimit } from "../utils/rateLimit";

/**
 * commandService — execução SERVER-SIDE de slash commands com efeito
 * colateral. O frontend nunca executa lógica sensível: aqui validamos
 * autenticação, permissão de canal e rate limit.
 *
 * Comandos puramente textuais (/shrug, /me) e aberturas de UI (/poll,
 * /topic, /gif) são resolvidos no composer — nada a validar aqui.
 */

export const commandRouter = createRouter({
  /** /nick — altera o apelido do próprio usuário no servidor do canal. */
  nick: authedQuery
    .input(
      z.object({
        channelId: z.number().int().positive(),
        nickname: z.string().trim().max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`command:nick:${ctx.user.id}`, 5, 60_000);
      const { channel } = await requireChannelAccess(
        ctx.user.id,
        input.channelId,
      );
      const nickname = input.nickname === "" ? null : input.nickname;
      await getDb()
        .update(schema.serverMembers)
        .set({ nickname })
        .where(
          and(
            eq(schema.serverMembers.serverId, channel.serverId),
            eq(schema.serverMembers.userId, ctx.user.id),
          ),
        );
      return { nickname };
    }),
});
