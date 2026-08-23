import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import {
  analyzeImage,
  MODERATION_MODEL,
  ModerationUnavailableError,
} from "./nvidiaContentSafety";
import { handleSevereViolation } from "./accountSafety";
import { env } from "../lib/env";

let warnedNoKey = false;

/**
 * Media moderation pipeline.
 *
 * Upload → media_moderation row (processing) → NVIDIA analysis → policy:
 *   safe            → approved
 *   Sexual (adult)  → sensitive (blurred +18, reveal allowed)
 *   other unsafe    → sensitive (generic blur)
 *   Sexual (minor)  → blocked + 3-day suspension + pending_review violation
 *
 * Failures NEVER auto-approve: the file stays private ("processing") and is
 * retried with backoff. Processing is idempotent per fileId — a guarded
 * status transition prevents duplicate violations/strikes.
 */

const RETRY_DELAYS_MS = [1_000, 4_000, 10_000];
const IMAGE_PREFIXES = ["image/"];

export function shouldModerate(mimeType: string): boolean {
  return IMAGE_PREFIXES.some(p => mimeType.startsWith(p));
}

export async function enqueueModeration(
  fileId: number,
  uploaderId: number
): Promise<void> {
  const db = getDb();

  // Deployment-level switch: without NVIDIA_API_KEY the instance opted out of
  // AI moderation, so media is released immediately (never stuck private).
  // A CONFIGURED key that later fails still keeps media private per policy.
  if (!env.nvidiaApiKey) {
    if (!warnedNoKey) {
      console.warn(
        "[media] NVIDIA_API_KEY ausente — moderação de imagens desativada neste deploy."
      );
      warnedNoKey = true;
    }
    await db
      .insert(schema.mediaModeration)
      .values({
        fileId,
        uploaderId,
        status: "approved",
        safety: "unknown",
        categories: [],
        allowReveal: true,
        moderationModel: "unmoderated",
        moderatedAt: new Date(),
      })
      .onDuplicateKeyUpdate({ set: { uploaderId } });
    // Self-heal uploads stranded in processing before this fix existed.
    await db
      .update(schema.mediaModeration)
      .set({
        status: "approved",
        safety: "unknown",
        allowReveal: true,
        moderationModel: "unmoderated",
        moderatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.mediaModeration.uploaderId, uploaderId),
          eq(schema.mediaModeration.status, "processing")
        )
      );
    return;
  }

  await db
    .insert(schema.mediaModeration)
    .values({ fileId, uploaderId, categories: [] })
    .onDuplicateKeyUpdate({ set: { uploaderId } });
  // Fire-and-forget: never block the upload response on the external API.
  void processMedia(fileId).catch(() => {});
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function bumpAttempts(fileId: number, error: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.mediaModeration)
    .set({ attempts: (await currentAttempts(fileId)) + 1, lastError: error.slice(0, 490) })
    .where(eq(schema.mediaModeration.fileId, fileId));
}

async function currentAttempts(fileId: number): Promise<number> {
  const [row] = await getDb()
    .select({ attempts: schema.mediaModeration.attempts })
    .from(schema.mediaModeration)
    .where(eq(schema.mediaModeration.fileId, fileId));
  return row?.attempts ?? 0;
}

/** Guarded transition: only "processing" rows can leave processing. */
async function finalizeIfProcessing(
  fileId: number,
  patch: Partial<typeof schema.mediaModeration.$inferInsert>
): Promise<boolean> {
  const db = getDb();
  const [res] = await db
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

export async function processMedia(fileId: number): Promise<void> {
  const db = getDb();

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    const [mod] = await db
      .select()
      .from(schema.mediaModeration)
      .where(eq(schema.mediaModeration.fileId, fileId));
    // Already finalized by a concurrent run — idempotent exit.
    if (!mod || mod.status !== "processing") return;

    const file = await db.query.files.findFirst({
      where: eq(schema.files.id, fileId),
    });
    if (!file) return;

    try {
      const analysis = await analyzeImage(file.data, file.mimeType);
      await applyPolicy(fileId, mod.uploaderId, analysis, file.mimeType);
      return;
    } catch (e) {
      const message =
        e instanceof ModerationUnavailableError
          ? e.message
          : e instanceof Error
            ? e.message
            : "erro desconhecido";
      await bumpAttempts(fileId, message);
      // Loop retries; after the last one the media stays private/processing
      // with the error recorded (never auto-approved).
    }
  }
}

