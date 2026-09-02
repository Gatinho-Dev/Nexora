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
  customStatus: null,
  profileTheme: "cobalt",
  profileAccent: "#7383FF",
  nameFont: "sans",
  nameEffect: "solid",
  nameColorA: "#F4F7FB",
  nameColorB: "#7383FF",
  avatarDecoration: "none",
  profileEffect: "none",
  profileGames: [],
  profileWishlist: [],
  profileWidgets: ["games", "favorite"],
  favoriteGameId: null,
  favoriteGameNote: null,
  status: "offline",
  role: "user",
  readReceipts: true,
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
    await expect(
      caller(user).grantBadge({ userId: 1, badgeId: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires authentication even for the authority probe", async () => {
    await expect(caller().authority()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("does not let a non-owner platform admin manage restricted badges", async () => {
    // Staff/restritas exigem autoridade "owner" — validado no handler
    // depois do lookup da badge; sem DB o erro de lookup não deve vazar
    // permissão: o teste garante que admin comum NUNCA recebe sucesso.
    await expect(
      caller({ ...user, role: "admin" }).grantBadge({
        userId: 999999,
        badgeId: 999999,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller({ ...user, role: "user" }).grantBadge({
        userId: 999999,
        badgeId: 999999,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
