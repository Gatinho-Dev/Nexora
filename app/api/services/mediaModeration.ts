import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { SafetyService, isSafetyKilled } from "./safety/safetyService";
import { recordSafetyError } from "./safety/safetyMetrics";
import {
  ModerationUnavailableError,
  toNormalizedVerdict,
  type ModerationErrorCode,
  type NormalizedVerdict,
} from "./safety/errors";
import { handleSevereViolation } from "./accountSafety";
import { env } from "../lib/env";

/**
 * Media moderation pipeline (audit-hardened).
 *
 * Upload → private row (processing) → analyzeImage → normalized verdict →
 *   ALLOW            → approved
 *   SENSITIVE_ADULT  → sensitive (blur +18, reveal allowed)
 *   BLOCK            → blocked + severe violation path
 *   UNCERTAIN        → review_required (no punishment on ambiguity)
 * Provider failures  → MODERATION_UNAVAILABLE: retries with backoff, then
 *   review_required — media stays PRIVATE. Never auto-blocked, never
 *   auto-approved, and never treated as prohibited content.
 */

export const MODERATION_MODEL = env.openrouterVisionModel;
const RETRY_DELAYS_MS = [500, 1500];
const IMAGE_PREFIXES = ["image/"];
const processingInFlight = new Set<number>();

// ── Circuit breaker ───────────────────────────────────────────
export const BREAKER_THRESHOLD = 5;
export const BREAKER_COOLDOWN_MS = 60_000;
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

export function breakerOpen(): boolean {
  return Date.now() < breakerOpenUntil;
}
export function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= BREAKER_THRESHOLD) {
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.warn(
      JSON.stringify({
        event: "moderation_breaker_open",
        cooldownMs: BREAKER_COOLDOWN_MS,
        timestamp: new Date().toISOString(),
      })
    );
  }
}
export function recordSuccess() {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

// ── Metrics (in-memory snapshot for the admin debug endpoint) ──
export const moderationMetrics = {
  uploadsTotal: 0,
  allowed: 0,
  sensitive: 0,
  blocked: 0,
  unavailable: 0,
  timeouts: 0,
  latencySumMs: 0,
  latencyCount: 0,
};

export function metricsSnapshot() {
  return {
    ...moderationMetrics,
    averageLatencyMs:
      moderationMetrics.latencyCount > 0
        ? Math.round(
            moderationMetrics.latencySumMs / moderationMetrics.latencyCount
          )
        : 0,
    provider: env.openrouterApiKey ? "openrouter" : "disabled",
    breakerOpen: breakerOpen(),
    consecutiveFailures,
  };
}

export function shouldModerate(mimeType: string): boolean {
  return IMAGE_PREFIXES.some(p => mimeType.startsWith(p));
}

/** Magic-byte sniffing — never trust the declared filename/MIME alone. */
export function isRealImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const b = buffer;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  const webp =
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP";
  return jpeg || png || gif || webp;
}

