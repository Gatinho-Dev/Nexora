import type { User } from "@db/schema";
import { env } from "../lib/env";

export type PlatformAuthority = "owner" | "admin" | null;

/**
 * Platform authority is decided exclusively on the server. Environment-owned
 * and persisted platform-owner accounts are recognized even when their role
 * has not been updated yet, while the existing database admin role remains
 * backwards compatible.
 */
export function getPlatformAuthority(user: User): PlatformAuthority {
  if (
    env.ownerUserIds.includes(user.id) ||
    env.ownerUnionIds.includes(user.unionId) ||
    user.platformOwner
  ) {
    return "owner";
  }

  if (
    user.role === "admin" ||
    env.adminUserIds.includes(user.id) ||
    env.adminUnionIds.includes(user.unionId)
  ) {
    return "admin";
  }

  return null;
}

export function isPlatformAdmin(user: User): boolean {
  return getPlatformAuthority(user) !== null;
}

export function isPlatformOwner(user: User): boolean {
  return getPlatformAuthority(user) === "owner";
}
