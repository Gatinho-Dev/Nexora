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
} from "drizzle-orm";
import type { AdminAuditLogDTO } from "@contracts/types";
import { createRouter, adminQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import {
  getPlatformAuthority,
  isPlatformOwner,
} from "./utils/platformAuth";
import {
  toOfficialAnnouncementDTO,
  toPlatformBadgeDTO,
  toUserBadgeDTO,
} from "./utils/platformDtos";
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

const badgeSlug = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras minúsculas, números e hífens no identificador.",
  );

const badgeIcon = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "Use um identificador de ícone válido.");

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

function requireOwnerForStaffBadge(
  user: typeof schema.users.$inferSelect,
  isStaff: boolean,
) {
  if (isStaff && !isPlatformOwner(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente o proprietário da plataforma pode gerenciar emblemas de staff.",
    });
  }
}

async function listBadgesForUser(userId: number) {
  const rows = await getDb()
    .select({ badge: schema.platformBadges, assignment: schema.userBadges })
    .from(schema.userBadges)
    .innerJoin(
      schema.platformBadges,
      eq(schema.platformBadges.id, schema.userBadges.badgeId),
    )
    .where(eq(schema.userBadges.userId, userId))
    .orderBy(desc(schema.userBadges.assignedAt));
  return rows.map(row => toUserBadgeDTO(row.badge, row.assignment));
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
        kind: announcementKind.default("GENERAL"),
        expiresAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`admin:announcement:${ctx.user.id}`, 20, 60_000);
      if (input.expiresAt && input.expiresAt <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A expiração precisa estar no futuro.",
        });
      }

      const announcement = await getDb().transaction(async tx => {
        const [{ id }] = await tx
          .insert(schema.officialAnnouncements)
          .values({
            title: input.title,
            content: input.content,
            kind: input.kind,
            publishedByUserId: ctx.user.id,
            expiresAt: input.expiresAt ?? null,
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

  listBadges: adminQuery.query(async () => {
    const badges = await getDb()
      .select()
      .from(schema.platformBadges)
      .orderBy(desc(schema.platformBadges.isStaff), asc(schema.platformBadges.label));
    return badges.map(toPlatformBadgeDTO);
  }),

  createBadge: adminQuery
    .input(
      z.object({
        slug: badgeSlug,
        label: z.string().trim().min(2).max(64),
        description: z.string().trim().max(255).nullable().optional(),
        icon: badgeIcon.nullable().optional(),
        color: z
          .string()
          .trim()
          .regex(/^#[0-9a-f]{6}$/i, "Informe uma cor hexadecimal válida.")
          .default("#4654D8"),
        isStaff: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`admin:badge-definition:${ctx.user.id}`, 30, 60_000);
      requireOwnerForStaffBadge(ctx.user, input.isStaff);

      const existing = await getDb().query.platformBadges.findFirst({
        where: eq(schema.platformBadges.slug, input.slug),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um emblema com este identificador.",
        });
      }

      const badge = await getDb().transaction(async tx => {
        const [{ id }] = await tx
          .insert(schema.platformBadges)
          .values({
            slug: input.slug,
            label: input.label,
            description: input.description ?? null,
            icon: input.icon ?? null,
            color: input.color,
            isStaff: input.isStaff,
            createdByUserId: ctx.user.id,
          })
          .$returningId();
        const created = await tx.query.platformBadges.findFirst({
          where: eq(schema.platformBadges.id, id),
        });
        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Não foi possível criar o emblema.",
          });
        }
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "badge.definition.create",
          entityType: "platform_badge",
          entityId: created.id,
          metadata: { slug: created.slug, isStaff: created.isStaff },
        });
        return created;
      });
      return toPlatformBadgeDTO(badge);
    }),

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
    .query(({ input }) => listBadgesForUser(input.userId)),

  assignBadge: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badgeId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`admin:badge-assignment:${ctx.user.id}`, 100, 60_000);
      const [user, badge] = await Promise.all([
        getDb().query.users.findFirst({ where: eq(schema.users.id, input.userId) }),
        getDb().query.platformBadges.findFirst({
          where: eq(schema.platformBadges.id, input.badgeId),
        }),
      ]);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      }
      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Emblema não encontrado." });
      }
      requireOwnerForStaffBadge(ctx.user, badge.isStaff);

      const assignedAt = new Date();
      await getDb().transaction(async tx => {
        await tx
          .insert(schema.userBadges)
          .values({
            userId: user.id,
            badgeId: badge.id,
            assignedByUserId: ctx.user.id,
            assignedAt,
          })
          .onDuplicateKeyUpdate({
            set: { assignedByUserId: ctx.user.id, assignedAt },
          });
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "badge.assignment.assign",
          entityType: "user_badge",
          entityId: badge.id,
          targetUserId: user.id,
          metadata: { badgeSlug: badge.slug },
        });
      });
      return { ok: true as const };
    }),

  unassignBadge: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badgeId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const badge = await getDb().query.platformBadges.findFirst({
        where: eq(schema.platformBadges.id, input.badgeId),
      });
      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Emblema não encontrado." });
      }
      requireOwnerForStaffBadge(ctx.user, badge.isStaff);

      const assignment = await getDb().query.userBadges.findFirst({
        where: and(
          eq(schema.userBadges.userId, input.userId),
          eq(schema.userBadges.badgeId, input.badgeId),
        ),
      });
      if (!assignment) return { ok: true as const };

      await getDb().transaction(async tx => {
        await tx
          .delete(schema.userBadges)
          .where(
            and(
              eq(schema.userBadges.userId, input.userId),
              eq(schema.userBadges.badgeId, input.badgeId),
            ),
          );
        await writeAudit(tx, {
          actorUserId: ctx.user.id,
          action: "badge.assignment.unassign",
          entityType: "user_badge",
          entityId: badge.id,
          targetUserId: input.userId,
          metadata: { badgeSlug: badge.slug },
        });
      });
      return { ok: true as const };
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
      await manualUnban(input.userId);
      void ctx;
      return { ok: true };
    }),
});
