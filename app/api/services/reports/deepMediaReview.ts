import { and, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "@db/schema";
import { getDb } from "../../queries/connection";
import { env } from "../../lib/env";
import { SafetyService, isSafetyKilled } from "../safety/safetyService";
import { toNormalizedVerdict } from "../safety/errors";
import { logSafetyEvent } from "../safetyAudit";

const MAX_CONCURRENT_REVIEWS = 2;
const MAX_ATTEMPTS = 3;
let activeReviews = 0;
let pumpScheduled = false;

type ReviewRow = typeof schema.mediaDeepReviews.$inferSelect;

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function schedulePump(delayMs = 0): void {
  if (pumpScheduled) return;
  pumpScheduled = true;
  setTimeout(() => {
    pumpScheduled = false;
    void pumpQueue();
  }, delayMs).unref?.();
}

async function claimNext(): Promise<ReviewRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.mediaDeepReviews)
    .where(eq(schema.mediaDeepReviews.status, "queued"))
    .orderBy(asc(schema.mediaDeepReviews.createdAt))
    .limit(1);
  if (!row) return null;
  const [result] = await db
    .update(schema.mediaDeepReviews)
    .set({
      status: "processing",
      attempts: row.attempts + 1,
      startedAt: new Date(),
      lastError: null,
    })
    .where(
      and(
        eq(schema.mediaDeepReviews.id, row.id),
        eq(schema.mediaDeepReviews.status, "queued")
      )
    );
  return (result as unknown as { affectedRows: number }).affectedRows > 0
    ? { ...row, status: "processing", attempts: row.attempts + 1 }
    : null;
}

async function applyDeepResult(row: ReviewRow): Promise<void> {
  const db = getDb();
  const [file] = await db
    .select({
      data: schema.files.data,
      mimeType: schema.files.mimeType,
      size: schema.files.size,
      uploaderId: schema.files.uploaderId,
    })
    .from(schema.files)
    .where(eq(schema.files.id, row.fileId))
    .limit(1);
  if (!file || file.size === 0 || !file.mimeType.startsWith("image/")) {
    throw new Error("REPORTED_IMAGE_NOT_AVAILABLE");
  }

  const requestId = randomUUID();
  const result = await SafetyService.analyzeImageDeep({
    data: file.data,
    mimeType: file.mimeType,
    mode: "reported",
    requestId,
  });
  const verdict = toNormalizedVerdict(result);
  const assessment = {
    source: "reported_media_deep_review",
    decision: verdict.decision,
    safe: result.safe,
    categories: result.categories,
    confidence: result.confidence ?? null,
    signals: result.signals ?? {},
    reviewRecommended: result.reviewRecommended ?? false,
    model: result.model,
    policyVersion: env.safetyPolicyVersion,
    reviewedAt: new Date().toISOString(),
  };

  // A report triggers stronger classification but never an automatic account
  // punishment. Suspected minor content is hidden and escalated to a human.
  if (verdict.decision === "BLOCK") {
    await db
      .update(schema.mediaModeration)
      .set({
        status: "review_required",
        safety: "unsafe",
        categories: result.categories,
        sensitive: true,
        adultOnly: true,
        allowReveal: false,
        moderationModel: result.model,
        moderatedAt: new Date(),
        lastError: null,
      })
      .where(eq(schema.mediaModeration.fileId, row.fileId));
  } else if (verdict.decision === "SENSITIVE_ADULT") {
    await db
      .update(schema.mediaModeration)
      .set({
        status: "sensitive",
        safety: "unsafe",
        categories: result.categories,
        sensitive: true,
        adultOnly: true,
        allowReveal: true,
        moderationModel: result.model,
        moderatedAt: new Date(),
        lastError: null,
      })
      .where(eq(schema.mediaModeration.fileId, row.fileId));
  } else if (verdict.decision === "ALLOW") {
    await db
      .update(schema.mediaModeration)
      .set({
        status: "approved",
        safety: "safe",
        categories: [],
        sensitive: false,
        adultOnly: false,
        allowReveal: true,
        moderationModel: result.model,
        moderatedAt: new Date(),
        lastError: null,
      })
      .where(eq(schema.mediaModeration.fileId, row.fileId));
  } else {
    await db
      .update(schema.mediaModeration)
      .set({
        status: "review_required",
        safety: "unknown",
        categories: result.categories,
        allowReveal: false,
        moderationModel: result.model,
        moderatedAt: new Date(),
        lastError: null,
      })
      .where(eq(schema.mediaModeration.fileId, row.fileId));
  }

  const priority =
    verdict.decision === "BLOCK"
      ? "critical"
      : verdict.decision === "SENSITIVE_ADULT"
        ? "high"
        : undefined;
  await db
    .update(schema.moderationCases)
    .set({
      aiAssessment: assessment,
      ...(priority ? { priority } : {}),
      policyVersion: env.safetyPolicyVersion,
    })
    .where(eq(schema.moderationCases.id, row.caseId));
  await db
    .update(schema.mediaDeepReviews)
    .set({
      status: "completed",
      result: assessment,
      model: result.model,
      completedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.mediaDeepReviews.id, row.id));

  await logSafetyEvent({
    event: "reported_media_deep_review_completed",
    targetUserId: file.uploaderId,
    caseId: row.caseId,
    metadata: {
      reportId: row.reportId,
      fileId: row.fileId,
      decision: verdict.decision,
      requestId,
    },
  });
}

