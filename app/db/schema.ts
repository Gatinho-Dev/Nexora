import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  char,
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
  /** Privacidade: quando false, o usuário não aparece em recibos "Visto por". */
  readReceipts: boolean("readReceipts").default(true).notNull(),
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
    tags: json("tags").$type<string[]>().default([]).notNull(),
    vanitySlug: varchar("vanitySlug", { length: 32 }),
    verificationLevel: mysqlEnum("verificationLevel", [
      "none",
      "low",
      "medium",
      "high",
      "maximum",
    ])
      .default("none")
      .notNull(),
    defaultNotifications: mysqlEnum("defaultNotifications", ["all", "mentions"])
      .default("all")
      .notNull(),
    invitesPaused: boolean("invitesPaused").default(false).notNull(),
    rulesEnabled: boolean("rulesEnabled").default(false).notNull(),
    rules: json("rules").$type<string[]>().default([]).notNull(),
    communityEnabled: boolean("communityEnabled").default(false).notNull(),
    ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
    /** Parceria oficial com a Nexora (alimenta a badge Partnered Server Owner). */
    partnered: boolean("partnered").default(false).notNull(),
    partneredAt: timestamp("partneredAt"),
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
    timeoutUntil: timestamp("timeoutUntil"),
    rulesAcceptedAt: timestamp("rulesAcceptedAt"),
    lastActiveAt: timestamp("lastActiveAt"),
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
    type: mysqlEnum("type", ["TEXT", "VOICE", "ANNOUNCEMENT", "FORUM", "STAGE", "MEDIA"])
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
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }),
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
    channelAuthorIdx: index("msg_channel_author_idx").on(
      table.channelId,
      table.authorId,
      table.id,
    ),
    conversationAuthorIdx: index("msg_conversation_author_idx").on(
      table.conversationId,
      table.authorId,
      table.id,
    ),
  }),
);

export const files = mysqlTable("files", {
  id: serial("id").primaryKey(),
  uploaderId: bigint("uploaderId", {
    mode: "number",
    unsigned: true,
  }).notNull(),
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
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
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
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
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
    hoistMembers: boolean("hoistMembers").default(false).notNull(),
    mentionable: boolean("mentionable").default(false).notNull(),
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
    requesterId: bigint("requesterId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    addresseeId: bigint("addresseeId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    status: mysqlEnum("status", ["PENDING", "ACCEPTED", "BLOCKED"]).default("PENDING").notNull(),
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
  /** Group conversations only: display name (null = generated from members). */
  name: varchar("name", { length: 100 }),
  avatarUrl: text("avatarUrl"),
  description: varchar("description", { length: 500 }),
  ownerId: bigint("ownerId", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const conversationMembers = mysqlTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    role: mysqlEnum("role", ["owner", "admin", "member"]).default("member").notNull(),
    nickname: varchar("nickname", { length: 64 }),
    mutedUntil: timestamp("mutedUntil"),
    notificationLevel: mysqlEnum("notificationLevel", ["all", "mentions", "muted"])
      .default("all")
      .notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("cm_uniq_idx").on(table.conversationId, table.userId),
    userIdx: index("cm_user_idx").on(table.userId),
  }),
);

// ── Group invites ─────────────────────────────────────────────
// Invite links for group conversations. The raw token is never stored —
// only its sha256 hash, mirroring the webhook secret pattern.
export const groupInvites = mysqlTable(
  "group_invites",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    /** sha256 hex of the raw invite token — raw token lives only in the link. */
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    expiresAt: timestamp("expiresAt"),
    maxUses: int("maxUses"),
    uses: int("uses").default(0).notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tokenUniq: uniqueIndex("gi_token_uniq").on(table.tokenHash),
    convIdx: index("gi_conv_idx").on(table.conversationId),
  }),
);

// ── Pinned messages (group conversations) ─────────────────────
export const pinnedMessages = mysqlTable(
  "pinned_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    pinnedByUserId: bigint("pinnedByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("pm_conv_msg_uniq").on(table.conversationId, table.messageId),
    convIdx: index("pm_conv_idx").on(table.conversationId),
  }),
);

