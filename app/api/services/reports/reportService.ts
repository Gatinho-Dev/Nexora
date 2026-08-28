import { and, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { env } from "../../lib/env";
import { logSafetyEvent } from "../safetyAudit";
import {
  attachReportToCase,
  createAutomaticCase,
  priorityForCategory,
  type CasePriority,
} from "./moderationCaseService";
import { enqueueDeepMediaReviews } from "./deepMediaReview";

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
  targetType: "message" | "user" | "media" | "server" | "channel",
  targetId: number
): Promise<{
  reportedUserId: number | null;
  exists: boolean;
  context?: string;
  mediaFileIds?: number[];
}> {
  const db = getDb();
  switch (targetType) {
    case "message": {
      const [msg] = await db
        .select({
          authorId: schema.messages.authorId,
          content: schema.messages.content,
        })
        .from(schema.messages)
        .where(eq(schema.messages.id, targetId))
        .limit(1);
      if (!msg) return { reportedUserId: null, exists: false };
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
        return file
          ? {
              reportedUserId: file.uploaderId,
              exists: true,
              mediaFileIds: file.mimeType.startsWith("image/")
                ? [targetId]
                : [],
            }
          : { reportedUserId: null, exists: false };
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
      return server
        ? { reportedUserId: server.ownerId, exists: true, context: server.name }
        : { reportedUserId: null, exists: false };
    }
    case "channel": {
      const [channel] = await db
        .select({
          name: schema.channels.name,
          serverId: schema.channels.serverId,
        })
        .from(schema.channels)
        .where(eq(schema.channels.id, targetId))
        .limit(1);
      if (!channel) return { reportedUserId: null, exists: false };
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
  const target = await resolveTarget(input.targetType, input.targetId);
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

  // Classificação aprofundada para texto denunciado + política limitada e auditável.
  let aiPriority: CasePriority | undefined;
  let aiAssessment: Record<string, unknown> | null = null;
  let linkedViolationId: number | null = null;
  let automaticAction: string | null = null;
  if (
    env.reportAiTriageEnabled &&
    input.targetType === "message" &&
    target.context &&
    env.safetyAiEnabled &&
    !env.safetyShadowMode &&
    env.openrouterApiKey
  ) {
    try {
      const { SafetyService } = await import("../safety/safetyService");
      const result = await SafetyService.analyzeText({
        content: target.context,
      });
      aiAssessment = {
        safe: result.safe,
        categories: result.categories,
        model: result.model,
      };
      if (result.categories.includes("sexual_minor")) aiPriority = "critical";
      const { applyReportedTextDecision } = await import("../textModeration");
      const applied = await applyReportedTextDecision({ messageId: input.targetId, authorId: target.reportedUserId, result });
      linkedViolationId = applied.violationId;
      automaticAction = applied.action;
      aiAssessment.automaticAction = applied.action;
    } catch {
      aiAssessment = { unavailable: true, automaticAction: "manual_review" };
    }
  }

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
      aiPriority ?? reportPriority(input.category)
    ),
    internalContext: target.context ?? input.description?.slice(0, 400),
    linkedViolationId,
    aiAssessment,
  });

  await attachReportToCase(caseId, reportId);
  if (["remove_and_warn", "remove_and_suspend"].includes(automaticAction ?? "")) {
    await getDb().update(schema.reports).set({ status: "action_taken", reviewedAt: new Date() }).where(eq(schema.reports.id, reportId));
    await getDb().update(schema.moderationCases).set({ status: "confirmed" }).where(eq(schema.moderationCases.id, caseId));
  } else if (automaticAction === "no_violation") {
    await getDb().update(schema.reports).set({ status: "no_violation", reviewedAt: new Date() }).where(eq(schema.reports.id, reportId));
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
