/**
 * Contratos do Nexora Live — salas temporárias sem cadastro.
 *
 * Compartilhado entre o gateway WebSocket (`/ws/live`), as rotas REST
 * (`/api/live/*`) e o frontend. Tudo aqui é puro (sem Node/DOM) para os dois
 * lados importarem o mesmo conjunto de tipos, limites e validações.
 */

// ── Limites centralizados (fonte única de verdade) ────────────
export const LIVE_NICK_MIN = 2;
export const LIVE_NICK_MAX = 24;
export const LIVE_ROOM_CODE_LENGTH = 6;
/** Sem glifos ambíguos (0/O, 1/I/L) — mesmo alfabeto dos códigos companion. */
export const LIVE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LIVE_CHAT_MAX_LENGTH = 500;
export const LIVE_CHAT_HISTORY_LIMIT = 100;
/** Nome opcional escolhido pelo criador no momento da criação. */
export const LIVE_ROOM_NAME_MAX = 40;
export const LIVE_MAX_PARTICIPANTS_DEFAULT = 8;
/** Teto absoluto aceito via env LIVE_MAX_PARTICIPANTS. */
export const LIVE_MAX_PARTICIPANTS_CEILING = 16;
/** Sala vazia expira depois deste tempo (ninguém na chamada). */
export const LIVE_EMPTY_ROOM_TTL_MS = 60_000;
/** Idade máxima absoluta de uma sala (independe de atividade). */
export const LIVE_ROOM_MAX_AGE_MS = 12 * 60 * 60_000;
/** Graça para reconexão antes de remover participante fantasma. */
export const LIVE_RECONNECT_GRACE_MS = 15_000;
/** Atualizações de lastActivityAt no MySQL no máximo a cada 30s. */
export const LIVE_ACTIVITY_TOUCH_MS = 30_000;

/** Rate limits do Nexora Live (aplicados no servidor). */
export const LIVE_RATE_LIMITS = {
  createRoom: { limit: 8, windowMs: 60 * 60_000 },
  checkRoom: { limit: 60, windowMs: 60_000 },
  join: { limit: 30, windowMs: 10 * 60_000 },
  chat: { limit: 5, windowMs: 5_000 },
  signal: { limit: 90, windowMs: 10_000 },
  state: { limit: 30, windowMs: 10_000 },
} as const;

// ── Tipos de domínio ─────────────────────────────────────────
export type LiveParticipant = {
  sessionId: string;
  nickname: string;
  isHost: boolean;
  muted: boolean;
  camera: boolean;
  screen: boolean;
};

export type LiveChatMessage = {
  id: string;
  sessionId: string;
  nickname: string;
  content: string;
  /** ISO 8601. */
  createdAt: string;
};

export type LiveDenyReason =
  | "room-unavailable"
  | "room-full"
  | "nick-taken"
  | "nick-invalid"
  | "rate-limited";

export type LiveJoinPayload = {
  roomCode: string;
  /** Nome definido pelo criador (null quando não escolhido). */
  roomName: string | null;
  hostSessionId: string | null;
  maxParticipants: number;
  /** Credencial secreta desta sessão — enviada apenas para o próprio socket. */
  sessionToken: string;
  you: LiveParticipant;
  participants: LiveParticipant[];
  chat: LiveChatMessage[];
};

// ── Protocolo WebSocket (/ws/live) ───────────────────────────
export type WSLiveClientEvent =
  | {
      t: "live:join";
      code: string;
      /** Gerado pelo cliente e mantido por aba (sessionStorage) para religar. */
      sessionId: string;
      nickname: string;
      /** Segredo emitido no primeiro join; comprova a posse da sessão. */
      sessionToken?: string;
      hostToken?: string;
    }
  | { t: "live:signal"; to: string; data: unknown }
  | { t: "live:chat"; content: string }
  | { t: "live:state"; muted?: boolean; camera?: boolean; screen?: boolean }
  | { t: "live:kick"; sessionId: string }
  | { t: "live:end" }
  | { t: "live:leave" }
  | { t: "ping" };

