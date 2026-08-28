import { and, asc, desc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../../queries/connection";
import { env } from "../../lib/env";
import { SafetyService, isSafetyKilled } from "../safety/safetyService";
import { decideReportedTextAction, removeMessageForModeration } from "../textModeration";
import { applyAutomatedHistorySanction } from "../accountSafety";
import { logSafetyEvent } from "../safetyAudit";

const MAX_CONCURRENT_REVIEWS = 1;
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;
const MAX_HISTORY_MESSAGES = 500;
const HISTORY_WINDOW_DAYS = 90;
let activeReviews = 0;
let pumpScheduled = false;

type ReviewRow = typeof schema.textHistoryReviews.$inferSelect;
type Scope = { scopeType: "channel" | "conversation"; scopeId: number };
type Finding = { category: string; violationId: number };

export type HistorySanctionDecision = {
  action: "none" | "warning" | "temporary_suspension";
  suspensionDays: number | null;
};

/** Pure, conservative policy: an automated history review never permanently bans. */
export function decideHistorySanction(categories: string[]): HistorySanctionDecision {
  if (categories.length === 0) return { action: "none", suspensionDays: null };
  if (categories.includes("sexual_minor")) {
    return {
      action: "temporary_suspension",
      suspensionDays: Math.max(1, env.sexualMinorSuspensionDays),
    };
  }
  const highRisk = new Set(["threat", "hate", "graphic_violence", "criminal", "malware"]);
  const highCount = categories.filter(category => highRisk.has(category)).length;
  if (highCount >= 5) {
    return { action: "temporary_suspension", suspensionDays: 7 };
  }
  if (highCount >= 3) {
    return { action: "temporary_suspension", suspensionDays: 3 };
  }
  if (highCount >= 2) {
    return { action: "temporary_suspension", suspensionDays: 1 };
  }
  const meaningfulCount = categories.filter(category => !["spam", "profanity"].includes(category)).length;
  if (meaningfulCount >= 8) return { action: "temporary_suspension", suspensionDays: 1 };
  return { action: "warning", suspensionDays: null };
}

const CATEGORY_LABELS: Record<string, string> = {
  harassment: "assédio",
  hate: "discurso de ódio",
  threat: "ameaça",
  sexual: "conteúdo sexual",
  sexual_minor: "segurança de menores",
  violence: "violência",
  graphic_violence: "violência gráfica",
  criminal: "atividade criminosa",
  privacy: "exposição de dados pessoais",
  scam: "fraude",
  spam: "spam",
  malware: "malware",
  regulated_goods: "produtos regulados",
  profanity: "linguagem abusiva",
};

function publicReason(categories: string[]): string {
  const unique = [...new Set(categories)].slice(0, 4);
  const labels = unique.map(category => CATEGORY_LABELS[category] ?? "violação das diretrizes");
  return `A revisão de segurança encontrou ${categories.length} mensagem(ns) desta conta em desacordo com as Diretrizes nesta conversa. Motivos identificados: ${labels.join(", ")}.`;
}

function primaryCategory(categories: string[]): string {
  return categories.includes("sexual_minor") ? "sexual_minor" : (categories[0] ?? "other");
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : "UNKNOWN_ERROR")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

function schedulePump(delayMs = 0): void {
  if (pumpScheduled) return;
  pumpScheduled = true;
  setTimeout(() => {
    pumpScheduled = false;
    void pumpQueue();
  }, delayMs).unref?.();
}

function scopePredicate(scope: Scope) {
  return scope.scopeType === "channel"
    ? eq(schema.messages.channelId, scope.scopeId)
    : eq(schema.messages.conversationId, scope.scopeId);
}

async function claimNext(): Promise<ReviewRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.textHistoryReviews)
    .where(eq(schema.textHistoryReviews.status, "queued"))
    .orderBy(asc(schema.textHistoryReviews.createdAt))
    .limit(1);
  if (!row) return null;
  const [result] = await db
    .update(schema.textHistoryReviews)
    .set({ status: "processing", attempts: row.attempts + 1, startedAt: new Date(), lastError: null })
    .where(and(eq(schema.textHistoryReviews.id, row.id), eq(schema.textHistoryReviews.status, "queued")));
  return (result as unknown as { affectedRows: number }).affectedRows > 0
    ? { ...row, status: "processing", attempts: row.attempts + 1 }
    : null;
}

