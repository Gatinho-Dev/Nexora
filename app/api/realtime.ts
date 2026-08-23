import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import * as cookie from "cookie";
import { and, eq, ne, or } from "drizzle-orm";
import { Session, type UserStatus } from "@contracts/constants";
import type {
  VoiceParticipant,
  WSClientEvent,
  WSServerEvent,
} from "@contracts/types";
import { verifySessionToken } from "./kimi/session";
import { findUserByUnionId } from "./queries/users";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { getMemberPermissions, toPublicUser } from "./utils/permissions";
import { env } from "./lib/env";
import { randomUUID } from "node:crypto";

// ── Connection registry ───────────────────────────────────────
type Client = {
  ws: WebSocket;
  userId: number;
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

function channelRoomKey(channelId: number) {
  return `c:${channelId}`;
}
function dmRoomKey(conversationId: number) {
  return `dm:${conversationId}`;
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
  const rows = await getDb()
    .select({ userId: schema.serverMembers.userId })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.serverId, serverId));
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
    await broadcastToChannel(channelId, {
      t: "voice:participants",
      channelId,
      participants,
    });
  } else {
    const conversationId = Number(roomKey.slice(3));
    await broadcastToConversation(conversationId, {
      t: "voice:participants",
      conversationId,
      participants,
    });
  }
}

async function voiceJoin(
  client: Client,
  target: { channelId?: number; conversationId?: number }
) {
  const db = getDb();
  let roomKey: string;
  let channelType: string | null = null;
  let channelServerId: number | null = null;

  if (target.channelId) {
    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, target.channelId),
    });
    if (!channel || (channel.type !== "VOICE" && channel.type !== "STAGE"))
      return;
    const perms = await getMemberPermissions(client.userId, channel.serverId);
    if (!perms || !perms.has("CONNECT")) return;
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
    if (!member) return;
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

  // Audit row for server voice channels (best-effort).
  if (target.channelId) {
    db.insert(schema.voiceSessions)
      .values({ channelId: target.channelId, userId: client.userId })
      .catch(() => {});
  }

  await broadcastVoiceParticipants(roomKey);
}

async function voiceLeave(client: Client) {
  const activeVoiceClient = voiceClientByUser.get(client.userId);
  if (activeVoiceClient && activeVoiceClient !== client) return;
  const roomKey = userVoiceRoom.get(client.userId);
  if (!roomKey) return;
  userVoiceRoom.delete(client.userId);
  voiceClientByUser.delete(client.userId);
  voiceSessionByUser.delete(client.userId);
  const room = voiceRooms.get(roomKey);
  if (room) {
    room.delete(client.userId);
    if (room.size === 0) voiceRooms.delete(roomKey);
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
        await voiceLeave(client);
      }
      break;
    case "voice:state":
      await voiceStateUpdate(client, event);
      break;
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
        const user = claim ? await findUserByUnionId(claim.unionId) : null;
        if (!user) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, ws => {
          wss.emit("connection", ws, req, user.id);
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
    async (ws: WebSocket, _req: IncomingMessage, userId: number) => {
      const client: Client = { ws, userId, alive: true };
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
