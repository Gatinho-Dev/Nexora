import { relations } from "drizzle-orm";
import * as s from "./schema";

// Relações do catálogo Drizzle. O runtime usa db.query.<tabela> em vários
// routers; sem relations registradas o modo relacional quebra com
// "Cannot read properties of undefined (reading 'map')".

export const usersRelations = relations(s.users, ({ many }) => ({
  serverMembers: many(s.serverMembers),
  friendships: many(s.friendships),
  conversationMembers: many(s.conversationMembers),
  notifications: many(s.notifications),
  invitesCreated: many(s.invites),
  messages: many(s.messages),
  userBadges: many(s.userBadges),
  badgeHistory: many(s.badgeHistory),
  serverEventsCreated: many(s.serverEvents),
  threadsCreated: many(s.threads),
}));

export const serversRelations = relations(s.servers, ({ many }) => ({
  members: many(s.serverMembers),
  channels: many(s.channels),
  categories: many(s.categories),
  roles: many(s.roles),
  invites: many(s.invites),
  bans: many(s.bans),
  notifications: many(s.notifications),
  events: many(s.serverEvents),
}));

export const serverMembersRelations = relations(s.serverMembers, ({ one }) => ({
  server: one(s.servers, {
    fields: [s.serverMembers.serverId],
    references: [s.servers.id],
  }),
  user: one(s.users, {
    fields: [s.serverMembers.userId],
    references: [s.users.id],
  }),
}));

export const categoriesRelations = relations(s.categories, ({ many, one }) => ({
  server: one(s.servers, {
    fields: [s.categories.serverId],
    references: [s.servers.id],
  }),
  channels: many(s.channels),
}));

export const channelsRelations = relations(s.channels, ({ many, one }) => ({
  server: one(s.servers, {
    fields: [s.channels.serverId],
    references: [s.servers.id],
  }),
  category: one(s.categories, {
    fields: [s.channels.categoryId],
    references: [s.categories.id],
  }),
  messages: many(s.messages),
  threads: many(s.threads),
  serverEvents: many(s.serverEvents),
  notifications: many(s.notifications),
}));

export const messagesRelations = relations(s.messages, ({ one }) => ({
  author: one(s.users, {
    fields: [s.messages.authorId],
    references: [s.users.id],
  }),
  channel: one(s.channels, {
    fields: [s.messages.channelId],
    references: [s.channels.id],
  }),
  conversation: one(s.conversations, {
    fields: [s.messages.conversationId],
    references: [s.conversations.id],
  }),
  thread: one(s.threads, {
    fields: [s.messages.threadId],
    references: [s.threads.id],
  }),
}));

export const filesRelations = relations(s.files, ({ one }) => ({
  uploader: one(s.users, {
    fields: [s.files.uploaderId],
    references: [s.users.id],
  }),
}));

export const rolesRelations = relations(s.roles, ({ many, one }) => ({
  server: one(s.servers, {
    fields: [s.roles.serverId],
    references: [s.servers.id],
  }),
  memberRoles: many(s.memberRoles),
}));

export const friendshipsRelations = relations(s.friendships, ({ one }) => ({
  requester: one(s.users, {
    fields: [s.friendships.requesterId],
    references: [s.users.id],
  }),
  addressee: one(s.users, {
    fields: [s.friendships.addresseeId],
    references: [s.users.id],
  }),
}));

export const conversationsRelations = relations(s.conversations, ({ many }) => ({
  members: many(s.conversationMembers),
}));

export const conversationMembersRelations = relations(
  s.conversationMembers,
  ({ one }) => ({
    conversation: one(s.conversations, {
      fields: [s.conversationMembers.conversationId],
      references: [s.conversations.id],
    }),
    user: one(s.users, {
      fields: [s.conversationMembers.userId],
      references: [s.users.id],
    }),
  }),
);

export const groupInvitesRelations = relations(s.groupInvites, ({ one }) => ({
  conversation: one(s.conversations, {
    fields: [s.groupInvites.conversationId],
    references: [s.conversations.id],
  }),
  creator: one(s.users, {
    fields: [s.groupInvites.createdByUserId],
    references: [s.users.id],
  }),
}));

export const invitesRelations = relations(s.invites, ({ one }) => ({
  server: one(s.servers, {
    fields: [s.invites.serverId],
    references: [s.servers.id],
  }),
  creator: one(s.users, {
    fields: [s.invites.creatorId],
    references: [s.users.id],
  }),
}));

export const bansRelations = relations(s.bans, ({ one }) => ({
  server: one(s.servers, {
    fields: [s.bans.serverId],
    references: [s.servers.id],
  }),
  user: one(s.users, {
    fields: [s.bans.userId],
    references: [s.users.id],
  }),
}));

export const notificationsRelations = relations(s.notifications, ({ one }) => ({
  user: one(s.users, {
    fields: [s.notifications.userId],
    references: [s.users.id],
  }),
  actor: one(s.users, {
    fields: [s.notifications.actorId],
    references: [s.users.id],
  }),
}));

export const badgesRelations = relations(s.badges, ({ many }) => ({
  userBadges: many(s.userBadges),
  history: many(s.badgeHistory),
}));

export const userBadgesRelations = relations(s.userBadges, ({ one }) => ({
  user: one(s.users, {
    fields: [s.userBadges.userId],
    references: [s.users.id],
  }),
  badge: one(s.badges, {
    fields: [s.userBadges.badgeId],
    references: [s.badges.id],
  }),
  grantor: one(s.users, {
    fields: [s.userBadges.grantedBy],
    references: [s.users.id],
  }),
}));

export const badgeHistoryRelations = relations(s.badgeHistory, ({ one }) => ({
  user: one(s.users, {
    fields: [s.badgeHistory.userId],
    references: [s.users.id],
  }),
  badge: one(s.badges, {
    fields: [s.badgeHistory.badgeId],
    references: [s.badges.id],
  }),
  actor: one(s.users, {
    fields: [s.badgeHistory.performedBy],
    references: [s.users.id],
  }),
}));

export const serverEventsRelations = relations(s.serverEvents, ({ one }) => ({
  server: one(s.servers, {
    fields: [s.serverEvents.serverId],
    references: [s.servers.id],
  }),
  channel: one(s.channels, {
    fields: [s.serverEvents.channelId],
    references: [s.channels.id],
  }),
  createdBy: one(s.users, {
    fields: [s.serverEvents.createdByUserId],
    references: [s.users.id],
  }),
}));

export const threadsRelations = relations(s.threads, ({ many, one }) => ({
  channel: one(s.channels, {
    fields: [s.threads.channelId],
    references: [s.channels.id],
  }),
  createdBy: one(s.users, {
    fields: [s.threads.createdById],
    references: [s.users.id],
  }),
  messages: many(s.messages),
}));

export const accountSessionsRelations = relations(s.accountSessions, ({ one }) => ({
  user: one(s.users, {
    fields: [s.accountSessions.userId],
    references: [s.users.id],
  }),
}));
