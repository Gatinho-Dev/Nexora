export type * from "../db/schema";
export * from "./errors";
import type { GroupRole, Permission, UserStatus } from "./constants";

// ── Public user representation (safe to expose) ───────────────
export type PublicUser = {
  id: number;
  username: string | null;
  name: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  status: string;
};

// ── Composite DTOs ────────────────────────────────────────────
export type ModerationStatus =
  | "processing"
  | "approved"
  | "sensitive"
  | "blocked"
  | "review_required";

export type AttachmentDTO = {
  id: number;
  fileId: number;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  spoiler: boolean;
  moderationStatus: ModerationStatus;
  sensitive: boolean;
  adultOnly: boolean;
  allowReveal: boolean;
};

export type AccountStatusDTO =
  | "good_standing"
  | "limited"
  | "very_limited"
  | "at_risk"
  | "suspended"
  | "permanently_banned";

export type SafetyViolationDTO = {
  id: number;
  category: string;
  severity: "warning" | "moderate" | "severe";
  source: "automatic_ai" | "moderator" | "user_report";
  status: "pending_review" | "confirmed" | "false_positive" | "resolved";
  action:
    | "none"
    | "warning"
    | "limited"
    | "content_blocked"
    | "three_day_suspension"
    | "temporary_suspension"
    | "permanent_ban";
  strikeApplied: boolean;
  internalNote?: string | null;
  createdAt: string | Date;
  reviewedAt?: string | Date | null;
};

export type AccountSafetyDTO = {
  accountStatus: AccountStatusDTO;
  severeStrikes: number;
  maxSevereStrikes: number;
  suspendedUntil: string | Date | null;
  permanentBan: boolean;
  sensitiveMediaPref: "hide" | "warn" | "auto";
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
  threadId?: number | null;
  threadReplyCount?: number | null;
  tag?: string | null;
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
  poll?: PollDTO | null;
  embeds?: MessageEmbedDTO[];
};

export type MessageEmbedDTO = {
  id: number;
  messageId: number;
  url: string;
  provider: string;
  type: string;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorUrl: string | null;
  providerName: string | null;
  thumbnailUrl: string | null;
  playerUrl: string | null;
  videoId: string | null;
  status: "processing" | "ready" | "unsupported" | "failed";
};

export type ChannelDTO = {
  id: number;
  serverId: number;
  categoryId: number | null;
  name: string;
  type: "TEXT" | "VOICE" | "ANNOUNCEMENT" | "FORUM" | "STAGE" | "MEDIA";
  position: number;
  topic?: string | null;
  syncedWithCategory?: boolean;
  tags?: string[] | null;
  forcedTags?: boolean;
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
  bannerUrl?: string | null;
  vanitySlug?: string | null;
  description: string | null;
  ownerId: number;
  createdAt: string | Date;
};

export type ServerDetailsDTO = {
  server: ServerDTO;
  channels: ChannelDTO[];
  categories: CategoryDTO[];
  members: MemberDTO[];
  /** True quando o servidor tem mais de 1000 membros e a lista foi cortada. */
  membersTruncated?: boolean;
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
  /** True when the other person is not a friend and I never replied. */
  isRequest?: boolean;
  // ── Group conversations ─────────────────────────────────────
  name?: string | null;
  avatarUrl?: string | null;
  description?: string | null;
  ownerId?: number | null;
  memberCount?: number;
  myRole?: GroupRole | null;
  updatedAt?: string | Date;
  /** Minha configuração de notificação neste grupo. */
  notificationLevel?: "all" | "mentions" | "muted";
  mutedUntil?: string | Date | null;
};

export type GroupMemberDTO = {
  user: PublicUser;
  role: GroupRole;
  joinedAt: string | Date;
};

export type GroupInviteDTO = {
  id: number;
  code?: string;
  url?: string;
  createdByUserId: number;
  expiresAt: string | Date | null;
  maxUses: number | null;
  uses: number;
  revokedAt: string | Date | null;
  createdAt: string | Date;
};

export type PinnedMessageDTO = {
  messageId: number;
  pinnedByUserId: number;
  createdAt: string | Date;
  message: MessageDTO | null;
};

