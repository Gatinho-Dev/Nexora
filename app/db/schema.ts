import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  json,
  customType,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// MySQL LONGBLOB column (binary file storage)
const longblob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "longblob";
  },
});

// ── Users ─────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 32 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  banner: text("banner"),
  bio: text("bio"),
  status: mysqlEnum("status", ["online", "idle", "dnd", "invisible", "offline"])
    .default("offline")
    .notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
});

// ── Servers ───────────────────────────────────────────────────
export const servers = mysqlTable(
  "servers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    iconUrl: text("iconUrl"),
    bannerUrl: text("bannerUrl"),
    description: text("description"),
    vanitySlug: varchar("vanitySlug", { length: 32 }),
    ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ vanityIdx: uniqueIndex("srv_vanity_uniq").on(table.vanitySlug) }),
);

export const serverMembers = mysqlTable(
  "server_members",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    nickname: varchar("nickname", { length: 64 }),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    serverUserIdx: uniqueIndex("sm_server_user_idx").on(table.serverId, table.userId),
    userIdx: index("sm_user_idx").on(table.userId),
  }),
);

export const categories = mysqlTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["text", "voice"]).default("text").notNull(),
    position: int("position").default(0).notNull(),
  },
  (table) => ({ serverIdx: index("cat_server_idx").on(table.serverId) }),
);

export const channels = mysqlTable(
  "channels",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    categoryId: bigint("categoryId", { mode: "number", unsigned: true }),
    name: varchar("name", { length: 64 }).notNull(),
    topic: varchar("topic", { length: 500 }),
    type: mysqlEnum(
      "type",
      ["TEXT", "VOICE", "ANNOUNCEMENT", "FORUM", "STAGE", "MEDIA"]
    )
      .default("TEXT")
      .notNull(),
    position: int("position").default(0).notNull(),
    syncedWithCategory: boolean("syncedWithCategory").default(true).notNull(),
    tags: json("tags").$type<string[]>(),
    forcedTags: boolean("forcedTags").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ serverIdx: index("ch_server_idx").on(table.serverId) }),
);

// ── Channel/category permission overrides ─────────────────────
export const permissionOverrides = mysqlTable(
  "permission_overrides",
  {
    id: serial("id").primaryKey(),
    targetType: mysqlEnum("targetType", ["category", "channel"]).notNull(),
    targetId: bigint("targetId", { mode: "number", unsigned: true }).notNull(),
    roleId: bigint("roleId", { mode: "number", unsigned: true }),
    allow: json("allow").$type<string[]>().notNull(),
    deny: json("deny").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    targetIdx: index("po_target_idx").on(table.targetType, table.targetId),
  }),
);

// ── Messages ──────────────────────────────────────────────────
export const messages = mysqlTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }),
    conversationId: bigint("conversationId", { mode: "number", unsigned: true }),
    authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull(),
    content: text("content").notNull(),
    replyToId: bigint("replyToId", { mode: "number", unsigned: true }),
    threadId: bigint("threadId", { mode: "number", unsigned: true }),
    tag: varchar("tag", { length: 24 }),
    editedAt: timestamp("editedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    channelIdx: index("msg_channel_idx").on(table.channelId, table.id),
    conversationIdx: index("msg_conversation_idx").on(table.conversationId, table.id),
  }),
);

export const files = mysqlTable("files", {
  id: serial("id").primaryKey(),
  uploaderId: bigint("uploaderId", { mode: "number", unsigned: true }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  size: int("size").notNull(),
  data: longblob("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const attachments = mysqlTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }).notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    size: int("size").notNull(),
    spoiler: boolean("spoiler").default(false).notNull(),
  },
  (table) => ({ messageIdx: index("att_message_idx").on(table.messageId) }),
);

export const messageReactions = mysqlTable(
  "message_reactions",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    emoji: varchar("emoji", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("react_uniq_idx").on(table.messageId, table.userId, table.emoji),
    messageIdx: index("react_message_idx").on(table.messageId),
  }),
);

// ── Roles & permissions ───────────────────────────────────────
export const roles = mysqlTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 16 }).default("#94a3b8").notNull(),
    position: int("position").default(0).notNull(),
    permissions: json("permissions").$type<string[]>().notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
  },
  (table) => ({ serverIdx: index("role_server_idx").on(table.serverId) }),
);