// ── Invites, bans, notifications ──────────────────────────────
export const invites = mysqlTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    creatorId: bigint("creatorId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    expiresAt: timestamp("expiresAt"),
    maxUses: int("maxUses"),
    uses: int("uses").default(0).notNull(),
    revokedAt: timestamp("revokedAt"),
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
  (table) => ({
    uniqIdx: uniqueIndex("ban_uniq_idx").on(table.serverId, table.userId),
  }),
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
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }),
    messageId: bigint("messageId", { mode: "number", unsigned: true }),
    content: text("content"),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notif_user_idx").on(table.userId, table.isRead),
    userIdIdIdx: index("notifications_user_id_id_idx").on(table.userId, table.id),
  }),
);

/** Preferências privadas por usuário e servidor. */
export const serverNotificationPreferences = mysqlTable(
  "server_notification_preferences",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    level: mysqlEnum("level", ["all", "mentions", "none"])
      .default("mentions")
      .notNull(),
    mutedUntil: timestamp("mutedUntil"),
    suppressEveryone: boolean("suppressEveryone").default(false).notNull(),
    suppressRoles: boolean("suppressRoles").default(false).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqIdx: uniqueIndex("snp_server_user_uniq").on(table.serverId, table.userId),
    userIdx: index("snp_user_idx").on(table.userId),
  }),
);

/** Registro imutável das ações administrativas dentro de um servidor. */
export const serverAuditLogs = mysqlTable(
  "server_audit_logs",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("targetType", { length: 48 }).notNull(),
    targetId: bigint("targetId", { mode: "number", unsigned: true }),
    targetUserId: bigint("targetUserId", { mode: "number", unsigned: true }),
    reason: varchar("reason", { length: 500 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    serverIdx: index("sal_server_idx").on(table.serverId, table.id),
    actorIdx: index("sal_actor_idx").on(table.actorUserId, table.id),
    targetIdx: index("sal_target_idx").on(table.targetUserId, table.id),
  }),
);

export const channelReads = mysqlTable(
  "channel_reads",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }),
    lastReadMessageId: bigint("lastReadMessageId", {
      mode: "number",
      unsigned: true,
    })
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
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
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
    /** MARKDOWN | PLAIN_TEXT — antigas sem valor = PLAIN_TEXT. */
    contentFormat: mysqlEnum("contentFormat", ["MARKDOWN", "PLAIN_TEXT"])
      .default("PLAIN_TEXT")
      .notNull(),
    kind: mysqlEnum("kind", ["GENERAL", "UPDATE", "SECURITY", "MAINTENANCE"])
      .default("GENERAL")
      .notNull(),
    /** INFO | SUCCESS | WARNING | ERROR | MAINTENANCE | ANNOUNCEMENT */
    type: mysqlEnum("type", ["INFO", "SUCCESS", "WARNING", "ERROR", "MAINTENANCE", "ANNOUNCEMENT"])
      .default("ANNOUNCEMENT")
      .notNull(),
    /** CTA opcional. */
    buttonLabel: varchar("buttonLabel", { length: 80 }),
    buttonUrl: varchar("buttonUrl", { length: 500 }),
    /** Agendamento: só aparece entre startsAt e expiresAt. */
    startsAt: timestamp("startsAt"),
    expiresAt: timestamp("expiresAt"),
    /** false = não pode ser fechada pelo usuário enquanto ativa. */
    dismissible: boolean("dismissible").default(true).notNull(),
    clicks: int("clicks").default(0).notNull(),
    publishedByUserId: bigint("publishedByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    activeIdx: index("oa_active_idx").on(table.isActive, table.id),
  }),
);

