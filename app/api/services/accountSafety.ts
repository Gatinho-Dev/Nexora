import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { sendToUsers } from "../realtime";
import { env } from "../lib/env";
import { logSafetyEvent } from "./safetyAudit";

/**
 * Account safety: strikes, suspensions, permanent bans and the account
 * status shown at Configurações → Status da Conta.
 *
 * All punishments happen server-side. The frontend only displays state.
 */

export type AccountStatus =
  | "good_standing"
  | "limited"
  | "very_limited"
  | "at_risk"
  | "suspended"
  | "permanently_banned";

type DbExecutor = typeof getDb extends () => infer T ? T : never;
type Tx = Parameters<Parameters<DbExecutor["transaction"]>[0]>[0];

/** Limite configurável via SEVERE_STRIKE_LIMIT (padrão 3). */
export const MAX_SEVERE_STRIKES = Math.max(1, env.severeStrikeLimit);
export const SUSPENSION_DAYS = env.sexualMinorSuspensionDays;

export async function ensureSafetyRow(userId: number): Promise<void> {
  await getDb()
    .insert(schema.accountSafety)
    .values({ userId })
    .onDuplicateKeyUpdate({ set: { userId } });
}

async function ensureSafetyRowTx(tx: Tx, userId: number): Promise<void> {
  await tx
    .insert(schema.accountSafety)
    .values({ userId })
    .onDuplicateKeyUpdate({ set: { userId } });
}

export async function getSafety(userId: number) {
  await ensureSafetyRow(userId);
  const [row] = await getDb()
    .select()
    .from(schema.accountSafety)
    .where(eq(schema.accountSafety.userId, userId));
  return row!;
}

/** Pure status calculation (unit-tested). */
export function calculateAccountStatus(
  row: {
    permanentBan: boolean;
    suspendedUntil: Date | null;
    severeStrikes: number;
  },
  now = new Date()
): AccountStatus {
  if (row.permanentBan) return "permanently_banned";
  const activeSuspension =
    !!row.suspendedUntil &&
    new Date(row.suspendedUntil).getTime() > now.getTime();
  // Expired suspensions no longer mask the underlying strike level.
  if (activeSuspension) return "suspended";
  if (row.severeStrikes >= MAX_SEVERE_STRIKES - 1) return "at_risk";
  if (row.severeStrikes >= 1) return "limited";
  return "good_standing";
}

/** Pure ban escalation rule: 3 confirmed severe strikes = permanent ban. */
export function shouldEscalateToBan(severeStrikes: number): boolean {
  return severeStrikes >= MAX_SEVERE_STRIKES;
}

/**
 * Pure restriction check used by assertCanInteract (unit-tested).
 * Returns an error message when interactions must be blocked.
 */
export function restrictionError(
  row: { suspendedUntil: Date | null; permanentBan: boolean },
  now = new Date()
): string | null {
  if (row.permanentBan) {
    return "Sua conta foi permanentemente banida do Nexora por infrações graves.";
  }
  if (isActivelySuspended(row, now)) {
    return "Sua conta está suspensa temporariamente. Consulte Configurações → Status da Conta.";
  }
  return null;
}

/** Pure suspension check — expiry is automatic, no admin needed. */
export function isActivelySuspended(
  row: { suspendedUntil: Date | null; permanentBan: boolean },
  now = new Date()
): boolean {
  if (row.permanentBan) return true;
  return (
    !!row.suspendedUntil &&
    new Date(row.suspendedUntil).getTime() > now.getTime()
  );
}

/** Refresh the denormalized status column from the raw fields. */
async function refreshStatus(userId: number): Promise<void> {
  const safety = await getSafety(userId);
  await getDb()
    .update(schema.accountSafety)
    .set({ status: calculateAccountStatus(safety) })
    .where(eq(schema.accountSafety.userId, userId));
}

/**
 * Central guard for interaction routes. Throws 403 when the user is
 * suspended or permanently banned. Reads are still allowed during a
 * temporary suspension (the user can browse + see Status da Conta).
 */
export async function assertCanInteract(userId: number): Promise<void> {
  const safety = await getSafety(userId);
  const error = restrictionError(safety);
  if (error) {
    throw new TRPCError({ code: "FORBIDDEN", message: error });
  }
}

function notifyUser(userId: number, content: string) {
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
      content,
      isRead: false,
      createdAt: new Date(),
    },
  });
}

/** Evento realtime para o cliente atualizar restrições imediatamente. */
export async function notifyRestrictionChanged(userId: number): Promise<void> {
  const safety = await getSafety(userId);
  sendToUsers([userId], {
    t: "account:restriction_updated",
    accountStatus: calculateAccountStatus(safety),
    severeStrikes: safety.severeStrikes,
    maxSevereStrikes: safety.maxSevereStrikes,
    suspendedUntil: safety.suspendedUntil,
    permanentBan: safety.permanentBan,
  });
}

/**
 * Severe violation path ("Sexual (minor)"): immediate suspension with a
 * pending_review occurrence so human review can confirm or revert.
 * Idempotente por (fileId|messageId) + category — duplicatas não re-punem.
 */