async function recordFinding(row: ReviewRow, messageId: number, category: string, model: string): Promise<number | null> {
  const db = getDb();
  const [existing] = await db
    .select({ id: schema.violations.id })
    .from(schema.violations)
    .where(and(eq(schema.violations.messageId, messageId), eq(schema.violations.category, category)))
    .limit(1);
  if (existing) {
    // A staff/appeal reversal is authoritative and durable. Re-reporting the
    // same occurrence cannot silently hide it again.
    const [existingDetail] = await db
      .select({ status: schema.violations.status })
      .from(schema.violations)
      .where(eq(schema.violations.id, existing.id))
      .limit(1);
    if (existingDetail?.status === "false_positive") return null;
    await removeMessageForModeration(messageId, row.reportedUserId);
    return existing.id;
  }
  const inserted = await db
    .insert(schema.violations)
    .values({
      userId: row.reportedUserId,
      messageId,
      targetType: "message",
      category,
      severity: category === "sexual_minor" ? "severe" : "moderate",
      source: "user_report",
      moderationModel: model,
      policyVersion: env.safetyPolicyVersion,
      status: "confirmed",
      action: "content_blocked",
      publicReason: `Mensagem removida por ${CATEGORY_LABELS[category] ?? "violação das diretrizes"}.`,
      affectedContentCount: 1,
      strikeApplied: false,
      internalNote: `Revisão de histórico da denúncia ${row.reportId}.`,
    })
    .$returningId();
  const violationId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);
  if (!violationId) throw new Error("HISTORY_VIOLATION_NOT_RECORDED");
  await removeMessageForModeration(messageId, row.reportedUserId);
  return violationId;
}

async function completeReview(row: ReviewRow, categories: string[], violationIds: number[], model: string): Promise<void> {
  const db = getDb();
  const decision = decideHistorySanction(categories);
  const reason = categories.length > 0 ? publicReason(categories) : "Nenhuma outra mensagem em desacordo foi encontrada nesta conversa.";
  let enforcementViolationId: number | null = null;
  if (decision.action !== "none") {
    enforcementViolationId = await applyAutomatedHistorySanction({
      userId: row.reportedUserId,
      anchorMessageId: row.anchorMessageId,
      reportId: row.reportId,
      model,
      sanction: {
        action: decision.action,
        suspensionDays: decision.suspensionDays,
        primaryCategory: primaryCategory(categories),
        publicReason: reason,
        affectedContentCount: categories.length,
      },
    });
  }
  await db
    .update(schema.textHistoryReviews)
    .set({
      status: "completed",
      categories,
      violationIds,
      removedCount: categories.length,
      sanction: decision.action,
      suspensionDays: decision.suspensionDays,
      publicReason: reason,
      model,
      enforcementViolationId,
      completedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.textHistoryReviews.id, row.id));
  await db
    .update(schema.reports)
    .set({
      status: decision.action === "none" ? "triaged" : "action_taken",
      reviewedAt: decision.action === "none" ? null : new Date(),
    })
    .where(eq(schema.reports.id, row.reportId));
  await db
    .update(schema.moderationCases)
    .set({
      status: decision.action === "none" ? "under_review" : "confirmed",
      linkedViolationId: enforcementViolationId,
      aiAssessment: {
        source: "reported_text_history_review",
        scannedCount: row.scannedCount,
        removedCount: categories.length,
        categories: [...new Set(categories)],
        sanction: decision.action,
        suspensionDays: decision.suspensionDays,
        model,
      },
    })
    .where(eq(schema.moderationCases.id, row.caseId));
  await logSafetyEvent({
    event: "reported_text_history_review_completed",
    targetUserId: row.reportedUserId,
    caseId: row.caseId,
    violationId: enforcementViolationId ?? undefined,
    metadata: { reportId: row.reportId, scannedCount: row.scannedCount, removedCount: categories.length, sanction: decision.action },
  });
}

async function processReview(initial: ReviewRow): Promise<void> {
  const db = getDb();
  let row = initial;
  const categories = [...(row.categories ?? [])];
  const violationIds = [...(row.violationIds ?? [])];
  let lastModel = row.model ?? "unknown";
  const scope: Scope = { scopeType: row.scopeType, scopeId: row.scopeId };

  while (true) {
    const messages = await db
      .select({ id: schema.messages.id, content: schema.messages.content })
      .from(schema.messages)
      .where(and(
        scopePredicate(scope),
        eq(schema.messages.authorId, row.reportedUserId),
        gt(schema.messages.id, row.cursorMessageId),
        lte(schema.messages.id, row.snapshotMaxMessageId),
        or(isNull(schema.messages.tag), ne(schema.messages.tag, "removed")),
      ))
      .orderBy(asc(schema.messages.id))
      .limit(BATCH_SIZE);
    if (messages.length === 0) break;

    for (const message of messages) {
      let finding: Finding | null = null;
      if (message.content.trim().length >= 3) {
        const result = await SafetyService.analyzeText({
          content: message.content.slice(0, 2000),
          requestId: `history:${row.id}:${message.id}`,
        });
        lastModel = result.model;
        const decision = decideReportedTextAction(result);
        // Ausência de confiança é um resultado incompleto, não uma autorização
        // para apagar conteúdo ou punir uma conta automaticamente.
        const confidenceAcceptable =
          result.confidence != null && result.confidence >= 0.75;
        if (
          confidenceAcceptable &&
          !result.reviewRecommended &&
          (decision.action === "remove_and_warn" || decision.action === "remove_and_suspend")
        ) {
          const violationId = await recordFinding(row, message.id, decision.category, result.model);
          if (violationId) finding = { category: decision.category, violationId };
        }
      }
      if (finding) {
        categories.push(finding.category);
        violationIds.push(finding.violationId);
      }
      row = {
        ...row,
        cursorMessageId: message.id,
        scannedCount: row.scannedCount + 1,
        removedCount: categories.length,
        categories,
        violationIds,
        model: lastModel,
      };
      await db
        .update(schema.textHistoryReviews)
        .set({
          cursorMessageId: row.cursorMessageId,
          scannedCount: row.scannedCount,
          removedCount: row.removedCount,
          categories,
          violationIds,
          model: lastModel,
        })
        .where(eq(schema.textHistoryReviews.id, row.id));
    }
  }
  await completeReview(row, categories, violationIds, lastModel);
}

