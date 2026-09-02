import { describe, expect, it } from "vitest";
import type { User } from "@db/schema";
import { groupRouter } from "./groupRouter";
import {
  buildFallbackGroupName,
  canDeleteGroup,
  canManageGroup,
  canModerateMember,
  inviteValidationError,
  roleAtLeast,
} from "./utils/groupPermissions";

const user: User = {
  id: 42,
  unionId: "local:test-user",
  username: "daniel",
  passwordHash: null,
  name: "Daniel",
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
  return groupRouter.createCaller({
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user: currentUser,
  });
}

// ── Authorization guards ──────────────────────────────────────

describe("group router authorization", () => {
  it("rejects unauthenticated create", async () => {
    await expect(
      caller().create({ memberIds: [2, 3] })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated read receipts", async () => {
    await expect(caller().readBy({ messageId: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("validates member count before touching the database", async () => {
    // Menos que o mínimo (precisa de ao menos MIN-1 amigos).
    await expect(
      caller(user).create({ memberIds: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates invite payload shape", async () => {
    await expect(
      caller(user).createInvite({
        conversationId: 1,
        expiresInSeconds: 999 as unknown as 3600,
        maxUses: 3 as unknown as 5,
      })
    ).rejects.toBeTruthy();
  });
});

// ── Pure permission matrix (item 44/16) ──────────────────────

describe("role matrix", () => {
  it("orders roles owner > admin > member", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("admin", "owner")).toBe(false);
  });

  it("lets owner+admins manage the group", () => {
    expect(canManageGroup("owner")).toBe(true);
    expect(canManageGroup("admin")).toBe(true);
    expect(canManageGroup("member")).toBe(false);
  });

  it("only lets the owner delete or transfer", () => {
    expect(canDeleteGroup("owner")).toBe(true);
    expect(canDeleteGroup("admin")).toBe(false);
    expect(canDeleteGroup("member")).toBe(false);
  });

  it("admins act only on plain members; owner acts on admins too", () => {
    expect(canModerateMember("owner", "admin")).toBe(true);
    expect(canModerateMember("owner", "member")).toBe(true);
    expect(canModerateMember("admin", "member")).toBe(true);
    expect(canModerateMember("admin", "admin")).toBe(false);
    expect(canModerateMember("member", "member")).toBe(false);
    expect(canModerateMember("member", "admin")).toBe(false);
  });
});

// ── Fallback group name (item 3) ─────────────────────────────

describe("buildFallbackGroupName", () => {
  it("joins two names with 'e'", () => {
    expect(buildFallbackGroupName(["Daniel", "Maria"])).toBe(
      "Daniel e Maria"
    );
  });

  it("joins three names with commas + 'e'", () => {
    expect(buildFallbackGroupName(["Daniel", "Maria", "João"])).toBe(
      "Daniel, Maria e João"
    );
  });

  it("summarizes big groups", () => {
    expect(
      buildFallbackGroupName([
        "Daniel",
        "Maria",
        "João",
        "Lucas",
        "Ana",
        "Bia",
      ])
    ).toBe("Daniel, Maria, João e +3");
  });

  it("ignores empty names and handles empty groups", () => {
    expect(buildFallbackGroupName([])).toBe("Grupo");
    expect(buildFallbackGroupName(["", "  ", "Daniel"])).toBe("Daniel");
  });
});

// ── Invite validation (itens 19/20/65) ───────────────────────

describe("inviteValidationError", () => {
  const now = new Date("2026-08-23T12:00:00Z");

  const valid = {
    revokedAt: null,
    expiresAt: null,
    maxUses: null,
    uses: 0,
  };

  it("accepts a fresh unlimited invite", () => {
    expect(inviteValidationError(valid, now)).toBeNull();
  });

  it("detects revoked invites", () => {
    expect(
      inviteValidationError({ ...valid, revokedAt: now }, now)
    ).toMatch(/revogado/i);
  });

  it("detects expired invites", () => {
    expect(
      inviteValidationError(
        { ...valid, expiresAt: new Date(now.getTime() - 1000) },
        now
      )
    ).toMatch(/expirou/i);
  });

  it("detects exhausted invites", () => {
    expect(
      inviteValidationError({ ...valid, maxUses: 5, uses: 5 }, now)
    ).toMatch(/limite/i);
  });

  it("still accepts an invite with uses left", () => {
    expect(
      inviteValidationError({ ...valid, maxUses: 5, uses: 4 }, now)
    ).toBeNull();
  });
});