async function failReview(row: ReviewRow, error: unknown): Promise<void> {
  const lastError = safeError(error);
  const retry = row.attempts < MAX_ATTEMPTS && !isSafetyKilled();
  await getDb()
    .update(schema.mediaDeepReviews)
    .set({
      status: retry ? "queued" : "failed",
      lastError,
      completedAt: retry ? null : new Date(),
    })
    .where(eq(schema.mediaDeepReviews.id, row.id));
  if (retry) schedulePump(800 * row.attempts);
  else {
    await logSafetyEvent({
      event: "reported_media_deep_review_failed",
      caseId: row.caseId,
      metadata: {
        reportId: row.reportId,
        fileId: row.fileId,
        reason: lastError,
      },
    });
  }
}

async function pumpQueue(): Promise<void> {
  if (isSafetyKilled() || !env.imageModerationEnabled) return;
  while (activeReviews < MAX_CONCURRENT_REVIEWS) {
    const row = await claimNext();
    if (!row) break;
    activeReviews += 1;
    void applyDeepResult(row)
      .catch(error => failReview(row, error))
      .finally(() => {
        activeReviews -= 1;
        schedulePump();
      });
  }
}

export async function enqueueDeepMediaReviews(input: {
  fileIds: number[];
  caseId: number;
  reportId: number;
}): Promise<number> {
  const fileIds = Array.from(new Set(input.fileIds)).slice(0, 10);
  if (fileIds.length === 0) return 0;
  const db = getDb();
  for (const fileId of fileIds) {
    await db
      .insert(schema.mediaDeepReviews)
      .values({ fileId, caseId: input.caseId, reportId: input.reportId })
      .onDuplicateKeyUpdate({ set: { caseId: input.caseId } });
  }
  schedulePump();
  return fileIds.length;
}

/** Called at startup so Render restarts cannot lose a reported-image review. */
export async function resumePendingDeepReviews(): Promise<void> {
  const db = getDb();
  await db
    .update(schema.mediaDeepReviews)
    .set({ status: "queued", lastError: "RESTART_RECOVERY" })
    .where(eq(schema.mediaDeepReviews.status, "processing"));
  if (!isSafetyKilled() && env.imageModerationEnabled) schedulePump();
}

export async function deepReviewStatusForReports(reportIds: number[]) {
  if (reportIds.length === 0) return [];
  return getDb()
    .select()
    .from(schema.mediaDeepReviews)
    .where(inArray(schema.mediaDeepReviews.reportId, reportIds));
}
