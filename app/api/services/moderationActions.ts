import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { sendToUsers } from "../realtime";
import { logSafetyEvent } from "./safetyAudit";
import { notifyRestrictionChanged } from "./accountSafety";

/** Banimento permanente aplicado manualmente por moderador. */
export async function applyManualBan(
  userId: number,
  reviewerId: number
): Promise<void> {
  await getDb()
    .update(schema.accountSafety)
    .set({ permanentBan: true, suspendedUntil: null })
    .where(eq(schema.accountSafety.userId, userId));
  const inserted = await getDb()
    .insert(schema.violations)
    .values({
      userId,
      category: "manual_moderator_action",
      severity: "severe",
      source: "moderator",
      status: "confirmed",
      action: "permanent_ban",
      strikeApplied: true,
      reviewedAt: new Date(),
      reviewedByUserId: reviewerId,
    })
    .$returningId()
    .catch(() => null);
  void inserted;
  const { calculateAccountStatus, getSafety } = await import("./accountSafety");
  const safety = await getSafety(userId);
  await getDb()
    .update(schema.accountSafety)
    .set({ status: calculateAccountStatus(safety) })
    .where(eq(schema.accountSafety.userId, userId));
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
        "Sua conta foi permanentemente banida do Nexora por decisão da moderação.",
      isRead: false,
      createdAt: new Date(),
    },
  });
  void notifyRestrictionChanged(userId).catch(() => {});
}

/** Advertência formal registrada no histórico de segurança. */
export async function warnUser(
  userId: number,
  reviewerId: number,
  note?: string
): Promise<void> {
  await getDb().insert(schema.violations).values({
    userId,
    category: "warning",
    severity: "warning",
    source: "moderator",
    status: "confirmed",
    action: "warning",
    strikeApplied: false,
    internalNote: note?.slice(0, 2000) ?? null,
    reviewedAt: new Date(),
    reviewedByUserId: reviewerId,
  });
  await logSafetyEvent({
    event: "moderator_warn",
    actorUserId: reviewerId,
    targetUserId: userId,
  });
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
        "Você recebeu uma advertência da moderação do Nexora. Consulte Configurações → Status da Conta.",
      isRead: false,
      createdAt: new Date(),
    },
  });
}

/**
 * Bloqueia mídia denunciada/confirmada: zera bytes (não retém conteúdo) e
 * marca como blocked. Nunca roda para arquivos já aprovados sem revisão —
 * aqui é uma ação explícita de moderador.
 */
export async function blockMediaForModeration(fileId: number): Promise<void> {
  await getDb()
    .update(schema.files)
    .set({ data: Buffer.alloc(0), size: 0 })
    .where(eq(schema.files.id, fileId));
  await getDb()
    .update(schema.mediaModeration)
    .set({
      status: "blocked",
      safety: "unsafe",
      allowReveal: false,
      moderatedAt: new Date(),
    })
    .where(eq(schema.mediaModeration.fileId, fileId));
}
