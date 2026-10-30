import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { rateLimit } from "../utils/rateLimit";
import { RateLimits } from "@contracts/constants";
import { requirePermission } from "../utils/permissions";
import { logServerAudit } from "../services/serverAudit";
import { sendToUsers } from "../realtime";

async function validateAttachments(userId: number, attachmentIds: number[]) {
  if (!attachmentIds.length) return;
  const owned = await getDb().select({ id: schema.files.id }).from(schema.files).where(and(
    eq(schema.files.uploaderId, userId),
    inArray(schema.files.id, attachmentIds),
  ));
  if (owned.length !== attachmentIds.length) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Um anexo não pertence à sua conta." });
  }
}

async function notifyTicket(userId: number, ticketId: number, content: string) {
  const [{ id }] = await getDb().insert(schema.notifications).values({
    userId,
    type: "ticket_update",
    content,
  }).$returningId();
  const notification = await getDb().query.notifications.findFirst({ where: eq(schema.notifications.id, id) });
  if (notification) {
    sendToUsers([userId], {
      t: "notification",
      notification: {
        id: notification.id,
        type: notification.type,
        actor: null,
        serverId: null,
        channelId: null,
        conversationId: null,
        messageId: null,
        content: `${content} (#${ticketId})`,
        isRead: false,
        createdAt: notification.createdAt,
      },
    });
  }
}

