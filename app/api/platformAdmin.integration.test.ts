import { describe, expect, it } from "vitest";
import { eq, or } from "drizzle-orm";
import { adminRouter } from "./adminRouter";
import { officialRouter } from "./officialRouter";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { ensureCatalog } from "./services/badgeService";
import * as schema from "@db/schema";

const runDatabaseIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDatabaseIntegration)("platform admin database flow", () => {
  it("publishes, reads and archives an official notice and safely assigns a staff badge", async () => {
    const db = getDb();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [{ id: userId }] = await db
      .insert(schema.users)
      .values({
        unionId: `integration:platform-admin:${suffix}`,
        username: `admin_${suffix.slice(-6)}`,
        name: "Platform integration admin",
      })
      .$returningId();

    let announcementId: number | null = null;
    let badgeId: number | null = null;
    env.ownerUserIds.push(userId);

    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
      expect(user).toBeTruthy();
      if (!user) throw new Error("Integration user was not created");

      const context = {
        req: new Request("http://localhost/api/trpc"),
        resHeaders: new Headers(),
        user,
      };
      const admin = adminRouter.createCaller(context);
      const official = officialRouter.createCaller(context);

      await expect(admin.authority()).resolves.toMatchObject({
        authority: "owner",
        canAccess: true,
        canManageStaffBadges: true,
      });

      await ensureCatalog();
      const catalog = await admin.listBadges();
      const staff = catalog.find(b => b.slug === "staff");
      expect(staff).toBeTruthy();
      if (!staff) throw new Error("staff badge not seeded");
      badgeId = staff.id;
      await admin.grantBadge({
        userId,
        badgeId,
        reason: "Integration test staff",
        manualOverride: true,
      });
      const badges = await admin.listUserBadges({ userId });
      expect(badges).toEqual([
        expect.objectContaining({
          id: badgeId,
          slug: "staff",
          manualOverride: true,
          restricted: true,
        }),
      ]);

      const announcement = await admin.createAnnouncement({
        title: "Comunicado de integração",
        content: "**Mensagem oficial** usada somente pelo teste: [Nexora](https://nexorachat.cloud)",
        contentFormat: "MARKDOWN",
        type: "ANNOUNCEMENT",
        buttonLabel: "Abrir",
        buttonUrl: "https://nexorachat.cloud",
        dismissible: true,
        kind: "UPDATE",
      });
      announcementId = announcement.id;

      const beforeRead = await official.list({ limit: 100 });
      expect(beforeRead.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: announcementId, isRead: false }),
        ]),
      );

      await official.markRead({ announcementId });
      const afterRead = await official.list({ limit: 100 });
      expect(afterRead.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: announcementId, isRead: true }),
        ]),
      );

      await admin.archiveAnnouncement({ announcementId });
      const visibleAfterArchive = await official.list({ limit: 100 });
      expect(visibleAfterArchive.items.some(item => item.id === announcementId)).toBe(
        false,
      );

      const audit = await admin.listAuditLog({ limit: 100 });
      const actions = audit.items
        .filter(item => item.actorUserId === userId)
        .map(item => item.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          "badge.grant",
          "official.announcement.create",
          "official.announcement.archive",
        ]),
      );

      // Reavaliação e verificador de consistência operam sem erro.
      const evaluation = await admin.reevaluateUserBadges({ userId });
      expect(evaluation).toHaveProperty("kept");
      const consistency = await admin.checkBadgeConsistency();
      expect(consistency).toHaveProperty("usersAnalyzed");
    } finally {
      const ownerIndex = env.ownerUserIds.lastIndexOf(userId);
      if (ownerIndex >= 0) env.ownerUserIds.splice(ownerIndex, 1);

      if (announcementId !== null) {
        await db
          .delete(schema.officialAnnouncementReads)
          .where(
            eq(schema.officialAnnouncementReads.announcementId, announcementId),
          );
      }
      if (badgeId !== null) {
        await db
          .delete(schema.userBadges)
          .where(eq(schema.userBadges.badgeId, badgeId));
        await db
          .delete(schema.badgeHistory)
          .where(eq(schema.badgeHistory.badgeId, badgeId));
      }
      await db
        .delete(schema.adminAuditLog)
        .where(
          or(
            eq(schema.adminAuditLog.actorUserId, userId),
            eq(schema.adminAuditLog.targetUserId, userId),
          ),
        );
      if (announcementId !== null) {
        await db
          .delete(schema.officialAnnouncements)
          .where(eq(schema.officialAnnouncements.id, announcementId));
      }
      // Catálogo é permanente — nada a limpar.
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  });
});
