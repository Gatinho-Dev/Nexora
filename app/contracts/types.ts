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
  customStatus: string | null;
  profileTheme: string;
  profileAccent: string;
  nameFont: string;
  nameEffect: string;
  nameColorA: string;
  nameColorB: string;
  avatarDecoration: string;
  profileEffect: string;
  profileGames: ProfileGame[];
  profileWishlist: ProfileGame[];
  profileWidgets: string[];
  favoriteGameId: string | null;
  favoriteGameNote: string | null;
  status: string;
  createdAt: string | Date;
};

export type ProfileGame = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

export type IntegrationProviderId =
  "spotify" | "youtube" | "twitch" | "github" | "roblox";

export type RichPresenceActivityDTO = {
  id: string;
  provider: IntegrationProviderId | "nexora";
  type: "music" | "gaming" | "streaming" | "watching" | "coding" | "activity";
  title: string;
  details?: string | null;
  state?: string | null;
  largeImageUrl?: string | null;
  largeImageText?: string | null;
  smallImageUrl?: string | null;
  smallImageText?: string | null;
  startedAt?: string | Date | null;
  endsAt?: string | Date | null;
  externalUrl?: string | null;
  isLive?: boolean;
  updatedAt: string | Date;
};

// ── Composite DTOs ────────────────────────────────────────────
export type ModerationStatus =
  "processing" | "approved" | "sensitive" | "blocked" | "review_required";

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
  source: "automatic_ai" | "moderator" | "user_report" | "automod";
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
  targetType?: string | null;
  messageId?: number | null;
  publicReason?: string | null;
  affectedContentCount?: number;
  suspensionDays?: number | null;
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
  hoistMembers?: boolean;
  mentionable?: boolean;
};

export type MemberDTO = {
  user: PublicUser;
  nickname: string | null;
  joinedAt: string | Date;
  roles: RoleDTO[];
  isOwner: boolean;
  timeoutUntil?: string | Date | null;
  lastActiveAt?: string | Date | null;
};

export type ServerDTO = {
  id: number;
  name: string;
  iconUrl: string | null;
  bannerUrl?: string | null;
  /** Parceria oficial persistida no servidor. */
  partnered: boolean;
  /** Badges reais derivados de features persistidas do servidor. */
  badges?: ServerBadgeType[];
  vanitySlug?: string | null;
  description: string | null;
  tags?: string[];
  verificationLevel?: "none" | "low" | "medium" | "high" | "maximum";
  defaultNotifications?: "all" | "mentions";
  invitesPaused?: boolean;
  rulesEnabled?: boolean;
  rules?: string[];
  communityEnabled?: boolean;
  publicDiscovery?: boolean;
  isFeatured?: boolean;
  discoveryCategoryId?: number | null;
  ownerId: number;
  /** Permissões efetivas do usuário atual, presentes nos resumos da rail. */
  myPermissions?: Permission[];
  /** Resumo de voz já filtrado por canais que o usuário pode visualizar. */
  activeVoiceCount?: number;
  voicePreviewMembers?: VoicePreviewMember[];
  createdAt: string | Date;
};

export type ServerBadgeType = "partner";

export type DiscoveryCategoryDTO = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  position: number;
};

export type ServerDiscoveryDTO = {
  id: number;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  tags: string[];
  category: DiscoveryCategoryDTO | null;
  memberCount: number;
  messageCount: number;
  activeMemberCount7d: number;
  lastActivityAt: string | Date | null;
  partnered: boolean;
  isFeatured: boolean;
  createdAt: string | Date;
  isMember: boolean;
  canJoin: boolean;
  requiresRules: boolean;
  rulesEnabled: boolean;
  rules: string[];
};

export type ServerDiscoveryPage = {
  items: ServerDiscoveryDTO[];
  nextCursor: number | null;
};

export type AdminPartnerServerDTO = {
  id: number;
  name: string;
  iconUrl: string | null;
  ownerId: number;
  ownerName: string | null;
  ownerUsername: string | null;
  memberCount: number;
  partnered: boolean;
  publicDiscovery: boolean;
  isFeatured: boolean;
  createdAt: string | Date;
};