export async function enqueueModeration(
  fileId: number,
  uploaderId: number,
  requestId?: string
): Promise<void> {
  const db = getDb();

  moderationMetrics.uploadsTotal += 1;

  // Fail closed: a missing key/disabled safety service must never turn into an
  // implicit approval. The uploader can see the pending item, but it cannot be
  // attached to a public message until moderation is operational.
  if (!env.imageModerationEnabled || isSafetyKilled()) {
    const reason = !env.openrouterApiKey
      ? "NO_API_KEY"
      : !env.imageModerationEnabled
        ? "IMAGE_MODERATION_DISABLED"
        : "SAFETY_DISABLED";
    await db
      .insert(schema.mediaModeration)
      .values({
        fileId,
        uploaderId,
        status: "review_required",
        safety: "unknown",
        categories: [],
        allowReveal: false,
        lastError: reason,
        moderationModel: "unavailable",
        moderatedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          uploaderId,
          status: "review_required",
          safety: "unknown",
          allowReveal: false,
          lastError: reason,
          moderationModel: "unavailable",
          moderatedAt: new Date(),
        },
      });
    moderationMetrics.unavailable += 1;
    return;
  }

  await db
    .insert(schema.mediaModeration)
    .values({ fileId, uploaderId, categories: [] })
    .onDuplicateKeyUpdate({ set: { uploaderId } });
  // Fire-and-forget: the upload response never blocks on the external API.
  void processMedia(fileId, requestId).catch(() => {});
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Converte erros do OpenRouter/parser em códigos do pipeline. */
function mapModerationError(e: unknown): ModerationErrorCode {
  if (e instanceof ModerationUnavailableError) return e.code;
  const name = (e as Error)?.constructor?.name ?? "";
  const message = (e as Error)?.message ?? "";
  if (name === "OpenRouterAuthenticationError") return "NO_API_KEY";
  if (name === "OpenRouterRateLimitError") return "RATE_LIMITED";
  if (name === "OpenRouterTimeoutError") return "TIMEOUT";
  if (name === "SafetyParsingError") return "INVALID_RESPONSE";
  if (message.includes("Falha ao contatar")) return "NETWORK";
  return "PROVIDER_ERROR";
}

async function markFailedAttempt(
  fileId: number,
  attempts: number,
  code: ModerationErrorCode
) {
  const db = getDb();
  await db
    .update(schema.mediaModeration)
    .set({
      attempts,
      lastError: code.slice(0, 490),
    })
    .where(eq(schema.mediaModeration.fileId, fileId));
}

/** Guarded transition: only rows still in `processing` can be finalized. */
async function finalizeIfProcessing(
  fileId: number,
  patch: Partial<typeof schema.mediaModeration.$inferInsert>
): Promise<boolean> {
  const [res] = await getDb()
    .update(schema.mediaModeration)
    .set({ ...patch, moderatedAt: new Date() })
    .where(
      and(
        eq(schema.mediaModeration.fileId, fileId),
        eq(schema.mediaModeration.status, "processing")
      )
    );
  return (res as unknown as { affectedRows: number }).affectedRows > 0;
}

export async function processMedia(
  fileId: number,
  requestId?: string
): Promise<void> {
  if (processingInFlight.has(fileId)) return;
  processingInFlight.add(fileId);
  const rid = requestId ?? randomUUID();
  const db = getDb();

  try {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

      const [mod] = await db
        .select()
        .from(schema.mediaModeration)
        .where(eq(schema.mediaModeration.fileId, fileId));
      // Concurrent run already finalized this file — idempotent exit.
      if (!mod || mod.status !== "processing") return;

      // Circuit breaker open → skip straight to unavailable state.
      if (breakerOpen()) {
        await giveUp(fileId, attempt + 1, "BREAKER_OPEN", rid);
        return;
      }

      const file = await db.query.files.findFirst({
        where: eq(schema.files.id, fileId),
      });
      if (!file || file.size === 0) {
        // Prohibited content already purged, or orphan row.
        await finalizeIfProcessing(fileId, {
          status: "blocked",
          safety: "unsafe",
          categories: ["purged"],
          allowReveal: false,
          moderationModel: MODERATION_MODEL,
        });
        return;
      }

      const startedAt = Date.now();
      try {
        const safetyResult = await SafetyService.analyzeImage({
          data: file.data,
          mimeType: file.mimeType,
        });
        const verdict: NormalizedVerdict = toNormalizedVerdict(safetyResult);
        recordSuccess();
        const latency = Date.now() - startedAt;
        moderationMetrics.latencySumMs += latency;
        moderationMetrics.latencyCount += 1;

        await applyPolicy(fileId, mod.uploaderId, verdict);

        console.log(
          JSON.stringify({
            event: "image_upload",
            requestId: rid,
            userId: `***${String(mod.uploaderId).slice(-2)}`,
            mime: file.mimeType,
            size: file.size,
            upload: "success",
            moderationProvider: "openrouter",
            moderation: "success",
            decision: verdict.decision,
            durationMs: latency,
          })
        );
        return;
      } catch (e) {
        const code: ModerationErrorCode = mapModerationError(e);
        recordFailure();
        recordSafetyError(
          code === "RATE_LIMITED"
            ? "rate_limited"
            : code === "TIMEOUT"
              ? "timeout"
              : "error"
        );
        moderationMetrics.unavailable += 1;
        if (code === "TIMEOUT") moderationMetrics.timeouts += 1;
        await markFailedAttempt(fileId, attempt + 1, code);
        console.warn(
          JSON.stringify({
            event: "image_upload",
            requestId: rid,
            upload: "success",
            moderation: "failed",
            reason: code,
            attempt: attempt + 1,
          })
        );
        // Loop retries; final iteration falls through to giveUp below.
      }
    }
    await giveUp(fileId, RETRY_DELAYS_MS.length + 1, "EXHAUSTED", rid);
  } finally {
    processingInFlight.delete(fileId);
  }
}

