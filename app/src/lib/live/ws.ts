import { liveWsUrl } from "@/lib/live/api";
import type { WSLiveClientEvent, WSLiveServerEvent } from "@contracts/live";

/**
 * Cliente WebSocket dedicado do Nexora Live (/ws/live).
 *
 * Separado do /ws autenticado de propósito: o Live é público, e isolar o
 * gateway evita qualquer acoplamento com a sessão Nexora. Reconexão com
 * backoff — o servidor mantém o participante na sala por 15s (grace).
 */

type Handler = (event: WSLiveServerEvent) => void;

class LiveSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closedByUser = false;
  /** Estado observável (usado pelo indicador de conexão da UI). */
  status: "connecting" | "open" | "closed" | "reconnecting" = "closed";
  onStatusChange: ((status: LiveSocket["status"]) => void) | null = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByUser = false;
    this.status = "connecting";
    this.onStatusChange?.(this.status);
    const ws = new WebSocket(liveWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.status = "open";
      this.onStatusChange?.(this.status);
      const ready = this.pendingOnOpen;
      this.pendingOnOpen = null;
      ready?.();
    };

    ws.onmessage = msg => {
      let event: WSLiveServerEvent;
      try {
        event = JSON.parse(String(msg.data)) as WSLiveServerEvent;
      } catch {
        return;
      }
      for (const handler of this.handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error("[live] handler error", err);
        }
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.closedByUser) {
        this.status = "closed";
        this.onStatusChange?.(this.status);
        return;
      }
      // Reconexão com backoff exponencial (máx ~8s) — o servidor segura o
      // participante por 15s, então tentativas rápidas são suficientes.
      this.status = "reconnecting";
      this.onStatusChange?.(this.status);
      const delay = Math.min(8000, 500 * 2 ** this.attempts);
      this.attempts++;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => {
      // onclose cuida da reconexão.
    };
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(event: WSLiveClientEvent): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
      return true;
    }
    return false;
  }

  /** Reconecta imediatamente e religa a sala quando o socket abrir. */
  forceReconnect(onReady: () => void) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.pendingOnOpen = onReady;
    this.connect();
  }

  private pendingOnOpen: (() => void) | null = null;

  /** Registra handler de eventos do servidor. Retorna unsubscriber. */
  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.status = "closed";
    this.onStatusChange?.(this.status);
  }
}

export const liveSocket = new LiveSocket();