export type ServerEventDTO = {
  id: number;
  serverId: number;
  channelId: number | null;
  name: string;
  description: string | null;
  startsAt: string | Date;
  endsAt: string | Date | null;
  status: "SCHEDULED" | "ACTIVE" | "CANCELLED";
  createdByUserId: number;
  interestedUserIds?: number[];
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

export type OfficialAnnouncementKind =
  | "GENERAL"
  | "UPDATE"
  | "SECURITY"
  | "MAINTENANCE";

export type OfficialAnnouncementType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "MAINTENANCE"
  | "ANNOUNCEMENT";

export type OfficialAnnouncementDTO = {
  id: number;
  title: string;
  content: string;
  /** MARKDOWN | PLAIN_TEXT — antigas sem valor = PLAIN_TEXT. */
  contentFormat: "MARKDOWN" | "PLAIN_TEXT";
  kind: OfficialAnnouncementKind;
  type: OfficialAnnouncementType;
  buttonLabel: string | null;
  buttonUrl: string | null;
  startsAt: string | Date | null;
  expiresAt: string | Date | null;
  dismissible: boolean;
  clicks: number;
  publishedAt: string | Date;
  isActive: boolean;
  isRead: boolean;
  readAt: string | Date | null;
  sender: {
    id: "nexora-official";
    name: "Nexora";
    verified: true;
    official: true;
    avatarUrl: string;
  };
};

export type PollDTO = {
  id: number;
  messageId: number;
  question: string;
  allowMultiple: boolean;
  expiresAt: string | Date | null;
  closedAt: string | Date | null;
  answers: { id: number; text: string; votes: number }[];
  totalVotes: number;
  /** Votos do usuário visualizador (vazio para perfis anônimos). */
  myAnswerIds: number[];
};

export type BadgeRarity =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY"
  | "EXCLUSIVE";

export type BadgeDTO = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  /** Arquivo /badges/{icon}.svg */
  icon: string;
  category: string;
  rarity: BadgeRarity;
  grantType: string;
  permanent: boolean;
  visible: boolean;
  canHide: boolean;
  displayOrder: number;
  restricted: boolean;
};

export type UserBadgeDTO = BadgeDTO & {
  grantedAt: string | Date;
  grantSource: string;
  expiresAt: string | Date | null;
};

export type AdminAuditLogDTO = {
  id: number;
  actorUserId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  targetUserId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
  actor: PublicUser | null;
};

export type VoiceParticipant = {
  userId: number;
  name: string;
  avatar: string | null;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screen: boolean;
  /** Stage channels only: false = audience (listen-only). */
  speaker?: boolean;
};

// ── WebSocket protocol ────────────────────────────────────────
// Client → Server
export type WSClientEvent =
  | { t: "ping" }
  | { t: "typing"; channelId?: number; conversationId?: number }
  | { t: "presence"; status: UserStatus }
  | { t: "group:update"; conversationId: number }
  | { t: "stage:hand"; channelId?: number; raised: boolean }
  | { t: "voice:join"; channelId?: number; conversationId?: number }
  | { t: "voice:leave"; voiceSessionId?: string }
  | {
      t: "voice:state";
      muted?: boolean;
      deafened?: boolean;
      camera?: boolean;
      screen?: boolean;
      voiceSessionId?: string;
    }
  | {
      t: "signal";
      to: number;
      channelId?: number;
      conversationId?: number;
      voiceSessionId?: string;
      data: unknown;
    };

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
  | {
      t: "voice:ready";
      channelId?: number;
      conversationId?: number;
      voiceSessionId: string;
    }
  | {
      t: "voice:denied";
      channelId?: number;
      conversationId?: number;
      reason: string;
    }
  | {
      t: "signal";
      from: number;
      channelId?: number;
      conversationId?: number;
      data: unknown;
    }
  | { t: "notification"; notification: NotificationDTO }
  | { t: "official:announcement"; announcement: OfficialAnnouncementDTO }
  | {
      t: "poll:update";
      messageId: number;
      channelId?: number;
      conversationId?: number;
      poll: PollDTO;
    }
  | { t: "server:refresh"; serverId: number }
  | { t: "events:refresh"; serverId: number }
  | { t: "stage:hands"; channelId?: number; userIds: number[] }
  | { t: "group:update"; conversationId: number }
  | { t: "dm:refresh" }
  | { t: "friends:refresh" };
