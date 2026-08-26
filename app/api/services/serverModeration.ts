import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

/**
 * Auditoria + hierarquia de moderação por servidor.
 * Audit log NUNCA contém segredos — apenas IDs, ações e metadados seguros.
 */

export async function logServerAudit(input: {
  serverId: number;
  actorUserId: number;
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await getDb().insert(schema.serverAuditLogs).values({
      serverId: input.serverId,
      actorUserId: input.actorUserId,
      action: input.action.slice(0, 48),
      targetType: input.targetType?.slice(0, 24) ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // auditoria nunca derruba a ação principal
  }
}

export async function listServerAudit(
  serverId: number,
  action?: string,
  limit = 100
) {
  return getDb()
    .select({
      log: schema.serverAuditLogs,
      actor: {
        id: schema.users.id,
        username: schema.users.username,
        name: schema.users.name,
        avatar: schema.users.avatar,
      },
    })
    .from(schema.serverAuditLogs)
    .leftJoin(schema.users, eq(schema.users.id, schema.serverAuditLogs.actorUserId))
    .where(
      action
        ? and(
            eq(schema.serverAuditLogs.serverId, serverId),
            eq(schema.serverAuditLogs.action, action.slice(0, 48))
          )
        : eq(schema.serverAuditLogs.serverId, serverId)
    )
    .orderBy(desc(schema.serverAuditLogs.id))
    .limit(Math.min(limit, 200));
}

/** Maior posição de cargo do membro (owner = infinito). */
export async function highestRolePosition(
  serverId: number,
  userId: number
): Promise<number> {
  const [server] = await getDb()
    .select({ ownerId: schema.servers.ownerId })
    .from(schema.servers)
    .where(eq(schema.servers.id, serverId))
    .limit(1);
  if (server?.ownerId === userId) return Number.MAX_SAFE_INTEGER;
  const rows = await getDb()
    .select({ position: schema.roles.position })
    .from(schema.memberRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.memberRoles.roleId))
    .where(
      and(
        eq(schema.memberRoles.serverId, serverId),
        eq(schema.memberRoles.userId, userId)
      )
    );
  return rows.length > 0 ? Math.max(...rows.map(r => r.position)) : 0;
}

/**
 * Hierarquia: ninguém modera o owner; ator precisa de cargo MAIOR que o alvo.
 * Owner sempre pode tudo.
 */
export async function assertCanModerate(
  serverId: number,
  actorId: number,
  targetId: number
): Promise<void> {
  const [server] = await getDb()
    .select({ ownerId: schema.servers.ownerId })
    .from(schema.servers)
    .where(eq(schema.servers.id, serverId))
    .limit(1);
  if (!server) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });
  }
  if (targetId === server.ownerId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "O proprietário do servidor não pode ser moderado.",
    });
  }
  if (actorId === server.ownerId) return;
  const [actorPos, targetPos] = await Promise.all([
    highestRolePosition(serverId, actorId),
    highestRolePosition(serverId, targetId),
  ]);
  if (actorPos <= targetPos) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não pode moderar este membro (hierarquia de cargos).",
    });
  }
}

/** Membro está em timeout ativo neste servidor? */
export async function activeTimeout(
  serverId: number,
  userId: number
): Promise<{ until: Date; reason: string | null } | null> {
  const [row] = await getDb()
    .select({
      timeoutUntil: schema.serverMembers.timeoutUntil,
      timeoutReason: schema.serverMembers.timeoutReason,
    })
    .from(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverId),
        eq(schema.serverMembers.userId, userId)
      )
    )
    .limit(1);
  if (!row?.timeoutUntil) return null;
  const until = new Date(row.timeoutUntil);
  if (until.getTime() <= Date.now()) return null;
  return { until, reason: row.timeoutReason };
}

/** Cargos com hoist para agrupamento na lista de membros. */
export async function hoistedRoles(serverId: number) {
  return getDb()
    .select()
    .from(schema.roles)
    .where(
      and(eq(schema.roles.serverId, serverId), eq(schema.roles.hoist, true))
    )
    .orderBy(desc(schema.roles.position));
}

void inArray;