export async function handleSevereViolation(input: {
  userId: number;
  fileId?: number | null;
  messageId?: number | null;
  targetType?: string;
  category: string;
  model?: string;
  policyVersion?: string;
  source?: "automatic_ai" | "automod" | "user_report";
}): Promise<number | null> {
  const db = getDb();
  await ensureSafetyRow(input.userId);

  const suspendedUntil = new Date(
    Date.now() + SUSPENSION_DAYS * 86_400_000
  );

  let violationId: number;
  try {
    const inserted = await db
      .insert(schema.violations)
      .values({
        userId: input.userId,
        fileId: input.fileId ?? null,
        messageId: input.messageId ?? null,
        targetType: input.targetType ?? null,
        category: input.category.slice(0, 120),
        severity: "severe",
        source: input.source ?? "automatic_ai",
        moderationModel: input.model ?? null,
        policyVersion: input.policyVersion ?? env.safetyPolicyVersion,
        status: "pending_review",
        action: "three_day_suspension",
      })
      .$returningId();
    violationId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);
  } catch {
    // Duplicate entry => mesma mídia/mensagem+categoria já punida. Não pune de novo.
    return null;
  }

  // Estende a suspensão apenas se não houver uma ativa mais longa.
  await db.transaction(async tx => {
    await tx
      .update(schema.accountSafety)
      .set({ suspendedUntil, suspendedByViolationId: violationId })
      .where(eq(schema.accountSafety.userId, input.userId));
  });
  await refreshStatus(input.userId);

  // Structured security log — never log image bytes or sensitive payloads.
  console.error(
    JSON.stringify({
      event: "severe_violation_detected",
      userId: input.userId,
      mediaId: input.fileId ?? null,
      messageId: input.messageId ?? null,
      category: input.category,
      violationId,
      timestamp: new Date().toISOString(),
    })
  );
  await logSafetyEvent({
    event: "severe_violation_auto_suspension",
    targetUserId: input.userId,
    violationId,
    metadata: { category: input.category, source: input.source ?? "automatic_ai" },
  });

  notifyUser(
    input.userId,
    "Uma ação foi aplicada à sua conta: possível violação grave das Diretrizes da Comunidade. Sua conta foi suspensa temporariamente. Consulte Configurações → Status da Conta."
  );
  void notifyRestrictionChanged(input.userId).catch(() => {});
  return violationId;
}

/**
 * Confirm a pending violation: applies one severe strike (guarded so the
 * same violation can never double-count) and escalates to a permanent ban
 * at MAX_SEVERE_STRIKES confirmed strikes.
 */
export async function confirmViolation(
  violationId: number,
  reviewerId: number
): Promise<{ severeStrikes: number; banned: boolean }> {
  const db = getDb();
  const [violation] = await db
    .select()
    .from(schema.violations)
    .where(eq(schema.violations.id, violationId));
  if (!violation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ocorrência não encontrada." });
  }

  if (violation.status === "confirmed" && violation.strikeApplied) {
    const safety = await getSafety(violation.userId);
    return { severeStrikes: safety.severeStrikes, banned: safety.permanentBan };
  }

  await db.transaction(async tx => {
    // Idempotent claim: only the first reviewer transition applies the strike.
    const claimed = await tx
      .update(schema.violations)
      .set({
        status: "confirmed",
        strikeApplied: true,
        reviewedAt: new Date(),
        reviewedByUserId: reviewerId,
      })
      .where(
        and(
          eq(schema.violations.id, violationId),
          eq(schema.violations.strikeApplied, false)
        )
      );
    const [claimResult] = claimed as unknown as [{ affectedRows: number }];
    if (claimResult?.affectedRows) {
      await ensureSafetyRowTx(tx, violation.userId);
      await tx
        .update(schema.accountSafety)
        .set({ severeStrikes: sql`${schema.accountSafety.severeStrikes} + 1` })
        .where(eq(schema.accountSafety.userId, violation.userId));
    }
  });

  const safety = await getSafety(violation.userId);
  let banned = false;
  if (shouldEscalateToBan(safety.severeStrikes) && !safety.permanentBan) {
    await db
      .update(schema.accountSafety)
      .set({ permanentBan: true })
      .where(eq(schema.accountSafety.userId, violation.userId));
    banned = true;
    notifyUser(
      violation.userId,
      "Sua conta foi permanentemente banida do Nexora após atingir o limite de infrações graves."
    );
  } else {
    notifyUser(
      violation.userId,
      `Uma infração foi adicionada ao Status da sua Conta. Infrações graves: ${safety.severeStrikes} / ${MAX_SEVERE_STRIKES}`
    );
  }
  await refreshStatus(violation.userId);
  await logSafetyEvent({
    event: "moderation_case_confirmed",
    actorUserId: reviewerId,
    targetUserId: violation.userId,
    violationId,
    metadata: { action: "severe_strike", severeStrikes: safety.severeStrikes, banned },
  });
  void notifyRestrictionChanged(violation.userId).catch(() => {});
  return { severeStrikes: safety.severeStrikes, banned };
}

