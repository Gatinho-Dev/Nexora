export const Session = {
  cookieName: "nexora_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
} as const;

// ── Permissions ───────────────────────────────────────────────
export const PERMISSIONS = [
  "ADMINISTRATOR",
  "VIEW_CHANNEL",
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
  "VIEW_CHANNEL",
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
  groupCreate: { limit: 4, windowMs: 60 * 60_000 },
  groupInviteCreate: { limit: 10, windowMs: 60 * 60_000 },
  groupMemberChange: { limit: 30, windowMs: 60_000 },
} as const;

// ── Groups (conversas privadas em grupo) ─────────────────────
export const GroupLimits = {
  /** Total de participantes contando o criador. */
  MIN_MEMBERS: 3,
  MAX_MEMBERS: 50,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
} as const;

/** Opções de expiração de convite de grupo (em horas; null = nunca). */
export const GROUP_INVITE_EXPIRY_HOURS = [1, 24, 168, null] as const;
/** Opções de limite de usos por convite de grupo (null = sem limite). */
export const GROUP_INVITE_MAX_USES = [1, 5, 10, null] as const;

/** Durações de silenciamento por conversa (minutos; null = até reativar). */
export const GROUP_MUTE_MINUTES = [15, 60, 480, 1440, 10080, null] as const;

/** Quem pode usar @todos/@everyone num grupo por padrão. */
export type GroupRole = "owner" | "admin" | "member";

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
