import { useAppStore } from '../stores/appStore';

const WS_URL = 'ws://localhost:8765/ws';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Map<string, (data: unknown) => void> = new Map();
  private shouldReconnect = true;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    useAppStore.getState().setWsStatus('connecting');

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        useAppStore.getState().setWsStatus('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data?: unknown };
          const handler = this.messageHandlers.get(msg.type);
          if (handler) handler(msg.data);
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        useAppStore.getState().setWsStatus('disconnected');
        this.stopHeartbeat();
        if (this.shouldReconnect) this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        useAppStore.getState().setWsStatus('error');
      };
    } catch {
      useAppStore.getState().setWsStatus('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type: string, handler: (data: unknown) => void): void {
    this.messageHandlers.set(type, handler);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
  }
}

export const wsService = new WebSocketService();
