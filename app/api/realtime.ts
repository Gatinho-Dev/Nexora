import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import * as cookie from "cookie";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { Session, type UserStatus } from "@contracts/constants";
import type {
  VoiceParticipant,
  WSClientEvent,
  WSServerEvent,
} from "@contracts/types";
import { verifySessionToken } from "./auth/token";
import { resolveActiveSession } from "./auth/sessions";
import { findUserByUnionId } from "./queries/users";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import {
  getEffectiveChannelPermissions,
  getMemberPermissions,
  toPublicUser,
} from "./utils/permissions";
import { env } from "./lib/env";
import { randomUUID } from "node:crypto";
import {
  allInviteesDeclined,
  DM_UNANSWERED_TIMEOUT_MS,
  hasUnansweredCallExpired,
  isDmCallAnswered,
  formatDmCallHistory,
  type DmCallEndReason,
} from "./voice/dmCallPolicy";
import { insertSystemMessage, userName } from "./services/groupService";

// ── Connection registry ───────────────────────────────────────
type Client = {
  ws: WebSocket;
  userId: number;
  /** Id da sessão (account_sessions) que criou este socket. */
  sid: string | null;
  alive: boolean;
};

const clients = new Set<Client>();
const byUser = new Map<number, Set<Client>>();

// Manual status chosen by the user (online/idle/dnd/invisible). Absent = online.
const manualStatus = new Map<number, UserStatus>();

// Voice rooms: "c:<channelId>" or "dm:<conversationId>" -> participants
const voiceRooms = new Map<string, Map<number, VoiceParticipant>>();
const userVoiceRoom = new Map<number, string>();
const voiceClientByUser = new Map<number, Client>();
const voiceSessionByUser = new Map<number, string>();
type DmCallSession = {
  callId: string;
  conversationId: number;
  initiatorId: number;
  startedAt: number;
  video: boolean;
  answered: boolean;
  participantsEver: Set<number>;
  invitedUserIds: Set<number>;
  declinedUserIds: Set<number>;
  timeout: ReturnType<typeof setTimeout> | null;
  emptyRoomTimeout: ReturnType<typeof setTimeout> | null;
};
const dmCallSessions = new Map<number, DmCallSession>();
/** Raised hands per stage room: roomKey → Set<userId>. */
const stageHands = new Map<string, Set<number>>();
/** Max simultaneous video transmitters on a stage (camera or screen). */
export const STAGE_MAX_TRANSMITTERS = 5;

function userHandsKey(userId: number): string | undefined {
  for (const key of stageHands.keys())
    if (stageHands.get(key)?.has(userId)) return key;
  return undefined;
}

function channelRoomKey(channelId: number) {
  return `c:${channelId}`;
}
function dmRoomKey(conversationId: number) {
  return `dm:${conversationId}`;
}

function callStateEvent(
  session: DmCallSession,
  state: "ringing" | "connected" | "ended",
  reason?: "unanswered" | "declined" | "cancelled" | "completed"
): WSServerEvent {
  return {
    t: "call:state",
    conversationId: session.conversationId,
    callId: session.callId,
    state,
    startedAt: new Date(session.startedAt).toISOString(),
    unansweredDeadline:
      !session.answered && state !== "ended"
        ? new Date(session.startedAt + DM_UNANSWERED_TIMEOUT_MS).toISOString()
        : undefined,
    video: session.video,
    initiatorId: session.initiatorId,
    reason,
  };
}

async function endDmCall(
  conversationId: number,
  reason: DmCallEndReason
) {
  const session = dmCallSessions.get(conversationId);
  if (!session) return;
  dmCallSessions.delete(conversationId);
  if (session.timeout) clearTimeout(session.timeout);
  session.timeout = null;
  if (session.emptyRoomTimeout) clearTimeout(session.emptyRoomTimeout);
  session.emptyRoomTimeout = null;

  try {
    await broadcastToConversation(
      conversationId,
      callStateEvent(session, "ended", reason)
    );
  } catch (error) {
    console.error("[voice] failed to broadcast call end", error);
  }

  try {
    const db = getDb();
    const initiatorName = await userName(session.initiatorId);
    const content = formatDmCallHistory({
      initiatorName,
      reason,
      startedAt: session.startedAt,
      endedAt: Date.now(),
    });
    const messageId = await insertSystemMessage(
      db,
      conversationId,
      session.initiatorId,
      content,
      "call",
    );
    const message = await db.query.messages.findFirst({
      where: eq(schema.messages.id, messageId),
    });
    if (message) {
      // Dynamic import avoids an eager realtime ↔ messageRouter cycle.
      const { buildMessageDTO } = await import("./messageRouter");
      await broadcastToConversation(conversationId, {
        t: "message:new",
        message: await buildMessageDTO(message),
      });
    }
  } catch (error) {
    console.error("[voice] failed to persist call history", error);
  }

  const room = voiceRooms.get(dmRoomKey(conversationId));
  const activeClients = room
    ? [...room.keys()]
        .map(userId => voiceClientByUser.get(userId))
        .filter((client): client is Client => !!client)
    : [];
  await Promise.all(activeClients.map(client => voiceLeave(client)));
}

