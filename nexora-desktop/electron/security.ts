export const API_ORIGIN = "https://nexorachat.cloud";
export const APP_ORIGIN = "nexora://app";

/**
 * Política de permissões do Chromium. Somente microfone/câmera do renderer
 * confiável são liberados; captura de tela, geolocalização e demais
 * permissões continuam negadas.
 */
export function mediaPermissionAllowed(
  permission: string,
  requestingUrl: string | undefined,
  dev: boolean,
): boolean {
  if (permission !== "media" || !requestingUrl) return false;
  return trustedFrame(requestingUrl, dev);
}

/** Eventos de voz que o renderer pode enviar pelo WebSocket autenticado. */
const VOICE_OUTBOUND = new Set(["voice:join", "voice:leave", "voice:state", "signal", "call:decline"]);

export function validVoiceOutbound(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (typeof event.t !== "string" || !VOICE_OUTBOUND.has(event.t)) return false;
  const target = (v: unknown) => v === undefined || (Number.isSafeInteger(v) && (v as number) > 0);
  const sessionId = (v: unknown) => v === undefined || (typeof v === "string" && v.length > 0 && v.length <= 128);
  const flag = (v: unknown) => v === undefined || typeof v === "boolean";
  const onlyKeys = (allowed: string[]) => Object.keys(event).every(k => allowed.includes(k));
  // No máximo um destino de sala (canal ou DM).
  const atMostOneRoom = (ev: Record<string, unknown>) =>
    ev.channelId === undefined || ev.conversationId === undefined;
  switch (event.t) {
    case "voice:join":
      return (
        onlyKeys(["t", "channelId", "conversationId", "initiated", "video"]) &&
        atMostOneRoom(event) && target(event.channelId) && target(event.conversationId) &&
        (event.channelId !== undefined) !== (event.conversationId !== undefined) &&
        flag(event.initiated) && flag(event.video)
      );
    case "voice:leave":
      return onlyKeys(["t", "voiceSessionId"]) && sessionId(event.voiceSessionId);
    case "voice:state":
      return (
        onlyKeys(["t", "muted", "deafened", "camera", "screen", "voiceSessionId"]) &&
        flag(event.muted) && flag(event.deafened) && flag(event.camera) && flag(event.screen) &&
        sessionId(event.voiceSessionId)
      );
    case "signal":
      return (
        onlyKeys(["t", "to", "channelId", "conversationId", "voiceSessionId", "data"]) &&
        target(event.to) && (event.to as number) > 0 &&
        target(event.channelId) && target(event.conversationId) &&
        atMostOneRoom(event) &&
        sessionId(event.voiceSessionId) &&
        typeof event.data === "object" && event.data !== null &&
        JSON.stringify(event.data).length <= 64 * 1024
      );
    case "call:decline":
      return onlyKeys(["t", "conversationId"]) && target(event.conversationId) && typeof event.conversationId === "number";
  }
  return false;
}

export function trustedFrame(url: string, dev: boolean): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "nexora:" && parsed.hostname === "app") ||
      (dev && parsed.origin === "http://127.0.0.1:5174")
    );
  } catch {
    return false;
  }
}

export function safeExternal(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      ["nexorachat.cloud", "github.com"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

const positive = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) > 0;
function target(input: Record<string, unknown>): boolean {
  return (
    (positive(input.channelId) && input.conversationId === undefined) ||
    (positive(input.conversationId) && input.channelId === undefined)
  );
}
export function allowedUploadType(mimeType: string): boolean {
  return ["image/", "video/", "audio/", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument", "application/zip", "text/plain"].some((prefix) => mimeType.startsWith(prefix));
}

export function validRpc(path: unknown, input: unknown): boolean {
  if (typeof path !== "string") return false;
  if (["auth.me", "server.list", "dm.list", "auth.logout", "advanced.profile.myProfile"].includes(path))
    return input === undefined;
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  const only = (...allowed: string[]) =>
    keys.every((key) => allowed.includes(key));
  if (path === "server.get") return only("serverId") && positive(obj.serverId);
  if (path === "message.list")
    return (
      only("channelId", "conversationId", "limit", "before") &&
      target(obj) &&
      (obj.limit === undefined ||
        (positive(obj.limit) && Number(obj.limit) <= 100)) &&
      (obj.before === undefined || positive(obj.before))
    );
  if (path === "message.send")
    return (
      only("channelId", "conversationId", "content", "replyToId", "attachmentIds") &&
      target(obj) &&
      typeof obj.content === "string" &&
      obj.content.length <= 4000 &&
      (obj.content.trim().length > 0 || (Array.isArray(obj.attachmentIds) && obj.attachmentIds.length > 0)) &&
      (obj.replyToId === undefined || positive(obj.replyToId)) &&
      (obj.attachmentIds === undefined ||
        (Array.isArray(obj.attachmentIds) && obj.attachmentIds.length <= 10 && obj.attachmentIds.every(positive)))
    );
  if (path === "message.edit")
    return only("messageId", "content") && positive(obj.messageId) && typeof obj.content === "string" && obj.content.trim().length > 0 && obj.content.length <= 4000;
  if (path === "message.delete") return only("messageId") && positive(obj.messageId);
  if (path === "message.addReaction" || path === "message.removeReaction")
    return only("messageId", "emoji") && positive(obj.messageId) && typeof obj.emoji === "string" && obj.emoji.length > 0 && obj.emoji.length <= 32;
  if (path === "message.markRead") return only("channelId", "conversationId", "lastMessageId") && target(obj) && positive(obj.lastMessageId);
  if (path === "advanced.profile.publicProfile") return only("userId") && positive(obj.userId);
  return false;
}

export function validTyping(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const obj = input as Record<string, unknown>;
  return Object.keys(obj).every((key) => key === "channelId" || key === "conversationId") && target(obj);
}