export const memberRoles = mysqlTable(
  "member_roles",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    roleId: bigint("roleId", { mode: "number", unsigned: true }).notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("mr_uniq_idx").on(table.serverId, table.userId, table.roleId),
    userIdx: index("mr_user_idx").on(table.userId),
  }),
);

// ── Friends & DMs ─────────────────────────────────────────────
export const friendships = mysqlTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: bigint("requesterId", { mode: "number", unsigned: true }).notNull(),
    addresseeId: bigint("addresseeId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", ["PENDING", "ACCEPTED", "BLOCKED"])
      .default("PENDING")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("fs_uniq_idx").on(table.requesterId, table.addresseeId),
    addresseeIdx: index("fs_addressee_idx").on(table.addresseeId),
  }),
);

export const conversations = mysqlTable("conversations", {
  id: serial("id").primaryKey(),
  isGroup: boolean("isGroup").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const conversationMembers = mysqlTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("cm_uniq_idx").on(table.conversationId, table.userId),
    userIdx: index("cm_user_idx").on(table.userId),
  }),
);

// ── Invites, bans, notifications ──────────────────────────────
export const invites = mysqlTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    creatorId: bigint("creatorId", { mode: "number", unsigned: true }).notNull(),
    expiresAt: timestamp("expiresAt"),
    maxUses: int("maxUses"),
    uses: int("uses").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ serverIdx: index("inv_server_idx").on(table.serverId) }),
);

export const bans = mysqlTable(
  "bans",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ uniqIdx: uniqueIndex("ban_uniq_idx").on(table.serverId, table.userId) }),
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // mention | dm | friend_request | reply
    actorId: bigint("actorId", { mode: "number", unsigned: true }),
    serverId: bigint("serverId", { mode: "number", unsigned: true }),
    channelId: bigint("channelId", { mode: "number", unsigned: true }),
    conversationId: bigint("conversationId", { mode: "number", unsigned: true }),
    messageId: bigint("messageId", { mode: "number", unsigned: true }),
    content: text("content"),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notif_user_idx").on(table.userId, table.isRead),
  }),
);

export const channelReads = mysqlTable(
  "channel_reads",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }),
    conversationId: bigint("conversationId", { mode: "number", unsigned: true }),
    lastReadMessageId: bigint("lastReadMessageId", { mode: "number", unsigned: true })
      .default(0)
      .notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("cr_user_idx").on(table.userId),
  }),
);

export const voiceSessions = mysqlTable(
  "voice_sessions",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    leftAt: timestamp("leftAt"),
  },
  (table) => ({ channelIdx: index("vs_channel_idx").on(table.channelId) }),
);

// ── Nexora platform announcements ────────────────────────────
// These are intentionally separate from user DMs. A platform announcement has
// no conversation/message endpoint, so clients cannot reply to or impersonate
// the official Nexora sender.
export const officialAnnouncements = mysqlTable(
  "official_announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 120 }).notNull(),
    content: text("content").notNull(),
    kind: mysqlEnum("kind", ["GENERAL", "UPDATE", "SECURITY", "MAINTENANCE"])
      .default("GENERAL")
      .notNull(),
    publishedByUserId: bigint("publishedByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    activeIdx: index("oa_active_idx").on(table.isActive, table.publishedAt),
  }),
);

