import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { requireChannelAccess, requireConversationAccess } from "./utils/permissions";
import { rateLimit } from "./utils/rateLimit";
import {
  closePoll,
  createPoll,
  getPollForViewer,
  getPollOwner,
  POLL_DURATIONS_HOURS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  vote,
} from "./services/pollService";
import { buildMessageDTO } from "./messageRouter";
import { broadcastToChannel, sendToUsers } from "./realtime";

const durationSchema = z
  .number()
  .int()
  .refine(
    hours => (POLL_DURATIONS_HOURS as readonly number[]).includes(hours),
    "Duração inválida.",
  )
  .nullable();

export const pollRouter = createRouter({
  /** Cria a mensagem da enquete + registros em transação. */
  create: authedQuery
    .input(
      z.object({
        channelId: z.number().optional(),
        conversationId: z.number().optional(),
        question: z.string().trim().min(3).max(300),
        options: z
          .array(z.string().trim().min(1).max(120))
          .min(POLL_MIN_OPTIONS)
          .max(POLL_MAX_OPTIONS),
        allowMultiple: z.boolean().default(false),
        durationHours: durationSchema.default(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`poll:create:${ctx.user.id}`, 5, 60_000);
      await getDb().query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
      });

      const trimmed = input.options.map(o => o.trim());
      if (new Set(trimmed.map(o => o.toLowerCase())).size !== trimmed.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "As opções não podem se repetir.",
        });
      }

      if (input.channelId) {
        const { perms } = await requireChannelAccess(ctx.user.id, input.channelId);
        if (!perms.has("SEND_MESSAGES")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não pode enviar mensagens neste canal.",
          });
        }
      } else if (input.conversationId) {
        await requireConversationAccess(ctx.user.id, input.conversationId);
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um canal ou conversa.",
        });
      }

      // Mensagem âncora da enquete (tag "poll" para renderização).
      const [{ id: messageId }] = await getDb()
        .insert(schema.messages)
        .values({
          channelId: input.channelId ?? null,
          conversationId: input.conversationId ?? null,
          authorId: ctx.user.id,
          content: input.question,
          tag: "poll",
        })
        .$returningId();

      await createPoll({
        messageId: messageId,
        createdByUserId: ctx.user.id,
        question: input.question,
        options: trimmed,
        allowMultiple: input.allowMultiple,
        durationHours: input.durationHours,
      });

      const row = await getDb().query.messages.findFirst({
        where: eq(schema.messages.id, messageId),
      });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar a enquete.",
        });
      }
      const dto = await buildMessageDTO(row);
      if (input.channelId) {
        broadcastToChannel(input.channelId, {
          t: "message:new",
          message: dto,
        });
      } else if (input.conversationId) {
        const members = await getDb()
          .select({ userId: schema.conversationMembers.userId })
          .from(schema.conversationMembers)
          .where(
            eq(
              schema.conversationMembers.conversationId,
              input.conversationId,
            ),
          );
        sendToUsers(
          members.map(m => m.userId),
          { t: "message:new", message: dto },
        );
      }
      return { messageId, message: dto };
    }),

  /** Vota (idempotente; substitui voto se allowMultiple=false). */
  vote: authedQuery
    .input(
      z.object({
        messageId: z.number().int().positive(),
        answerIds: z.array(z.number().int().positive()).min(1).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`poll:vote:${ctx.user.id}`, 30, 60_000);
      const result = await vote({
        messageId: input.messageId,
        userId: ctx.user.id,
        answerIds: input.answerIds,
      }).catch((e: Error) => {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
      });
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enquete não encontrada." });
      }

      // Realtime para todos os visualizadores da mensagem.
      const [message] = await getDb()
        .select({
          channelId: schema.messages.channelId,
          conversationId: schema.messages.conversationId,
        })
        .from(schema.messages)
        .where(eq(schema.messages.id, input.messageId))
        .limit(1);
      const dtoForAll = await getPollForViewer(input.messageId, null);
      if (message && dtoForAll) {
        const event = {
          t: "poll:update" as const,
          messageId: input.messageId,
          channelId: message.channelId ?? undefined,
          conversationId: message.conversationId ?? undefined,
          poll: dtoForAll,
        };
        if (message.channelId) broadcastToChannel(message.channelId, event);
        else if (message.conversationId) {
          const members = await getDb()
            .select({ userId: schema.conversationMembers.userId })
            .from(schema.conversationMembers)
            .where(
              eq(
                schema.conversationMembers.conversationId,
                message.conversationId,
              ),
            );
          sendToUsers(members.map(m => m.userId), event);
        }
      }
      return result;
    }),

  /** Encerra antecipadamente (autor da enquete ou MANAGE_MESSAGES). */
  close: authedQuery
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = await getPollOwner(input.messageId);
      if (!ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enquete não encontrada." });
      }
      if (ownerId !== ctx.user.id) {
        const [message] = await getDb()
          .select({ channelId: schema.messages.channelId })
          .from(schema.messages)
          .where(eq(schema.messages.id, input.messageId))
          .limit(1);
        let allowed = false;
        if (message?.channelId) {
          const { perms } = await requireChannelAccess(
            ctx.user.id,
            message.channelId,
          );
          allowed = perms.has("MANAGE_MESSAGES");
        }
        if (!allowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas o autor da enquete ou moderadores podem encerrá-la.",
          });
        }
      }
      const poll = await closePoll(input.messageId);
      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enquete não encontrada." });
      }
      const [message] = await getDb()
        .select({
          channelId: schema.messages.channelId,
          conversationId: schema.messages.conversationId,
        })
        .from(schema.messages)
        .where(eq(schema.messages.id, input.messageId))
        .limit(1);
      if (message?.channelId) {
        broadcastToChannel(message.channelId, {
          t: "poll:update",
          messageId: input.messageId,
          channelId: message.channelId,
          poll,
        });
      }
      return { poll };
    }),

  /** Resultados atuais. */
  results: authedQuery
    .input(z.object({ messageId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const poll = await getPollForViewer(input.messageId, ctx.user.id);
      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enquete não encontrada." });
      }
      return poll;
    }),
});
