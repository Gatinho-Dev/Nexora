import { and, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { logSafetyEvent } from "../safetyAudit";
import {
  attachReportToCase,
  createAutomaticCase,
  priorityForCategory,
  type CasePriority,
} from "./moderationCaseService";
import { enqueueDeepMediaReviews } from "./deepMediaReview";
import { enqueueTextHistoryReview } from "./textHistoryReview";
import {
  requireChannelAccess,
  requireConversationAccess,
  getMemberPermissions,
} from "../../utils/permissions";

/**
 * ReportService — denúncias de usuários.
 *
 * Proteções contra abuso:
 * - rate limit por denunciante (aplicado no router);
 * - deduplicação: denúncias do mesmo alvo entram no MESMO caso;
 * - brigading (500 denúncias) aumenta prioridade, não prova violação.
 */

export const REPORT_CATEGORIES = [
  "harassment",
  "hate",
  "sexual",
  "minor_safety",
  "violence",
  "self_harm",
  "spam_or_scam",
  "personal_info",
  "impersonation",
  "illegal",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Subcategorias exibidas quando a categoria é segurança de menores. */
export const MINOR_SAFETY_SUBCATEGORIES = [
  "sexual_content_involving_minor",
  "grooming_or_exploitation",
  "predatory_behavior",
  "other_minor_risk",
] as const;

/** Mapeia categoria da denúncia → prioridade base. Pura — unit-tested. */
export function reportPriority(category: string): CasePriority {
  if (category === "minor_safety") return "critical";
  if (["violence", "self_harm", "illegal"].includes(category)) return "high";
  if (["harassment", "hate", "sexual"].includes(category)) return "normal";
  return "low";
}

async function resolveTarget(
  reporterId: number,
  targetType: "message" | "user" | "media" | "server" | "channel",
  targetId: number
): Promise<{
  reportedUserId: number | null;
  exists: boolean;
  context?: string;
  mediaFileIds?: number[];
  scope?: { scopeType: "channel" | "conversation"; scopeId: number };
}> {
  const db = getDb();
  switch (targetType) {
    case "message": {
      const [msg] = await db
        .select({
          authorId: schema.messages.authorId,
          content: schema.messages.content,
          channelId: schema.messages.channelId,
          conversationId: schema.messages.conversationId,
        })
        .from(schema.messages)
        .where(eq(schema.messages.id, targetId))
        .limit(1);
      if (!msg) return { reportedUserId: null, exists: false };
      try {
        if (msg.channelId) {
          const { perms } = await requireChannelAccess(reporterId, msg.channelId);
          if (!perms.has("READ_MESSAGES")) throw new Error("NO_READ_PERMISSION");
        } else if (msg.conversationId) {
          await requireConversationAccess(reporterId, msg.conversationId);
        } else {
          throw new Error("MESSAGE_WITHOUT_SCOPE");
        }
      } catch {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conteúdo denunciado não foi encontrado." });
      }
      if (!msg.channelId && !msg.conversationId) {
        return { reportedUserId: null, exists: false };
      }
      const imageAttachments = await db
        .select({ fileId: schema.attachments.fileId })
        .from(schema.attachments)
        .where(
          and(
            eq(schema.attachments.messageId, targetId),
            sql`${schema.attachments.mimeType} LIKE 'image/%'`
          )
        );
      return {
        reportedUserId: msg.authorId,
        exists: true,
        context: msg.content.slice(0, 2000),
        mediaFileIds: imageAttachments.map(attachment => attachment.fileId),
        scope: msg.channelId
          ? { scopeType: "channel", scopeId: msg.channelId }
          : { scopeType: "conversation", scopeId: msg.conversationId! },
      };
    }
    case "user":
    case "media": {
      if (targetType === "media") {
        const [file] = await db
          .select({
            uploaderId: schema.files.uploaderId,
            mimeType: schema.files.mimeType,
          })
          .from(schema.files)
          .where(eq(schema.files.id, targetId))
          .limit(1);
        if (!file) return { reportedUserId: null, exists: false };
        const locations = await db
          .select({
            channelId: schema.messages.channelId,
            conversationId: schema.messages.conversationId,
          })
          .from(schema.attachments)
          .innerJoin(schema.messages, eq(schema.attachments.messageId, schema.messages.id))
          .where(eq(schema.attachments.fileId, targetId));
        let visible = false;
        for (const location of locations) {
          try {
            if (location.channelId) {
              const { perms } = await requireChannelAccess(reporterId, location.channelId);
              visible = perms.has("READ_MESSAGES");
            } else if (location.conversationId) {
              await requireConversationAccess(reporterId, location.conversationId);
              visible = true;
            }
          } catch {
            visible = false;
          }
          if (visible) break;
        }
        if (!visible) return { reportedUserId: null, exists: false };
        return {
          reportedUserId: file.uploaderId,
          exists: true,
          mediaFileIds: file.mimeType.startsWith("image/") ? [targetId] : [],
        };
      }
      const [user] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, targetId))
        .limit(1);
      return user
        ? { reportedUserId: user.id, exists: true }
        : { reportedUserId: null, exists: false };
    }
    case "server": {
      const [server] = await db
        .select({ ownerId: schema.servers.ownerId, name: schema.servers.name })
        .from(schema.servers)
        .where(eq(schema.servers.id, targetId))
        .limit(1);
      if (!server || !(await getMemberPermissions(reporterId, targetId))) {
        return { reportedUserId: null, exists: false };
      }
      return server
        ? { reportedUserId: server.ownerId, exists: true, context: server.name }
        : { reportedUserId: null, exists: false };
    }
    case "channel": {
      let access;
      try {
        access = await requireChannelAccess(reporterId, targetId);
      } catch {
        return { reportedUserId: null, exists: false };
      }
      const channel = access.channel;
      const [server] = await db
        .select({ ownerId: schema.servers.ownerId })
        .from(schema.servers)
        .where(eq(schema.servers.id, channel.serverId))
        .limit(1);
      return {
        reportedUserId: server?.ownerId ?? null,
        exists: true,
        context: channel.name,
      };
    }
  }
}

