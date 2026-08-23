import { describe, expect, it } from "vitest";
import { eq, or } from "drizzle-orm";
import { adminRouter } from "./adminRouter";
import { officialRouter } from "./officialRouter";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
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

      const badge = await admin.createBadge({
        slug: `integration-staff-${suffix}`,
        label: "Integration Staff",
        icon: "shield-check",
        color: "#4654D8",
        isStaff: true,
      });
      badgeId = badge.id;
      await admin.assignBadge({ userId, badgeId });
      await expect(admin.listUserBadges({ userId })).resolves.toEqual([
        expect.objectContaining({ id: badgeId, isStaff: true }),
      ]);

      const announcement = await admin.createAnnouncement({
        title: "Comunicado de integração",
        content: "Mensagem oficial usada somente pelo teste automatizado.",
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
          "badge.definition.create",
          "badge.assignment.assign",
          "official.announcement.create",
          "official.announcement.archive",
        ]),
      );
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
      if (badgeId !== null) {
        await db
          .delete(schema.platformBadges)
          .where(eq(schema.platformBadges.id, badgeId));
      }
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  });
});
