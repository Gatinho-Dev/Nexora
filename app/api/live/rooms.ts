import { timingSafeEqual } from "node:crypto";
import { and, eq, lt, or } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  LIVE_ACTIVITY_TOUCH_MS,
  LIVE_CHAT_HISTORY_LIMIT,
  LIVE_CODE_ALPHABET,
  LIVE_EMPTY_ROOM_TTL_MS,
  LIVE_MAX_PARTICIPANTS_CEILING,
  LIVE_MAX_PARTICIPANTS_DEFAULT,
  LIVE_RECONNECT_GRACE_MS,
  LIVE_ROOM_CODE_LENGTH,
  LIVE_ROOM_MAX_AGE_MS,
  nicknameKey,
  type LiveChatMessage,
  type LiveDenyReason,
  type LiveJoinPayload,
  type LiveParticipant,
} from "@contracts/live";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { rateLimit } from "../utils/rateLimit";

/**
 * Registro das salas do Nexora Live.
 *
 * O estado de participantes/chat vive SOMENTE em memória: salas são
 * temporárias por design e nada de participantes (nick, sessionId) é
 * persistido. O MySQL guarda apenas o metadado mínimo de `live_rooms` para
 * observabilidade e para o sweeper marcar 'expired' de forma durável.
 *
 * Segurança de sessão: cada sessão recebe um `sessionToken` secreto emitido
 * no primeiro join. O sessionId é público (necessário para o signaling
 * WebRTC), então ele NÃO pode ser a credencial — qualquer participante da
 * sala vê os sessionIds dos outros. O token comprova a posse da sessão em
 * reconexões e ações sensíveis.
 */

// ── Config derivada de env ────────────────────────────────────
export function liveMaxParticipants(): number {
  const raw = parseInt(process.env.LIVE_MAX_PARTICIPANTS || "", 10);
  if (!Number.isSafeInteger(raw) || raw <= 0) {
    return LIVE_MAX_PARTICIPANTS_DEFAULT;
  }
  return Math.min(raw, LIVE_MAX_PARTICIPANTS_CEILING);
}

// ── Tipos internos ────────────────────────────────────────────
type LiveSocketLike = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export type { LiveSocketLike };

type Connection = {
  socket: LiveSocketLike;
  /** UUID da conexão WebSocket física (uma sessão pode ter várias). */
  connectionId: string;
  sessionId: string;
  lastSeenAt: number;
};

type RoomParticipant = LiveParticipant & {
  /** Segredo da sessão (base64url). Nunca sai do servidor. */
  sessionToken: string;
  /** sha256 do token do criador original — prova de posse do host. */
  creatorTokenHash: string | null;
  connections: Map<string, Connection>;
  /** Timestamp da última desconexão (grace para reconexão). */
  disconnectedAt: number | null;
  joinedAt: number;
};

type LiveRoom = {
  code: string;
  /** Nome opcional definido pelo criador (null = usar "Sala {código}"). */
  name: string | null;
  /** sha256 do hostToken — só o criador original conhece o token cru. */
  hostTokenHash: string | null;
  /** sessionId do host atual (transferível). */
  hostSessionId: string | null;
  maxParticipants: number;
  createdAt: number;
  lastActivityAt: number;
  /** Definido quando a sala entra em expiração. */
  emptySince: number | null;
  endTimeout: ReturnType<typeof setTimeout> | null;
  participants: Map<string, RoomParticipant>;
  chat: LiveChatMessage[];
  /** Coluna `id` no MySQL quando a sala foi persistida. */
  dbId: number | null;
  /** Última vez que lastActivityAt foi atualizado no banco (throttle). */
  lastDbTouchAt: number;
};

const rooms = new Map<string, LiveRoom>();
/** sessionId → código da sala (busca rápida de saída/kick/end). */
const sessionIndex = new Map<string, string>();

// ── Códigos de sala ───────────────────────────────────────────
export function generateRoomCode(): string {
  const bytes = randomBytes(LIVE_ROOM_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < LIVE_ROOM_CODE_LENGTH; i++) {
    code += LIVE_CODE_ALPHABET[bytes[i] % LIVE_CODE_ALPHABET.length];
  }
  return code;
}