async function joinDmCallSession(input: {
  conversationId: number;
  userId: number;
  initiated: boolean;
  video: boolean;
}) {
  let session = dmCallSessions.get(input.conversationId);
  if (!session) {
    const members = await getDb()
      .select({ userId: schema.conversationMembers.userId })
      .from(schema.conversationMembers)
      .where(
        eq(schema.conversationMembers.conversationId, input.conversationId)
      );
    const startedAt = Date.now();
    session = {
      callId: randomUUID(),
      conversationId: input.conversationId,
      initiatorId: input.userId,
      startedAt,
      video: input.video,
      answered: false,
      participantsEver: new Set(),
      invitedUserIds: new Set(
        members
          .map(member => member.userId)
          .filter(userId => userId !== input.userId)
      ),
      declinedUserIds: new Set(),
      timeout: null,
      emptyRoomTimeout: null,
    };
    dmCallSessions.set(input.conversationId, session);
    const callId = session.callId;
    session.timeout = setTimeout(() => {
      const current = dmCallSessions.get(input.conversationId);
      if (
        current?.callId === callId &&
        hasUnansweredCallExpired({
          answered: current.answered,
          startedAt: current.startedAt,
          now: Date.now(),
        })
      ) {
        void endDmCall(input.conversationId, "unanswered");
      }
    }, DM_UNANSWERED_TIMEOUT_MS);
    session.timeout.unref?.();
  }

  if (session.emptyRoomTimeout) clearTimeout(session.emptyRoomTimeout);
  session.emptyRoomTimeout = null;

  session.participantsEver.add(input.userId);
  if (!session.answered && isDmCallAnswered(session.participantsEver)) {
    session.answered = true;
    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = null;
    await broadcastToConversation(
      input.conversationId,
      callStateEvent(session, "connected")
    );
    return;
  }
  await broadcastToConversation(
    input.conversationId,
    callStateEvent(session, session.answered ? "connected" : "ringing")
  );
}

async function declineDmCall(client: Client, conversationId: number) {
  const member = await getDb().query.conversationMembers.findFirst({
    where: and(
      eq(schema.conversationMembers.conversationId, conversationId),
      eq(schema.conversationMembers.userId, client.userId)
    ),
  });
  const session = dmCallSessions.get(conversationId);
  if (!member || !session || session.answered) return;
  session.declinedUserIds.add(client.userId);
  if (allInviteesDeclined(session.invitedUserIds, session.declinedUserIds)) {
    await endDmCall(conversationId, "declined");
  }
}

function addClient(client: Client) {
  clients.add(client);
  let set = byUser.get(client.userId);
  if (!set) {
    set = new Set();
    byUser.set(client.userId, set);
  }
  set.add(client);
}

function removeClient(client: Client) {
  clients.delete(client);
  const set = byUser.get(client.userId);
  if (set) {
    set.delete(client);
    if (set.size === 0) byUser.delete(client.userId);
  }
}

export function isUserOnline(userId: number): boolean {
  return byUser.has(userId);
}

/**
 * Logout remoto: encerra todos os WebSockets de uma sessão específica.
 * Envia `session:revoked` antes de fechar para o cliente mostrar
 * "Sua sessão foi encerrada" e voltar ao login.
 */
export function kickSession(sessionId: string): void {
  for (const client of clients) {
    if (client.sid === sessionId) {
      try {
        client.ws.send(JSON.stringify({ t: "session:revoked" }));
      } catch {
        // socket já fechado
      }
      client.ws.close(4001, "session-revoked");
      removeClient(client);
    }
  }
}