/**
 * Terminal provider failure → review_required (media stays private).
 * NEVER classified as unsafe/prohibited by itself.
 */
async function giveUp(
  fileId: number,
  attempts: number,
  code: ModerationErrorCode | "EXHAUSTED" | "BREAKER_OPEN",
  rid: string
) {
  await finalizeIfProcessing(fileId, {
    status: "review_required",
    safety: "unknown",
    allowReveal: false,
    lastError: code,
    attempts,
    moderationModel: MODERATION_MODEL,
  });
  moderationMetrics.unavailable += 1;
  console.error(
    JSON.stringify({
      event: "image_moderation_unavailable",
      requestId: rid,
      fileId,
      reason: code,
      timestamp: new Date().toISOString(),
    })
  );
}

/** Owner-triggered retry after MODERATION_UNAVAILABLE. */
export async function retryModeration(
  fileId: number,
  requesterId: number
): Promise<boolean> {
  if (!env.imageModerationEnabled || isSafetyKilled()) return false;
  const db = getDb();
  const [mod] = await db
    .select()
    .from(schema.mediaModeration)
    .where(eq(schema.mediaModeration.fileId, fileId));
  if (!mod || mod.uploaderId !== requesterId) return false;
  if (mod.status !== "review_required") return false;
  await db
    .update(schema.mediaModeration)
    .set({ status: "processing", attempts: 0, lastError: null })
    .where(eq(schema.mediaModeration.fileId, fileId));
  void processMedia(fileId).catch(() => {});
  return true;
}

// ── Policy decision (pure, unit-tested) ───────────────────────

export type PolicyDecision = {
  status: "approved" | "sensitive" | "blocked" | "review_required";
  safety: "safe" | "unsafe" | "unknown";
  categories: string[];
  sensitive: boolean;
  adultOnly: boolean;
  allowReveal: boolean;
  moderationModel: string;
  severeMinor: boolean;
};

/**
 * Pure decision from a NORMALIZED verdict. Order matters: minor-related
 * sexual content is evaluated before generic sexual content, and only
 * confident minor detection triggers the severe path.
 */
export function decideFromVerdict(v: NormalizedVerdict): PolicyDecision {
  if (v.decision === "BLOCK") {
    return {
      status: "blocked",
      safety: "unsafe",
      categories: v.categories,
      sensitive: true,
      adultOnly: true,
      allowReveal: false,
      moderationModel: MODERATION_MODEL,
      severeMinor: true,
    };
  }
  if (v.decision === "SENSITIVE_ADULT") {
    return {
      status: "sensitive",
      safety: "unsafe",
      categories: v.categories,
      sensitive: true,
      adultOnly: true,
      allowReveal: true,
      moderationModel: MODERATION_MODEL,
      severeMinor: false,
    };
  }
  if (v.decision === "ALLOW") {
    return {
      status: "approved",
      safety: "safe",
      categories: [],
      sensitive: false,
      adultOnly: false,
      allowReveal: true,
      moderationModel: MODERATION_MODEL,
      severeMinor: false,
    };
  }
  // UNCERTAIN: hold privately for review — no punishment, no publish.
  return {
    status: "review_required",
    safety: "unknown",
    categories: v.categories,
    sensitive: false,
    adultOnly: false,
    allowReveal: false,
    moderationModel: MODERATION_MODEL,
    severeMinor: false,
  };
}