function newSecret(): string {
  return randomBytes(24).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function touch(room: LiveRoom) {
  room.lastActivityAt = Date.now();
  if (
    room.dbId !== null &&
    room.lastDbTouchAt < Date.now() - LIVE_ACTIVITY_TOUCH_MS
  ) {
    room.lastDbTouchAt = Date.now();
    try {
      getDb()
        .update(schema.liveRooms)
        .set({ lastActivityAt: new Date() })
        .where(eq(schema.liveRooms.id, room.dbId))
        .catch(() => {});
    } catch {
      // Banco indisponível: a sala continua funcionando em memória.
    }
  }
}

// ── Persistência (best-effort, nunca bloqueia a sala) ────────
function persistCreate(room: LiveRoom) {
  try {
    getDb()
      .insert(schema.liveRooms)
      .values({
        roomCode: room.code,
        hostTokenHash: room.hostTokenHash,
        status: "active",
        maxParticipants: room.maxParticipants,
      })
      .$returningId()
      .then(([row]) => {
        if (rooms.get(room.code) === room && row) room.dbId = row.id;
      })
      .catch(() => {});
  } catch {
    // Banco indisponível: sala só em memória (persistência é opcional).
  }
}

function persistExpire(room: LiveRoom) {
  const updates: Partial<typeof schema.liveRooms.$inferInsert> = {
    status: "expired" as const,
    expiresAt: new Date(),
  };
  try {
    if (room.dbId !== null) {
    getDb()
      .update(schema.liveRooms)
      .set(updates)
      .where(eq(schema.liveRooms.id, room.dbId))
      .catch(() => {});    } else {
      // A sala pode não ter tido tempo de persistir (latência/crash):
      // marca por código para não deixar linhas 'active' eternas.
      getDb()
        .update(schema.liveRooms)
        .set(updates)
        .where(eq(schema.liveRooms.roomCode, room.code))
        .catch(() => {});
    }
  } catch {
    // Banco indisponível: nada a fazer — a linha vira 'active' e o sweeper
    // de 24h remove.
  }
}

/**
 * Sweeper: remove linhas de `live_rooms` antigas (auditoria mínima). Roda a
 * cada 10 min; fire-and-forget — nunca bloqueia o runtime.
 */
export function startLiveRoomSweeper() {
  const sweep = async () => {
    try {
      const db = getDb();
      const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
      await db
        .delete(schema.liveRooms)
        .where(
          or(
            and(
              eq(schema.liveRooms.status, "active"),
              lt(schema.liveRooms.createdAt, cutoff)
            ),
            and(
              eq(schema.liveRooms.status, "expired"),
              lt(schema.liveRooms.lastActivityAt, cutoff)
            )
          )
        );
    } catch {
      // Sem banco no momento — o sweep é best-effort.
    }
  };
  const timer = setInterval(() => void sweep(), 10 * 60_000);
  timer.unref?.();
}

// ── Helpers ───────────────────────────────────────────────────
function toParticipantView(
  p: RoomParticipant,
  hostSessionId: string | null
): LiveParticipant {
  return {
    sessionId: p.sessionId,
    nickname: p.nickname,
    isHost: p.sessionId === hostSessionId,
    muted: p.muted,
    camera: p.camera,
    screen: p.screen,
  };
}

function broadcast(room: LiveRoom, event: unknown, exclude?: string) {
  const payload = JSON.stringify(event);
  for (const participant of room.participants.values()) {
    if (exclude && participant.sessionId === exclude) continue;
    for (const connection of participant.connections.values()) {
      if (connection.socket.readyState === 1) {
        try {
          connection.socket.send(payload);
        } catch {
          // socket morrendo; o close handler resolve
        }
      }
    }
  }
}

function publicParticipants(room: LiveRoom): LiveParticipant[] {
  return [...room.participants.values()].map(p =>
    toParticipantView(p, room.hostSessionId)
  );
}

function scheduleExpiry(room: LiveRoom) {
  if (room.emptySince !== null) return;
  room.emptySince = Date.now();
  room.endTimeout = setTimeout(() => {
    endRoom(room.code);
  }, LIVE_EMPTY_ROOM_TTL_MS);
  room.endTimeout.unref?.();
}

function clearExpiry(room: LiveRoom) {
  if (room.endTimeout) {
    clearTimeout(room.endTimeout);
    room.endTimeout = null;
  }
  room.emptySince = null;
}

/** Promove o participante mais antigo restante a host. */
function reassignHost(room: LiveRoom): string | null {
  if (room.participants.size === 0) {
    room.hostSessionId = null;
    return null;
  }
  const next = [...room.participants.values()].sort(
    (a, b) => a.joinedAt - b.joinedAt
  )[0];
  room.hostSessionId = next.sessionId;
  broadcast(room, { t: "live:host", hostSessionId: room.hostSessionId });
  return room.hostSessionId;
}

function scheduleIfEmpty(room: LiveRoom) {
  if (room.participants.size === 0 && room.emptySince === null) {
    scheduleExpiry(room);
  }
}

function authParticipant(
  sessionId: string,
  token: string | undefined
): RoomParticipant | null {
  if (!token) return null;
  const code = sessionIndex.get(sessionId);
  if (!code) return null;
  const participant = rooms.get(code)?.participants.get(sessionId);
  if (!participant) return null;
  // Comparação em tempo constante contra timing attacks (token cru em memória).
  const a = Buffer.from(token);
  const b = Buffer.from(participant.sessionToken);
  return a.length === b.length && timingSafeEqual(a, b)
    ? participant
    : null;
}

// ── API pública do módulo ─────────────────────────────────────
export type CreateRoomResult =
  | { ok: true; code: string; hostToken: string; name: string | null }
  | { ok: false; error: "rate-limited" };

/**
 * Cria a sala. `name` já deve vir sanitizado/validado (validateRoomName) —
 * o HTTP handler faz a validação antes de chamar.
 */
export async function createRoom(name: string | null = null): Promise<CreateRoomResult> {
  // Proteção contra criação excessiva de salas por processo.
  try {
    rateLimit("live:globalCreate", 400, 60_000);
  } catch {
    return { ok: false, error: "rate-limited" };
  }

  const maxParticipants = liveMaxParticipants();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    if (rooms.has(code)) continue;
    const room: LiveRoom = {
      code,
      name,
      hostTokenHash: null,
      hostSessionId: null,
      maxParticipants,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      emptySince: Date.now(),
      endTimeout: null,
      participants: new Map(),
      chat: [],
      dbId: null,
      lastDbTouchAt: 0,
    };
    room.endTimeout = setTimeout(
      () => endRoom(code),
      LIVE_EMPTY_ROOM_TTL_MS
    );
    room.endTimeout.unref?.();
    rooms.set(code, room);
    const hostToken = newSecret();
    room.hostTokenHash = hashToken(hostToken);
    persistCreate(room);
    return { ok: true, code, hostToken, name: room.name };
  }
  return { ok: false, error: "rate-limited" };
}