function effectiveStatus(userId: number): string {
  if (!byUser.has(userId)) return "offline";
  return manualStatus.get(userId) ?? "online";
}

/** Status as seen by others (invisible appears offline). */
function visibleStatus(userId: number): string {
  const s = effectiveStatus(userId);
  return s === "invisible" ? "offline" : s;
}

// ── Send helpers ──────────────────────────────────────────────
function send(client: Client, event: WSServerEvent) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(event));
  }
}

export function sendToUsers(userIds: Iterable<number>, event: WSServerEvent) {
  for (const userId of userIds) {
    const set = byUser.get(userId);
    if (set) for (const c of set) send(c, event);
  }
}

/** Broadcast a platform-scoped event to every currently authenticated socket. */
export function broadcastToAll(event: WSServerEvent) {
  for (const client of clients) send(client, event);
}

async function serverMemberIds(serverId: number): Promise<number[]> {
  const connectedUserIds = [...byUser.keys()];
  if (connectedUserIds.length === 0) return [];
  const rows = await getDb()
    .select({ userId: schema.serverMembers.userId })
    .from(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverId),
        inArray(schema.serverMembers.userId, connectedUserIds)
      )
    );
  return rows.map(r => r.userId);
}

export async function broadcastToServer(
  serverId: number,
  event: WSServerEvent
) {
  sendToUsers(await serverMemberIds(serverId), event);
}

export async function broadcastToChannel(
  channelId: number,
  event: WSServerEvent
) {
  const channel = await getDb().query.channels.findFirst({
    where: eq(schema.channels.id, channelId),
  });
  if (!channel) return;
  await broadcastToServer(channel.serverId, event);
}

export async function broadcastToConversation(
  conversationId: number,
  event: WSServerEvent
) {
  const rows = await getDb()
    .select({ userId: schema.conversationMembers.userId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  sendToUsers(
    rows.map(r => r.userId),
    event
  );
}

/** All users that share a server or friendship with the given user. */
export async function contactIds(userId: number): Promise<Set<number>> {
  const db = getDb();
  const ids = new Set<number>();

  const friendRows = await db
    .select()
    .from(schema.friendships)
    .where(
      and(
        or(
          eq(schema.friendships.requesterId, userId),
          eq(schema.friendships.addresseeId, userId)
        ),
        eq(schema.friendships.status, "ACCEPTED")
      )
    );
  for (const f of friendRows) {
    ids.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
  }

  const myServers = await db
    .select({ serverId: schema.serverMembers.serverId })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.userId, userId));
  for (const s of myServers) {
    const members = await db
      .select({ userId: schema.serverMembers.userId })
      .from(schema.serverMembers)
      .where(
        and(
          eq(schema.serverMembers.serverId, s.serverId),
          ne(schema.serverMembers.userId, userId)
        )
      );
    for (const m of members) ids.add(m.userId);
  }
  return ids;
}

