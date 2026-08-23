import { describe, expect, it } from "vitest";
import type { User } from "@db/schema";
import { adminRouter } from "./adminRouter";

const user: User = {
  id: 123,
  unionId: "local:not-an-admin",
  username: "member",
  passwordHash: null,
  name: "Member",
  email: null,
  avatar: null,
  banner: null,
  bio: null,
  status: "offline",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignInAt: new Date(),
  lastSeenAt: null,
};

function caller(currentUser?: User) {
  return adminRouter.createCaller({
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user: currentUser,
  });
}

describe("admin router authorization", () => {
  it("reports no authority to a regular authenticated user", async () => {
    await expect(caller(user).authority()).resolves.toEqual({
      authority: null,
      canAccess: false,
      canManageStaffBadges: false,
    });
  });

  it("rejects protected procedures before any database work", async () => {
    await expect(caller(user).listBadges()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requires authentication even for the authority probe", async () => {
    await expect(caller().authority()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("does not let a non-owner platform admin create a staff badge", async () => {
    await expect(
      caller({ ...user, role: "admin" }).createBadge({
        slug: "staff-test",
        label: "Staff Test",
        icon: "shield-check",
        color: "#4654D8",
        isStaff: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