export type RoomInfo = {
  exists: boolean;
  expired?: boolean;
  full?: boolean;
  nicknames?: string[];
  maxParticipants?: number;
  /** Nome definido pelo criador (ausente = sala sem nome). */
  name?: string | null;
};

export function getRoomInfo(code: string): RoomInfo {
  const room = rooms.get(code);
  if (!room) return { exists: false };
  return {
    exists: true,
    expired: false,
    full: room.participants.size >= room.maxParticipants,
    nicknames: [...room.participants.values()].map(p => p.nickname),
    maxParticipants: room.maxParticipants,
    name: room.name,
  };
}

export function roomExists(code: string): boolean {
  return rooms.has(code);
}

export type JoinResult =
  | { ok: true; payload: LiveJoinPayload; isNew: boolean }
  | { ok: false; reason: LiveDenyReason; message: string };

/**
 * Registra (ou religa) um participante à sala. O cliente gera o sessionId
 * (persistido na aba) e recebe um sessionToken secreto na resposta.
 */
export function joinRoom(input: {
  code: string;
  sessionId: string;
  nickname: string;
  socket: LiveSocketLike;
  sessionToken?: string;
  hostToken?: string;
}): JoinResult {
  const room = rooms.get(input.code);
  if (!room) {
    return {
      ok: false,
      reason: "room-unavailable",
      message: "Esta sala não está mais disponível.",
    };
  }
  if (Date.now() - room.createdAt > LIVE_ROOM_MAX_AGE_MS) {
    endRoom(room.code);
    return {
      ok: false,
      reason: "room-unavailable",
      message: "Esta sala não está mais disponível.",
    };
  }

  const knownParticipant = room.participants.get(input.sessionId);
  const isReconnect = !!knownParticipant;

  if (isReconnect) {
    // Reconexão exige o sessionToken — o sessionId é público.
    const auth = authParticipant(input.sessionId, input.sessionToken);
    if (auth !== knownParticipant) {
      return {
        ok: false,
        reason: "nick-invalid",
        message: "Sessão inválida. Recarregue a página e entre novamente.",
      };
    }
  } else {
    // Novo participante: valida capacidade e unicidade de nick.
    if (room.participants.size >= room.maxParticipants) {
      return {
        ok: false,
        reason: "room-full",
        message: "Esta sala está cheia.",
      };
    }
    const nickKey = nicknameKey(input.nickname);
    for (const p of room.participants.values()) {
      if (nicknameKey(p.nickname) === nickKey) {
        return {
          ok: false,
          reason: "nick-taken",
          message: "Este nick já está em uso nesta sala. Escolha outro.",
        };
      }
    }
  }

  const connectionId = randomUUID();
  let participant: RoomParticipant;
  let sessionToken: string;

  if (isReconnect && knownParticipant) {
    participant = knownParticipant;
    participant.disconnectedAt = null;
    sessionToken = participant.sessionToken;
    participant.connections.set(connectionId, {
      socket: input.socket,
      connectionId,
      sessionId: input.sessionId,
      lastSeenAt: Date.now(),
    });
  } else {
    sessionToken = newSecret();
    participant = {
      sessionId: input.sessionId,
      nickname: input.nickname,
      isHost: false,
      muted: false,
      camera: false,
      screen: false,
      sessionToken,
      creatorTokenHash:
        room.hostTokenHash !== null &&
        !!input.hostToken &&
        hashToken(input.hostToken) === room.hostTokenHash
          ? room.hostTokenHash
          : null,
      connections: new Map(),
      disconnectedAt: null,
      joinedAt: Date.now(),
    };
    participant.connections.set(connectionId, {
      socket: input.socket,
      connectionId,
      sessionId: input.sessionId,
      lastSeenAt: Date.now(),
    });
    room.participants.set(input.sessionId, participant);
    sessionIndex.set(input.sessionId, input.code);
    // O criador original (com o hostToken) assume o host; caso contrário,
    // o primeiro participante de uma sala sem host assume.
    if (room.hostSessionId === null || participant.creatorTokenHash) {
      room.hostSessionId = input.sessionId;
    }
  }

  // Remove sockets já mortos (aba fechada cujo close ainda não chegou).
  for (const [connId, conn] of participant.connections) {
    if (conn.socket.readyState >= 2) participant.connections.delete(connId);
  }

  clearExpiry(room);
  if (!isReconnect) {
    broadcast(room, {
      t: "live:participants",
      participants: publicParticipants(room),
      hostSessionId: room.hostSessionId,
    });
  }

  touch(room);
  const participants = publicParticipants(room);
  const you = participants.find(p => p.sessionId === input.sessionId);
  if (!you) {
    // Defensivo: nunca deve acontecer, mas evita um crash se ocorrer.
    removeParticipant(room, input.sessionId);
    return {
      ok: false,
      reason: "room-unavailable",
      message: "Não foi possível entrar na sala. Tente novamente.",
    };
  }
  return {
    ok: true,
    isNew: !isReconnect,
    payload: {
      roomCode: room.code,
      roomName: room.name,
      hostSessionId: room.hostSessionId,
      maxParticipants: room.maxParticipants,
      sessionToken,
      you,
      participants,
      chat: [...room.chat],
    },
  };
}