export const officialAnnouncementReads = mysqlTable(
  "official_announcement_reads",
  {
    id: serial("id").primaryKey(),
    announcementId: bigint("announcementId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    readAt: timestamp("readAt").defaultNow().notNull(),
  },
  (table) => ({
    announcementUserIdx: uniqueIndex("oar_announcement_user_idx").on(
      table.announcementId,
      table.userId,
    ),
    userIdx: index("oar_user_idx").on(table.userId, table.announcementId),
  }),
);

// ── Platform badges ──────────────────────────────────────────
// Badge definitions are data-driven so new staff/emblem types can be added
// later without another schema migration.
export const platformBadges = mysqlTable(
  "platform_badges",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 48 }).notNull().unique(),
    label: varchar("label", { length: 64 }).notNull(),
    description: varchar("description", { length: 255 }),
    icon: varchar("icon", { length: 64 }),
    color: varchar("color", { length: 16 }).default("#4654D8").notNull(),
    isStaff: boolean("isStaff").default(false).notNull(),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({ staffIdx: index("pb_staff_idx").on(table.isStaff) }),
);

export const userBadges = mysqlTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    badgeId: bigint("badgeId", { mode: "number", unsigned: true }).notNull(),
    assignedByUserId: bigint("assignedByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  },
  (table) => ({
    userBadgeIdx: uniqueIndex("ub_user_badge_idx").on(table.userId, table.badgeId),
    badgeIdx: index("ub_badge_idx").on(table.badgeId, table.userId),
  }),
);

export const adminAuditLog = mysqlTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entityType", { length: 48 }).notNull(),
    entityId: bigint("entityId", { mode: "number", unsigned: true }),
    targetUserId: bigint("targetUserId", { mode: "number", unsigned: true }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("aal_actor_idx").on(table.actorUserId, table.id),
    targetIdx: index("aal_target_idx").on(table.targetUserId, table.id),
  }),
);

// ── Stage channels ────────────────────────────────────────────
// Users authorized to speak in a STAGE channel. Everyone else joins as
// audience and can listen but not transmit.
export const stageSpeakers = mysqlTable(
  "stage_speakers",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    grantedByUserId: bigint("grantedByUserId", {
      mode: "number",
      unsigned: true,
    }),
    grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("ss_channel_user_idx").on(table.channelId, table.userId),
    userIdx: index("ss_user_idx").on(table.userId),
  }),
);

// ── Server events ─────────────────────────────────────────────
export const serverEvents = mysqlTable(
  "server_events",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt"),
    status: mysqlEnum("status", ["SCHEDULED", "ACTIVE", "CANCELLED"])
      .default("SCHEDULED")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ serverIdx: index("se_server_idx").on(table.serverId) }),
);

// ── Webhooks (integrações externas) ───────────────────────────
export const webhooks = mysqlTable(
  "webhooks",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }).notNull(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    avatarUrl: varchar("avatarUrl", { length: 500 }),
    /** sha256 of the secret token — raw token is never stored. */
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ channelIdx: index("wh_channel_idx").on(table.channelId) }),
);

// ── Threads (sub-canais de texto) ─────────────────────────────
export const threads = mysqlTable(
  "threads",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    private: boolean("private").default(false).notNull(),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ channelIdx: index("th_channel_idx").on(table.channelId) }),
);

// ── Announcement channel follows ──────────────────────────────
export const channelFollows = mysqlTable(
  "channel_follows",
  {
    id: serial("id").primaryKey(),
    sourceChannelId: bigint("sourceChannelId", { mode: "number", unsigned: true }).notNull(),
    followerServerId: bigint("followerServerId", { mode: "number", unsigned: true }).notNull(),
    targetChannelId: bigint("targetChannelId", { mode: "number", unsigned: true }).notNull(),
    createdByUserId: bigint("createdByUserId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("cf_source_idx").on(table.sourceChannelId),
    uniq: uniqueIndex("cf_source_target_uniq").on(table.sourceChannelId, table.targetChannelId),
  }),
);

