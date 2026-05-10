/**
 * WebSocket-Handler — gleiche Auth + Rate-Limit-Regeln wie HTTP.
 *
 * Auth-Flow:
 *   1. Client connected -> Server sendet { type: 'connected' }
 *   2. Client sendet { type: 'auth', token: '<bearer>' }
 *   3. Server validates token; bei OK: { type: 'auth_ok' }, bei FAIL: close 1008
 *   4. Erst nach auth_ok werden user_message-Frames akzeptiert
 *
 * Reconnect-Strategie liegt beim Client (Exponential-Backoff), nicht hier.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { runAgent } from './agent.js';
import { checkRateLimit } from './rate-limit.js';
import type {
  WsClientFrame,
  WsServerFrame,
} from './types.js';

const WS_HEARTBEAT_MS = 30_000;

export function attachWebSocketServer(
  httpServer: HttpServer,
  expectedToken: string,
): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? 'unknown';

    let authenticated = false;

    sendFrame(socket, {
      type: 'connected',
      message: 'OpenClaw WebSocket ready. Send { type: "auth", token: "..." } first.',
    });

    // Keep-alive heartbeat
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }, WS_HEARTBEAT_MS);

    socket.on('message', async (raw) => {
      let parsed: WsClientFrame;
      try {
        parsed = JSON.parse(raw.toString()) as WsClientFrame;
      } catch {
        sendFrame(socket, {
          type: 'error',
          code: 'BAD_JSON',
          message: 'Frames must be valid JSON',
        });
        return;
      }

      // Auth-Phase
      if (parsed.type === 'auth') {
        if (parsed.token === expectedToken) {
          authenticated = true;
          sendFrame(socket, { type: 'auth_ok' });
        } else {
          sendFrame(socket, {
            type: 'error',
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
          });
          socket.close(1008, 'unauthorized');
        }
        return;
      }

      if (!authenticated) {
        sendFrame(socket, {
          type: 'error',
          code: 'NOT_AUTHENTICATED',
          message: 'Send auth-frame first',
        });
        return;
      }

      // Rate-Limit gilt auch fuer WebSocket
      if (!checkRateLimit(ip)) {
        sendFrame(socket, {
          type: 'error',
          code: 'RATE_LIMITED',
          message: 'Slow down. Limit: see /healthz endpoint.',
        });
        return;
      }

      if (parsed.type === 'user_message') {
        sendFrame(socket, { type: 'status', message: 'thinking' });
        try {
          const result = await runAgent(parsed.message, parsed.context ?? {});
          sendFrame(socket, {
            type: 'agent_message',
            message: result.answer,
            conversation_id: parsed.conversation_id,
            tool_calls_made: result.tool_calls_made,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown error';
          sendFrame(socket, {
            type: 'error',
            code: message === 'DAILY_CAP_EXCEEDED' ? 'DAILY_CAP_EXCEEDED' : 'AGENT_ERROR',
            message,
          });
        }
      }
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
    });

    socket.on('error', () => {
      clearInterval(heartbeat);
    });
  });
}

function sendFrame(socket: WebSocket, frame: WsServerFrame): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(frame));
}