export function detachSocket(
  code: string,
  sessionId: string,
  socket: LiveSocketLike
): "reconnected" | "left" | "gone" {
  const room = rooms.get(code);
  const participant = room?.participants.get(sessionId);
  if (!room || !participant) return "gone";
  for (const [connId, conn] of participant.connections) {
    if (conn.socket === socket) participant.connections.delete(connId);
  }
  if (participant.connections.size > 0) return "reconnected";
  // Sem outras conexões: grace de reconexão antes de remover.
  participant.disconnectedAt = Date.now();
  setTimeout(() => {
    const current = rooms.get(code);
    const currentParticipant = current?.participants.get(sessionId);
    if (
      current !== room ||
      !currentParticipant ||
      currentParticipant !== participant ||
      currentParticipant.connections.size > 0
    ) {
      return;
    }
    removeParticipant(room, participant.sessionId);
  }, LIVE_RECONNECT_GRACE_MS).unref?.();
  return "left";
}

function removeParticipant(room: LiveRoom, sessionId: string) {
  const participant = room.participants.get(sessionId);
  if (!participant) return;
  room.participants.delete(sessionId);
  sessionIndex.delete(sessionId);
  for (const conn of participant.connections.values()) {
    try {
      conn.socket.close(4000, "removed");
    } catch {
      // ignore
    }
  }
  const wasHost = room.hostSessionId === sessionId;
  if (room.participants.size === 0) {
    room.hostSessionId = null;
    scheduleIfEmpty(room);
  } else if (wasHost) {
    reassignHost(room);
  }
  broadcast(room, {
    t: "live:participants",
    participants: publicParticipants(room),
    hostSessionId: room.hostSessionId,
  });
  touch(room);
}