export type VoicePreviewMember = {
  userId: number;
  name: string;
  avatar: string | null;
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
  /** First message that is still unread for the current account. */
  firstUnreadMessageId?: number | null;
  /** True when the other person is not a friend and I never replied. */
  isRequest?: boolean;
  /** Message requests explicitly classified as possible spam. */
  isSpam?: boolean;
  /** Per-account inbox organization. */
  pinnedAt?: string | Date | null;
  hiddenAt?: string | Date | null;
  mutedForever?: boolean;
  privateNote?: string | null;
  friendNickname?: string | null;
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
  "GENERAL" | "UPDATE" | "SECURITY" | "MAINTENANCE";

export type OfficialAnnouncementType =
  "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "MAINTENANCE" | "ANNOUNCEMENT";

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
  "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "EXCLUSIVE";

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

export type CompanionControlAction =
  | "toggle-mute"
  | "toggle-deafen"
  | "toggle-camera"
  | "toggle-screen"
  | "leave-call"
  /** Câmera do celular ligada (envia vídeo de novo). */
  | "camera-on"
  /** Câmera do celular desligada (PC volta a mostrar sem vídeo). */
  | "camera-off"
  /** Microfone do celular ligado. */
  | "mic-on"
  /** Microfone do celular desligado (silêncio enviado). */
  | "mic-off"
  /** Celular pede para se desconectar (não encerra a chamada). */
  | "disconnect";

export type CompanionStatus = "pending" | "paired" | "video-ready" | "disconnected";

export type CompanionSessionPublic = {
  id: string;
  ownerUserId: number;
  status: CompanionStatus;
  cameraActive: boolean;
  muted: boolean;
  deafened: boolean;
  screenActive: boolean;
  participantsCount: number;
  createdAt: string;
};

export type WSPublicClientEvent =
  | { t: "pair"; code: string }
  | { t: "companion:ready"; code: string }
  | { t: "companion:signal"; code: string; data: unknown }
  | { t: "companion:control"; code: string; action: CompanionControlAction };

export type WSPublicServerEvent =
  | { t: "paired"; code: string; session: CompanionSessionPublic }
  | { t: "companion:state"; code: string; session: CompanionSessionPublic }
  | { t: "companion:signal"; code: string; data: unknown }
  | { t: "companion:error"; code: string; message: string }
  /** Pareamento válido, aguardando o dono aprovar no computador. */
  | { t: "companion:pending"; code: string };

// ── Segurança: denúncias / apelações / casos ──────────────────
export type ReportTargetType =
  "message" | "user" | "media" | "server" | "channel";

export type ReportDTO = {
  id: number;
  targetType: ReportTargetType;
  targetId: number;
  category: string;
  status:
    | "submitted"
    | "triaged"
    | "under_review"
    | "action_taken"
    | "no_violation"
    | "closed";
  priority: "low" | "normal" | "high" | "critical";
  createdAt: string | Date;
  reviewedAt?: string | Date | null;
};

export type AppealDTO = {
  id: number;
  violationId: number;
  status: "submitted" | "under_review" | "approved" | "denied";
  reason: string | null;
  createdAt: string | Date;
  reviewedAt?: string | Date | null;
  reviewNote?: string | null;
  violationCategory?: string | null;
  violationAction?: string | null;
};

export type ModerationCaseDTO = {
  id: number;
  targetType: string;
  targetId: number | null;
  reportedUserId: number | null;
  reportedUser?: {
    id: number;
    username: string | null;
    name: string | null;
    avatar: string | null;
  } | null;
  category: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "open" | "under_review" | "confirmed" | "false_positive" | "closed";
  reportsCount: number;
  linkedViolationId: number | null;
  assignedModeratorId: number | null;
  aiAssessment?: Record<string, unknown> | null;
  internalContext?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type AccountSessionDTO = {
  id: string;
  friendlyName: string;
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  ipAddress: string | null;
  createdAt: string | Date;
  lastSeenAt: string | Date;
  /** True para a sessão que fez esta requisição. */
  isCurrent?: boolean;
};

export type SafetyAiStatusDTO = {
  provider: string;
  model: string;
  visionModel: string;
  policyVersion: string;
  shadowMode: boolean;
  aiEnabled: boolean;
  textModerationEnabled: boolean;
  imageModerationEnabled: boolean;
  requestsTotal: number;
  flaggedTotal: number;
  rateLimited: number;
  timeouts: number;
  errorsTotal: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  averageLatencyMs: number;
  queueDepth: number;
  breakerOpen: boolean;
  killSwitch: boolean;
};

// ── WebSocket protocol ────────────────────────────────────────
// Client → Server
/**
 * Atividade publicada pelo player em `/cider`.
 *
 * O Cider é a única origem de atividade que **não** vem de OAuth: a página já
 * está autenticada pela sessão e empurra a faixa quando ela muda. `activity`
 * com `title: null` significa "parei de ouvir" e limpa o registro.
 */
export type CiderActivityPayload = {
  title: string | null;
  details?: string | null;
  state?: string | null;
  largeImageUrl?: string | null;
  largeImageText?: string | null;
  smallImageUrl?: string | null;
  smallImageText?: string | null;
  /** Epoch ms. `startedAt`/`endsAt` desenham a barra de progresso. */
  startedAt?: number | null;
  endsAt?: number | null;
  externalUrl?: string | null;
};

// ── Cider: sessão de escuta compartilhada ("Ouvir junto") ─────
/**
 * Faixa no formato que a sessão de escuta troca.
 *
 * É um recorte deliberado do `CiderTrack` da interface: só o que o convidado
 * precisa para **reproduzir e desenhar** a faixa. Nome de canal do YouTube,
 * pontuação de busca e preferências ficam de fora — nada disso é compartilhado.
 */
export type CiderListenTrack = {
  videoId: string;
  title: string;
  artist?: string | null;
  channelName?: string | null;
  artworkUrl?: string | null;
  durationMs?: number;
  url?: string | null;
};

export type CiderListenRole = "host" | "guest";

export type CiderListenMember = {
  userId: number;
  name: string;
  avatar?: string | null;
  role: CiderListenRole;
};

/**
 * O que o anfitrião publica — e o que o convidado usa para se alinhar.
 *
 * `positionMs` é a posição no momento do envio. Não há campo de horário aqui:
 * quem recebe mede o próprio tempo de viagem (`receivedAt` local) em vez de
 * comparar relógios, que é a única conta que não depende de os dois lados
 * estarem com o horário certo.
 */
export type CiderListenState = {
  track: CiderListenTrack | null;
  playing: boolean;
  positionMs: number;
  index: number;
  queue: CiderListenTrack[];
};

/**
 * Pedidos que um convidado manda ao anfitrião.
 *
 * O convidado **não** comanda o próprio player: ele pede. Sem isso, apertar
 * "próxima" na tela do convidado só o afastaria do grupo — o anfitrião é quem
 * tem a fila verdadeira, então "pular", "voltar", "pausar" e "buscar posição"
 * passam por ele.
 */
export type CiderListenRequestKind = "next" | "previous" | "toggle" | "seek";

export type WSClientEvent =
  | { t: "ping" }
  | { t: "typing"; channelId?: number; conversationId?: number }
  | { t: "presence"; status: UserStatus }
  | { t: "cider:now-playing"; activity: CiderActivityPayload }
  /** Abre uma sessão de escuta compartilhada e vira o anfitrião. */
  | { t: "cider:listen:start" }
  | { t: "cider:listen:join"; code: string }
  /**
   * Volta para uma sessão conhecida (recarregamento, reconexão).
   *
   * `token` é o segredo que o servidor entregou a **este** membro quando ele
   * entrou: sem ele, qualquer um que soubesse o código poderia retomar a vaga
   * de outra pessoa — inclusive a do anfitrião, que manda na fila.
   */
  | { t: "cider:listen:resume"; code: string; token: string }
  | { t: "cider:listen:leave" }
  /** O anfitrião encerra a sessão para todos. */
  | { t: "cider:listen:end" }
  | { t: "cider:listen:state"; state: CiderListenState }
  | { t: "cider:listen:react"; emoji: string }
  | { t: "cider:listen:request"; kind: CiderListenRequestKind; positionMs?: number }
  /** Um convidado sugere uma faixa: quem decide o lugar na fila é o anfitrião. */
  | { t: "cider:listen:add"; track: CiderListenTrack }
  | { t: "cider:listen:invite"; toUserId: number }
  | { t: "group:update"; conversationId: number }
  | { t: "stage:hand"; channelId?: number; raised: boolean }
  | {
      t: "voice:join";
      channelId?: number;
      conversationId?: number;
      /** True only for the user gesture that starts a fresh DM call. */
      initiated?: boolean;
      video?: boolean;
    }
  | { t: "voice:leave"; voiceSessionId?: string }
  | { t: "call:decline"; conversationId: number }
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
    }
  | { t: "companion:start"; voiceSessionId?: string }
  | { t: "companion:signal"; sessionId: string; data: unknown }
  | { t: "companion:stop"; sessionId: string }
  /** Dono aprovou o pareamento solicitado pelo celular. */
  | { t: "companion:approve"; sessionId: string }
  /** Dono recusou o pareamento solicitado pelo celular. */
  | { t: "companion:reject"; sessionId: string };

/** Atividade de jogo (Roblox) transmitida em tempo real e retornada por query. */
export type RobloxActivityDTO = {
  status?: string;
  name: string | null;
  creatorName: string | null;
  thumbnailUrl: string | null;
  startedAt: string | Date | null;
  universeId?: number | null;
  placeId?: number | null;
  playUrl: string | null;
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
      serverId?: number;
      participants: VoiceParticipant[];
      activeVoiceCount?: number;
      voicePreviewMembers?: VoicePreviewMember[];
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
      t: "call:state";
      conversationId: number;
      callId: string;
      state: "ringing" | "connected" | "ended";
      startedAt: string;
      unansweredDeadline?: string;
      video: boolean;
      initiatorId: number;
      reason?: "unanswered" | "declined" | "cancelled" | "completed";
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
      t: "companion:session";
      sessionId: string;
      code: string;
    }
  | { t: "companion:paired"; sessionId: string }
  | {
      t: "companion:control";
      sessionId: string;
      action: CompanionControlAction;
    }
  | {
      t: "companion:state";
      sessionId: string;
      session: CompanionSessionPublic;
    }
  | {
      t: "companion:signal";
      sessionId: string;
      data: unknown;
    }
  | { t: "companion:disconnected"; sessionId: string }
  /** Um celular está tentando parear — o dono precisa aprovar. */
  | { t: "companion:request"; sessionId: string }
  | {
      t: "poll:update";
      messageId: number;
      channelId?: number;
      conversationId?: number;
      poll: PollDTO;
    }
  | { t: "server:refresh"; serverId: number }
  | { t: "discovery:refresh" }
  | { t: "pins:refresh"; serverId?: number; channelId?: number }
  | {
      t: "preferences:refresh";
      userId?: number;
      serverId?: number;
      scope?: string;
    }
  | { t: "forum:refresh"; serverId?: number; channelId?: number }
  | {
      t: "stage:refresh";
      serverId?: number;
      channelId?: number;
      sessionId?: number | null;
    }
  | {
      t: "stage:request";
      serverId?: number;
      channelId?: number;
      userId?: number;
    }
  | {
      t: "stage:moderation";
      serverId?: number;
      channelId?: number;
      action?: string;
    }
  | { t: "onboarding:refresh"; serverId?: number }
  | { t: "soundboard:refresh"; serverId?: number; channelId?: number }
  | {
      t: "soundboard:play";
      serverId?: number;
      channelId?: number;
      soundId?: number;
      userId?: number;
      url?: string;
      volume?: number;
    }
  | {
      t: "voice:priority";
      serverId?: number;
      channelId?: number;
      userId?: number;
      priority?: number;
      enabled?: boolean;
      attenuation?: number;
    }
  | { t: "support:refresh"; userId?: number; ticketId?: number }
  | { t: "events:refresh"; serverId: number }
  | { t: "pins:refresh"; channelId: number }
  | {
      t: "preferences:refresh";
      scope:
        | "profile"
        | "favorites"
        | "server-folders"
        | "server-order"
        | "user"
        | "audio-clips";
    }
  | { t: "forum:refresh"; channelId: number }
  | { t: "stage:refresh"; channelId: number }
  | { t: "stage:request"; channelId: number; userId: number }
  | {
      t: "stage:moderation";
      channelId: number;
      action: "accept" | "reject" | "audience" | "mute" | "remove";
    }
  | { t: "onboarding:refresh"; serverId: number }
  | { t: "soundboard:refresh"; serverId: number }
  | {
      t: "soundboard:play";
      channelId: number;
      soundId: number;
      userId: number;
      url: string;
      volume: number;
    }
  | { t: "support:refresh" }
  | {
      t: "voice:priority";
      serverId: number;
      userId: number;
      enabled: boolean;
      attenuation: number;
    }
  | { t: "stage:hands"; channelId?: number; userIds: number[] }
  | { t: "group:update"; conversationId: number }
  | { t: "dm:refresh" }
  | {
      t: "read:update";
      userId: number;
      lastMessageId: number;
      channelId?: number;
      conversationId?: number;
    }
  | { t: "friends:refresh" }
  | { t: "session:revoked" }
  | {
      t: "activity:update";
      userId: number;
      activity: RobloxActivityDTO | null;
    }
  | {
      t: "rich-presence:update";
      userId: number;
      activities: RichPresenceActivityDTO[];
    }
  /**
   * Resposta a `cider:listen:start`/`join`: dá ao cliente o código, o próprio
   * membro (para ele não precisar saber seu id), o anfitrião, a lista completa
   * e — no caso do convidado — o estado atual, para ele já entrar alinhado.
   */
  | {
      t: "cider:listen:session";
      code: string;
      me: CiderListenMember;
      hostId: number;
      members: CiderListenMember[];
      state: CiderListenState | null;
      /** Segredo de retomada do próprio dono (nunca o de outro membro). */
      token: string;
    }
  /**
   * O anfitrião saiu (`present: false`) ou voltou (`present: true`).
   *
   * Enquanto ele está ausente a sessão existe: os convidados continuam juntos,
   * mas o estado não avança — e é melhor dizer isso do que deixá-los seguindo
   * um player que não está mais lá.
   */
  | { t: "cider:listen:host-presence"; code: string; present: boolean }
  | { t: "cider:listen:members"; code: string; members: CiderListenMember[] }
  | { t: "cider:listen:sync"; code: string; state: CiderListenState }
  | {
      t: "cider:listen:reaction";
      code: string;
      from: number;
      name: string;
      emoji: string;
    }
  | {
      t: "cider:listen:request";
      code: string;
      from: number;
      name: string;
      kind: CiderListenRequestKind;
      positionMs?: number;
    }
  | {
      t: "cider:listen:add";
      code: string;
      from: number;
      name: string;
      track: CiderListenTrack;
    }
  | { t: "cider:listen:ended"; code: string; reason: "host-left" | "closed" }
  | { t: "cider:listen:invited"; code: string; from: CiderListenMember }
  | { t: "cider:listen:denied"; reason: string }
  | {
      t: "account:restriction_updated";
      accountStatus:
        | "good_standing"
        | "limited"
        | "very_limited"
        | "at_risk"
        | "suspended"
        | "permanently_banned";
      severeStrikes: number;
      maxSevereStrikes: number;
      suspendedUntil: Date | string | null;
      permanentBan: boolean;
    };
