import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { logSafetyEvent } from "../safetyAudit";

/**
 * ModerationCaseService — casos agregam denúncias relacionadas e detecções
 * automáticas. 500 denúncias do mesmo alvo NÃO viram prova: viram 1 caso
 * com reportsCount alto. A decisão continua sendo política + revisão humana.
 */

export type CasePriority = "low" | "normal" | "high" | "critical";
export type CaseStatus = "open" | "under_review" | "confirmed" | "false_positive" | "closed";

/** Prioridade por categoria (pura — unit-tested). */
export function priorityForCategory(
  category: string,
  aiPriority?: CasePriority
): CasePriority {
  const critical = new Set(["minor_safety", "sexual_minor"]);
  const high = new Set(["violence", "self_harm", "illegal", "threats"]);
  if (aiPriority === "critical") return "critical";
  if (category === "minor_safety" || category === "sexual_minor") return "critical";
  void critical;
  if (high.has(category)) return aiPriority === "high" ? "high" : "high";
  if (aiPriority && aiPriority !== "low") return aiPriority;
  return "normal";
}

/** Cria (ou reusa) um caso automático vindo da IA/AutoMod. Idempotente via violationId. */
export async function createAutomaticCase(input: {
  targetType: string;
  targetId: number | null;
  reportedUserId: number;
  category: string;
  priority: CasePriority;
  internalContext?: string;
  linkedViolationId?: number | null;
  aiAssessment?: Record<string, unknown> | null;
  violationStatus?: string;
}): Promise<number> {
  const db = getDb();

  if (input.linkedViolationId) {
    const existing = await db
      .select({ id: schema.moderationCases.id })
      .from(schema.moderationCases)
      .where(eq(schema.moderationCases.linkedViolationId, input.linkedViolationId))
      .limit(1);
    if (existing.length > 0) return existing[0].id;
  }

  // Janela anti-duplicação: caso aberto do mesmo alvo+categoria nas últimas 24h é reutilizado.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [openCase] = await db
    .select({ id: schema.moderationCases.id })
    .from(schema.moderationCases)
    .where(
      and(
        eq(schema.moderationCases.targetType, input.targetType),
        input.targetId != null
          ? eq(schema.moderationCases.targetId, input.targetId)
          : sql`${schema.moderationCases.targetId} IS NULL`,
        eq(schema.moderationCases.category, input.category),
        inArray(schema.moderationCases.status, ["open", "under_review"]),
        gte(schema.moderationCases.createdAt, since)
      )
    )
    .orderBy(desc(schema.moderationCases.createdAt))
    .limit(1);

  if (openCase) {
    if (input.linkedViolationId || input.aiAssessment) {
      await db.update(schema.moderationCases).set({ linkedViolationId: input.linkedViolationId ?? undefined, aiAssessment: input.aiAssessment ?? undefined }).where(eq(schema.moderationCases.id, openCase.id));
    }
    return openCase.id;
  }

  const inserted = await db
    .insert(schema.moderationCases)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      reportedUserId: input.reportedUserId,
      category: input.category.slice(0, 64),
      priority: input.priority,
      status: "open",
      internalContext: input.internalContext?.slice(0, 500) ?? null,
      linkedViolationId: input.linkedViolationId ?? null,
      aiAssessment: input.aiAssessment ?? null,
      policyVersion: input.aiAssessment ? String((input.aiAssessment as { policyVersion?: string }).policyVersion ?? "") || null : null,
    })
    .$returningId();
  const caseId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);

  await logSafetyEvent({
    event: "moderation_case_created",
    targetUserId: input.reportedUserId,
    caseId,
    metadata: { category: input.category, priority: input.priority, origin: "automatic_ai" },
  });
  return caseId;
}

/** Anexa uma denúncia ao caso (idempotente pela unique reportId). */
export async function attachReportToCase(
  caseId: number,
  reportId: number
): Promise<void> {
  const db = getDb();
  try {
    await db.insert(schema.moderationCaseReports).values({ caseId, reportId });
    await db
      .update(schema.moderationCases)
      .set({ reportsCount: sql`${schema.moderationCases.reportsCount} + 1` })
      .where(eq(schema.moderationCases.id, caseId));
    await db
      .update(schema.reports)
      .set({ caseId, status: "triaged" })
      .where(eq(schema.reports.id, reportId));
  } catch {
    // Denúncia já anexada — idempotente.
  }
}

/** Fila de casos para o painel. */
export async function listCases(filters: {
  status?: CaseStatus;
  priority?: CasePriority;
  onlyCritical?: boolean;
  limit?: number;
}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(schema.moderationCases.status, filters.status));
  if (filters.priority) {
    conditions.push(eq(schema.moderationCases.priority, filters.priority));
  }
  if (filters.onlyCritical) {
    conditions.push(inArray(schema.moderationCases.priority, ["critical", "high"]));
  }
  const rows = await getDb()
    .select({
      case: schema.moderationCases,
      reportedUser: {
        id: schema.users.id,
        username: schema.users.username,
        name: schema.users.name,
        avatar: schema.users.avatar,
      },
    })
    .from(schema.moderationCases)
    .leftJoin(schema.users, eq(schema.users.id, schema.moderationCases.reportedUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      desc(schema.moderationCases.priority),
      desc(schema.moderationCases.createdAt)
    )
    .limit(Math.min(filters.limit ?? 100, 200));
  return rows;
}

export async function getCaseById(caseId: number) {  const [row] = await getDb()
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.id, caseId))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Caso não encontrado." });
  const relatedReports = await getDb()
    .select({
      id: schema.reports.id,
      reporterId: schema.reports.reporterId,
      category: schema.reports.category,
      subcategory: schema.reports.subcategory,
      description: schema.reports.description,
      createdAt: schema.reports.createdAt,
      status: schema.reports.status,
    })
    .from(schema.moderationCaseReports)
    .innerJoin(schema.reports, eq(schema.reports.id, schema.moderationCaseReports.reportId))
    .where(eq(schema.moderationCaseReports.caseId, caseId))
    .orderBy(desc(schema.reports.createdAt))
    .limit(50);
  return { ...row, reports: relatedReports };
}

/** Brigading: eleva prioridade do caso (sinal, não prova). */
export async function escalateCasePriority(
  caseId: number,
  priority: CasePriority,
  reportsCount: number
): Promise<void> {
  await getDb()
    .update(schema.moderationCases)
    .set({ priority, reportsCount })
    .where(eq(schema.moderationCases.id, caseId));
}