export function removeSession(sessionId: string): void {
  const code = sessionIndex.get(sessionId);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) {
    sessionIndex.delete(sessionId);
    return;
  }
  // O celular da Mobile Camera desta sessão cai junto com o dono.
  void import("./liveCompanionBridge").then(m =>
    m.notifyOwnerGone(sessionId)
  );
  removeParticipant(room, sessionId);
}

// ── Ações de sala ─────────────────────────────────────────────
export type ChatResult =
  | { ok: true; message: LiveChatMessage }
  | { ok: false; error: "not-in-room" | "rate-limited" | "invalid" };

export function postChat(sessionId: string, rawContent: string): ChatResult {
  const code = sessionIndex.get(sessionId);
  const room = code ? rooms.get(code) : undefined;
  const participant = room?.participants.get(sessionId);
  if (!room || !participant) return { ok: false, error: "not-in-room" };

  const content = rawContent.trim().slice(0, 500);
  if (!content) return { ok: false, error: "invalid" };

  try {
    rateLimit(`live:chat:${sessionId}`, 5, 5_000);
  } catch {
    return { ok: false, error: "rate-limited" };
  }

  const message: LiveChatMessage = {
    id: randomUUID(),
    sessionId,
    nickname: participant.nickname,
    content,
    createdAt: new Date().toISOString(),
  };
  room.chat.push(message);
  if (room.chat.length > LIVE_CHAT_HISTORY_LIMIT) {
    room.chat.splice(0, room.chat.length - LIVE_CHAT_HISTORY_LIMIT);
  }
  broadcast(room, { t: "live:chat", message });
  touch(room);
  return { ok: true, message };
}

export type StateResult = { ok: boolean };

export function updateState(
  sessionId: string,
  patch: { muted?: boolean; camera?: boolean; screen?: boolean }
): StateResult {
  const code = sessionIndex.get(sessionId);
  const room = code ? rooms.get(code) : undefined;
  const participant = room?.participants.get(sessionId);
  if (!room || !participant) return { ok: false };
  if (typeof patch.muted === "boolean") participant.muted = patch.muted;
  if (typeof patch.camera === "boolean") participant.camera = patch.camera;
  if (typeof patch.screen === "boolean") participant.screen = patch.screen;
  broadcast(room, {
    t: "live:participants",
    participants: publicParticipants(room),
    hostSessionId: room.hostSessionId,
  });
  return { ok: true };
}

