import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import type { AdminAuditLogDTO } from "@contracts/types";
import {
  createRouter,
  adminQuery,
  authedQuery,
  ownerQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import {
  getPlatformAuthority,
  isPlatformOwner,
} from "./utils/platformAuth";
import {
  toOfficialAnnouncementDTO,
} from "./utils/platformDtos";
import { toBadgeDTO, toUserBadgeDTO } from "./utils/badgeDtos";
import {
  badgeHistoryWrite,
  checkConsistency,
  evaluateUser,
  fixConsistency,
  grant,
  recordEvent,
  revoke,
} from "./services/badgeService";
import { toPublicUser } from "./utils/permissions";
import { broadcastToAll } from "./realtime";
import {
  addInternalNote,
  confirmViolation,
  listViolations,
  manualSuspend,
  manualUnban,
  markFalsePositive,
  resolveViolation,
} from "./services/accountSafety";
import {
  listCases,
  getCaseById,
} from "./services/reports/moderationCaseService";
import {
  reviewAppeal as reviewAppealService,
  listOpenAppeals,
} from "./services/appeals/appealService";
import { SafetyService, isSafetyKilled, setSafetyKillSwitch } from "./services/safety/safetyService";
import { breakerOpen } from "./services/mediaModeration";
import { logSafetyEvent, listSafetyAuditEvents } from "./services/safetyAudit";
import { removeMessageForModeration } from "./services/textModeration";
import { blockMediaForModeration, applyManualBan, warnUser } from "./services/moderationActions";
import { rateLimit } from "./utils/rateLimit";

const announcementKind = z.enum([
  "GENERAL",
  "UPDATE",
  "SECURITY",
  "MAINTENANCE",
]);

const pageInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.number().int().positive().optional(),
  })
  .optional();

type AuditDatabase = Pick<ReturnType<typeof getDb>, "insert">;

async function writeAudit(database: AuditDatabase, input: {
  actorUserId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  targetUserId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  await database.insert(schema.adminAuditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    targetUserId: input.targetUserId ?? null,
    metadata: input.metadata ?? null,
  });
}

/**
 * Permissões de badges mapeadas na autoridade da plataforma:
 * VIEW/GRANT/REVOKE = admin · MANAGE_SYSTEM_BADGES = owner (badges
 * restritas: Staff, Partnered, Certified Moderator, Alumni, Bug Hunter T2).
 */