/** Dispensas por usuário: mensagem dispensável não reaparece. */
export const officialAnnouncementDismissals = mysqlTable(
  "official_announcement_dismissals",
  {
    id: serial("id").primaryKey(),
    announcementId: bigint("announcementId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    dismissedAt: timestamp("dismissedAt").defaultNow().notNull(),
  },
  (table) => ({
    announcementUserIdx: uniqueIndex("oad_announcement_user_idx").on(
      table.announcementId,
      table.userId,
    ),
    userIdx: index("oad_user_idx").on(table.userId),
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

// ── Badges (sistema novo — substitui platform_badges/user_badges antigos) ──
// Catálogo data-driven: novas badges entram como linhas, sem nova migration.
export const badges = mysqlTable(
  "badges",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    description: varchar("description", { length: 300 }),
    /** Arquivo em /badges/{icon}.svg */
    icon: varchar("icon", { length: 64 }).notNull(),
    category: varchar("category", { length: 32 }).default("general").notNull(),
    rarity: mysqlEnum("rarity", ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "EXCLUSIVE"])
      .default("COMMON")
      .notNull(),
    /** Quem pode conceder: SYSTEM | ADMIN | MIGRATION | EVENT | IMPORT | STAFF_DIRECTORY */
    grantType: varchar("grantType", { length: 24 }).default("ADMIN").notNull(),
    permanent: boolean("permanent").default(true).notNull(),
    visible: boolean("visible").default(true).notNull(),
    canHide: boolean("canHide").default(false).notNull(),
    displayOrder: int("displayOrder").default(100).notNull(),
    /** Exige autoridade "owner" para conceder/remover. */
    restricted: boolean("restricted").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({ orderIdx: index("badges_order_idx").on(table.displayOrder) }),
);

export const userBadges = mysqlTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    badgeId: bigint("badgeId", { mode: "number", unsigned: true }).notNull(),
    grantedAt: timestamp("grantedAt").defaultNow().notNull(),
    /** userId de quem concedeu (null = SYSTEM). */
    grantedBy: bigint("grantedBy", { mode: "number", unsigned: true }),
    /** SYSTEM | ADMIN | MIGRATION | EVENT | IMPORT | STAFF_DIRECTORY | LEGACY_ARCHIVED */
    grantSource: varchar("grantSource", { length: 24 }).default("SYSTEM").notNull(),
    reason: varchar("reason", { length: 300 }),
    expiresAt: timestamp("expiresAt"),
    hiddenByUser: boolean("hiddenByUser").default(false).notNull(),
    /** true = automação não pode remover esta concessão. */
    manualOverride: boolean("manualOverride").default(false).notNull(),
    /** true = automação não pode conceder esta badge a este usuário. */
    automaticGrantDisabled: boolean("automaticGrantDisabled").default(false).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Um usuário nunca possui duas instâncias da mesma badge.
    userBadgeIdx: uniqueIndex("ub_user_badge_idx").on(table.userId, table.badgeId),
    badgeIdx: index("ub_badge_idx").on(table.badgeId, table.userId),
  }),
);

/** Trilha de auditoria completa de badges. */
export const badgeHistory = mysqlTable(
  "badge_history",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    badgeId: bigint("badgeId", { mode: "number", unsigned: true }).notNull(),
    /** GRANTED | REVOKED | EXPIRED | RESTORED | MIGRATED | LEGACY_ARCHIVED |
        MANUAL_OVERRIDE_ENABLED | MANUAL_OVERRIDE_DISABLED |
        AUTO_GRANT_DISABLED | AUTO_GRANT_ENABLED */
    action: varchar("action", { length: 32 }).notNull(),
    performedBy: bigint("performedBy", { mode: "number", unsigned: true }),
    /** SYSTEM | ADMIN | MIGRATION | EVENT | AUTOMATION | LEGACY */
    source: varchar("source", { length: 24 }).default("SYSTEM").notNull(),
    reason: varchar("reason", { length: 300 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("bh_user_idx").on(table.userId, table.timestamp),
    badgeIdx: index("bh_badge_idx").on(table.badgeId),
  }),
);

