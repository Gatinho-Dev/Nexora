import type { WSClientEvent, WSServerEvent } from "@contracts/types";
import { websocketUrl } from "./endpoints";

type Handler = (event: WSServerEvent) => void;

/**
 * WebSocket singleton with automatic reconnect (exponential backoff),
 * heartbeat and event subscription. Resets cleanly on logout.
 */
class RealtimeClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private shouldConnect = false;
  private connectListeners = new Set<(connected: boolean) => void>();
  private connectionWaiters = new Set<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  connect() {
    this.shouldConnect = true;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.open();
  }

  private open() {
    const ws = new WebSocket(websocketUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.notifyConnect(true);
      this.startHeartbeat();
      for (const waiter of this.connectionWaiters) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      }
      this.connectionWaiters.clear();
    };

    ws.onmessage = raw => {
      try {
        const event = JSON.parse(raw.data as string) as WSServerEvent;
        for (const handler of this.handlers) handler(event);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      this.notifyConnect(false);
      this.ws = null;
      if (this.shouldConnect) this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldConnect) this.open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ t: "ping" });
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private notifyConnect(connected: boolean) {
    for (const listener of this.connectListeners) listener(connected);
  }

  send(event: WSClientEvent): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
      return true;
    }
    return false;
  }

  waitUntilConnected(timeoutMs = 10_000): Promise<void> {
    if (this.connected) return Promise.resolve();
    this.connect();
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.connectionWaiters.delete(waiter);
          reject(new Error("Tempo esgotado ao conectar o realtime da Nexora."));
        }, timeoutMs),
      };
      this.connectionWaiters.add(waiter);
    });
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConnect(listener: (connected: boolean) => void): () => void {
    this.connectListeners.add(listener);
    return () => this.connectListeners.delete(listener);
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.shouldConnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    for (const waiter of this.connectionWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Conexão realtime encerrada."));
    }
    this.connectionWaiters.clear();
  }
}

export const realtime = new RealtimeClient();