async function broadcastPresence(userId: number) {
  const status = visibleStatus(userId);
  const contacts = await contactIds(userId);
  sendToUsers(contacts, { t: "presence", userId, status });
  // Persist coarse status for fresh page loads (never "invisible").
  const persisted = status === "offline" ? "offline" : status;
  getDb()
    .update(schema.users)
    .set({
      status: persisted as typeof schema.users.$inferSelect.status,
      lastSeenAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .catch(() => {});
}

// ── Voice ─────────────────────────────────────────────────────
export function getVoiceParticipants(roomKey: string): VoiceParticipant[] {
  return [...(voiceRooms.get(roomKey)?.values() ?? [])];
}

/**
 * Compact server-rail summary. Callers must pass only channel ids the viewer
 * is allowed to see; this function deliberately knows nothing about ACLs.
 */
export function getVoiceSummaryForChannels(channelIds: Iterable<number>) {
  const participants = new Map<number, VoiceParticipant>();
  for (const channelId of channelIds) {
    for (const participant of getVoiceParticipants(channelRoomKey(channelId))) {
      participants.set(participant.userId, participant);
    }
  }
  const visible = [...participants.values()];
  return {
    activeVoiceCount: visible.length,
    voicePreviewMembers: visible
      .slice(0, 4)
      .map(({ userId, name, avatar }) => ({
        userId,
        name,
        avatar,
      })),
  };
}

/** Flip a user between stage speaker and audience while they are connected. */
export async function setLiveStageSpeaker(
  channelId: number,
  userId: number,
  speaker: boolean
): Promise<boolean> {
  const roomKey = channelRoomKey(channelId);
  const room = voiceRooms.get(roomKey);
  const participant = room?.get(userId);
  if (!participant || !room) return false;
  participant.speaker = speaker;
  if (!speaker) {
    participant.muted = true;
    participant.camera = false;
    participant.screen = false;
  }
  await broadcastVoiceParticipants(roomKey);
  return true;
}

/** True when the given user currently sits in the voice room of the channel. */
export function isUserInVoiceRoom(channelId: number, userId: number): boolean {
  return !!voiceRooms.get(channelRoomKey(channelId))?.has(userId);
}

async function broadcastVoiceParticipants(roomKey: string) {
  const participants = getVoiceParticipants(roomKey);
  if (roomKey.startsWith("c:")) {
    const channelId = Number(roomKey.slice(2));
    const channel = await getDb().query.channels.findFirst({
      where: eq(schema.channels.id, channelId),
    });
    if (!channel) return;
    const [memberIds, serverVoiceChannels] = await Promise.all([
      serverMemberIds(channel.serverId),
      getDb()
        .select()
        .from(schema.channels)
        .where(
          and(
            eq(schema.channels.serverId, channel.serverId),
            or(
              eq(schema.channels.type, "VOICE"),
              eq(schema.channels.type, "STAGE")
            )
          )
        ),
    ]);
    await Promise.all(
      memberIds.map(async userId => {
        const permissions = await getMemberPermissions(
          userId,
          channel.serverId
        );
        const visibleChannelIds: number[] = [];
        for (const voiceChannel of serverVoiceChannels) {
          if (
            permissions?.has("ADMINISTRATOR") ||
            permissions?.has("MANAGE_CHANNELS")
          ) {
            visibleChannelIds.push(voiceChannel.id);
            continue;
          }
          const effective = await getEffectiveChannelPermissions(
            userId,
            voiceChannel
          );
          if (effective?.has("VIEW_CHANNEL")) {
            visibleChannelIds.push(voiceChannel.id);
          }
        }
        if (!visibleChannelIds.includes(channelId)) return;
        const summary = getVoiceSummaryForChannels(visibleChannelIds);
        sendToUsers([userId], {
          t: "voice:participants",
          channelId,
          serverId: channel.serverId,
          participants,
          ...summary,
        });
      })
    );
  } else {
    const conversationId = Number(roomKey.slice(3));
    await broadcastToConversation(conversationId, {
      t: "voice:participants",
      conversationId,
      participants,
    });
  }
}

function broadcastStageHands(roomKey: string) {
  const hands = [...(stageHands.get(roomKey) ?? [])];
  if (roomKey.startsWith("c:")) {
    const channelId = Number(roomKey.slice(2));
    const room = voiceRooms.get(roomKey);
    if (room) {
      sendToUsers([...room.keys()], {
        t: "stage:hands",
        channelId,
        userIds: hands,
      });
    }
  }
}

async function countTransmitters(
  room: Map<number, VoiceParticipant>
): Promise<number> {
  let n = 0;
  for (const p of room.values()) if (p.camera || p.screen) n++;
  return n;
}

async function voiceJoin(
  client: Client,
  target: {
    channelId?: number;
    conversationId?: number;
    initiated?: boolean;
    video?: boolean;
  }
) {
  const db = getDb();
  let roomKey: string;
  let channelType: string | null = null;
  let channelServerId: number | null = null;

  if (target.channelId) {
    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, target.channelId),
    });
    if (!channel || (channel.type !== "VOICE" && channel.type !== "STAGE")) {
      send(client, {
        t: "voice:denied",
        channelId: target.channelId,
        reason: "Canal de voz não encontrado.",
      });
      return;
    }
    const perms = await getEffectiveChannelPermissions(client.userId, channel);
    if (!perms || !perms.has("VIEW_CHANNEL") || !perms.has("CONNECT")) {
      send(client, {
        t: "voice:denied",
        channelId: target.channelId,
        reason: "Você não tem permissão para acessar este canal de voz.",
      });
      return;
    }
    roomKey = channelRoomKey(target.channelId);
    channelType = channel.type;
    channelServerId = channel.serverId;
  } else if (target.conversationId) {
    const member = await db.query.conversationMembers.findFirst({
      where: and(
        eq(schema.conversationMembers.conversationId, target.conversationId),
        eq(schema.conversationMembers.userId, client.userId)
      ),
    });
    if (!member) {
      send(client, {
        t: "voice:denied",
        conversationId: target.conversationId,
        reason: "Você não participa desta conversa.",
      });
      return;
    }
    roomKey = dmRoomKey(target.conversationId);
  } else {
    return;
  }

  // A user has one active voice socket. This prevents duplicate signaling from
  // being delivered to every open Nexora tab for the same account.
  const previousVoiceClient = voiceClientByUser.get(client.userId);
  if (previousVoiceClient && previousVoiceClient !== client) {
    await voiceLeave(previousVoiceClient);
  }
  // Leave any previous voice room first.
  await voiceLeave(client);

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, client.userId),
  });
  if (!user) return;

  // Stage channels: only authorized speakers may transmit. Everyone else
  // joins the room as audience.
  let speaker = true;
  if (channelType === "STAGE") {
    const perms = await getMemberPermissions(client.userId, channelServerId!);
    if (perms?.has("ADMINISTRATOR")) {
      speaker = true;
    } else {
      const granted = await db
        .select({ userId: schema.stageSpeakers.userId })
        .from(schema.stageSpeakers)
        .where(
          and(
            eq(schema.stageSpeakers.channelId, target.channelId!),
            eq(schema.stageSpeakers.userId, client.userId)
          )
        )
        .limit(1);
      speaker = granted.length > 0;
    }
  }

  let room = voiceRooms.get(roomKey);
  if (!room) {
    room = new Map();
    voiceRooms.set(roomKey, room);
  }
  room.set(client.userId, {
    userId: client.userId,
    name: user.name ?? user.username ?? "Usuário",
    avatar: user.avatar,
    muted: !speaker,
    deafened: false,
    camera: false,
    screen: false,
    speaker,
  });
  userVoiceRoom.set(client.userId, roomKey);
  voiceClientByUser.set(client.userId, client);
  const voiceSessionId = randomUUID();
  voiceSessionByUser.set(client.userId, voiceSessionId);
  send(client, {
    t: "voice:ready",
    channelId: target.channelId,
    conversationId: target.conversationId,
    voiceSessionId,
  });

  if (target.conversationId) {
    await joinDmCallSession({
      conversationId: target.conversationId,
      userId: client.userId,
      initiated: target.initiated === true,
      video: target.video === true,
    });
  }

  // Audit row for server voice channels (best-effort).
  if (target.channelId) {
    db.insert(schema.voiceSessions)
      .values({ channelId: target.channelId, userId: client.userId })
      .catch(() => {});
  }

  await broadcastVoiceParticipants(roomKey);
}

