import type { WebSocket } from "ws";
import {
  getLiveCompanionForOwner,
  getLiveCompanionByCode,
  disbandLiveCompanion,
  refreshLiveCompanionExpiry,
  liveCompanionForSessionOf,
  sendToSessionSockets,
  type LiveCompanionSession,
} from "./rooms";

/**
 * Ponte entre o celular (gateway público /ws/live-companion) e o dono
 * (gateway autenticado /ws/live). Nenhuma mídia passa por aqui — só
 * signaling WebRTC e controles. A aprovação do dono é obrigatória antes
 * de qualquer signaling fluir (defesa contra quem escanear o QR sem
 * permissão — ex.: código fotografado).
 */

const approved = new Set<string>();

function phoneSocketOf(session: LiveCompanionSession): WebSocket | null {
  const ws = session.companionSocket as WebSocket | null;
  return ws && ws.readyState === 1 ? ws : null;
}

/** Celular pareou: pede aprovação ao dono da sessão. */
export function notifyPairRequest(session: LiveCompanionSession): void {
  approved.delete(session.id);
  sendToSessionSockets(session.ownerSessionId, {
    t: "live-companion:request",
    sessionId: session.id,
  });
}

/**
 * Registra a socket do celular na sessão (chamado no "pair").
 * Retorna true quando o pareamento é reconexão de um celular já aprovado
 * (o gateway pode mandar "paired" direto, sem nova aprovação).
 */
export function attachLiveCompanionSocket(
  session: LiveCompanionSession
): boolean {
  // Reconexão do mesmo celular já aprovado: religa direto (a graça do
  // servidor segura a sessão por alguns segundos).
  if (approved.has(session.id)) {
    refreshLiveCompanionExpiry(session);
    return true;
  }
  // Primeiro pareamento: exige aprovação fresca do dono.
  approved.delete(session.id);
  sendToSessionSockets(session.ownerSessionId, {
    t: "live-companion:request",
    sessionId: session.id,
  });
  return false;
}

/** Remove a socket do celular da sessão (chamado no close). */
export function detachLiveCompanionSocket(
  session: LiveCompanionSession,
  ws: WebSocket
): void {
  if (session.companionSocket === ws) {
    session.companionSocket = null;
  }
}

/** Dono aprovou — o celular recebe "paired" e envia a oferta WebRTC. */
export function approveLiveCompanion(
  ownerSessionId: string,
  sessionToken: string,
  companionId: string
): boolean {
  const session = getLiveCompanionForOwner(
    ownerSessionId,
    sessionToken,
    companionId
  );
  if (!session) return false;
  const phone = phoneSocketOf(session);
  if (!phone) return false;
  approved.add(session.id);
  refreshLiveCompanionExpiry(session);
  phone.send(JSON.stringify({ t: "paired", code: session.code }));
  return true;
}

/** Dono desconectou o celular manualmente — sessão invalidada com aviso. */
export function stopLiveCompanion(
  ownerSessionId: string,
  sessionToken: string,
  companionId: string
): void {
  const session = getLiveCompanionForOwner(
    ownerSessionId,
    sessionToken,
    companionId
  );
  approved.delete(companionId);
  if (!session) return;
  const phone = phoneSocketOf(session);
  if (phone) {
    try {
      phone.send(JSON.stringify({ t: "companion:ended" }));
      phone.close(4000, "owner-stopped");
    } catch {
      // ignore
    }
  }
  disbandLiveCompanion(session);
}

/** Dono recusou — sessão invalidada e celular avisado. */
export function rejectLiveCompanion(
  ownerSessionId: string,
  sessionToken: string,
  companionId: string
): void {
  const session = getLiveCompanionForOwner(
    ownerSessionId,
    sessionToken,
    companionId
  );
  approved.delete(companionId);
  if (!session) return;
  const phone = phoneSocketOf(session);
  if (phone) {
    try {
      phone.send(
        JSON.stringify({
          t: "companion:error",
          code: session.code,
          message: "O proprietário recusou a conexão deste celular.",
        })
      );
      phone.close(4000, "owner-rejected");
    } catch {
      // socket morrendo
    }
  }
  disbandLiveCompanion(session);
}

export function isLiveCompanionApproved(session: LiveCompanionSession): boolean {
  return approved.has(session.id);
}

/** Signaling do celular → dono. */
export function relayLiveCompanionSignal(
  session: LiveCompanionSession,
  data: unknown
): void {
  if (!isLiveCompanionApproved(session)) return;
  refreshLiveCompanionExpiry(session);
  sendToSessionSockets(session.ownerSessionId, {
    t: "live-companion:signal",
    data,
  });
}

/** Signaling do dono → celular (chamado pelo gateway /ws/live). */
export function relayOwnerSignal(
  ownerSessionId: string,
  data: unknown
): void {
  const session = liveCompanionForSessionOf(ownerSessionId);
  if (!session || !isLiveCompanionApproved(session)) return;
  const phone = phoneSocketOf(session);
  if (phone) {
    phone.send(JSON.stringify({ t: "companion:signal", data }));
  }
}

/** Controle do celular (camera-on/off, mic, disconnect…) → dono. */
export function liveCompanionControl(
  session: LiveCompanionSession,
  action: string
): void {
  if (action === "__owner:disconnected") {
    // Queda definitiva do celular: o dono derruba o peer.
    sendToSessionSockets(session.ownerSessionId, {
      t: "live-companion:disconnected",
    });
    return;
  }
  if (!isLiveCompanionApproved(session)) return;
  refreshLiveCompanionExpiry(session);
  sendToSessionSockets(session.ownerSessionId, {
    t: "live-companion:control",
    action,
  });
}

/** Dono saiu/encerrou a sala: celular recebe "ended" e a sessão morre. */
export function notifyOwnerGone(ownerSessionId: string): void {
  for (;;) {
    const session = liveCompanionForSessionOf(ownerSessionId);
    if (!session) break;
    const phone = phoneSocketOf(session);
    if (phone) {
      try {
        phone.send(JSON.stringify({ t: "companion:ended" }));
        phone.close(4000, "owner-gone");
      } catch {
        // ignore
      }
    }
    approved.delete(session.id);
    disbandLiveCompanion(session);
  }
}

/** Sessão expirada sozinha (timeout sem aprovação/uso). */
export function expireIfStale(code: string): void {
  const session = getLiveCompanionByCode(code);
  if (session) {
    approved.delete(session.id);
    disbandLiveCompanion(session);
  }
}