export async function applyPolicy(
  fileId: number,
  uploaderId: number,
  verdict: NormalizedVerdict
): Promise<void> {
  const decision = decideFromVerdict(verdict);
  const claimed = await finalizeIfProcessing(fileId, decision);
  if (!claimed) return;

  if (decision.status === "approved") moderationMetrics.allowed += 1;
  else if (decision.status === "sensitive") moderationMetrics.sensitive += 1;
  else if (decision.status === "blocked") moderationMetrics.blocked += 1;
  else moderationMetrics.unavailable += 1;

  if (decision.severeMinor) {
    // Do not retain prohibited content unnecessarily.
    await getDb()
      .update(schema.files)
      .set({ data: Buffer.alloc(0), size: 0 })
      .where(eq(schema.files.id, fileId));
    await handleSevereViolation({
      userId: uploaderId,
      fileId,
      targetType: "image",
      category: "sexual_minor",
      model: MODERATION_MODEL,
      policyVersion: env.safetyPolicyVersion,
    });
    return;
  }

  void decision;
}

/** Batched status lookup for the sender's pending chips. */
export async function moderationStatusForUploader(
  uploaderId: number,
  fileIds: number[]
): Promise<Record<number, {
  status: typeof schema.mediaModeration.$inferSelect.status;
  sensitive: boolean;
  adultOnly: boolean;
  allowReveal: boolean;
}>> {
  if (fileIds.length === 0) return {};
  if (!env.imageModerationEnabled || isSafetyKilled()) {
    await holdStuckProcessing(uploaderId);
  }
  const rows = await getDb()
    .select({
      fileId: schema.mediaModeration.fileId,
      status: schema.mediaModeration.status,
      sensitive: schema.mediaModeration.sensitive,
      adultOnly: schema.mediaModeration.adultOnly,
      allowReveal: schema.mediaModeration.allowReveal,
    })
    .from(schema.mediaModeration)
    .where(
      and(
        eq(schema.mediaModeration.uploaderId, uploaderId),
        inArray(schema.mediaModeration.fileId, fileIds)
      )
    );
  return Object.fromEntries(rows.map(r => [r.fileId, {
    status: r.status,
    sensitive: r.sensitive,
    adultOnly: r.adultOnly,
    allowReveal: r.allowReveal,
  }]));
}

async function holdStuckProcessing(uploaderId: number) {
  await getDb()
    .update(schema.mediaModeration)
    .set({
      status: "review_required",
      safety: "unknown",
      allowReveal: false,
      lastError: !env.openrouterApiKey ? "NO_API_KEY" : "SAFETY_DISABLED",
      moderationModel: "unavailable",
      moderatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.mediaModeration.uploaderId, uploaderId),
        eq(schema.mediaModeration.status, "processing")
      )
    );
}

/** Resume automatic checks after a Render restart. Rows never become public
 * merely because the worker or provider was temporarily unavailable. */
export async function resumePendingModeration(limit = 50): Promise<void> {
  const db = getDb();
  if (!env.imageModerationEnabled || isSafetyKilled()) {
    await db
      .update(schema.mediaModeration)
      .set({
        status: "review_required",
        safety: "unknown",
        allowReveal: false,
        lastError: !env.openrouterApiKey ? "NO_API_KEY" : "SAFETY_DISABLED",
        moderationModel: "unavailable",
        moderatedAt: new Date(),
      })
      .where(eq(schema.mediaModeration.status, "processing"));
    return;
  }
  const pending = await db
    .select({ fileId: schema.mediaModeration.fileId })
    .from(schema.mediaModeration)
    .where(eq(schema.mediaModeration.status, "processing"))
    .limit(Math.min(Math.max(limit, 1), 200));
  for (const row of pending) void processMedia(row.fileId).catch(() => {});
}

void randomUUID;
