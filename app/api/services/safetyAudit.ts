import { desc, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

/**
 * Auditoria de segurança — registra eventos estruturados em banco.
 *
 * REGRA ABSOLUTA: nunca registrar conteúdo proibido bruto (bytes de imagem,
 * texto da mensagem, base64). Apenas IDs, categorias e metadados seguros.
 */
export async function logSafetyEvent(input: {
  event: string;
  actorUserId?: number | null;
  targetUserId?: number | null;
  caseId?: number | null;
  violationId?: number | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await getDb().insert(schema.safetyAuditEvents).values({
      event: input.event.slice(0, 64),
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      caseId: input.caseId ?? null,
      violationId: input.violationId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    // Auditoria nunca derruba o fluxo principal.
    console.warn(
      JSON.stringify({
        event: "safety_audit_insert_failed",
        auditEvent: input.event,
        timestamp: new Date().toISOString(),
      })
    );
    void e;
  }
}

/** Lista eventos de auditoria para o painel (sem conteúdo privado). */
export async function listSafetyAuditEvents(
  event?: string,
  limit = 100
): Promise<
  {
    id: number;
    event: string;
    actorUserId: number | null;
    targetUserId: number | null;
    caseId: number | null;
    violationId: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }[]
> {
  return getDb()
    .select({
      id: schema.safetyAuditEvents.id,
      event: schema.safetyAuditEvents.event,
      actorUserId: schema.safetyAuditEvents.actorUserId,
      targetUserId: schema.safetyAuditEvents.targetUserId,
      caseId: schema.safetyAuditEvents.caseId,
      violationId: schema.safetyAuditEvents.violationId,
      metadata: schema.safetyAuditEvents.metadata,
      createdAt: schema.safetyAuditEvents.createdAt,
    })
    .from(schema.safetyAuditEvents)
    .where(
      event ? eq(schema.safetyAuditEvents.event, event.slice(0, 64)) : undefined
    )
    .orderBy(desc(schema.safetyAuditEvents.id))
    .limit(Math.min(limit, 200));
}