// ── Account safety & moderation ───────────────────────────────
// Server-side source of truth for account standing. The frontend may display
// this data but never decides punishments.
export const accountSafety = mysqlTable("account_safety", {
  userId: bigint("userId", { mode: "number", unsigned: true })
    .primaryKey(),
  status: mysqlEnum("status", [
    "good_standing",
    "limited",
    "very_limited",
    "at_risk",
    "suspended",
    "permanently_banned",
  ])
    .default("good_standing")
    .notNull(),
  severeStrikes: int("severeStrikes").default(0).notNull(),
  maxSevereStrikes: int("maxSevereStrikes").default(3).notNull(),
  suspendedUntil: timestamp("suspendedUntil"),
  suspendedByViolationId: bigint("suspendedByViolationId", {
    mode: "number",
    unsigned: true,
  }),
  permanentBan: boolean("permanentBan").default(false).notNull(),
  /** Sensitive media preference: hide | warn | auto */
  sensitiveMediaPref: mysqlEnum("sensitiveMediaPref", [
    "hide",
    "warn",
    "auto",
  ])
    .default("warn")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const violations = mysqlTable(
  "violations",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }),
    category: varchar("category", { length: 120 }).notNull(),
    severity: mysqlEnum("severity", ["warning", "moderate", "severe"])
      .default("severe")
      .notNull(),
    source: mysqlEnum("source", ["automatic_ai", "moderator", "user_report"])
      .default("automatic_ai")
      .notNull(),
    moderationModel: varchar("moderationModel", { length: 160 }),
    status: mysqlEnum("status", [
      "pending_review",
      "confirmed",
      "false_positive",
      "resolved",
    ])
      .default("pending_review")
      .notNull(),
    action: mysqlEnum("action", [
      "none",
      "warning",
      "limited",
      "content_blocked",
      "three_day_suspension",
      "temporary_suspension",
      "permanent_ban",
    ])
      .default("none")
      .notNull(),
    strikeApplied: boolean("strikeApplied").default(false).notNull(),
    internalNote: text("internalNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
    reviewedByUserId: bigint("reviewedByUserId", {
      mode: "number",
      unsigned: true,
    }),
  },
  (table) => ({
    userIdx: index("vio_user_idx").on(table.userId, table.id),
    statusIdx: index("vio_status_idx").on(table.status, table.createdAt),
    /** Idempotency: one violation per file + category. */
    fileCatUniq: uniqueIndex("vio_file_cat_uniq").on(table.fileId, table.category),
  }),
);

/** Moderation state for uploaded files (images/videos). One row per file. */
export const mediaModeration = mysqlTable("media_moderation", {
  fileId: bigint("fileId", { mode: "number", unsigned: true })
    .primaryKey(),
  uploaderId: bigint("uploaderId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", [
    "processing",
    "approved",
    "sensitive",
    "blocked",
    "review_required",
  ])
    .default("processing")
    .notNull(),
  safety: mysqlEnum("safety", ["safe", "unsafe", "unknown"])
    .default("unknown")
    .notNull(),
  categories: json("categories").$type<string[]>().notNull(),
  sensitive: boolean("sensitive").default(false).notNull(),
  adultOnly: boolean("adultOnly").default(false).notNull(),
  allowReveal: boolean("allowReveal").default(true).notNull(),
  attempts: int("attempts").default(0).notNull(),
  lastError: varchar("lastError", { length: 500 }),
  moderationModel: varchar("moderationModel", { length: 160 }),
  moderatedAt: timestamp("moderatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Types ─────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type ServerMember = typeof serverMembers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type MemberRole = typeof memberRoles.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Ban = typeof bans.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ChannelRead = typeof channelReads.$inferSelect;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type OfficialAnnouncement = typeof officialAnnouncements.$inferSelect;
export type OfficialAnnouncementRead = typeof officialAnnouncementReads.$inferSelect;
export type PlatformBadge = typeof platformBadges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type PermissionOverride = typeof permissionOverrides.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type ChannelFollow = typeof channelFollows.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type AccountSafety = typeof accountSafety.$inferSelect;
export type Violation = typeof violations.$inferSelect;
export type MediaModeration = typeof mediaModeration.$inferSelect;
