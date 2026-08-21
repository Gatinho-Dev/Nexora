export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

// ── Permissions ───────────────────────────────────────────────
export const PERMISSIONS = [
  "ADMINISTRATOR",
  "MANAGE_SERVER",
  "MANAGE_CHANNELS",
  "MANAGE_ROLES",
  "KICK_MEMBERS",
  "BAN_MEMBERS",
  "MANAGE_MESSAGES",
  "SEND_MESSAGES",
  "READ_MESSAGES",
  "CONNECT",
  "SPEAK",
  "STREAM",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const DEFAULT_MEMBER_PERMISSIONS: Permission[] = [
  "SEND_MESSAGES",
  "READ_MESSAGES",
  "CONNECT",
  "SPEAK",
  "STREAM",
];

export const MODERATOR_PERMISSIONS: Permission[] = [
  ...DEFAULT_MEMBER_PERMISSIONS,
  "MANAGE_CHANNELS",
  "MANAGE_MESSAGES",
  "KICK_MEMBERS",
];

// ── Rate limits (easy to tweak) ───────────────────────────────
export const RateLimits = {
  message: { limit: 5, windowMs: 5_000 },
  serverCreate: { limit: 5, windowMs: 60 * 60_000 },
  inviteCreate: { limit: 10, windowMs: 60 * 60_000 },
  friendRequest: { limit: 10, windowMs: 60_000 },
  upload: { limit: 10, windowMs: 60_000 },
  reaction: { limit: 20, windowMs: 10_000 },
} as const;

// ── Uploads ───────────────────────────────────────────────────
export const MAX_UPLOAD_MB = 8;

export const ALLOWED_UPLOAD_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
] as const;

// ── User status ───────────────────────────────────────────────
export const USER_STATUSES = ["online", "idle", "dnd", "invisible"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
