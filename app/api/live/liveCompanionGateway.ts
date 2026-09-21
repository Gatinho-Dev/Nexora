import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { env } from "../lib/env";
import {
  getLiveCompanionByCode,
  disbandLiveCompanion,
  type LiveCompanionSession,
} from "./rooms";
import { isValidSignalData } from "../realtime";
import {
  attachLiveCompanionSocket,
  detachLiveCompanionSocket,
  relayLiveCompanionSignal,
  liveCompanionControl,
  isLiveCompanionApproved,
} from "./liveCompanionBridge";

/**
 * Gateway público do Nexora Mobile Camera para salas do Nexora Live
 * (/ws/live-companion).
 *
 * Mesmo padrão do /ws/companion (Nexora tradicional): upgrade por pathname,
 * verificação de origem e mensagens JSON com validação estrita. O celular
 * envia a oferta WebRTC e o áudio/vídeo fluem P2P direto para o dono — o
 * servidor só retransmite signaling e controles.
 */

const WS_OPEN = 1;

/** Tolerância para o celular religar o WS após queda breve de rede. */
const RECONNECT_GRACE_MS = 10_000;

type MobileConnection = {
  session: LiveCompanionSession | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

function send(ws: WebSocket, event: Record<string, unknown>) {
  if (ws.readyState === WS_OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function attachLiveCompanionGateway(server: HttpServer) {
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
      if (pathname !== "/ws/live-companion") return;

      // Mesma política de origem dos demais gateways.
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

  wss.on("connection", (ws: WebSocket) => {
    const connection: MobileConnection = {
      session: null,
      reconnectTimer: null,
    };

    ws.on("message", raw => {
      let event: unknown;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!event || typeof event !== "object") return;
      const t = String((event as Record<string, unknown>).t ?? "");
      const code = String((event as Record<string, unknown>).code ?? "");
      if (!["pair", "companion:ready", "companion:signal", "companion:control"].includes(t)) {
        return;
      }
      if (!code || code.length > 16) return;

      if (t === "pair") {
        const session = getLiveCompanionByCode(code);
        if (!session) {
          send(ws, {
            t: "companion:error",
            code,
            message: "Código inválido ou expirado.",
          });
          return;
        }
        if (
          session.companionSocket &&
          session.companionSocket !== ws &&
          (session.companionSocket as WebSocket).readyState === WS_OPEN
        ) {
          send(ws, {
            t: "companion:error",
            code,
            message: "Este pareamento já está em uso por outro dispositivo.",
          });
          return;
        }
        connection.session = session;
        if (connection.reconnectTimer) {
          clearTimeout(connection.reconnectTimer);
          connection.reconnectTimer = null;
        }
        session.companionSocket = ws;
        const isReconnect = attachLiveCompanionSocket(session);
        if (isReconnect) {
          // Mesmo celular já aprovado: religa sem nova aprovação.
          send(ws, { t: "paired", code });
        } else {
          // O pareamento só se completa quando o dono aprova no PC:
          // o bridge envia "paired" de volta após a aprovação.
          send(ws, { t: "companion:pending", code });
        }
        return;
      }

      if (!connection.session) return;
      const session = connection.session;
      if (getLiveCompanionByCode(session.code) !== session) {
        connection.session = null;
        send(ws, {
          t: "companion:error",
          code: session.code,
          message: "Este pareamento expirou. Conecte-se novamente.",
        });
        return;
      }
      // Fonte da verdade é o bridge: a aprovação acontece no dono (outro
      // gateway), então o estado local não pode ser confiável aqui.
      if (!isLiveCompanionApproved(session)) return;

      if (t === "companion:signal") {
        if (!isValidSignalData((event as { data?: unknown }).data)) return;
        relayLiveCompanionSignal(session, (event as { data?: unknown }).data);
        return;
      }

      if (t === "companion:control") {
        const action = String((event as { action?: unknown }).action ?? "");
        if (
          ![
            "camera-on",
            "camera-off",
            "mic-on",
            "mic-off",
            "disconnect",
            "leave-call",
          ].includes(action)
        ) {
          return;
        }
        liveCompanionControl(session, action);
        return;
      }
    });

    ws.on("close", () => {
      const session = connection.session;
      if (!session) return;
      detachLiveCompanionSocket(session, ws);

      if (!isLiveCompanionApproved(session)) {
        // Nunca aprovado: consome a sessão (código não pode ser reusado).
        disbandLiveCompanion(session);
        connection.session = null;
        return;
      }

      // Queda breve (troca de Wi-Fi/dados): guarda o lugar por 10s.
      connection.reconnectTimer = setTimeout(() => {
        const stillOurs = getLiveCompanionByCode(session.code) === session;
        if (stillOurs) {
          disbandLiveCompanion(session);
          liveCompanionControl(session, "__owner:disconnected");
        }
      }, RECONNECT_GRACE_MS);
    });
  });

  console.log("[live-companion] WebSocket gateway attached at /ws/live-companion");
}
