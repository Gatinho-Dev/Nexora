import { apiUrl, websocketUrl } from "@/lib/endpoints";

/**
 * Camada de rede do Nexora Live.
 *
 * REST para criar/checar salas, WebSocket dedicado (/ws/live) para signaling,
 * chat e presença. Nada aqui depende da sessão Nexora — o Live é público.
 */

export async function createLiveRoom(name?: string): Promise<{
  code: string;
  hostToken: string;
  name: string | null;
}> {
  const res = await fetch(apiUrl("/api/live/rooms"), {
    method: "POST",
    credentials: "include",
    headers: name ? { "Content-Type": "application/json" } : undefined,
    body: name ? JSON.stringify({ name }) : undefined,
  });
  if (!res.ok) {
    throw new Error("Não foi possível criar a sala. Tente novamente.");
  }
  return (await res.json()) as {
    code: string;
    hostToken: string;
    name: string | null;
  };
}

export type LiveRoomInfo = {
  exists: boolean;
  expired?: boolean;
  full?: boolean;
  nicknames?: string[];
  maxParticipants?: number;
  name?: string | null;
};

export async function fetchLiveRoomInfo(
  code: string
): Promise<LiveRoomInfo> {
  const res = await fetch(apiUrl(`/api/live/rooms/${encodeURIComponent(code)}`), {
    credentials: "include",
  });
  if (!res.ok) return { exists: false };
  return (await res.json()) as LiveRoomInfo;
}

/** URL do WebSocket dedicado do Live (mesmo host da API). */
export function liveWsUrl(): string {
  return websocketUrl("/ws/live");
}

/** Compartilha o link da sala: Web Share API quando disponível. */
export async function shareRoomLink(url: string, code: string): Promise<boolean> {
  const shareData: ShareData = {
    title: "Nexora Live",
    text: `Entre na minha sala: ${code}`,
    url,
  };
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
    } catch {
      // usuário cancelou ou falhou → cai para o fallback
    }
  }
  return false;
}
