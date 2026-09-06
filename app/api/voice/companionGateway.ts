 import { WebSocketServer, WebSocket } from "ws";
 import type { Server as HttpServer } from "http";
 import type { IncomingMessage } from "http";
 import type { Duplex } from "stream";
import type {
  CompanionControlAction,
  WSPublicClientEvent,
  WSPublicServerEvent,
} from "@contracts/types";
 import { env } from "../lib/env";
import {
  getCompanionSessionByCode,
  toPublic,
  disbandCompanionSession,
  type CompanionSession,
} from "./companion";
 import { sendToUsers } from "../realtime";
 
 /**
  * Public companion WebSocket gateway.
  *
  * A companion device (no login) connects to /ws/companion and pairs to a
  * live voice session via a short QR code. Only *signaling* and control
  * messages flow through the server: media is sent peer-to-peer between the
  * companion device and the call owner over WebRTC.
  */
 
 function isPublicEvent(value: unknown): value is WSPublicClientEvent {
   if (!value || typeof value !== "object") return false;
   const event = value as Record<string, unknown>;
   if (!["pair", "companion:ready", "companion:signal", "companion:control"].includes(String(event.t))) return false;
   if (typeof event.code !== "string" || event.code.length > 16) return false;
   if (event.t === "pair" || event.t === "companion:ready") return true;
   return true;
 }
 
 export function attachCompanionGateway(server: HttpServer) {
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
       if (pathname !== "/ws/companion") return;
 
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
       const requestOrigin = host ? protocol + "://" + host : "";
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
     let pairedCode: string | null = null;
 
     ws.on("message", raw => {
       let event: unknown;
       try {
         event = JSON.parse(raw.toString());
       } catch {
         return;
       }
       if (!isPublicEvent(event)) return;
 
       if (event.t === "pair") {
         const session = getCompanionSessionByCode(event.code);
         if (!session) {
           sendPublic(ws, {
             t: "companion:error",
             code: event.code,
             message: "Código inválido ou expirado.",
           });
           return;
         }
         if (session.companionSocket && session.companionSocket !== ws) {
           sendPublic(ws, {
             t: "companion:error",
             code: event.code,
             message: "Este pareamento já está em uso por outro dispositivo.",
           });
           return;
         }
         pairedCode = event.code;
         session.companionSocket = ws;
         session.status = "paired";
         sendPublic(ws, {
           t: "paired",
           code: event.code,
           session: toPublic(session),
         });
         sendToUsers([session.ownerUserId], {
           t: "companion:paired",
           sessionId: session.id,
         });
         sendToUsers([session.ownerUserId], {
           t: "companion:state",
           sessionId: session.id,
           session: toPublic(session),
         });
         return;
       }
 
       if (!pairedCode) return;
       const session = getCompanionSessionByCode(pairedCode);
       if (!session || session.companionSocket !== ws) return;
 
       if (event.t === "companion:ready") {
         session.status = "video-ready";
         sendToUsers([session.ownerUserId], {
           t: "companion:state",
           sessionId: session.id,
           session: toPublic(session),
         });
         return;
       }
 
       if (event.t === "companion:signal") {
         sendToUsers([session.ownerUserId], {
           t: "companion:signal",
           sessionId: session.id,
           data: event.data,
         });
         return;
       }
 
       if (event.t === "companion:control") {
         applyCompanionControl(session, event.action);
         sendToUsers([session.ownerUserId], {
           t: "companion:control",
           sessionId: session.id,
           action: event.action,
         });
         // Keep the public side in sync.
         sendPublic(ws, {
           t: "companion:state",
           code: pairedCode,
           session: toPublic(session),
         });
       }
     });
 
     ws.on("close", () => {
       if (!pairedCode) return;
       const session = getCompanionSessionByCode(pairedCode);
       if (session && session.companionSocket === ws) {
         session.companionSocket = null;
         session.status = "disconnected";
         sendToUsers([session.ownerUserId], {
           t: "companion:disconnected",
           sessionId: session.id,
         });
         sendToUsers([session.ownerUserId], {
           t: "companion:state",
           sessionId: session.id,
           session: toPublic(session),
         });
         disbandCompanionSession(session);
       }
     });
   });
 
   console.log("[companion] WebSocket gateway attached at /ws/companion");
 }
 
 function sendPublic(ws: WebSocket, event: WSPublicServerEvent) {
   if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
 }
 
function applyCompanionControl(session: CompanionSession, action: CompanionControlAction) {
   switch (action) {
     case "toggle-camera":
       session.cameraActive = !session.cameraActive;
       break;
     case "toggle-mute":
       session.muted = !session.muted;
       break;
     case "toggle-deafen":
       session.deafened = !session.deafened;
       break;
     case "toggle-screen":
       session.screenActive = !session.screenActive;
       break;
     case "leave-call":
       session.status = "disconnected";
       session.cameraActive = false;
       break;
   }
 }