export const supportFeaturesRouter = createRouter({
  createTicket: authedQuery
    .input(z.object({
      category: z.enum(["account", "moderation", "report", "bug", "billing", "security", "ban"]),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
      subject: z.string().min(3).max(160),
      message: z.string().min(1).max(5000),
      attachmentIds: z.array(z.number()).max(10).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`ticket:${ctx.user.id}`, RateLimits.ticketCreate.limit, RateLimits.ticketCreate.windowMs);
      await validateAttachments(ctx.user.id, input.attachmentIds);
      const [{ id }] = await getDb().insert(schema.tickets).values({
        requesterUserId: ctx.user.id,
        category: input.category,
        priority: input.priority,
        subject: input.subject.trim(),
      }).$returningId();
      await getDb().insert(schema.ticketMessages).values({
        ticketId: id,
        authorUserId: ctx.user.id,
        content: input.message.trim(),
        attachmentIds: input.attachmentIds,
      });
      return { id };
    }),

  myTickets: authedQuery.query(async ({ ctx }) => getDb()
    .select()
    .from(schema.tickets)
    .where(eq(schema.tickets.requesterUserId, ctx.user.id))
    .orderBy(desc(schema.tickets.id))
    .limit(200)),

  ticket: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const ticket = await getDb().query.tickets.findFirst({ where: eq(schema.tickets.id, input.id) });
      if (!ticket || (ticket.requesterUserId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket não encontrado." });
      }
      const messages = await getDb().select().from(schema.ticketMessages).where(and(
        eq(schema.ticketMessages.ticketId, ticket.id),
        ticket.requesterUserId === ctx.user.id ? eq(schema.ticketMessages.internal, false) : undefined,
      )).orderBy(schema.ticketMessages.id);
      return { ticket, messages };
    }),

  replyTicket: authedQuery
    .input(z.object({ ticketId: z.number(), message: z.string().min(1).max(5000), attachmentIds: z.array(z.number()).max(10).default([]) }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await getDb().query.tickets.findFirst({ where: eq(schema.tickets.id, input.ticketId) });
      if (!ticket || (ticket.requesterUserId !== ctx.user.id && ctx.user.role !== "admin")) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket não encontrado." });
      if (["RESOLVED", "CLOSED"].includes(ticket.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este ticket está encerrado." });
      await validateAttachments(ctx.user.id, input.attachmentIds);
      await getDb().insert(schema.ticketMessages).values({ ticketId: ticket.id, authorUserId: ctx.user.id, content: input.message.trim(), attachmentIds: input.attachmentIds });
      await getDb().update(schema.tickets).set({ status: ctx.user.role === "admin" ? "WAITING_USER" : "IN_PROGRESS", updatedAt: new Date() }).where(eq(schema.tickets.id, ticket.id));
      if (ctx.user.role === "admin") await notifyTicket(ticket.requesterUserId, ticket.id, "Seu ticket recebeu uma resposta");
      return { ok: true };
    }),

  ticketQueue: adminQuery
    .input(z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional() }))
    .query(async ({ input }) => getDb().select().from(schema.tickets).where(input.status ? eq(schema.tickets.status, input.status) : undefined).orderBy(desc(schema.tickets.id)).limit(500)),

  updateTicket: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), assigneeUserId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await getDb().query.tickets.findFirst({ where: eq(schema.tickets.id, input.id) });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket não encontrado." });
      await getDb().update(schema.tickets).set({ status: input.status, priority: input.priority, assigneeUserId: input.assigneeUserId, updatedAt: new Date() }).where(eq(schema.tickets.id, ticket.id));
      await notifyTicket(ticket.requesterUserId, ticket.id, `Status atualizado para ${input.status}`);
      sendToUsers([ctx.user.id], { t: "support:refresh" });
      return { ok: true };
    }),

  createBanAppeal: authedQuery
    .input(z.object({ serverId: z.number(), reason: z.string().min(3).max(240), explanation: z.string().min(20).max(5000), evidence: z.array(z.string().url().max(800)).max(10).default([]) }))
    .mutation(async ({ ctx, input }) => {
      const ban = await getDb().query.bans.findFirst({ where: and(eq(schema.bans.serverId, input.serverId), eq(schema.bans.userId, ctx.user.id)) });
      if (!ban) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum banimento ativo foi encontrado." });
      const pending = await getDb().query.banAppeals.findFirst({ where: and(eq(schema.banAppeals.banId, ban.id), eq(schema.banAppeals.status, "PENDING")) });
      if (pending) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma apelação em análise." });
      const [{ id }] = await getDb().insert(schema.banAppeals).values({ serverId: input.serverId, userId: ctx.user.id, banId: ban.id, reason: input.reason.trim(), explanation: input.explanation.trim(), evidence: input.evidence }).$returningId();
      return { id };
    }),

  myBanAppeals: authedQuery.query(async ({ ctx }) => getDb().select().from(schema.banAppeals).where(eq(schema.banAppeals.userId, ctx.user.id)).orderBy(desc(schema.banAppeals.id)).limit(100)),

  serverBanAppeals: authedQuery
    .input(z.object({ serverId: z.number(), status: z.enum(["PENDING", "UPHELD", "REDUCED", "REMOVED"]).optional() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "BAN_MEMBERS");
      return getDb().select().from(schema.banAppeals).where(and(eq(schema.banAppeals.serverId, input.serverId), input.status ? eq(schema.banAppeals.status, input.status) : undefined)).orderBy(desc(schema.banAppeals.id)).limit(200);
    }),

  resolveBanAppeal: authedQuery
    .input(z.object({ id: z.number(), status: z.enum(["UPHELD", "REDUCED", "REMOVED"]), resolution: z.string().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const appeal = await getDb().query.banAppeals.findFirst({ where: eq(schema.banAppeals.id, input.id) });
      if (!appeal || appeal.status !== "PENDING") throw new TRPCError({ code: "NOT_FOUND", message: "Apelação pendente não encontrada." });
      await requirePermission(ctx.user.id, appeal.serverId, "BAN_MEMBERS");
      if (input.status === "REMOVED") await getDb().delete(schema.bans).where(eq(schema.bans.id, appeal.banId));
      await getDb().update(schema.banAppeals).set({ status: input.status, resolution: input.resolution.trim(), reviewedByUserId: ctx.user.id, reviewedAt: new Date() }).where(eq(schema.banAppeals.id, appeal.id));
      await logServerAudit({ serverId: appeal.serverId, actorUserId: ctx.user.id, action: `BAN_APPEAL_${input.status}`, targetType: "ban_appeal", targetId: appeal.id, targetUserId: appeal.userId, reason: input.resolution.trim() });
      await notifyTicket(appeal.userId, appeal.id, `Apelação de banimento: ${input.status}`);
      return { ok: true };
    }),
});
