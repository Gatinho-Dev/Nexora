import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import type { WSLiveClientEvent, WSLiveServerEvent } from "@contracts/live";
import {
  LIVE_CHAT_MAX_LENGTH,
  isValidRoomCode,
  sanitizeNickname,
  validateNickname,
} from "@contracts/live";
import { env } from "../lib/env";
import {
  detachSocket,
  endRoomByHost,
  joinRoom,
  kickParticipant,
  postChat,
  relaySignal,
  removeSession,
  updateState,
} from "./rooms";
import { isValidSignalData } from "../realtime";
/**
 * Gateway WebSocket público do Nexora Live (/ws/live).
 *
 * Segue o mesmo padrão do gateway /ws/companion: upgrade por pathname,
 * verificação de origem e mensagens JSON com validação estrita. Nenhuma
 * autenticação Nexora é necessária — cada conexão recebe um sessionId
 * efêmero. Todo estado de sala vive em api/live/rooms.ts.
 */

const WS_OPEN = 1;

type LiveConnection = {
  ws: WebSocket;
  /** sessionId informado pelo cliente no join (chave pública da sessão). */
  sessionId: string | null;
  /** Segredo emitido pelo servidor no join — nunca aceito do cliente. */
  sessionToken: string | null;
  roomCode: string | null;
  lastSignalAt: number;
  signalCount: number;
};

function send(ws: WebSocket, event: WSLiveServerEvent) {
  if (ws.readyState === WS_OPEN) {
    ws.send(JSON.stringify(event));
  }
}

/** Máximo de sinalizações por janela de 10s por conexão (anti-spam). */
const SIGNAL_WINDOW_MS = 10_000;
const SIGNAL_MAX_PER_WINDOW = 120;

export function attachLiveGateway(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on(
    "upgrade",
    (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      let pathname = "";
      try {
        pathname = new URL(req.url ?? "", "http://localhost").pathname;
      } catch {
        socket.destroy();
        return;
      }
      if (pathname !== "/ws/live") return;

      // Mesma política de origem do /ws e /ws/companion.
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

      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit("connection", ws, req);
      });
    }
  );

  // Heartbeat: encerra conexões zumbis (mesmo padrão do /ws).
  const heartbeat = setInterval(() => {
    for (const connection of connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.ping();
        } catch {
          // ignore
        }
      }
    }
  }, 30_000);
  heartbeat.unref();

  const connections = new Map<WebSocket, LiveConnection>();

  wss.on("connection", (ws: WebSocket) => {
    const connection: LiveConnection = {
      ws,
      sessionId: null,
      sessionToken: null,
      roomCode: null,
      lastSignalAt: 0,
      signalCount: 0,
    };
    connections.set(ws, connection);

    ws.on("pong", () => {
      // nada a fazer — o ping serve apenas para manter viva a conexão.
    });

    ws.on("message", raw => {
      let event: unknown;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!event || typeof event !== "object") return;
      const t = String((event as Record<string, unknown>).t ?? "");
      if (
        ![
          "ping",
          "live:join",
          "live:signal",
          "live:chat",
          "live:state",
          "live:kick",
          "live:end",
          "live:leave",
        ].includes(t)
      ) {
        return;
      }
      void handleEvent(connection, event as WSLiveClientEvent).catch(err => {
        console.error("[live] event error:", err);
      });
    });

    ws.on("close", () => {
      connections.delete(ws);
      if (connection.roomCode && connection.sessionId) {
        detachSocket(connection.roomCode, connection.sessionId, ws);
      }
    });

    ws.on("error", () => {
      // close handler cuida da limpeza.
    });
  });

  async function handleEvent(
    connection: LiveConnection,
    event: WSLiveClientEvent
  ): Promise<void> {
    const { ws } = connection;

    switch (event.t) {
      case "ping":
        send(ws, { t: "pong" });
        return;

      case "live:join": {
        if (connection.roomCode) {
          // Já está em uma sala nesta conexão: ignora (evita dup join).
          return;
        }
        const code = isValidRoomCode(event.code) ? event.code : "";
        const nickname = sanitizeNickname(String(event.nickname ?? ""));
        const validation = validateNickname(nickname);
        if (!code || !validation.ok) {
          send(ws, {
            t: "live:denied",
            reason: validation.ok ? "room-unavailable" : "nick-invalid",
            message: validation.ok
              ? "Esta sala não está mais disponível."
              : validation.error,
          });
          return;
        }
        // O cliente gera o sessionId (UUID v4) e mantém por aba no
        // sessionStorage para religar após refresh; o servidor emite o
        // sessionToken secreto no primeiro join.
        const clientId =
          typeof event.sessionId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            event.sessionId
          )
            ? event.sessionId
            : null;
        if (!clientId) {
          send(ws, {
            t: "live:denied",
            reason: "nick-invalid",
            message: "Sessão inválida. Recarregue a página.",
          });
          return;
        }
        connection.sessionId = clientId;
        const result = joinRoom({
          code,
          sessionId: clientId,
          nickname: validation.value,
          socket: ws,
          sessionToken: event.sessionToken,
          hostToken:
            typeof event.hostToken === "string" && event.hostToken.length <= 128
              ? event.hostToken
              : undefined,
        });
        if (!result.ok) {
          send(ws, {
            t: "live:denied",
            reason: result.reason,
            message: result.message,
          });
          return;
        }
        connection.roomCode = code;
        connection.sessionToken = result.payload.sessionToken;
        send(ws, { t: "live:joined", payload: result.payload });
        return;
      }

      case "live:signal": {
        if (!connection.roomCode || !connection.sessionId) return;
        // Rate limit simples por conexão.
        const now = Date.now();
        if (now - connection.lastSignalAt > SIGNAL_WINDOW_MS) {
          connection.lastSignalAt = now;
          connection.signalCount = 0;
        }
        connection.signalCount++;
        if (connection.signalCount > SIGNAL_MAX_PER_WINDOW) return;
        if (!isValidSignalData(event.data)) return;
        relaySignal(connection.sessionId, String(event.to ?? ""), event.data);
        return;
      }

      case "live:chat": {
        if (!connection.roomCode || !connection.sessionId) return;
        const content = String(event.content ?? "");
        if (!content || content.length > LIVE_CHAT_MAX_LENGTH) return;
        const result = postChat(connection.sessionId, content);
        if (!result.ok) {
          if (result.error === "rate-limited") {
            send(ws, {
              t: "live:denied",
              reason: "rate-limited",
              message: "Você está enviando mensagens rápido demais.",
            });
          }
          return;
        }
        return;
      }

      case "live:state": {
        if (!connection.roomCode || !connection.sessionId) return;
        updateState(connection.sessionId, {
          muted:
            typeof event.muted === "boolean" ? event.muted : undefined,
          camera:
            typeof event.camera === "boolean" ? event.camera : undefined,
          screen: typeof event.screen === "boolean" ? event.screen : undefined,
        });
        return;
      }

      case "live:kick": {
        if (!connection.roomCode || !connection.sessionId) return;
        kickParticipant(connection.sessionId, String(event.sessionId ?? ""));
        return;
      }

      case "live:end": {
        if (!connection.roomCode || !connection.sessionId) return;
        endRoomByHost(connection.sessionId);
        connection.roomCode = null;
        return;
      }

      case "live:leave": {
        if (connection.roomCode && connection.sessionId) {
          removeSession(connection.sessionId);
          connection.roomCode = null;
        }
        return;
      }
    }
  }

  console.log("[live] WebSocket gateway attached at /ws/live");
}
