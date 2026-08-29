import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

export async function logServerAudit(input: {
  serverId: number;
  actorUserId: number;
  action: string;
  targetType: string;
  targetId?: number | null;
  targetUserId?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await getDb().insert(schema.serverAuditLogs).values({
    serverId: input.serverId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    targetUserId: input.targetUserId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
  });
}
