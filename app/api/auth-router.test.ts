import { describe, expect, it } from "vitest";
import type { User } from "@db/schema";
import { authRouter } from "./auth-router";
import { accountRouter } from "./accountRouter";

const user: User = {
  id: 42,
  unionId: "local:security-test",
  username: "securitytest",
  passwordHash: "scrypt$v1$salt$hash",
  name: "Security Test",
  email: "private@example.com",
  emailHash: "a".repeat(64),
  emailVerifiedAt: new Date(),
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
  status: "online",
  role: "user",
  platformOwner: false,
  readReceipts: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignInAt: new Date(),
  lastSeenAt: null,
};

function caller(currentUser?: User) {
  return authRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: { host: "localhost:3000" },
    }),
    resHeaders: new Headers(),
    user: currentUser,
  });
}

describe("auth router privacy and logout", () => {
  it("never returns private account fields from auth.me", async () => {
    const result = await caller(user).me();
    expect(result.id).toBe(user.id);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("emailHash");
    expect(result).not.toHaveProperty("platformOwner");
    expect(result).not.toHaveProperty("email");
  });

  it("keeps logout idempotent when there is no active session", async () => {
    await expect(caller().logout()).resolves.toEqual({ success: true });
  });

  it("requires authentication for the current account probe", async () => {
    await expect(caller().me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protects account security procedures before any database work", async () => {
    const account = accountRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
    });
    await expect(account.emailStatus()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(account.sessionsList()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      account.removeEmail({ currentPassword: "not-a-real-password" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