export function relaySignal(
  fromSessionId: string,
  toSessionId: string,
  data: unknown
): boolean {
  const fromCode = sessionIndex.get(fromSessionId);
  const toCode = sessionIndex.get(toSessionId);
  if (!fromCode || fromCode !== toCode) return false;
  const room = rooms.get(fromCode);
  const target = room?.participants.get(toSessionId);
  if (!room || !target) return false;
  const payload = JSON.stringify({
    t: "live:signal",
    from: fromSessionId,
    data,
  });
  let delivered = false;
  for (const conn of target.connections.values()) {
    if (conn.socket.readyState === 1) {
      try {
        conn.socket.send(payload);
        delivered = true;
      } catch {
        // ignore
      }
    }
  }
  return delivered;
}

export function kickParticipant(
  hostSessionId: string,
  targetSessionId: string
): boolean {
  const code = sessionIndex.get(hostSessionId);
  const room = code ? rooms.get(code) : undefined;
  if (!room || room.hostSessionId !== hostSessionId) return false;
  if (hostSessionId === targetSessionId) return false;
  if (!room.participants.has(targetSessionId)) return false;
  const target = room.participants.get(targetSessionId);
  if (target) {
    for (const conn of target.connections.values()) {
      try {
        conn.socket.send(JSON.stringify({ t: "live:kicked" }));
      } catch {
        // ignore
      }
    }
  }
  removeParticipant(room, targetSessionId);
  return true;
}

export function endRoomByHost(hostSessionId: string): boolean {
  const code = sessionIndex.get(hostSessionId);
  const room = code ? rooms.get(code) : undefined;
  if (!room || room.hostSessionId !== hostSessionId) return false;
  // Todos os celulares pareados com a sala caem com ela.
  for (const participant of room.participants.keys()) {
    void import("./liveCompanionBridge").then(m =>
      m.notifyOwnerGone(participant)
    );
  }
  endRoom(room.code);
  return true;
}

export function endRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  if (room.endTimeout) clearTimeout(room.endTimeout);
  room.endTimeout = null;
  // Notifica todos antes de destruir.
  broadcast(room, { t: "live:ended" });
  for (const participant of room.participants.values()) {
    for (const conn of participant.connections.values()) {
      try {
        conn.socket.close(4001, "room-ended");
      } catch {
        // ignore
      }
    }
    sessionIndex.delete(participant.sessionId);
  }
  room.participants.clear();
  room.chat = [];
  rooms.delete(code);
  persistExpire(room);
}

/** Resolve a sala de uma sessão (observabilidade/testes). */
export function roomOfSession(sessionId: string): string | null {
  return sessionIndex.get(sessionId) ?? null;
}

/** Envia um evento WS para todas as conexões de uma sessão (mobile camera). */
export function sendToSessionSockets(
  sessionId: string,
  event: unknown
): void {
  const code = sessionIndex.get(sessionId);
  if (!code) return;
  const participant = rooms.get(code)?.participants.get(sessionId);
  if (!participant) return;
  const payload = JSON.stringify(event);
  for (const connection of participant.connections.values()) {
    if (connection.socket.readyState === 1) {
      try {
        connection.socket.send(payload);
      } catch {
        // socket morrendo; o close handler resolve
      }
    }
  }
}

/** Número de salas ativas neste processo (observabilidade/testes). */
export function liveRoomCount(): number {
  return rooms.size;
}

/** Limpa todo o estado (usado em testes). */
export function resetLiveRoomsForTests() {
  for (const room of rooms.values()) {
    if (room.endTimeout) clearTimeout(room.endTimeout);
  }
  rooms.clear();
  sessionIndex.clear();
}

// ── Mobile Camera: pareamento de celular com uma sessão do Live ──
// Mesmo modelo do companion do Nexora tradicional, mas sem ownerUserId:
// a "posse" aqui é a posse do sessionToken da sessão da sala (o celular
// nunca conhece o token — só o gateway autenticado o usa).