async function voiceLeave(client: Client, intentional = false) {
  const activeVoiceClient = voiceClientByUser.get(client.userId);
  if (activeVoiceClient && activeVoiceClient !== client) return;
  const roomKey = userVoiceRoom.get(client.userId);
  if (!roomKey) return;
  userVoiceRoom.delete(client.userId);
  voiceClientByUser.delete(client.userId);
  {
    const hands = userHandsKey(client.userId);
    if (hands) {
      stageHands.get(hands)?.delete(client.userId);
      if (stageHands.get(hands)?.size === 0) stageHands.delete(hands);
    }
  }
  voiceSessionByUser.delete(client.userId);
  const room = voiceRooms.get(roomKey);
  if (room) {
    room.delete(client.userId);
    if (room.size === 0) voiceRooms.delete(roomKey);
  }
  if (roomKey.startsWith("dm:")) {
    const conversationId = Number(roomKey.slice(3));
    const session = dmCallSessions.get(conversationId);
    if (session && !voiceRooms.get(roomKey)?.size) {
      if (intentional) {
        await endDmCall(
          conversationId,
          session.answered ? "completed" : "cancelled"
        );
      } else {
        if (session.emptyRoomTimeout) clearTimeout(session.emptyRoomTimeout);
        const callId = session.callId;
        session.emptyRoomTimeout = setTimeout(() => {
          const current = dmCallSessions.get(conversationId);
          if (current?.callId === callId && !voiceRooms.get(roomKey)?.size) {
            void endDmCall(
              conversationId,
              current.answered ? "completed" : "cancelled"
            );
          }
        }, 20_000);
        session.emptyRoomTimeout.unref?.();
      }
    }
  }
  if (roomKey.startsWith("c:")) {
    getDb()
      .update(schema.voiceSessions)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(schema.voiceSessions.channelId, Number(roomKey.slice(2))),
          eq(schema.voiceSessions.userId, client.userId)
        )
      )
      .catch(() => {});
  }
  await broadcastVoiceParticipants(roomKey);
}

