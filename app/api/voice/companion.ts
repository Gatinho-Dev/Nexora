import { randomUUID } from "node:crypto";
import type { CompanionSessionPublic, CompanionStatus } from "@contracts/types";

/**
 * In-memory companion session registry.
 *
 * A companion device pairs to a live Nexora voice call by scanning a QR code
 * (no login). The pairing code is a short random token valid for a few
 * minutes. We keep the session in memory on the process that owns the voice
 * room; the WebSocket gateway for companion connections lives in this file
 * and is attached to the same HTTP server as /ws.
 */

export type CompanionSession = {
  id: string;
  code: string;
  ownerUserId: number;
  sessionId: string;
  status: CompanionStatus;
  cameraActive: boolean;
  muted: boolean;
  deafened: boolean;
  screenActive: boolean;
  participantsCount: number;
  createdAt: number;
  expiresAt: number;
  ownerSocket: import("ws").WebSocket | null;
  companionSocket: import("ws").WebSocket | null;
};

/** Alphanumeric code without ambiguous glyphs (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePairingCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isCompanionCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,12}$/.test(value)
  );
}

const sessions = new Map<string, CompanionSession>();
const expiresByCode = new Map<string, string>();
const sessionsByOwner = new Map<string, number>(); // sessionId -> ownerUserId

const COMPANION_LIFETIME_MS = 10 * 60_000; // pairing valid for 10 minutes

export function toPublic(session: CompanionSession): CompanionSessionPublic {
  return {
    id: session.id,
    ownerUserId: session.ownerUserId,
    status: session.status,
    cameraActive: session.cameraActive,
    muted: session.muted,
    deafened: session.deafened,
    screenActive: session.screenActive,
    participantsCount: session.participantsCount,
    createdAt: new Date(session.createdAt).toISOString(),
  };
}

export function getCompanionSessionForOwner(
  sessionId: string,
  ownerUserId: number
): CompanionSession | undefined {
  const owner = sessionsByOwner.get(sessionId);
  if (owner !== ownerUserId) return undefined;
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    sessions.delete(session.id);
    return undefined;
  }
  return session;
}

export function getCompanionSession(id: string): CompanionSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    sessions.delete(id);
    expiresByCode.delete(session.code);
    sessionsByOwner.delete(session.sessionId);
    return undefined;
  }
  return session;
}

export function getCompanionSessionByCode(
  code: string
): CompanionSession | undefined {
  const id = expiresByCode.get(code);
  if (!id) return undefined;
  const session = sessions.get(id);
  if (!session || Date.now() > session.expiresAt) {
    expiresByCode.delete(code);
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function createCompanionSession(input: {
  ownerUserId: number;
  sessionId: string;
}) {
  // One active companion per voice session.
  cleanupExpired();
  const existing = getCompanionSessionForOwner(
    input.sessionId,
    input.ownerUserId
  );
  if (existing) return existing;

  let code = generatePairingCode();
  while (expiresByCode.has(code)) code = generatePairingCode();

  const now = Date.now();
  const session: CompanionSession = {
    id: randomUUID(),
    code,
    ownerUserId: input.ownerUserId,
    sessionId: input.sessionId,
    status: "pending",
    cameraActive: false,
    muted: false,
    deafened: false,
    screenActive: false,
    participantsCount: 0,
    createdAt: now,
    expiresAt: now + COMPANION_LIFETIME_MS,
    ownerSocket: null,
    companionSocket: null,
  };
  sessions.set(session.id, session);
  expiresByCode.set(code, session.id);
  sessionsByOwner.set(session.sessionId, input.ownerUserId);
  return session;
}

export function refreshCompanionExpiry(
  session: CompanionSession,
  ttlMs = COMPANION_LIFETIME_MS
) {
  session.expiresAt = Date.now() + ttlMs;
}

export function disbandCompanionSession(session: CompanionSession) {
  sessions.delete(session.id);
  expiresByCode.delete(session.code);
  sessionsByOwner.delete(session.sessionId);
}

export function cleanupExpired() {
  const now = Date.now();
  for (const session of [...sessions.values()]) {
    if (now > session.expiresAt) {
      sessions.delete(session.id);
      expiresByCode.delete(session.code);
      sessionsByOwner.delete(session.sessionId);
    }
  }
}
