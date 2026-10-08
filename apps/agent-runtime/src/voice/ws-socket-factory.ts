/**
 * WebSocket-Factory für den Grok-Realtime-Adapter (PR 3).
 *
 * Node 20 (Dockerfile, CI) hat keinen globalen WebSocket-Client mit
 * Custom Headers. xAI verlangt `Authorization: Bearer …` beim Connect —
 * deshalb `ws`.
 */

import WebSocket from 'ws';

import type {
  RealtimeSocketEvent,
  RealtimeSocketEventType,
  RealtimeSocketFactory,
  RealtimeSocketLike,
} from '../providers/grok-provider.js';

type Listener = (event: RealtimeSocketEvent) => void;

/** Adapter: `ws` → RealtimeSocketLike (EventTarget-API). */
class WsRealtimeSocket implements RealtimeSocketLike {
  private readonly socket: WebSocket;
  private readonly wraps = new WeakMap<Listener, (raw: unknown) => void>();

  constructor(url: string, headers: Record<string, string>) {
    this.socket = new WebSocket(url, { headers });
  }

  get readyState(): number {
    return this.socket.readyState;
  }

  send(data: string): void {
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  addEventListener(type: RealtimeSocketEventType, listener: Listener): void {
    const wrapped = (raw: unknown) => {
      if (type === 'message') {
        const msg = raw as { data?: unknown };
        listener({ data: msg.data });
        return;
      }
      if (type === 'close') {
        const close = raw as { code?: number; reason?: string };
        listener({ code: close.code, reason: close.reason });
        return;
      }
      listener({});
    };
    this.wraps.set(listener, wrapped);
    this.socket.addEventListener(type, wrapped as never);
  }

  removeEventListener(type: RealtimeSocketEventType, listener: Listener): void {
    const wrapped = this.wraps.get(listener);
    if (wrapped) {
      this.socket.removeEventListener(type, wrapped as never);
      this.wraps.delete(listener);
    }
  }
}

/** Erzeugt eine RealtimeSocketFactory auf Basis von `ws` (Custom Headers). */
export function createWsSocketFactory(): RealtimeSocketFactory {
  return (url, init) => new WsRealtimeSocket(url, init.headers ?? {});
}

/** Nur für Tests: Headers der letzten Factory-Verbindung. */
export function createRecordingWsFactory(record: {
  urls: string[];
  headers: Array<Record<string, string>>;
  sockets: RealtimeSocketLike[];
  impl: RealtimeSocketFactory;
}): RealtimeSocketFactory {
  return (url, init) => {
    record.urls.push(url);
    record.headers.push({ ...init.headers });
    const socket = record.impl(url, init);
    record.sockets.push(socket);
    return socket;
  };
}