export type PolicyDecision = {
  status: "approved" | "sensitive" | "blocked";
  safety: "safe" | "unsafe" | "unknown";
  categories: string[];
  sensitive: boolean;
  adultOnly: boolean;
  allowReveal: boolean;
  moderationModel: string;
};

/** Pure decision logic — unit-tested separately from I/O. */
export function decidePolicy(analysis: {
  safe: boolean;
  sexualMinor: boolean;
  sexualAdult: boolean;
  categories: string[];
}): PolicyDecision & { severeMinor: boolean } {
  // Rule order matters: minor-related sexual content FIRST.
  if (!analysis.safe && analysis.sexualMinor) {
    return {
      status: "blocked",
      safety: "unsafe",
      categories: analysis.categories,
      sensitive: true,
      adultOnly: true,
      allowReveal: false,
      moderationModel: MODERATION_MODEL,
      severeMinor: true,
    };
  }
  if (!analysis.safe && analysis.sexualAdult) {
    return {
      status: "sensitive",
      safety: "unsafe",
      categories: analysis.categories,
      sensitive: true,
      adultOnly: true,
      allowReveal: true,
      moderationModel: MODERATION_MODEL,
      severeMinor: false,
    };
  }
  if (!analysis.safe) {
    // Other unsafe categories (violence, hate...) stay behind a generic blur.
    return {
      status: "sensitive",
      safety: "unsafe",
      categories: analysis.categories,
      sensitive: true,
      adultOnly: false,
      allowReveal: true,
      moderationModel: MODERATION_MODEL,
      severeMinor: false,
    };
  }
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

export async function applyPolicy(
  fileId: number,
  uploaderId: number,
  analysis: {
    safe: boolean;
    sexualMinor: boolean;
    sexualAdult: boolean;
    categories: string[];
  },
  mimeType: string
): Promise<void> {
  const decision = decidePolicy(analysis);
  const claimed = await finalizeIfProcessing(fileId, decision);
  if (!claimed) return; // concurrent run already handled this file

  if (decision.severeMinor) {
    // Do not retain prohibited content unnecessarily.
    await getDb()
      .update(schema.files)
      .set({ data: Buffer.alloc(0), size: 0 })
      .where(eq(schema.files.id, fileId));
    await handleSevereViolation({
      userId: uploaderId,
      fileId,
      category: "sexual_minor",
      model: MODERATION_MODEL,
    });
    return;
  }

  if (decision.status === "sensitive" || decision.status === "blocked") {
    await getDb()
      .insert(schema.violations)
      .values({
        userId: uploaderId,
        fileId,
        category: decision.categories[0]?.slice(0, 120) ?? "unsafe_content",
        severity: decision.status === "blocked" ? "severe" : "moderate",
        source: "automatic_ai",
        moderationModel: MODERATION_MODEL,
        status: "resolved", // informational; no strike for blurred content
        action: "content_blocked",
      })
      .onDuplicateKeyUpdate({ set: { action: "content_blocked" } })
      .catch(() => {});
  }

  void mimeType;
}

/** Batched status lookup for the uploader's pending chips. */
export async function moderationStatusForUploader(
  uploaderId: number,
  fileIds: number[]
): Promise<Record<number, string>> {
  if (fileIds.length === 0) return {};
  if (!env.nvidiaApiKey) {
    // No moderation configured: release anything stranded in processing.
    await getDb()
      .update(schema.mediaModeration)
      .set({
        status: "approved",
        safety: "unknown",
        allowReveal: true,
        moderationModel: "unmoderated",
        moderatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.mediaModeration.uploaderId, uploaderId),
          eq(schema.mediaModeration.status, "processing")
        )
      );
  }
  const rows = await getDb()
    .select({
      fileId: schema.mediaModeration.fileId,
      status: schema.mediaModeration.status,
    })
    .from(schema.mediaModeration)
    .where(
      and(
        eq(schema.mediaModeration.uploaderId, uploaderId),
        inArray(schema.mediaModeration.fileId, fileIds)
      )
    );
  return Object.fromEntries(rows.map(r => [r.fileId, r.status]));
}
