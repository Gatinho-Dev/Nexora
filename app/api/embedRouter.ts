import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { rateLimit } from "./utils/rateLimit";
import {
  enqueueEmbedsForMessage,
  processEmbed,
  providerFor,
  removeEmbed,
} from "./services/embeds/embedService";

/**
 * Endpoint de embeds — autenticado + rate limit rigoroso (pode virar
 * proxy SSRF se mal protegido; o fetch usa safeFetch com validação de
 * IP/DNS/redirect/timeout/bytes).
 */
export const embedRouter = createRouter({
  /** Resolve uma URL solta (preview sob demanda). */
  resolve: authedQuery
    .input(z.object({ url: z.string().url().max(1000) }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`embed:resolve:${ctx.user.id}`, 10, 60_000);
      let provider = "generic";
      try {
        provider = providerFor(new URL(input.url)) ?? "generic";
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "URL inválida." });
      }
      const workIds = await getDb()
        .insert(schema.messageEmbeds)
        .values({
          messageId: 0, // linha de trabalho sem mensagem (resposta direta)
          url: input.url,
          provider,
          status: "processing",
        })
        .$returningId()
        .catch(() => null);
      if (!workIds?.[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Não foi possível iniciar o preview.",
        });
      }
      const workId = workIds[0].id;
      await processEmbed(0, input.url).catch(() => {});
      const result = await getDb()
        .select()
        .from(schema.messageEmbeds)
        .where(eq(schema.messageEmbeds.id, workId))
        .limit(1);
      await getDb()
        .delete(schema.messageEmbeds)
        .where(eq(schema.messageEmbeds.id, workId));
      const embed = result[0];
      if (!embed || embed.status !== "ready") {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Não foi possível gerar o preview deste link.",
        });
      }
      return { embed };
    }),

  /** Autor ou moderador remove o preview (URL continua na mensagem). */
  remove: authedQuery
    .input(z.object({ embedId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`embed:remove:${ctx.user.id}`, 30, 60_000);
      const removed = await removeEmbed(input.embedId, ctx.user.id, false);
      if (!removed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o autor da mensagem pode remover o preview.",
        });
      }
      return { ok: true as const };
    }),

  /** Re-processa embeds de uma mensagem (autor ou mod). */
  refresh: authedQuery
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`embed:refresh:${ctx.user.id}`, 10, 60_000);
      const [message] = await getDb()
        .select({
          id: schema.messages.id,
          authorId: schema.messages.authorId,
          content: schema.messages.content,
          channelId: schema.messages.channelId,
          conversationId: schema.messages.conversationId,
        })
        .from(schema.messages)
        .where(eq(schema.messages.id, input.messageId))
        .limit(1);
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      }
      await enqueueEmbedsForMessage(
        message.id,
        message.content,
        message.channelId,
        message.conversationId,
      );
      return { ok: true as const };
    }),
});