export type WSLiveServerEvent =
  | { t: "live:joined"; payload: LiveJoinPayload }
  | {
      t: "live:participants";
      participants: LiveParticipant[];
      hostSessionId: string | null;
    }
  | { t: "live:signal"; from: string; data: unknown }
  | { t: "live:chat"; message: LiveChatMessage }
  | { t: "live:host"; hostSessionId: string }
  | { t: "live:kicked" }
  | { t: "live:ended" }
  | { t: "live:denied"; reason: LiveDenyReason; message: string }
  | { t: "pong" };

// ── Helpers de nick (compartilhados cliente/servidor) ────────
// Caracteres de controle/invisíveis (unicode escapes evitam no-control-regex).
// Caracteres de controle/invisíveis: C0/C1 controls + zero-width/bidi.
// Usa property escapes (\p{Cc}) e faixas unicode via \u{...} — sem literais de controle.
const NICK_INVISIBLE_CHARS = new RegExp(
  "[\\p{Cc}\\p{Cf}\\u2028\\u2029\\u202a-\\u202e]",
  "gu"
);

/**
 * Normaliza o nick: NFC, remove caracteres invisíveis/de controle, colapsa
 * espaços e descarta caracteres fora do conjunto permitido (letras, números,
 * espaço, ponto, hífen e underline). O resultado é seguro para renderizar e
 * para comparação de unicidade (após toLowerCase).
 */
export function sanitizeNickname(input: string): string {
  return input
    .normalize("NFC")
    .replace(NICK_INVISIBLE_CHARS, "")
    .replace(/[^\p{L}\p{N} _. -]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIVE_NICK_MAX);
}

export type NickValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateNickname(input: string): NickValidation {
  const value = sanitizeNickname(input);
  if (value.length < LIVE_NICK_MIN) {
    return {
      ok: false,
      error: `Escolha um nick com pelo menos ${LIVE_NICK_MIN} caracteres.`,
    };
  }
  if (value.length > LIVE_NICK_MAX) {
    return {
      ok: false,
      error: `Use no máximo ${LIVE_NICK_MAX} caracteres.`,
    };
  }
  // Períodos/hífens/underscores não podem dominar o nick nem sobrar nas pontas.
  if (/^[._-]+|[._-]+$/.test(value)) {
    return {
      ok: false,
      error: "O nick não pode começar nem terminar com pontuação.",
    };
  }
  if (/^(nexora|admin|moderador|sistema|suporte)([ _.-]|$)/i.test(value)) {
    return {
      ok: false,
      error: "Este nick é reservado. Escolha outro.",
    };
  }
  return { ok: true, value };
}

/** Chave de comparação para unicidade de nick dentro da sala. */
export function nicknameKey(nickname: string): string {
  return sanitizeNickname(nickname).toLowerCase();
}

// ── Helpers de nome da sala ─────────────────────────────────
/**
 * Normaliza o nome escolhido pelo criador: NFC, sem caracteres invisíveis,
 * sem tags HTML/JSX (<, >, &), colapsa espaços e corta no máximo. Diferente
 * do nick: aceita mais pontuação e permite string vazia (nome é opcional —
 * a sala cai para o padrão "Sala {código}").
 */
export function sanitizeRoomName(input: string): string {
  return input
    .normalize("NFC")
    .replace(NICK_INVISIBLE_CHARS, "")
    .replace(/[<>&]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIVE_ROOM_NAME_MAX);
}

export type RoomNameValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Valida o nome da sala. Entrada vazia é válida (sala sem nome) — devolve
 * `value: null` e a UI exibe o fallback "Sala {código}".
 */
export function validateRoomName(input: string): RoomNameValidation {
  const value = sanitizeRoomName(input);
  if (!value) return { ok: true, value: null };
  if (/^[._-]+$/.test(value)) {
    return {
      ok: false,
      error: "O nome da sala não pode conter só pontuação.",
    };}
  return { ok: true, value };
}

// ── Helpers de código de sala ────────────────────────────────
const ROOM_CODE_PATTERN = new RegExp(
  `^[${LIVE_CODE_ALPHABET}]{${LIVE_ROOM_CODE_LENGTH}}$`
);

/** Maiúsculas, sem separadores — aceita o código colado junto ao link. */
export function normalizeRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, LIVE_ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/** Extrai o código de um link completo ou devolve o próprio código. */
export function roomCodeFromShareInput(input: string): string {
  const match = input.trim().match(/\/live\/([a-zA-Z0-9-]+)/);
  return normalizeRoomCode(match ? match[1] : input);
}
