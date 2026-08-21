export type * from "../db/schema";
export * from "./errors";
import type { Permission, UserStatus } from "./constants";

// ── Public user representation (safe to expose) ───────────────
export type PublicUser = {
  id: number;
  username: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  status: string;
};

// ── Composite DTOs ────────────────────────────────────────────
export type AttachmentDTO = {
  id: number;
  fileId: number;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
};

export type ReactionDTO = {
  emoji: string;
  count: number;
  userIds: number[];
};

export type MessageDTO = {
  id: number;
  channelId: number | null;
  conversationId: number | null;
  authorId: number;
  content: string;
  replyToId: number | null;
  createdAt: string | Date;
  editedAt: string | Date | null;
  author: PublicUser;
  attachments: AttachmentDTO[];
  reactions: ReactionDTO[];
  replyTo?: {
    id: number;
    content: string;
    author: PublicUser;
  } | null;
};

export type ChannelDTO = {
  id: number;
  serverId: number;
  categoryId: number | null;
  name: string;
  type: "TEXT" | "VOICE" | "ANNOUNCEMENT" | "FORUM" | "STAGE";
  position: number;
};

export type CategoryDTO = {
  id: number;
  serverId: number;
  name: string;
  kind: "text" | "voice";
  position: number;
};

export type RoleDTO = {
  id: number;
  serverId: number;
  name: string;
  color: string;
  position: number;
  permissions: Permission[] | string[];
  isDefault: boolean;
};

export type MemberDTO = {
  user: PublicUser;
  nickname: string | null;
  joinedAt: string | Date;
  roles: RoleDTO[];
  isOwner: boolean;
};

export type ServerDTO = {
  id: number;
  name: string;
  iconUrl: string | null;
  description: string | null;
  ownerId: number;
  createdAt: string | Date;
};

export type ServerDetailsDTO = {
  server: ServerDTO;
  channels: ChannelDTO[];
  categories: CategoryDTO[];
  members: MemberDTO[];
  roles: RoleDTO[];
  myPermissions: Permission[];
};

export type FriendDTO = {
  friendshipId: number;
  user: PublicUser;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  direction: "incoming" | "outgoing" | "none";
};

export type ConversationDTO = {
  id: number;
  isGroup: boolean;
  members: PublicUser[];
  otherUser: PublicUser | null;
  lastMessage: {
    id: number;
    content: string;
    createdAt: string | Date;
    authorId: number;
  } | null;
  unreadCount: number;
};

export type NotificationDTO = {
  id: number;
  type: string;
  actor: PublicUser | null;
  serverId: number | null;
  channelId: number | null;
  conversationId: number | null;
  messageId: number | null;
  content: string | null;
  isRead: boolean;
  createdAt: string | Date;
};

export type VoiceParticipant = {
  userId: number;
  name: string;
  avatar: string | null;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screen: boolean;
};

// ── WebSocket protocol ────────────────────────────────────────
// Client → Server
export type WSClientEvent =
  | { t: "ping" }
  | { t: "typing"; channelId?: number; conversationId?: number }
  | { t: "presence"; status: UserStatus }
  | { t: "voice:join"; channelId?: number; conversationId?: number }
  | { t: "voice:leave" }
  | {
      t: "voice:state";
      muted?: boolean;
      deafened?: boolean;
      camera?: boolean;
      screen?: boolean;
    }
  | { t: "signal"; to: number; channelId?: number; conversationId?: number; data: unknown };

// Server → Client
export type WSServerEvent =
  | { t: "ready"; userId: number }
  | { t: "pong" }
  | { t: "message:new"; message: MessageDTO }
  | { t: "message:update"; message: MessageDTO }
  | {
      t: "message:delete";
      id: number;
      channelId: number | null;
      conversationId: number | null;
    }
  | {
      t: "reaction";
      messageId: number;
      channelId: number | null;
      conversationId: number | null;
      reactions: ReactionDTO[];
    }
  | {
      t: "typing";
      channelId?: number;
      conversationId?: number;
      user: PublicUser;
    }
  | { t: "presence"; userId: number; status: string }
  | {
      t: "voice:participants";
      channelId?: number;
      conversationId?: number;
      participants: VoiceParticipant[];
    }
  | { t: "signal"; from: number; channelId?: number; conversationId?: number; data: unknown }
  | { t: "notification"; notification: NotificationDTO }
  | { t: "server:refresh"; serverId: number }
  | { t: "dm:refresh" }
  | { t: "friends:refresh" };