async function voiceStateUpdate(
  client: Client,
  patch: Partial<
    Pick<VoiceParticipant, "muted" | "deafened" | "camera" | "screen">
  > & { voiceSessionId?: string }
) {
  if (patch.voiceSessionId !== voiceSessionByUser.get(client.userId)) return;
  const statePatch: Partial<
    Pick<VoiceParticipant, "muted" | "deafened" | "camera" | "screen">
  > = {};
  if (typeof patch.muted === "boolean") statePatch.muted = patch.muted;
  if (typeof patch.deafened === "boolean") statePatch.deafened = patch.deafened;
  if (typeof patch.camera === "boolean") statePatch.camera = patch.camera;
  if (typeof patch.screen === "boolean") statePatch.screen = patch.screen;
  const roomKey = userVoiceRoom.get(client.userId);
  if (!roomKey) return;
  const room = voiceRooms.get(roomKey);
  const participant = room?.get(client.userId);
  if (!participant) return;
  // Stage audience cannot transmit.
  if (participant.speaker === false) {
    statePatch.camera = false;
    statePatch.screen = false;
    if (statePatch.muted === false) delete statePatch.muted;
  }
  // Stage: hard cap of simultaneous transmitters.
  if (
    roomKey.startsWith("c:") &&
    (statePatch.camera === true || statePatch.screen === true)
  ) {
    const channelRow = await getDb().query.channels.findFirst({
      where: eq(schema.channels.id, Number(roomKey.slice(2))),
    });
    if (channelRow?.type === "STAGE") {
      if (!room) return;
      const transmitters = await countTransmitters(room);
      if (transmitters >= STAGE_MAX_TRANSMITTERS) {
        delete statePatch.camera;
        delete statePatch.screen;
      }
    }
  }
  Object.assign(participant, statePatch);
  if (statePatch.deafened) participant.muted = true;
  await broadcastVoiceParticipants(roomKey);
}

// ── Message handling ──────────────────────────────────────────
async function handleEvent(client: Client, event: WSClientEvent) {
  switch (event.t) {
    case "ping":
      send(client, { t: "pong" });
      break;
    case "typing": {
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, client.userId),
      });
      if (!user) return;
      const payload = {
        t: "typing" as const,
        channelId: event.channelId,
        conversationId: event.conversationId,
        user: toPublicUser(user),
      };
      if (event.channelId) {
        const channel = await getDb().query.channels.findFirst({
          where: eq(schema.channels.id, event.channelId),
        });
        if (!channel) return;
        const members = await serverMemberIds(channel.serverId);
        sendToUsers(
          members.filter(id => id !== client.userId),
          payload
        );
      } else if (event.conversationId) {
        const rows = await getDb()
          .select({ userId: schema.conversationMembers.userId })
          .from(schema.conversationMembers)
          .where(
            eq(schema.conversationMembers.conversationId, event.conversationId)
          );
        sendToUsers(
          rows.map(r => r.userId).filter(id => id !== client.userId),
          payload
        );
      }
      break;
    }
    case "presence": {
      manualStatus.set(client.userId, event.status);
      await broadcastPresence(client.userId);
      break;
    }
    case "voice:join":
      await voiceJoin(client, event);
      break;
    case "voice:leave":
      if (event.voiceSessionId === voiceSessionByUser.get(client.userId)) {
        await voiceLeave(client, true);
      }
      break;
    case "call:decline":
      await declineDmCall(client, event.conversationId);
      break;
    case "voice:state":
      await voiceStateUpdate(client, event);
      break;
    case "stage:hand": {
      const myRoom = userVoiceRoom.get(client.userId);
      if (!myRoom?.startsWith("c:")) return;
      const expected =
        event.channelId != null ? channelRoomKey(event.channelId) : null;
      if (expected !== myRoom) return;
      // Only audience may raise hands.
      const room = voiceRooms.get(myRoom);
      if (!room) return;
      const me = room.get(client.userId);
      if (!me || me.speaker !== false) return;
      let set = stageHands.get(myRoom);
      if (!set) {
        set = new Set();
        stageHands.set(myRoom, set);
      }
      if (event.raised) set.add(client.userId);
      else set.delete(client.userId);
      broadcastStageHands(myRoom);
      break;
    }
    case "signal": {
      const myRoom = userVoiceRoom.get(client.userId);
      if (!myRoom) return;
      if (event.voiceSessionId !== voiceSessionByUser.get(client.userId))
        return;
      const expected = event.channelId
        ? channelRoomKey(event.channelId)
        : event.conversationId
          ? dmRoomKey(event.conversationId)
          : null;
      if (expected !== myRoom) return;
      const room = voiceRooms.get(myRoom);
      if (!room?.has(event.to)) return;
      if (!isValidSignalData(event.data)) return;
      const targetClient = voiceClientByUser.get(event.to);
      if (!targetClient) return;
      send(targetClient, {
        t: "signal",
        from: client.userId,
        channelId: event.channelId,
        conversationId: event.conversationId,
        data: event.data,
      });
      break;
    }
  }
}