/** Eventos internos que alimentam concessões automáticas e janelas de evento. */
export const badgeEvents = mysqlTable(
  "badge_events",
  {
    id: serial("id").primaryKey(),
    /** USER_CREATED | QUEST_COMPLETED | BUG_REPORT_ACCEPTED | SERVER_PARTNERED
        | SERVER_UNPARTNERED | SERVER_OWNER_CHANGED | APPLICATION_VERIFIED
        | APPLICATION_ACTIVITY | MODERATOR_CERTIFIED | SUBSCRIPTION_STARTED
        | SUBSCRIPTION_ENDED | USERNAME_MIGRATED */
    type: varchar("type", { length: 32 }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    badgeId: bigint("badgeId", { mode: "number", unsigned: true }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("be_user_idx").on(table.userId, table.type),
  }),
);

/** Janela de evento para badges temporárias (ex.: A Clown, for a limited time). */
export const badgeEventWindows = mysqlTable("badge_event_windows", {
  id: serial("id").primaryKey(),
  badgeId: bigint("badgeId", { mode: "number", unsigned: true }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  requirements: varchar("requirements", { length: 300 }),
  permanentAfterEvent: boolean("permanentAfterEvent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const adminAuditLog = mysqlTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: bigint("actorUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
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
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
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
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    avatarUrl: varchar("avatarUrl", { length: 500 }),
    /** sha256 of the secret token — raw token is never stored. */
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    createdById: bigint("createdById", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ channelIdx: index("wh_channel_idx").on(table.channelId) }),
);

// ── Threads (sub-canais de texto) ─────────────────────────────
export const threads = mysqlTable(
  "threads",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdById: bigint("createdById", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    private: boolean("private").default(false).notNull(),
    archivedAt: timestamp("archivedAt"),
    lockedAt: timestamp("lockedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ channelIdx: index("th_channel_idx").on(table.channelId) }),
);

// ── Embeds de links ───────────────────────────────────────────
export const messageEmbeds = mysqlTable(
  "message_embeds",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    url: varchar("url", { length: 1000 }).notNull(),
    provider: varchar("provider", { length: 24 }).notNull(),
    type: varchar("type", { length: 16 }).default("unknown").notNull(),
    title: varchar("title", { length: 300 }),
    description: varchar("description", { length: 600 }),
    authorName: varchar("authorName", { length: 120 }),
    authorUrl: varchar("authorUrl", { length: 500 }),
    providerName: varchar("providerName", { length: 80 }),
    thumbnailUrl: varchar("thumbnailUrl", { length: 800 }),
    playerUrl: varchar("playerUrl", { length: 800 }),
    videoId: varchar("videoId", { length: 120 }),
    position: int("position").default(0).notNull(),
    status: mysqlEnum("status", ["processing", "ready", "unsupported", "failed"])
      .default("processing")
      .notNull(),
    fetchedAt: timestamp("fetchedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    messageIdx: index("embed_message_idx").on(table.messageId),
    urlIdx: index("embed_url_idx").on(table.url),
  }),
);

// ── Enquetes ──────────────────────────────────────────────────
export const polls = mysqlTable("polls", {
  id: serial("id").primaryKey(),
  messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull().unique(),
  question: varchar("question", { length: 300 }).notNull(),
  allowMultiple: boolean("allowMultiple").default(false).notNull(),
  expiresAt: timestamp("expiresAt"),
  closedAt: timestamp("closedAt"),
  createdByUserId: bigint("createdByUserId", {
    mode: "number",
    unsigned: true,
  }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pollAnswers = mysqlTable(
  "poll_answers",
  {
    id: serial("id").primaryKey(),
    pollId: bigint("pollId", { mode: "number", unsigned: true }).notNull(),
    text: varchar("text", { length: 120 }).notNull(),
    position: int("position").default(0).notNull(),
  },
  (table) => ({ pollIdx: index("poll_answers_poll_idx").on(table.pollId) }),
);

export const pollVotes = mysqlTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    pollId: bigint("pollId", { mode: "number", unsigned: true }).notNull(),
    answerId: bigint("answerId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    // Um voto por resposta por usuário — a chave garante idempotência.
    voteUniq: uniqueIndex("poll_votes_uniq").on(table.pollId, table.userId, table.answerId),
    userIdx: index("poll_votes_user_idx").on(table.userId),
  }),
);

// ── Announcement channel follows ──────────────────────────────
export const channelFollows = mysqlTable(
  "channel_follows",
  {
    id: serial("id").primaryKey(),
    sourceChannelId: bigint("sourceChannelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    followerServerId: bigint("followerServerId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    targetChannelId: bigint("targetChannelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
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
  userId: bigint("userId", { mode: "number", unsigned: true }).primaryKey(),
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
  sensitiveMediaPref: mysqlEnum("sensitiveMediaPref", ["hide", "warn", "auto"])
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
    /** Mensagem de texto associada (moderação de texto/denúncias). */
    messageId: bigint("messageId", { mode: "number", unsigned: true }),
    /** Tipo do alvo original: message | image | profile | server | channel | user. */
    targetType: varchar("targetType", { length: 32 }),
    category: varchar("category", { length: 120 }).notNull(),
    severity: mysqlEnum("severity", ["warning", "moderate", "severe"]).default("severe").notNull(),
    source: mysqlEnum("source", ["automatic_ai", "moderator", "user_report", "automod"])
      .default("automatic_ai")
      .notNull(),
    moderationModel: varchar("moderationModel", { length: 160 }),
    /** Versão da política aplicada na detecção (ex.: 2026.08.1). */
    policyVersion: varchar("policyVersion", { length: 40 }),
    status: mysqlEnum("status", ["pending_review", "confirmed", "false_positive", "resolved"])
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
    /** Motivo sanitizado exibido ao titular na Central de Segurança. */
    publicReason: varchar("publicReason", { length: 500 }),
    /** Quantos conteúdos foram afetados pela decisão agrupada. */
    affectedContentCount: int("affectedContentCount").default(1).notNull(),
    /** Duração escolhida pela política automática, quando houver suspensão. */
    suspensionDays: int("suspensionDays"),
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
    /** Idempotência: uma violação por arquivo + categoria. */
    fileCatUniq: uniqueIndex("vio_file_cat_uniq").on(table.fileId, table.category),
    /** Idempotência: uma violação por mensagem + categoria. */
    msgCatUniq: uniqueIndex("vio_msg_cat_uniq").on(table.messageId, table.category),
  }),
);

/** Moderation state for uploaded files (images/videos). One row per file. */
export const mediaModeration = mysqlTable("media_moderation", {
  fileId: bigint("fileId", { mode: "number", unsigned: true }).primaryKey(),
  uploaderId: bigint("uploaderId", {
    mode: "number",
    unsigned: true,
  }).notNull(),
  status: mysqlEnum("status", ["processing", "approved", "sensitive", "blocked", "review_required"])
    .default("processing")
    .notNull(),
  safety: mysqlEnum("safety", ["safe", "unsafe", "unknown"]).default("unknown").notNull(),
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

// ── Denúncias (user reports) ──────────────────────────────────
export const reports = mysqlTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: bigint("reporterId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    /** message | user | media | server | channel */
    targetType: mysqlEnum("targetType", [
      "message",
      "user",
      "media",
      "server",
      "channel",
    ]).notNull(),
    targetId: bigint("targetId", { mode: "number", unsigned: true }).notNull(),
    reportedUserId: bigint("reportedUserId", {
      mode: "number",
      unsigned: true,
    }),
    category: varchar("category", { length: 64 }).notNull(),
    subcategory: varchar("subcategory", { length: 64 }),
    description: varchar("description", { length: 1000 }),
    status: mysqlEnum("status", [
      "submitted",
      "triaged",
      "under_review",
      "action_taken",
      "no_violation",
      "closed",
    ])
      .default("submitted")
      .notNull(),
    priority: mysqlEnum("priority", ["low", "normal", "high", "critical"])
      .default("normal")
      .notNull(),
    caseId: bigint("caseId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  (table) => ({
    reporterIdx: index("rep_reporter_idx").on(table.reporterId, table.id),
    targetIdx: index("rep_target_idx").on(table.targetType, table.targetId),
    reportedUserIdx: index("rep_reported_user_idx").on(table.reportedUserId),
    caseIdx: index("rep_case_idx").on(table.caseId),
  }),
);

// ── Casos de moderação (agregam denúncias + detecções automáticas) ──
export const moderationCases = mysqlTable(
  "moderation_cases",
  {
    id: serial("id").primaryKey(),
    /** message | user | media | server | channel | automatic_ai */
    targetType: varchar("targetType", { length: 32 }).notNull(),
    targetId: bigint("targetId", { mode: "number", unsigned: true }),
    reportedUserId: bigint("reportedUserId", {
      mode: "number",
      unsigned: true,
    }),
    category: varchar("category", { length: 64 }).notNull(),
    priority: mysqlEnum("priority", ["low", "normal", "high", "critical"])
      .default("normal")
      .notNull(),
    status: mysqlEnum("status", ["open", "under_review", "confirmed", "false_positive", "closed"])
      .default("open")
      .notNull(),
    /** Resultado normalizado da IA (SafetyResult) na triagem — sem conteúdo bruto. */
    aiAssessment: json("aiAssessment").$type<Record<string, unknown> | null>(),
    reportsCount: int("reportsCount").default(0).notNull(),
    /** Contexto interno curto para revisão (nunca exposto ao usuário). */
    internalContext: varchar("internalContext", { length: 500 }),
    linkedViolationId: bigint("linkedViolationId", {
      mode: "number",
      unsigned: true,
    }),
    assignedModeratorId: bigint("assignedModeratorId", {
      mode: "number",
      unsigned: true,
    }),
    policyVersion: varchar("policyVersion", { length: 40 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index("mc_status_idx").on(table.status, table.createdAt),
    priorityIdx: index("mc_priority_idx").on(table.priority),
    reportedUserIdx: index("mc_reported_user_idx").on(table.reportedUserId),
    targetIdx: index("mc_target_idx").on(table.targetType, table.targetId),
  }),
);

/** N:M entre casos e denúncias relacionadas. */
export const moderationCaseReports = mysqlTable(
  "moderation_case_reports",
  {
    id: serial("id").primaryKey(),
    caseId: bigint("caseId", { mode: "number", unsigned: true }).notNull(),
    reportId: bigint("reportId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    reportUniq: uniqueIndex("mcr_report_uniq").on(table.reportId),
    caseIdx: index("mcr_case_idx").on(table.caseId),
  }),
);

/** Durable, idempotent second-stage visual review triggered by a report. */
export const mediaDeepReviews = mysqlTable(
  "media_deep_reviews",
  {
    id: serial("id").primaryKey(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }).notNull(),
    caseId: bigint("caseId", { mode: "number", unsigned: true }).notNull(),
    reportId: bigint("reportId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", ["queued", "processing", "completed", "failed"])
      .default("queued")
      .notNull(),
    attempts: int("attempts").default(0).notNull(),
    lastError: varchar("lastError", { length: 500 }),
    result: json("result").$type<Record<string, unknown> | null>(),
    model: varchar("model", { length: 160 }),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    reportFileUniq: uniqueIndex("mdr_report_file_uniq").on(table.reportId, table.fileId),
    statusIdx: index("mdr_status_created_idx").on(table.status, table.createdAt),
    caseIdx: index("mdr_case_idx").on(table.caseId),
  }),
);

/**
 * Revisão durável do histórico textual iniciada por uma denúncia. O escopo é
 * congelado no momento da denúncia e processado por cursor, evitando que uma
 * requisição HTTP fique presa ou que um restart do Render perca a análise.
 */
export const textHistoryReviews = mysqlTable(
  "text_history_reviews",
  {
    id: serial("id").primaryKey(),
    reportId: bigint("reportId", { mode: "number", unsigned: true }).notNull(),
    caseId: bigint("caseId", { mode: "number", unsigned: true }).notNull(),
    anchorMessageId: bigint("anchorMessageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    reportedUserId: bigint("reportedUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    scopeType: mysqlEnum("scopeType", ["channel", "conversation"]).notNull(),
    scopeId: bigint("scopeId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", ["queued", "processing", "completed", "failed"])
      .default("queued")
      .notNull(),
    attempts: int("attempts").default(0).notNull(),
    snapshotMaxMessageId: bigint("snapshotMaxMessageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    cursorMessageId: bigint("cursorMessageId", {
      mode: "number",
      unsigned: true,
    })
      .default(0)
      .notNull(),
    scannedCount: int("scannedCount").default(0).notNull(),
    removedCount: int("removedCount").default(0).notNull(),
    categories: json("categories").$type<string[]>().notNull(),
    violationIds: json("violationIds").$type<number[]>().notNull(),
    enforcementViolationId: bigint("enforcementViolationId", {
      mode: "number",
      unsigned: true,
    }),
    sanction: mysqlEnum("sanction", ["none", "warning", "temporary_suspension"])
      .default("none")
      .notNull(),
    suspensionDays: int("suspensionDays"),
    publicReason: varchar("publicReason", { length: 500 }),
    model: varchar("model", { length: 160 }),
    lastError: varchar("lastError", { length: 500 }),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    reportUniq: uniqueIndex("thr_report_uniq").on(table.reportId),
    statusIdx: index("thr_status_created_idx").on(table.status, table.createdAt),
    scopeIdx: index("thr_scope_author_idx").on(
      table.scopeType,
      table.scopeId,
      table.reportedUserId,
    ),
  }),
);

// ── Apelações ─────────────────────────────────────────────────
export const appeals = mysqlTable(
  "appeals",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    violationId: bigint("violationId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    reason: varchar("reason", { length: 2000 }),
    status: mysqlEnum("status", ["submitted", "under_review", "approved", "denied"])
      .default("submitted")
      .notNull(),
    reviewNote: varchar("reviewNote", { length: 1000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
    reviewedByUserId: bigint("reviewedByUserId", {
      mode: "number",
      unsigned: true,
    }),
  },
  (table) => ({
    userIdx: index("app_user_idx").on(table.userId, table.id),
    violationUniq: uniqueIndex("app_violation_uniq").on(table.violationId),
  }),
);

// ── AutoMod por servidor ──────────────────────────────────────
export const automodRules = mysqlTable(
  "automod_rules",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    /** flood | repeat | mass_mention | blocked_words | invites | suspicious_links | sensitive_content */
    ruleType: varchar("ruleType", { length: 32 }).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    /** Configuração livre por regra (palavras, limites etc). */
    config: json("config").$type<Record<string, unknown> | null>(),
    updatedByUserId: bigint("updatedByUserId", {
      mode: "number",
      unsigned: true,
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    serverTypeUniq: uniqueIndex("amr_server_type_uniq").on(table.serverId, table.ruleType),
  }),
);

// ── Auditoria de segurança ────────────────────────────────────
export const safetyAuditEvents = mysqlTable(
  "safety_audit_events",
  {
    id: serial("id").primaryKey(),
    /** ex.: moderation_case_confirmed, appeal_approved, automod_triggered */
    event: varchar("event", { length: 64 }).notNull(),
    actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }),
    targetUserId: bigint("targetUserId", { mode: "number", unsigned: true }),
    caseId: bigint("caseId", { mode: "number", unsigned: true }),
    violationId: bigint("violationId", { mode: "number", unsigned: true }),
    /** Metadados seguros — nunca conteúdo proibido bruto. */
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("sae_event_idx").on(table.event, table.createdAt),
    targetIdx: index("sae_target_idx").on(table.targetUserId),
  }),
);

// ── Sessões de dispositivo (Dispositivos conectados) ──────────
// O banco guarda apenas sha256(token) — nunca o JWT bruto.
export const accountSessions = mysqlTable(
  "account_sessions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    tokenHash: char("tokenHash", { length: 64 }).notNull(),
    userAgent: varchar("userAgent", { length: 250 }),
    browser: varchar("browser", { length: 40 }).notNull(),
    os: varchar("os", { length: 40 }).notNull(),
    /** desktop | mobile | tablet | unknown */
    deviceType: varchar("deviceType", { length: 20 }).notNull(),
    friendlyName: varchar("friendlyName", { length: 80 }).notNull(),
    /** IPv4 ou IPv6. */
    ipAddress: varchar("ipAddress", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("as_token_hash_uniq").on(table.tokenHash),
    userSeenIdx: index("as_user_seen_idx").on(table.userId, table.lastSeenAt),
    expiresIdx: index("as_expires_idx").on(table.expiresAt),
  }),
);

// ── Conexões externas (integrações: Roblox etc.) ─────────────
export const userConnections = mysqlTable(
  "user_connections",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    /** ROBLOX (único provider por enquanto; estrutura genérica). */
    provider: varchar("provider", { length: 32 }).notNull(),
    /** Identificador permanente na plataforma externa (sub do OIDC). */
    providerUserId: varchar("providerUserId", { length: 64 }).notNull(),
    username: varchar("username", { length: 100 }),
    displayName: varchar("displayName", { length: 100 }),
    avatarUrl: varchar("avatarUrl", { length: 500 }),
    profileUrl: varchar("profileUrl", { length: 300 }),
    accessTokenEnc: varchar("accessTokenEnc", { length: 600 }),
    refreshTokenEnc: varchar("refreshTokenEnc", { length: 600 }),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    needsReauth: boolean("needsReauth").default(false).notNull(),
    showOnProfile: boolean("showOnProfile").default(true).notNull(),
    showActivity: boolean("showActivity").default(true).notNull(),
    allowJoin: boolean("allowJoin").default(true).notNull(),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    providerUserUniq: uniqueIndex("uc_provider_user_uniq").on(table.provider, table.providerUserId),
    userIdx: index("uc_user_idx").on(table.userId, table.provider),
  }),
);

// ── Atividade Rich Presence derivada do worker ───────────────
export const robloxActivity = mysqlTable("roblox_activity", {
  userId: bigint("userId", { mode: "number", unsigned: true }).primaryKey(),
  /** OFFLINE | ONLINE | IN_GAME | IN_STUDIO */
  status: varchar("status", { length: 20 }).notNull(),
  universeId: bigint("universeId", { mode: "number" }),
  placeId: bigint("placeId", { mode: "number" }),
  name: varchar("name", { length: 200 }),
  creatorName: varchar("creatorName", { length: 100 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 600 }),
  playUrl: varchar("playUrl", { length: 300 }),
  /** Estimado pela Nexora no primeiro IN_GAME detectado. */
  startedAt: timestamp("startedAt"),
  stale: boolean("stale").default(false).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
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
export type GroupInvite = typeof groupInvites.$inferSelect;
export type PinnedMessage = typeof pinnedMessages.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Ban = typeof bans.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ChannelRead = typeof channelReads.$inferSelect;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type OfficialAnnouncement = typeof officialAnnouncements.$inferSelect;
export type OfficialAnnouncementRead = typeof officialAnnouncementReads.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type BadgeHistory = typeof badgeHistory.$inferSelect;
export type BadgeEvent = typeof badgeEvents.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type PermissionOverride = typeof permissionOverrides.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type ChannelFollow = typeof channelFollows.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type AccountSafety = typeof accountSafety.$inferSelect;
export type Violation = typeof violations.$inferSelect;
export type MediaModeration = typeof mediaModeration.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ModerationCase = typeof moderationCases.$inferSelect;
export type ModerationCaseReport = typeof moderationCaseReports.$inferSelect;
export type MediaDeepReview = typeof mediaDeepReviews.$inferSelect;
export type Appeal = typeof appeals.$inferSelect;
export type AutomodRule = typeof automodRules.$inferSelect;
export type SafetyAuditEvent = typeof safetyAuditEvents.$inferSelect;
export type AccountSession = typeof accountSessions.$inferSelect;
export type UserConnection = typeof userConnections.$inferSelect;
export type RobloxActivity = typeof robloxActivity.$inferSelect;
