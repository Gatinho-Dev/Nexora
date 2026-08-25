import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { env } from "../../lib/env";
import {
  MAX_SEVERE_STRIKES,
  getSafety,
  notifyRestrictionChanged,
} from "../accountSafety";
import { logSafetyEvent } from "../safetyAudit";

/**
 * AppealService — o usuário pode contestar decisões.
 *
 * Apelação APROVADA (transacional):
 * - remove strike, quando aplicado;
 * - remove suspensão ligada a esta violação;
 * - rebaixa permanentBan se os strikes caírem abaixo do limite;
 * - recalcula Status da Conta + notifica + registra reversão.
 */

export async function createAppeal(input: {
  userId: number;
  violationId: number;
  reason: string;
}): Promise<{ appealId: number }> {
  const db = getDb();
  const [violation] = await db
    .select()
    .from(schema.violations)
    .where(
      and(
        eq(schema.violations.id, input.violationId),
        eq(schema.violations.userId, input.userId)
      )
    )
    .limit(1);
  if (!violation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ocorrência não encontrada para a sua conta.",
    });
  }

  // Uma apelação por violação.
  const inserted = await db
    .insert(schema.appeals)
    .values({
      userId: input.userId,
      violationId: input.violationId,
      reason: input.reason.slice(0, 2000),
    })
    .$returningId()
    .catch(() => null);
  if (!inserted) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Já existe uma apelação para esta ocorrência.",
    });
  }
  const appealId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);

  await logSafetyEvent({
    event: "appeal_submitted",
    actorUserId: input.userId,
    targetUserId: input.userId,
    violationId: input.violationId,
    metadata: { appealId },
  });
  return { appealId };
}

export async function listMyAppeals(userId: number) {
  return getDb()
    .select({
      id: schema.appeals.id,
      violationId: schema.appeals.violationId,
      status: schema.appeals.status,
      reason: schema.appeals.reason,
      createdAt: schema.appeals.createdAt,
      reviewedAt: schema.appeals.reviewedAt,
      reviewNote: schema.appeals.reviewNote,
      violationCategory: schema.violations.category,
      violationAction: schema.violations.action,
      violationStatus: schema.violations.status,
    })
    .from(schema.appeals)
    .leftJoin(schema.violations, eq(schema.violations.id, schema.appeals.violationId))
    .where(eq(schema.appeals.userId, userId))
    .orderBy(desc(schema.appeals.createdAt))
    .limit(50);
}

export async function listOpenAppeals() {
  return getDb()
    .select({
      appeal: schema.appeals,
      user: {
        id: schema.users.id,
        username: schema.users.username,
        name: schema.users.name,
        avatar: schema.users.avatar,
      },
    })
    .from(schema.appeals)
    .leftJoin(schema.users, eq(schema.users.id, schema.appeals.userId))
    .where(inArray(schema.appeals.status, ["submitted", "under_review"]))
    .orderBy(desc(schema.appeals.createdAt))
    .limit(100);
}

/** Regra pura: apelação aprovada deve remover banimento? — unit-tested. */
export function shouldLiftPermanentBan(severeStrikesAfterRemoval: number): boolean {
  const limit = env.severeStrikeLimit || MAX_SEVERE_STRIKES;
  return severeStrikesAfterRemoval < Math.max(1, limit);
}

/** Aprova apelação: reverte strike/suspensão/ban daquela violação. */
export async function reviewAppeal(input: {
  appealId: number;
  reviewerId: number;
  decision: "approved" | "denied";
  note?: string;
}): Promise<void> {
  const db = getDb();
  const [appeal] = await db
    .select()
    .from(schema.appeals)
    .where(eq(schema.appeals.id, input.appealId))
    .limit(1);
  if (!appeal) throw new TRPCError({ code: "NOT_FOUND", message: "Apelação não encontrada." });
  if (appeal.status === "approved" || appeal.status === "denied") return;

  const claimed = await db
    .update(schema.appeals)
    .set({
      status: input.decision,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewerId,
      reviewNote: input.note?.slice(0, 1000) ?? null,
    })
    .where(and(eq(schema.appeals.id, appeal.id), sql`${schema.appeals.reviewedAt} IS NULL`));
  const affected = (claimed as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
  if (!affected) return; // outro moderador já revisou

  if (input.decision === "denied") {
    await logSafetyEvent({
      event: "appeal_denied",
      actorUserId: input.reviewerId,
      targetUserId: appeal.userId,
      violationId: appeal.violationId,
      metadata: { appealId: appeal.id },
    });
    return;
  }

  // APROVADA → reversão transacional.
  await db.transaction(async tx => {
    const [violation] = await tx
      .select()
      .from(schema.violations)
      .where(eq(schema.violations.id, appeal.violationId))
      .limit(1);
    if (!violation) return;

    let strikesRemoved = 0;
    if (violation.strikeApplied) {
      const updated = await tx
        .update(schema.violations)
        .set({ strikeApplied: false, status: "false_positive" })
        .where(
          and(
            eq(schema.violations.id, violation.id),
            eq(schema.violations.strikeApplied, true)
          )
        );
      const [res] = updated as unknown as [{ affectedRows: number }];
      if (res?.affectedRows) {
        strikesRemoved = 1;
        await tx
          .update(schema.accountSafety)
          .set({
            severeStrikes: sql`GREATEST(${schema.accountSafety.severeStrikes} - 1, 0)`,
          })
          .where(eq(schema.accountSafety.userId, appeal.userId));
      }
    } else if (violation.status === "pending_review") {
      await tx
        .update(schema.violations)
        .set({ status: "false_positive", strikeApplied: false })
        .where(eq(schema.violations.id, violation.id));
    }

    // Remove suspensão causada por esta violação.
    await tx
      .update(schema.accountSafety)
      .set({ suspendedUntil: null, suspendedByViolationId: null })
      .where(
        and(
          eq(schema.accountSafety.userId, appeal.userId),
          eq(schema.accountSafety.suspendedByViolationId, violation.id)
        )
      );

    // Rebaixa ban permanente se strikes agora ficaram abaixo do limite.
    const [safetyRow] = await tx
      .select()
      .from(schema.accountSafety)
      .where(eq(schema.accountSafety.userId, appeal.userId))
      .limit(1);
    if (safetyRow?.permanentBan && shouldLiftPermanentBan(safetyRow.severeStrikes)) {
      await tx
        .update(schema.accountSafety)
        .set({ permanentBan: false })
        .where(eq(schema.accountSafety.userId, appeal.userId));
    }
    void strikesRemoved;
  });

  await logSafetyEvent({
    event: "appeal_approved",
    actorUserId: input.reviewerId,
    targetUserId: appeal.userId,
    violationId: appeal.violationId,
    metadata: { appealId: appeal.id },
  });

  await refreshStatusAndNotify(appeal.userId);
}

async function refreshStatusAndNotify(userId: number): Promise<void> {
  const { calculateAccountStatus } = await import("../accountSafety");
  const row = await getSafety(userId);
  await getDb()
    .update(schema.accountSafety)
    .set({ status: calculateAccountStatus(row) })
    .where(eq(schema.accountSafety.userId, userId));

  const { sendToUsers } = await import("../../realtime");
  sendToUsers([userId], {
    t: "notification",
    notification: {
      id: 0,
      type: "moderation",
      actor: null,
      serverId: null,
      channelId: null,
      conversationId: null,
      messageId: null,
      content:
        "A restrição da sua conta foi removida após revisão. Nenhuma infração foi mantida.",
      isRead: false,
      createdAt: new Date(),
    },
  });
  void notifyRestrictionChanged(userId).catch(() => {});
}