function requireBadgeManagePermission(
  user: typeof schema.users.$inferSelect,
  badgeRestricted: boolean,
) {
  if (badgeRestricted && !isPlatformOwner(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Esta badge é restrita: somente o proprietário da plataforma pode gerenciá-la.",
    });
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

export const adminRouter = createRouter({
  authority: authedQuery.query(({ ctx }) => {
    const authority = getPlatformAuthority(ctx.user);
    return {
      authority,
      canAccess: authority !== null,
      canManageStaffBadges: authority === "owner",
    };
  }),

  listAnnouncements: adminQuery
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.number().int().positive().optional(),
          includeArchived: z.boolean().default(true),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const rows = await getDb()
        .select()
        .from(schema.officialAnnouncements)
        .where(
          and(
            input?.cursor
              ? lt(schema.officialAnnouncements.id, input.cursor)
              : undefined,
            input?.includeArchived === false
              ? eq(schema.officialAnnouncements.isActive, true)
              : undefined,
          ),
        )
        .orderBy(desc(schema.officialAnnouncements.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return {
        items: page.map(row => toOfficialAnnouncementDTO(row)),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    }),

  createAnnouncement: adminQuery
    .input(
      z.object({
        title: z.string().trim().min(2).max(120),
        content: z.string().trim().min(1).max(10_000),
        contentFormat: z.enum(["MARKDOWN", "PLAIN_TEXT"]).default("MARKDOWN"),
        kind: announcementKind.default("GENERAL"),
        type: z
          .enum(["INFO", "SUCCESS", "WARNING", "ERROR", "MAINTENANCE", "ANNOUNCEMENT"])
          .default("ANNOUNCEMENT"),
        buttonLabel: z.string().trim().max(80).nullable().optional(),
        buttonUrl: z
          .string()
          .trim()
          .url("Informe uma URL válida (https://…).")
          .max(500)
          .nullable()
          .optional(),
        startsAt: z.coerce.date().nullable().optional(),
        expiresAt: z.coerce.date().nullable().optional(),
        dismissible: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`admin:announcement:${ctx.user.id}`, 20, 60_000);
      if (input.buttonLabel && !input.buttonUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe a URL do botão (ou remova o texto do botão).",
        });
      }
      if (input.buttonUrl && !input.buttonLabel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe o texto do botão (ou remova a URL).",
        });
      }
      if (input.expiresAt && input.startsAt && input.expiresAt <= input.startsAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A expiração precisa ser depois do início.",
        });
      }

      const announcement = await getDb().transaction(async tx => {
        const [{ id }] = await tx
          .insert(schema.officialAnnouncements)
          .values({
            title: input.title,
            content: input.content,
            contentFormat: input.contentFormat,
            kind: input.kind,
            type: input.type,
            buttonLabel: input.buttonLabel ?? null,
            buttonUrl: input.buttonUrl ?? null,
            startsAt: input.startsAt ?? null,
            expiresAt: input.expiresAt ?? null,
            dismissible: input.dismissible,
            publishedByUserId: ctx.user.id,
          })
          .$returningId();
        const created = await tx.query.officialAnnouncements.findFirst({
          where: eq(schema.officialAnnouncements.id, id),
        });
        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Não foi possível publicar o comunicado.",
          });
        }
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "official.announcement.create",
          entityType: "official_announcement",
          entityId: created.id,
          metadata: { title: created.title, kind: created.kind },
        });
        return created;
      });

      const dto = toOfficialAnnouncementDTO(announcement);
      broadcastToAll({ t: "official:announcement", announcement: dto });
      return dto;
    }),

  /** Edita um comunicado existente (sem precisar recriar). */
  editAnnouncement: adminQuery
    .input(
      z.object({
        announcementId: z.number().int().positive(),
        title: z.string().trim().min(2).max(120).optional(),
        content: z.string().trim().min(1).max(10_000).optional(),
        contentFormat: z.enum(["MARKDOWN", "PLAIN_TEXT"]).optional(),
        type: z
          .enum(["INFO", "SUCCESS", "WARNING", "ERROR", "MAINTENANCE", "ANNOUNCEMENT"])
          .optional(),
        buttonLabel: z.string().trim().max(80).nullable().optional(),
        buttonUrl: z.string().trim().max(500).nullable().optional(),
        startsAt: z.coerce.date().nullable().optional(),
        expiresAt: z.coerce.date().nullable().optional(),
        dismissible: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { announcementId, ...patch } = input;
      const existing = await getDb().query.officialAnnouncements.findFirst({
        where: eq(schema.officialAnnouncements.id, announcementId),
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comunicado oficial não encontrado.",
        });
      }
      await getDb().transaction(async tx => {
        await tx
          .update(schema.officialAnnouncements)
          .set(patch)
          .where(eq(schema.officialAnnouncements.id, announcementId));
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "official.announcement.edit",
          entityType: "official_announcement",
          entityId: announcementId,
          metadata: { fields: Object.keys(patch) },
        });
      });
      const updated = await getDb().query.officialAnnouncements.findFirst({
        where: eq(schema.officialAnnouncements.id, announcementId),
      });
      return updated ? toOfficialAnnouncementDTO(updated) : null;
    }),

  /** Duplica um comunicado (rascunho inativo para ajustar e publicar). */
  duplicateAnnouncement: adminQuery
    .input(z.object({ announcementId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getDb().query.officialAnnouncements.findFirst({
        where: eq(schema.officialAnnouncements.id, input.announcementId),
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comunicado oficial não encontrado.",
        });
      }
      const [{ id }] = await getDb()
        .insert(schema.officialAnnouncements)
        .values({
          title: `${existing.title} (cópia)`.slice(0, 120),
          content: existing.content,
          contentFormat: existing.contentFormat,
          kind: existing.kind,
          type: existing.type,
          buttonLabel: existing.buttonLabel,
          buttonUrl: existing.buttonUrl,
          dismissible: existing.dismissible,
          isActive: false,
          publishedByUserId: ctx.user.id,
        })
        .$returningId();
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: "official.announcement.duplicate",
        entityType: "official_announcement",
        entityId: id,
        metadata: { fromId: existing.id },
      });
      const created = await getDb().query.officialAnnouncements.findFirst({
        where: eq(schema.officialAnnouncements.id, id),
      });
      return created ? toOfficialAnnouncementDTO(created) : null;
    }),

  /** Exclui definitivamente. */
  deleteAnnouncement: adminQuery
    .input(z.object({ announcementId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getDb().query.officialAnnouncements.findFirst({
        where: eq(schema.officialAnnouncements.id, input.announcementId),
      });
      if (!existing) return { ok: true as const };
      await getDb().transaction(async tx => {
        await tx
          .delete(schema.officialAnnouncementReads)
          .where(
            eq(schema.officialAnnouncementReads.announcementId, input.announcementId),
          );
        await tx
          .delete(schema.officialAnnouncementDismissals)
          .where(
            eq(
              schema.officialAnnouncementDismissals.announcementId,
              input.announcementId,
            ),
          );
        await tx
          .delete(schema.officialAnnouncements)
          .where(eq(schema.officialAnnouncements.id, input.announcementId));
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "official.announcement.delete",
          entityType: "official_announcement",
          entityId: input.announcementId,
          metadata: { title: existing.title },
        });
      });
      return { ok: true as const };
    }),

  /** Histórico com métricas (visualizações/cliques). */
  announcementStats: adminQuery
    .input(z.object({ announcementId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [views] = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(schema.officialAnnouncementReads)
        .where(
          eq(schema.officialAnnouncementReads.announcementId, input.announcementId),
        );
      const [dismissals] = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(schema.officialAnnouncementDismissals)
        .where(
          eq(
            schema.officialAnnouncementDismissals.announcementId,
            input.announcementId,
          ),
        );
      return {
        views: Number(views.count),
        dismissals: Number(dismissals.count),
      };
    }),

  archiveAnnouncement: adminQuery
    .input(z.object({ announcementId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const announcement = await getDb().query.officialAnnouncements.findFirst({
        where: eq(schema.officialAnnouncements.id, input.announcementId),
      });
      if (!announcement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comunicado oficial não encontrado.",
        });
      }
      if (!announcement.isActive) return { ok: true as const };

      await getDb().transaction(async tx => {
        await tx
          .update(schema.officialAnnouncements)
          .set({ isActive: false })
          .where(eq(schema.officialAnnouncements.id, announcement.id));
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "official.announcement.archive",
          entityType: "official_announcement",
          entityId: announcement.id,
          metadata: { title: announcement.title },
        });
      });
      return { ok: true as const };
    }),

  // ── Badges (sistema novo) ─────────────────────────────────────

  /** Catálogo completo para o painel. */
  listBadges: adminQuery.query(async () => {
    const badges = await getDb()
      .select()
      .from(schema.badges)
      .orderBy(asc(schema.badges.displayOrder));
    return badges.map(toBadgeDTO);
  }),

  /** TODAS as badges de um usuário (inclusive ocultas/vencidas) + detalhes. */
  searchUsers: adminQuery
    .input(
      z.object({
        query: z.string().trim().min(1).max(64),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const pattern = `%${escapeLike(input.query)}%`;
      const users = await getDb()
        .select()
        .from(schema.users)
        .where(
          or(
            like(schema.users.username, pattern),
            like(schema.users.name, pattern),
          ),
        )
        .orderBy(desc(schema.users.id))
        .limit(input.limit);
      return users.map(toPublicUser);
    }),

  listUserBadges: adminQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select({ ub: schema.userBadges, badge: schema.badges })
        .from(schema.userBadges)
        .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
        .where(eq(schema.userBadges.userId, input.userId))
        .orderBy(asc(schema.badges.displayOrder));
      const grantorIds = rows
        .map(r => r.ub.grantedBy)
        .filter((id): id is number => typeof id === "number");
      const grantors = grantorIds.length
        ? await getDb()
            .select({ id: schema.users.id, username: schema.users.username, name: schema.users.name })
            .from(schema.users)
            .where(or(...grantorIds.map(id => eq(schema.users.id, id))))
        : [];
      const byId = new Map(grantors.map(g => [g.id, g]));
      return rows.map(r => ({
        ...toUserBadgeDTO(r.badge, r.ub),
        hiddenByUser: r.ub.hiddenByUser,
        manualOverride: r.ub.manualOverride,
        automaticGrantDisabled: r.ub.automaticGrantDisabled,
        reason: r.ub.reason,
        grantedByUser: r.ub.grantedBy
          ? byId.get(r.ub.grantedBy) ?? null
          : null,
      }));
    }),

  /** Concede badge manualmente (com override opcional e expiração). */
  grantBadge: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badgeId: z.number().int().positive(),
        reason: z.string().trim().max(300).optional(),
        /** Dias até expirar; null/omitido = permanente. */
        expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
        manualOverride: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`admin:badge-grant:${ctx.user.id}`, 100, 60_000);
      const authority = getPlatformAuthority(ctx.user);
      if (!authority) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão." });
      }
      const [user, badge] = await Promise.all([
        getDb().query.users.findFirst({ where: eq(schema.users.id, input.userId) }),
        getDb().query.badges.findFirst({ where: eq(schema.badges.id, input.badgeId) }),
      ]);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      }
      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge não encontrada." });
      }
      requireBadgeManagePermission(ctx.user, badge.restricted);

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null;
      const result = await grant(user.id, badge.id, {
        source: "ADMIN",
        grantedBy: ctx.user.id,
        reason: input.reason ?? null,
        expiresAt,
        manualOverride: input.manualOverride,
      });
      if (input.manualOverride && result.granted && !result.alreadyHad) {
        await badgeHistoryWrite({
          userId: user.id,
          badgeId: badge.id,
          action: "MANUAL_OVERRIDE_ENABLED",
          performedBy: ctx.user.id,
          source: "ADMIN",
          reason: "Override manual ativado na concessão.",
        });
      }
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: "badge.grant",
        entityType: "user_badge",
        entityId: badge.id,
        targetUserId: user.id,
        metadata: { badgeSlug: badge.slug, manualOverride: input.manualOverride },
      });
      return result;
    }),

  /** Remove badge manualmente (com motivo — vai para o histórico). */
  revokeBadge: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badgeId: z.number().int().positive(),
        reason: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authority = getPlatformAuthority(ctx.user);
      if (!authority) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão." });
      }
      const badge = await getDb().query.badges.findFirst({
        where: eq(schema.badges.id, input.badgeId),
      });
      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge não encontrada." });
      }
      requireBadgeManagePermission(ctx.user, badge.restricted);

      const removed = await revoke(input.userId, badge.id, {
        performedBy: ctx.user.id,
        reason: input.reason ?? null,
        source: "ADMIN",
      });
      if (removed) {
        await writeAudit(getDb(), {
          actorUserId: ctx.user.id,
          action: "badge.revoke",
          entityType: "user_badge",
          entityId: badge.id,
          targetUserId: input.userId,
          metadata: { badgeSlug: badge.slug, reason: input.reason ?? null },
        });
      }
      return { removed };
    }),

  /** Liga/desliga o override manual (protege da automação). */
  setManualOverride: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badgeId: z.number().int().positive(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const badge = await getDb().query.badges.findFirst({
        where: eq(schema.badges.id, input.badgeId),
      });
      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge não encontrada." });
      }
      requireBadgeManagePermission(ctx.user, badge.restricted);
      await getDb()
        .update(schema.userBadges)
        .set({ manualOverride: input.enabled })
        .where(
          and(
            eq(schema.userBadges.userId, input.userId),
            eq(schema.userBadges.badgeId, input.badgeId),
          ),
        );
      await badgeHistoryWrite({
        userId: input.userId,
        badgeId: input.badgeId,
        action: input.enabled ? "MANUAL_OVERRIDE_ENABLED" : "MANUAL_OVERRIDE_DISABLED",
        performedBy: ctx.user.id,
        source: "ADMIN",
      });
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: input.enabled ? "badge.override.enable" : "badge.override.disable",
        entityType: "user_badge",
        entityId: badge.id,
        targetUserId: input.userId,
      });
      return { ok: true as const };
    }),

  /** Liga/desliga a automação para esta badge/usuário. */
  setAutomaticGrantDisabled: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badgeId: z.number().int().positive(),
        disabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const badge = await getDb().query.badges.findFirst({
        where: eq(schema.badges.id, input.badgeId),
      });
      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge não encontrada." });
      }
      requireBadgeManagePermission(ctx.user, badge.restricted);
      await getDb()
        .update(schema.userBadges)
        .set({ automaticGrantDisabled: input.disabled })
        .where(
          and(
            eq(schema.userBadges.userId, input.userId),
            eq(schema.userBadges.badgeId, input.badgeId),
          ),
        );
      await badgeHistoryWrite({
        userId: input.userId,
        badgeId: input.badgeId,
        action: input.disabled ? "AUTO_GRANT_DISABLED" : "AUTO_GRANT_ENABLED",
        performedBy: ctx.user.id,
        source: "ADMIN",
      });
      return { ok: true as const };
    }),

  /** Histórico de badges do usuário. */
  badgeHistory: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const rows = await getDb()
        .select({
          history: schema.badgeHistory,
          badge: schema.badges,
          actor: schema.users,
        })
        .from(schema.badgeHistory)
        .leftJoin(schema.badges, eq(schema.badges.id, schema.badgeHistory.badgeId))
        .leftJoin(schema.users, eq(schema.users.id, schema.badgeHistory.performedBy))
        .where(eq(schema.badgeHistory.userId, input.userId))
        .orderBy(desc(schema.badgeHistory.timestamp))
        .limit(input.limit);
      return rows.map(r => ({
        id: r.history.id,
        action: r.history.action,
        source: r.history.source,
        reason: r.history.reason,
        timestamp: r.history.timestamp,
        metadata: r.history.metadata,
        badgeSlug: r.badge?.slug ?? null,
        badgeName: r.badge?.name ?? null,
        performedByUser: r.actor
          ? { id: r.actor.id, username: r.actor.username, name: r.actor.name }
          : null,
      }));
    }),

  /** Reavalia as badges automáticas do usuário. */
  reevaluateUserBadges: adminQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const result = await evaluateUser(input.userId, { trigger: "ADMIN" });
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: "badge.reevaluate",
        entityType: "user",
        targetUserId: input.userId,
        metadata: { ...result },
      });
      return result;
    }),

  /** Verificador de inconsistências (Administração → Sistema → Badges). */
  checkBadgeConsistency: adminQuery.query(async () => checkConsistency()),

  fixBadgeConsistency: adminQuery.mutation(async ({ ctx }) => {
    const result = await fixConsistency(ctx.user.id);
    await writeAudit(getDb(), {
      actorUserId: ctx.user.id,
      action: "badge.consistency.fix",
      entityType: "system",
      metadata: { ...result },
    });
    return result;
  }),

  /** Define parceria de servidor (alimenta Partnered Server Owner). */
  setServerPartnership: adminQuery
    .input(
      z.object({
        serverId: z.number().int().positive(),
        partnered: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isPlatformOwner(ctx.user)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Somente o proprietário da plataforma gerencia parcerias.",
        });
      }
      const [server] = await getDb()
        .select()
        .from(schema.servers)
        .where(eq(schema.servers.id, input.serverId))
        .limit(1);
      if (!server) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });
      }
      await getDb()
        .update(schema.servers)
        .set({
          partnered: input.partnered,
          partneredAt: input.partnered ? new Date() : null,
        })
        .where(eq(schema.servers.id, input.serverId));
      await recordEvent(
        input.partnered ? "SERVER_PARTNERED" : "SERVER_UNPARTNERED",
        server.ownerId,
        { serverId: server.id, serverName: server.name },
      );
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: input.partnered ? "server.partner" : "server.unpartner",
        entityType: "server",
        entityId: server.id,
        targetUserId: server.ownerId,
      });
      return { ok: true as const };
    }),

  /** Registra bug report aceito (Bug Hunter). */
  recordBugReport: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        critical: z.boolean().default(false),
        description: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await recordEvent("BUG_REPORT_ACCEPTED", input.userId, {
        critical: input.critical,
        description: input.description ?? null,
      });
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: "badge.bugReport.record",
        entityType: "user",
        targetUserId: input.userId,
        metadata: { critical: input.critical },
      });
      const result = await evaluateUser(input.userId, {
        trigger: "BUG_REPORT_ACCEPTED",
      });
      return result;
    }),

  /** Registra quest completada. */
  recordQuest: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        description: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await recordEvent("QUEST_COMPLETED", input.userId, {
        description: input.description ?? null,
      });
      await writeAudit(getDb(), {
        actorUserId: ctx.user.id,
        action: "badge.quest.record",
        entityType: "user",
        targetUserId: input.userId,
      });
      const result = await evaluateUser(input.userId, {
        trigger: "QUEST_COMPLETED",
      });
      return result;
    }),

  listAuditLog: adminQuery
    .input(pageInput)
    .query(async ({ input }): Promise<{
      items: AdminAuditLogDTO[];
      nextCursor: number | null;
    }> => {
      const limit = input?.limit ?? 50;
      const rows = await getDb()
        .select({ log: schema.adminAuditLog, actor: schema.users })
        .from(schema.adminAuditLog)
        .leftJoin(schema.users, eq(schema.users.id, schema.adminAuditLog.actorUserId))
        .where(
          input?.cursor ? lt(schema.adminAuditLog.id, input.cursor) : undefined,
        )
        .orderBy(desc(schema.adminAuditLog.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return {
        items: page.map(({ log, actor }) => ({
          id: log.id,
          actorUserId: log.actorUserId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          targetUserId: log.targetUserId,
          metadata: log.metadata,
          createdAt: log.createdAt,
          actor: actor ? toPublicUser(actor) : null,
        })),
        nextCursor: hasMore ? (page.at(-1)?.log.id ?? null) : null,
      };
    }),

  // ── Safety & moderation queue ────────────────────────────────
  safetyQueue: adminQuery
    .input(
      z.object({
        status: z.enum(["pending_review", "confirmed", "false_positive", "resolved"]),
      })
    )
    .query(async ({ input }) => listViolations(input.status)),

  reviewViolation: adminQuery
    .input(
      z.object({
        violationId: z.number(),
        decision: z.enum(["confirm", "false_positive"]),
        note: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.decision === "confirm") {
        const result = await confirmViolation(input.violationId, ctx.user.id);
        if (input.note) await addInternalNote(input.violationId, ctx.user.id, input.note);
        return result;
      }
      await markFalsePositive(input.violationId, ctx.user.id, input.note);
      return { severeStrikes: null, banned: false };
    }),

  resolveViolation: adminQuery
    .input(z.object({ violationId: z.number(), note: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      await resolveViolation(input.violationId, ctx.user.id, input.note);
      return { ok: true };
    }),

  noteViolation: adminQuery
    .input(z.object({ violationId: z.number(), note: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await addInternalNote(input.violationId, ctx.user.id, input.note);
      return { ok: true };
    }),

  suspendUser: adminQuery
    .input(z.object({ userId: z.number(), days: z.number().min(1).max(30) }))
    .mutation(async ({ ctx, input }) => {
      await manualSuspend(input.userId, input.days, ctx.user.id);
      return { ok: true };
    }),

  unbanUser: adminQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await manualUnban(input.userId, ctx.user.id);
      return { ok: true };
    }),

  // ── Casos de moderação (denúncias + IA) ──────────────────────
  casesQueue: adminQuery
    .input(
      z.object({
        status: z
          .enum(["open", "under_review", "confirmed", "false_positive", "closed"])
          .optional(),
        priority: z.enum(["low", "normal", "high", "critical"]).optional(),
        onlyCritical: z.boolean().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
    )
    .query(async ({ input }) => listCases(input)),

  caseDetail: adminQuery.input(z.object({ caseId: z.number() })).query(async ({ input }) => {
    const detail = await getCaseById(input.caseId);
    // Nunca expor internalContext a quem não precisa? Painel é staff-only.
    return detail;
  }),

  reviewCase: adminQuery
    .input(
      z.object({
        caseId: z.number(),
        decision: z.enum([
          "confirm",
          "false_positive",
          "remove_content",
          "warn",
          "timeout",
          "suspend",
          "unban_lift_suspension",
          "ban",
          "close_no_action",
          "assign",
        ]),
        note: z.string().max(2000).optional(),
        days: z.number().min(1).max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const detail = await getCaseById(input.caseId);
      await getDb()
        .update(schema.moderationCases)
        .set({
          assignedModeratorId:
            input.decision === "assign" ? ctx.user.id : detail.assignedModeratorId,
          status:
            input.decision === "confirm"
              ? "confirmed"
              : input.decision === "false_positive"
                ? "false_positive"
                : input.decision === "close_no_action"
                  ? "closed"
                  : input.decision === "assign"
                    ? "under_review"
                    : detail.status,
        })
        .where(eq(schema.moderationCases.id, input.caseId));

      if (detail.linkedViolationId) {
        if (input.decision === "confirm") {
          await confirmViolation(detail.linkedViolationId, ctx.user.id);
        } else if (input.decision === "false_positive") {
          await markFalsePositive(detail.linkedViolationId, ctx.user.id, input.note);
        } else if (input.decision === "ban") {
          const [violation] = await getDb()
            .select()
            .from(schema.violations)
            .where(eq(schema.violations.id, detail.linkedViolationId));
          if (violation) {
            await confirmViolation(detail.linkedViolationId, ctx.user.id);
            await applyManualBan(violation.userId, ctx.user.id);
          }
        } else if (input.decision === "suspend" && detail.reportedUserId) {
          await manualSuspend(detail.reportedUserId, input.days ?? 3, ctx.user.id);
        } else if (input.decision === "timeout" && detail.reportedUserId) {
          await manualSuspend(detail.reportedUserId, 1, ctx.user.id);
        } else if (input.decision === "warn" && detail.reportedUserId) {
          await warnUser(detail.reportedUserId, ctx.user.id, input.note);
        }
      }

      if (input.decision === "false_positive") {
        // Atualiza denúncias relacionadas.
        await getDb()
          .update(schema.reports)
          .set({ status: "no_violation", reviewedAt: new Date() })
          .where(eq(schema.reports.caseId, input.caseId));
      } else if (["confirm", "ban", "suspend"].includes(input.decision)) {
        await getDb()
          .update(schema.reports)
          .set({ status: "action_taken", reviewedAt: new Date() })
          .where(eq(schema.reports.caseId, input.caseId));
      } else if (input.decision === "close_no_action") {
        await getDb()
          .update(schema.reports)
          .set({ status: "closed", reviewedAt: new Date() })
          .where(eq(schema.reports.caseId, input.caseId));
      }

      await logSafetyEvent({
        event: `moderation_case_${input.decision}`,
        actorUserId: ctx.user.id,
        targetUserId: detail.reportedUserId,
        caseId: input.caseId,
        violationId: detail.linkedViolationId,
        metadata: { note: input.note ?? null, days: input.days ?? null },
      });
      return { ok: true };
    }),

  removeCaseContent: adminQuery
    .input(z.object({ caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const detail = await getCaseById(input.caseId);
      let removed = false;
      if (
        detail.targetType === "message" &&
        detail.targetId != null &&
        detail.reportedUserId
      ) {
        removed = await removeMessageForModeration(
          detail.targetId,
          detail.reportedUserId
        );
      } else if (detail.targetType === "media" && detail.targetId != null) {
        await blockMediaForModeration(detail.targetId);
        removed = true;
      }
      await logSafetyEvent({
        event: "moderation_case_content_removed",
        actorUserId: ctx.user.id,
        targetUserId: detail.reportedUserId,
        caseId: input.caseId,
        metadata: { removed },
      });
      return { ok: true, removed };
    }),

  // ── Apelações (staff) ────────────────────────────────────────
  appealsQueue: adminQuery.query(async () => listOpenAppeals()),

  reviewAppeal: adminQuery
    .input(
      z.object({
        appealId: z.number(),
        decision: z.enum(["approved", "denied"]),
        note: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await reviewAppealService({
        appealId: input.appealId,
        reviewerId: ctx.user.id,
        decision: input.decision,
        note: input.note,
      });
      return { ok: true };
    }),

  // ── Status da IA / kill switch / auditoria de segurança ──────
  safetyAiStatus: adminQuery.query(async () => ({
    metrics: SafetyService.metricsSnapshot(),
    breakerOpen: breakerOpen(),
    killSwitch: isSafetyKilled(),
    shadowMode: SafetyService.isShadowMode(),
  })),

  setSafetyKillSwitch: ownerQuery
    .input(z.object({ killed: z.boolean() }))
    .mutation(async ({ input }) => {
      setSafetyKillSwitch(input.killed);
      await logSafetyEvent({
        event: input.killed ? "safety_kill_switch_on" : "safety_kill_switch_off",
        metadata: {},
      });
      return { ok: true };
    }),

  safetyAuditEvents: adminQuery
    .input(
      z.object({
        event: z.string().max(64).optional(),
        limit: z.number().min(1).max(200).optional(),
      })
    )
    .query(async ({ input }) =>
      listSafetyAuditEvents(input.event, input.limit)
    ),
});