/** Cria uma denúncia e o caso de moderação correspondente. */
export async function createReport(input: {
  reporterId: number;
  targetType: "message" | "user" | "media" | "server" | "channel";
  targetId: number;
  category: string;
  subcategory?: string;
  description?: string;
}): Promise<{ reportId: number; caseId: number }> {
  // Não denunciar a si mesmo.
  const target = await resolveTarget(input.reporterId, input.targetType, input.targetId);
  if (!target.exists || target.reportedUserId == null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conteúdo denunciado não foi encontrado.",
    });
  }
  if (
    target.reportedUserId === input.reporterId &&
    input.targetType !== "message"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Você não pode denunciar seu próprio conteúdo.",
    });
  }

  // Rate limit de abuso: máx. 5 denúncias / 10 min / usuário (além do rateLimit genérico).
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const [recentCount] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.reporterId, input.reporterId),
        gte(schema.reports.createdAt, since)
      )
    );
  if (Number(recentCount?.count ?? 0) >= 5) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Você enviou muitas denúncias em pouco tempo. Tente novamente mais tarde.",
    });
  }

  const inserted = await getDb()
    .insert(schema.reports)
    .values({
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reportedUserId: target.reportedUserId,
      category: input.category.slice(0, 64),
      subcategory: input.subcategory?.slice(0, 64) ?? null,
      description: input.description?.slice(0, 1000) ?? null,
      status: "submitted",
      priority: reportPriority(input.category),
    })
    .$returningId();
  const reportId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);

  // A revisão textual é persistente e assíncrona: a denúncia não fica presa ao
  // provedor e o Render pode retomar o cursor depois de um restart.
  const aiAssessment: Record<string, unknown> | null =
    input.targetType === "message" && target.scope
      ? { historyReview: "queued", scopeType: target.scope.scopeType }
      : null;

  const categoryForCase =
    input.category === "minor_safety"
      ? "minor_safety"
      : mapReportCategoryToCaseCategory(input.category);

  const caseId = await createAutomaticCase({
    targetType: input.targetType,
    targetId: input.targetId,
    reportedUserId: target.reportedUserId!,
    category: categoryForCase,
    priority: priorityForCategory(
      categoryForCase,
      reportPriority(input.category)
    ),
    internalContext: target.context ?? input.description?.slice(0, 400),
    linkedViolationId: null,
    aiAssessment,
  });

  await attachReportToCase(caseId, reportId);
  let historyReviewQueued = false;
  if (input.targetType === "message" && target.scope) {
    historyReviewQueued = await enqueueTextHistoryReview({
      reportId,
      caseId,
      anchorMessageId: input.targetId,
      reportedUserId: target.reportedUserId,
      scopeType: target.scope.scopeType,
      scopeId: target.scope.scopeId,
    });
  }

  // A reported image receives a slower multi-pass visual review. Enqueueing is
  // durable and fast; the worker continues asynchronously after this response.
  const deepMediaCount = await enqueueDeepMediaReviews({
    fileIds: target.mediaFileIds ?? [],
    caseId,
    reportId,
  });

  // Brigading: muitas denúncias recentes do mesmo alvo elevam a prioridade
  // (sinal — não prova).
  const [brigadeCount] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.targetType, input.targetType),
        eq(schema.reports.targetId, input.targetId),
        gte(
          schema.reports.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000)
        )
      )
    );
  const count = Number(brigadeCount?.count ?? 0);
  if (count >= 10) {
    const { escalateCasePriority } = await import("./moderationCaseService");
    await escalateCasePriority(
      caseId,
      count >= 50 ? "critical" : "high",
      count
    );
  }

  await logSafetyEvent({
    event: "report_submitted",
    actorUserId: input.reporterId,
    targetUserId: target.reportedUserId,
    caseId,
    metadata: {
      reportId,
      targetType: input.targetType,
      category: input.category,
      deepMediaCount,
      historyReviewQueued,
    },
  });

  return { reportId, caseId };
}

function mapReportCategoryToCaseCategory(category: string): string {
  switch (category) {
    case "spam_or_scam":
      return "scam_or_spam";
    case "personal_info":
      return "privacy";
    default:
      return category;
  }
}

/** Minhas denúncias (para o solicitante). */
export async function listMyReports(reporterId: number) {
  return getDb()
    .select({
      id: schema.reports.id,
      targetType: schema.reports.targetType,
      targetId: schema.reports.targetId,
      category: schema.reports.category,
      status: schema.reports.status,
      priority: schema.reports.priority,
      createdAt: schema.reports.createdAt,
      reviewedAt: schema.reports.reviewedAt,
    })
    .from(schema.reports)
    .where(eq(schema.reports.reporterId, reporterId))
    .orderBy(desc(schema.reports.createdAt))
    .limit(50);
}
