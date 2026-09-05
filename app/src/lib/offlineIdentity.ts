import type { User } from "@contracts/types";

type AuthUser = Omit<User, "passwordHash">;

const OFFLINE_IDENTITY_KEY = "nexora:offline-identity";

export function cacheOfflineIdentity(user: AuthUser) {
  try {
    // Keep only a non-secret local identity marker. Email and the external
    // union identifier are intentionally excluded from the offline copy.
    sessionStorage.setItem(OFFLINE_IDENTITY_KEY, JSON.stringify({
      ...user,
      email: null,
      unionId: `offline:${user.id}`,
    }));
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

export function readOfflineIdentity(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(OFFLINE_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return Number.isFinite(parsed.id) ? parsed : null;
  } catch {
    return null;
  }
}

export function offlineIdentityId(): number | null {
  return readOfflineIdentity()?.id ?? null;
}

export function clearOfflineIdentity() {
  try {
    sessionStorage.removeItem(OFFLINE_IDENTITY_KEY);
  } catch {
    // No-op when storage is disabled.
  }
}
