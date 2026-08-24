import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@db/schema";
import { env } from "../lib/env";
import {
  getPlatformAuthority,
  isPlatformAdmin,
  isPlatformOwner,
} from "./platformAuth";

const baseUser: User = {
  id: 10,
  unionId: "local:regular-user",
  username: "regular",
  passwordHash: null,
  name: "Regular",
  email: null,
  avatar: null,
  banner: null,
  bio: null,
  status: "offline",
  role: "user",
  readReceipts: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignInAt: new Date(),
  lastSeenAt: null,
};

let originalOwnerUnionIds: string[];
let originalOwnerUserIds: number[];
let originalAdminUnionIds: string[];
let originalAdminUserIds: number[];

beforeEach(() => {
  originalOwnerUnionIds = [...env.ownerUnionIds];
  originalOwnerUserIds = [...env.ownerUserIds];
  originalAdminUnionIds = [...env.adminUnionIds];
  originalAdminUserIds = [...env.adminUserIds];
  env.ownerUnionIds.splice(0);
  env.ownerUserIds.splice(0);
  env.adminUnionIds.splice(0);
  env.adminUserIds.splice(0);
});

afterEach(() => {
  env.ownerUnionIds.splice(0, env.ownerUnionIds.length, ...originalOwnerUnionIds);
  env.ownerUserIds.splice(0, env.ownerUserIds.length, ...originalOwnerUserIds);
  env.adminUnionIds.splice(0, env.adminUnionIds.length, ...originalAdminUnionIds);
  env.adminUserIds.splice(0, env.adminUserIds.length, ...originalAdminUserIds);
});

describe("platform authority", () => {
  it("does not grant platform access to a normal user", () => {
    expect(getPlatformAuthority(baseUser)).toBeNull();
    expect(isPlatformAdmin(baseUser)).toBe(false);
    expect(isPlatformOwner(baseUser)).toBe(false);
  });

  it("recognizes environment-owned accounts with owner precedence", () => {
    env.ownerUnionIds.push(baseUser.unionId);
    const persistedAdmin = { ...baseUser, role: "admin" as const };
    expect(getPlatformAuthority(persistedAdmin)).toBe("owner");
    expect(isPlatformOwner(persistedAdmin)).toBe(true);
  });

  it("recognizes an environment admin and the persisted admin role", () => {
    env.adminUserIds.push(baseUser.id);
    expect(getPlatformAuthority(baseUser)).toBe("admin");
    expect(getPlatformAuthority({ ...baseUser, id: 11, role: "admin" })).toBe(
      "admin",
    );
  });
});
