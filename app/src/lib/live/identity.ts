import { randomUUID } from "@/lib/live/uuid";

/**
 * Identidade efêmera do participante do Nexora Live.
 *
 * O sessionId é gerado pelo cliente e vive no sessionStorage (por aba) para
 * permitir reconexão após refresh. O sessionToken secreto é emitido pelo
 * servidor no primeiro join e guardado junto — nunca é escolhido pelo cliente.
 */

const KEY = "nexora-live-identity";

export type LiveIdentity = {
  sessionId: string;
  nickname: string;
  /** Segredo emitido pelo servidor (por sala); vazio antes do primeiro join. */
  sessionToken: string;
  /** hostToken quando este cliente criou a sala (reassumir host). */
  hostToken: string;
  roomCode: string;
};

export function loadIdentity(): LiveIdentity | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveIdentity>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.nickname !== "string"
    ) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      nickname: parsed.nickname,
      sessionToken: parsed.sessionToken ?? "",
      hostToken: parsed.hostToken ?? "",
      roomCode: parsed.roomCode ?? "",
    };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: LiveIdentity): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // sessionStorage indisponível (modo privado) — segue sem persistência.
  }
}

export function clearIdentity(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Cria (ou mantém) o sessionId desta aba. */
export function ensureSessionId(): string {
  const existing = loadIdentity();
  if (existing?.sessionId) return existing.sessionId;
  const id = randomUUID();
  saveIdentity({
    sessionId: id,
    nickname: existing?.nickname ?? "",
    sessionToken: "",
    hostToken: "",
    roomCode: "",
  });
  return id;
}

/** Aplica a credencial recebida do servidor no join bem-sucedido. */
export function updateIdentity(patch: Partial<LiveIdentity>): void {
  const current = loadIdentity();
  if (!current) return;
  saveIdentity({ ...current, ...patch });
}