export type LiveCompanionSession = {
  id: string;
  /** Código curto que vai no QR Code (não é segredo de conta). */
  code: string;
  /** Sessão da sala à qual o celular vai servir como câmera. */
  ownerSessionId: string;
  roomCode: string;
  companionSocket: unknown;
  createdAt: number;
  expiresAt: number;
};

const LIVE_COMPANION_TTL_MS = 5 * 60_000;

export function createLiveCompanionSession(input: {
  ownerSessionId: string;
  sessionToken: string;
  roomCode: string;
}): LiveCompanionSession | null {
  cleanupExpiredLiveCompanions();
  const participant = authParticipant(input.ownerSessionId, input.sessionToken);
  if (!participant || participant.sessionId !== input.ownerSessionId) return null;

  // Um celular por sessão: substitui a sessão anterior (invalida o token).
  for (const [id, existing] of liveCompanionsByOwner) {
    if (existing.ownerSessionId === input.ownerSessionId) {
      liveCompanionSessions.delete(id);
      liveCompanionsByCode.delete(existing.code);
      liveCompanionsByOwner.delete(id);
    }
  }

  const now = Date.now();
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += LIVE_CODE_ALPHABET[bytes[i] % LIVE_CODE_ALPHABET.length];
  }
  while (liveCompanionsByCode.has(code)) {
    code = code.slice(1) + LIVE_CODE_ALPHABET[randomBytes(1)[0] % LIVE_CODE_ALPHABET.length];
  }
  const session: LiveCompanionSession = {
    id: randomUUID(),
    code,
    ownerSessionId: input.ownerSessionId,
    roomCode: input.roomCode,
    companionSocket: null,
    createdAt: now,
    expiresAt: now + LIVE_COMPANION_TTL_MS,
  };
  liveCompanionSessions.set(session.id, session);
  liveCompanionsByCode.set(session.code, session.id);
  liveCompanionsByOwner.set(session.id, session);
  return session;
}

export function getLiveCompanionByCode(code: string): LiveCompanionSession | undefined {
  const id = liveCompanionsByCode.get(code);
  if (!id) return undefined;
  const session = liveCompanionSessions.get(id);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    liveCompanionSessions.delete(id);
    liveCompanionsByCode.delete(code);
    liveCompanionsByOwner.delete(id);
    return undefined;
  }
  return session;
}

export function getLiveCompanionForOwner(
  sessionId: string,
  sessionToken: string,
  companionId: string
): LiveCompanionSession | undefined {
  const session = liveCompanionSessions.get(companionId);
  if (!session || session.ownerSessionId !== sessionId) return undefined;
  if (Date.now() > session.expiresAt) {
    liveCompanionSessions.delete(companionId);
    liveCompanionsByCode.delete(session.code);
    liveCompanionsByOwner.delete(companionId);
    return undefined;
  }
  // A posse é provada pelo sessionToken da sessão da sala.
  const participant = authParticipant(sessionId, sessionToken);
  if (!participant || participant.sessionId !== sessionId) return undefined;
  return session;
}

export function disbandLiveCompanion(session: LiveCompanionSession): void {
  liveCompanionSessions.delete(session.id);
  liveCompanionsByCode.delete(session.code);
  liveCompanionsByOwner.delete(session.id);
}

export function refreshLiveCompanionExpiry(session: LiveCompanionSession): void {
  session.expiresAt = Date.now() + LIVE_COMPANION_TTL_MS;
}

function cleanupExpiredLiveCompanions() {
  const now = Date.now();
  for (const [id, session] of liveCompanionSessions) {
    if (now > session.expiresAt) {
      liveCompanionSessions.delete(id);
      liveCompanionsByCode.delete(session.code);
      liveCompanionsByOwner.delete(id);
    }
  }
}

/** Quando a sessão do dono sai da sala, o celular dela cai junto. */
export function liveCompanionForSessionOf(sessionId: string): LiveCompanionSession | null {
  for (const session of liveCompanionSessions.values()) {
    if (session.ownerSessionId === sessionId) return session;
  }
  return null;
}

const liveCompanionSessions = new Map<string, LiveCompanionSession>();
const liveCompanionsByCode = new Map<string, string>();
const liveCompanionsByOwner = new Map<string, LiveCompanionSession>();
