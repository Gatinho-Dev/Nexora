import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import type { AccountSafetyDTO, SafetyViolationDTO } from "@contracts/types";
import { rateLimit } from "./utils/rateLimit";
import {
  getSafety,
  calculateAccountStatus,
} from "./services/accountSafety";
import { moderationStatusForUploader } from "./services/mediaModeration";
import {
  REPORT_CATEGORIES,
  MINOR_SAFETY_SUBCATEGORIES,
  createReport,
  listMyReports,
} from "./services/reports/reportService";
import {
  createAppeal,
  listMyAppeals,
} from "./services/appeals/appealService";

function toSafetyDTO(
  safety: typeof schema.accountSafety.$inferSelect
): AccountSafetyDTO {
  return {
    accountStatus: calculateAccountStatus(safety),
    severeStrikes: safety.severeStrikes,
    maxSevereStrikes: safety.maxSevereStrikes,
    suspendedUntil: safety.suspendedUntil,
    permanentBan: safety.permanentBan,
    sensitiveMediaPref: safety.sensitiveMediaPref,
  };
}

/** Own violations only — full history is private to the user + moderators. */
async function ownViolations(userId: number): Promise<SafetyViolationDTO[]> {
  const rows = await getDb()
    .select()
    .from(schema.violations)
    .where(eq(schema.violations.userId, userId))
    .orderBy(desc(schema.violations.createdAt))
    .limit(100);
  // Never expose graphic descriptions in the user-facing surface.
  return rows.map(v => ({
    id: v.id,
    category:
      v.category === "sexual_minor" ? "Violação grave de segurança" : v.category,
    severity: v.severity,
    source: v.source,
    status: v.status,
    action: v.action,
    strikeApplied: v.strikeApplied,
    internalNote: undefined,
    createdAt: v.createdAt,
    reviewedAt: v.reviewedAt,
  }));
}

export const safetyRouter = createRouter({
  me: authedQuery.query(async ({ ctx }): Promise<{
    safety: AccountSafetyDTO;
    violations: SafetyViolationDTO[];
  }> => {
    const safety = await getSafety(ctx.user.id);
    return { safety: toSafetyDTO(safety), violations: await ownViolations(ctx.user.id) };
  }),

  setSensitiveMediaPref: authedQuery
    .input(z.object({ pref: z.enum(["hide", "warn", "auto"]) }))
    .mutation(async ({ ctx, input }) => {
      await getSafety(ctx.user.id);
      await getDb()
        .update(schema.accountSafety)
        .set({ sensitiveMediaPref: input.pref })
        .where(eq(schema.accountSafety.userId, ctx.user.id));
      return { ok: true };
    }),

  /** Poll moderation status for the sender's pending upload chips. */
  attachmentStatus: authedQuery
    .input(z.object({ fileIds: z.array(z.number()).max(20) }))
    .query(async ({ ctx, input }) => {
      return moderationStatusForUploader(ctx.user.id, input.fileIds);
    }),

  // ── Denúncias ────────────────────────────────────────────────
  reportCategories: authedQuery.query(async () => ({
    categories: REPORT_CATEGORIES,
    minorSafetySubcategories: MINOR_SAFETY_SUBCATEGORIES,
  })),

  createReport: authedQuery
    .input(
      z.object({
        targetType: z.enum(["message", "user", "media", "server", "channel"]),
        targetId: z.number().int().positive(),
        category: z.enum(REPORT_CATEGORIES),
        subcategory: z.string().max(64).optional(),
        description: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`report:${ctx.user.id}`, 5, 10 * 60 * 1000);
      const { caseId } = await createReport({
        reporterId: ctx.user.id,
        ...input,
      });
      return {
        ok: true as const,
        message:
          "Denúncia enviada. Obrigado por ajudar a manter o Nexora seguro. Nossa equipe analisará a situação.",
        caseId,
      };
    }),

  myReports: authedQuery.query(async ({ ctx }) => listMyReports(ctx.user.id)),

  // ── Apelações ────────────────────────────────────────────────
  createAppeal: authedQuery
    .input(
      z.object({
        violationId: z.number().int().positive(),
        reason: z.string().min(10).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`appeal:${ctx.user.id}`, 3, 60 * 60 * 1000);
      return createAppeal({ userId: ctx.user.id, ...input });
    }),

  myAppeals: authedQuery.query(async ({ ctx }) => listMyAppeals(ctx.user.id)),
});