/** False positive: lift the suspension caused by THIS violation, no strike. */
export async function markFalsePositive(
  violationId: number,
  reviewerId: number,
  note?: string
): Promise<void> {
  const db = getDb();
  const [violation] = await db
    .select()
    .from(schema.violations)
    .where(eq(schema.violations.id, violationId));
  if (!violation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ocorrência não encontrada." });
  }

  await db.transaction(async tx => {
    await tx
      .update(schema.violations)
      .set({
        status: "false_positive",
        strikeApplied: false,
        internalNote: note ?? violation.internalNote ?? null,
        reviewedAt: new Date(),
        reviewedByUserId: reviewerId,
      })
      .where(
        and(
          eq(schema.violations.id, violationId),
          eq(schema.violations.strikeApplied, false)
        )
      );

    // Lift only a suspension caused by this specific violation.
    await tx
      .update(schema.accountSafety)
      .set({ suspendedUntil: null, suspendedByViolationId: null })
      .where(
        and(
          eq(schema.accountSafety.userId, violation.userId),
          eq(schema.accountSafety.suspendedByViolationId, violationId)
        )
      );
  });

  await refreshStatus(violation.userId);
  await logSafetyEvent({
    event: "violation_marked_false_positive",
    actorUserId: reviewerId,
    targetUserId: violation.userId,
    violationId,
  });
  notifyUser(
    violation.userId,
    "A restrição da sua conta foi removida. Após revisão, determinamos que a ocorrência não constituiu uma violação. Nenhuma infração foi adicionada."
  );
  void notifyRestrictionChanged(violation.userId).catch(() => {});
}

export async function resolveViolation(
  violationId: number,
  reviewerId: number,
  note?: string
): Promise<void> {
  await getDb()
    .update(schema.violations)
    .set({
      status: "resolved",
      reviewedAt: new Date(),
      reviewedByUserId: reviewerId,
      internalNote: note ?? null,
    })
    .where(
      and(
        eq(schema.violations.id, violationId),
        inArray(schema.violations.status, ["pending_review", "false_positive"])
      )
    );
}

export async function addInternalNote(
  violationId: number,
  reviewerId: number,
  note: string
): Promise<void> {
  await getDb()
    .update(schema.violations)
    .set({ internalNote: note.slice(0, 2000), reviewedByUserId: reviewerId })
    .where(eq(schema.violations.id, violationId));
}

/** Manual moderator actions. */
export async function manualSuspend(
  userId: number,
  days: number,
  reviewerId: number
): Promise<void> {
  const db = getDb();
  await ensureSafetyRow(userId);
  const until = new Date(Date.now() + Math.max(1, Math.min(30, days)) * 86_400_000);
  const inserted = await db
    .insert(schema.violations)
    .values({
      userId,
      category: "manual_moderator_action",
      severity: "severe",
      source: "moderator",
      status: "confirmed",
      action: "temporary_suspension",
      strikeApplied: true,
      reviewedAt: new Date(),
      reviewedByUserId: reviewerId,
    })
    .$returningId();
  const violationId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);
  await db
    .update(schema.accountSafety)
    .set({ suspendedUntil: until, suspendedByViolationId: violationId })
    .where(eq(schema.accountSafety.userId, userId));
  await refreshStatus(userId);
  await logSafetyEvent({
    event: "moderator_manual_suspension",
    actorUserId: reviewerId,
    targetUserId: userId,
    violationId,
    metadata: { days },
  });
  notifyUser(userId, "Um moderador aplicou uma suspensão temporária na sua conta. Consulte Configurações → Status da Conta.");
  void notifyRestrictionChanged(userId).catch(() => {});
}

export async function manualUnban(
  userId: number,
  reviewerId?: number
): Promise<void> {
  await ensureSafetyRow(userId);
  const [before] = await getDb()
    .select()
    .from(schema.accountSafety)
    .where(eq(schema.accountSafety.userId, userId));
  await getDb()
    .update(schema.accountSafety)
    .set({
      permanentBan: false,
      suspendedUntil: null,
      suspendedByViolationId: null,
      severeStrikes: 0,
      status: "good_standing",
    })
    .where(eq(schema.accountSafety.userId, userId));
  if (reviewerId) {
    await logSafetyEvent({
      event: "moderator_unban",
      actorUserId: reviewerId,
      targetUserId: userId,
      metadata: { previousStrikes: before?.severeStrikes ?? null },
    });
  }
  notifyUser(userId, "As restrições da sua conta foram removidas pela moderação do Nexora.");
  void notifyRestrictionChanged(userId).catch(() => {});
}

export type ModerationQueueItem = Awaited<ReturnType<typeof listViolations>>[number];

export async function listViolations(
  status:
    | "pending_review"
    | "confirmed"
    | "false_positive"
    | "resolved"
) {
  return getDb()
    .select({
      violation: schema.violations,
      user: {
        id: schema.users.id,
        username: schema.users.username,
        name: schema.users.name,
        avatar: schema.users.avatar,
      },
    })
    .from(schema.violations)
    .leftJoin(schema.users, eq(schema.users.id, schema.violations.userId))
    .where(eq(schema.violations.status, status))
    .orderBy(desc(schema.violations.createdAt))
    .limit(200);
}
