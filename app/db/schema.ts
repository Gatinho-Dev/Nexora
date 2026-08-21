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
export const servers = mysqlTable("servers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  iconUrl: text("iconUrl"),
  description: text("description"),
  ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
    type: mysqlEnum("type", ["TEXT", "VOICE", "ANNOUNCEMENT", "FORUM", "STAGE"])
      .default("TEXT")
      .notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ serverIdx: index("ch_server_idx").on(table.serverId) }),
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