export function isValidSignalData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const signal = value as {
    description?: { type?: unknown; sdp?: unknown };
    candidate?: unknown;
  };
  if (signal.description) {
    if (
      !["offer", "answer", "pranswer", "rollback"].includes(
        String(signal.description.type)
      )
    ) {
      return false;
    }
    if (
      signal.description.sdp !== undefined &&
      (typeof signal.description.sdp !== "string" ||
        signal.description.sdp.length > 1_000_000)
    ) {
      return false;
    }
    return true;
  }
  return "candidate" in signal;
}

// ── Attach to HTTP server ─────────────────────────────────────
export function attachRealtime(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on(
    "upgrade",
    async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      let pathname = "";
      try {
        pathname = new URL(req.url ?? "", "http://localhost").pathname;
      } catch {
        socket.destroy();
        return;
      }
      if (pathname !== "/ws") return; // let other upgrade handlers run

      const origin = req.headers.origin?.replace(/\/$/, "") ?? "";
      const forwardedHost = req.headers["x-forwarded-host"];
      const host =
        (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ??
        req.headers.host ??
        "";
      const forwardedProto = req.headers["x-forwarded-proto"];
      const protocol =
        (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ??
        (env.isProduction ? "https" : "http");
      const requestOrigin = host ? `${protocol}://${host}` : "";

      if (
        origin &&
        origin !== requestOrigin &&
        !env.allowedOrigins.includes(origin)
      ) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      try {
        const cookies = cookie.parse(req.headers.cookie ?? "");
        const token = cookies[Session.cookieName];
        const claim = token ? await verifySessionToken(token) : null;
        // Sessão deve existir e estar ativa (revogação remota funciona aqui).
        const session = claim ? await resolveActiveSession(claim.sid) : null;
        const user =
          claim && session ? await findUserByUnionId(claim.unionId) : null;
        if (!user || !session) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, ws => {
          wss.emit("connection", ws, req, user.id, session.id);
        });
      } catch {
        socket.destroy();
      }
    }
  );

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.ws.terminate();
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, 30_000);
  heartbeat.unref();

  wss.on(
    "connection",
    async (
      ws: WebSocket,
      _req: IncomingMessage,
      userId: number,
      sid: string | null
    ) => {
      const client: Client = { ws, userId, sid: sid ?? null, alive: true };
      addClient(client);
      send(client, { t: "ready", userId });
      await broadcastPresence(userId);

      ws.on("pong", () => {
        client.alive = true;
      });

      ws.on("message", raw => {
        client.alive = true;
        let event: WSClientEvent;
        try {
          event = JSON.parse(raw.toString());
        } catch {
          return;
        }
        handleEvent(client, event).catch(err => {
          console.error("[realtime] event error:", err);
        });
      });

      ws.on("close", () => {
        const wasLastConnection = (byUser.get(userId)?.size ?? 0) <= 1;
        removeClient(client);
        voiceLeave(client).catch(() => {});
        if (wasLastConnection && !byUser.has(userId)) {
          broadcastPresence(userId).catch(() => {});
        }
      });
    }
  );

  console.log("[realtime] WebSocket server attached at /ws");
}
