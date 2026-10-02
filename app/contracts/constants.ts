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
  // ── Permissões de recursos avançados ─────────────────────────
  "MANAGE_FORUMS",
  "MANAGE_EVENTS",
  "MANAGE_STAGE",
  "MANAGE_COMMUNITY",
  "MANAGE_ONBOARDING",
  "MANAGE_SOUNDBOARD",
  "VIEW_SERVER_INSIGHTS",
  "PIN_MESSAGES",
  "BYPASS_SLOWMODE",
  "REQUEST_TO_SPEAK",
  "PRIORITY_SPEAKER",
  "USE_SOUNDBOARD",
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
  "PIN_MESSAGES",
  "BYPASS_SLOWMODE",
];

// ── Rate limits (easy to tweak) ───────────────────────────────
export const RateLimits = {
  message: { limit: 5, windowMs: 5_000 },
  serverCreate: { limit: 5, windowMs: 60 * 60_000 },
  serverDiscovery: { limit: 60, windowMs: 60_000 },
  serverJoin: { limit: 20, windowMs: 60_000 },
  inviteCreate: { limit: 10, windowMs: 60 * 60_000 },
  friendRequest: { limit: 10, windowMs: 60_000 },
  upload: { limit: 10, windowMs: 60_000 },
  reaction: { limit: 20, windowMs: 10_000 },
  groupCreate: { limit: 4, windowMs: 60 * 60_000 },
  groupInviteCreate: { limit: 10, windowMs: 60 * 60_000 },
  groupMemberChange: { limit: 30, windowMs: 60_000 },
  /** Desafios de segurança: 2FA, passkeys e QR de login. */
  securityChallenge: { limit: 10, windowMs: 60_000 },
  /** Abertura de tickets de suporte. */
  ticketCreate: { limit: 5, windowMs: 15 * 60_000 },
  /** Busca global de mensagens. */
  search: { limit: 20, windowMs: 60_000 },
  /** Criação/edição de mensagens agendadas. */
  scheduledMessage: { limit: 10, windowMs: 60_000 },
  /** Reprodução de sons do Soundboard. */
  soundboardPlay: { limit: 30, windowMs: 60_000 },
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

// ── Cider: sessão de escuta compartilhada ("Ouvir junto") ─────
/**
 * Números de "Ouvir junto" num lugar só, porque os dois lados precisam dos
 * mesmos valores: o servidor recusa o que passa do teto e o cliente desenha o
 * que cabe. Duplicar o 12 num arquivo e o 12 noutro seria pedir divergência.
 */
export const CiderListen = {
  /** Comprimento do código da sessão. */
  CODE_LENGTH: 6,
  /**
   * Alfabeto do código **sem** letras/dígitos que se confundem a olho nu
   * (0/O e 1/I/L): o código é lido em voz alta e digitado à mão.
   */
  CODE_ALPHABET: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  /** Teto de participantes, anfitrião incluso. */
  MAX_MEMBERS: 12,
  /** Teto do trecho de fila que acompanha o estado do anfitrião. */
  MAX_QUEUE: 50,
  /** Teto do título/artista que entra no estado (texto de terceiros). */
  MAX_TEXT: 200,
  /** Intervalo mínimo entre reações do mesmo usuário. */
  REACT_INTERVAL_MS: 600,
  /**
   * Intervalo mínimo entre publicações de estado do anfitrião. O cliente
   * publica no máximo a cada `minMs` (com publicação final garantida), então
   * este número é a defesa do servidor contra um cliente hostil — não um
   * relógio que a interface precise respeitar.
   */
  STATE_INTERVAL_MS: 600,
  /**
   * Banda de tolerância do convidado. Dentro dela, dois players tocando a mesma
   * faixa estão "juntos" e corrigir a posição a cada segundo só faria o áudio
   * engasgar; fora dela, o convidado busca a posição do anfitrião.
   */
  DRIFT_TOLERANCE_MS: 3_000,
  /** Quanto tempo uma reação vive na tela, em ms. */
  REACTION_LIFETIME_MS: 2_600,
  /** Reações simultâneas na tela (as mais antigas saem primeiro). */
  MAX_FLOATING_REACTIONS: 14,
} as const;

/**
 * Reações aceitas na sessão de escuta.
 *
 * É uma lista fechada, e não "qualquer emoji": o servidor recusa o que não
 * está aqui, e uma lista aberta deixaria um cliente autenticado animar texto
 * arbitrário sobre a capa de todo mundo. São os gestos de quem está ouvindo
 * junto, não um teclado de emojis.
 */
export const CIDER_LISTEN_EMOJIS = ["❤️", "🔥", "😂", "😮", "👏", "🎉", "🥲", "💜"] as const;
export type CiderListenEmoji = (typeof CIDER_LISTEN_EMOJIS)[number];

// ── User status ───────────────────────────────────────────────
export const USER_STATUSES = ["online", "idle", "dnd", "invisible"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