async function failReview(row: ReviewRow, error: unknown): Promise<void> {
  const lastError = safeError(error);
  const retry = row.attempts < MAX_ATTEMPTS && !isSafetyKilled();
  await getDb()
    .update(schema.textHistoryReviews)
    .set({ status: retry ? "queued" : "failed", lastError, completedAt: retry ? null : new Date() })
    .where(eq(schema.textHistoryReviews.id, row.id));
  if (retry) schedulePump(800 * row.attempts);
  else {
    await getDb().update(schema.moderationCases).set({ status: "under_review" }).where(eq(schema.moderationCases.id, row.caseId));
    await logSafetyEvent({ event: "reported_text_history_review_failed", caseId: row.caseId, metadata: { reportId: row.reportId, reason: lastError } });
  }
}

async function pumpQueue(): Promise<void> {
  if (isSafetyKilled() || !env.reportAiTriageEnabled || !env.textModerationEnabled) return;
  while (activeReviews < MAX_CONCURRENT_REVIEWS) {
    const row = await claimNext();
    if (!row) break;
    activeReviews += 1;
    void processReview(row)
      .catch(error => failReview(row, error))
      .finally(() => { activeReviews -= 1; schedulePump(); });
  }
}

export async function enqueueTextHistoryReview(input: {
  reportId: number;
  caseId: number;
  anchorMessageId: number;
  reportedUserId: number;
  scopeType: "channel" | "conversation";
  scopeId: number;
}): Promise<boolean> {
  if (!env.reportAiTriageEnabled || !env.textModerationEnabled || !env.safetyAiEnabled || env.safetyShadowMode || !env.openrouterApiKey) return false;
  const db = getDb();
  const scope: Scope = { scopeType: input.scopeType, scopeId: input.scopeId };
  const cutoff = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000);
  const snapshotRows = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(and(
      scopePredicate(scope),
      eq(schema.messages.authorId, input.reportedUserId),
      gt(schema.messages.createdAt, cutoff),
    ))
    .orderBy(desc(schema.messages.id))
    .limit(MAX_HISTORY_MESSAGES);
  const snapshotMaxMessageId = snapshotRows[0]?.id ?? input.anchorMessageId;
  const cursorMessageId = Math.max(0, (snapshotRows.at(-1)?.id ?? input.anchorMessageId) - 1);
  await db
    .insert(schema.textHistoryReviews)
    .values({ ...input, snapshotMaxMessageId, cursorMessageId, categories: [], violationIds: [] })
    .onDuplicateKeyUpdate({ set: { caseId: input.caseId } });
  schedulePump();
  return true;
}

/** Render restart recovery: continue from the last committed cursor. */
export async function resumePendingTextHistoryReviews(): Promise<void> {
  await getDb()
    .update(schema.textHistoryReviews)
    .set({ status: "queued", lastError: "RESTART_RECOVERY" })
    .where(eq(schema.textHistoryReviews.status, "processing"));
  if (!isSafetyKilled() && env.reportAiTriageEnabled && env.textModerationEnabled) schedulePump();
}

/** Manual/appeal reversal for the grouped enforcement restores every item. */
export async function restoreHistoryReviewAfterFalsePositive(
  enforcementViolationId: number,
  reviewerId?: number,
): Promise<number> {
  const db = getDb();
  const [review] = await db
    .select({ violationIds: schema.textHistoryReviews.violationIds })
    .from(schema.textHistoryReviews)
    .where(eq(schema.textHistoryReviews.enforcementViolationId, enforcementViolationId))
    .limit(1);
  const violationIds = [...new Set(review?.violationIds ?? [])];
  if (violationIds.length === 0) return 0;
  const rows = await db
    .select({ id: schema.violations.id, messageId: schema.violations.messageId })
    .from(schema.violations)
    .where(inArray(schema.violations.id, violationIds));
  await db
    .update(schema.violations)
    .set({
      status: "false_positive",
      strikeApplied: false,
      reviewedAt: new Date(),
      ...(reviewerId ? { reviewedByUserId: reviewerId } : {}),
    })
    .where(inArray(schema.violations.id, violationIds));
  const { restoreMessageAfterFalsePositive } = await import("../textModeration");
  for (const row of rows) {
    if (row.messageId) await restoreMessageAfterFalsePositive(row.messageId, row.id);
  }
  return rows.length;
}
