/**
 * OpenClaw-Agent — main entrypoint.
 *
 * Hono-app mit:
 *   - Bearer-Auth (env OPENCLAW_SECRET)
 *   - Rate-Limit (per IP, 10 req/min default)
 *   - CORS-Whitelist (env OPENCLAW_CORS_ORIGINS, comma-separated)
 *   - Cost-Cap (env OPENCLAW_DAILY_TOKEN_CAP)
 *   - Sentry-Integration (no-op wenn SENTRY_DSN missing)
 *   - WebSocket auf /ws
 *   - Graceful-Shutdown auf SIGTERM
 *
 * Endpoints:
 *   GET  /healthz       — Liveness + daily-usage-Status
 *   POST /api/chat      — Single-shot Chat (Bearer-Auth)
 *   GET  /ws            — WebSocket-Upgrade (Bearer im Frame, nicht Header)
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as Sentry from '@sentry/node';
import { runAgent } from './agent.js';
import { checkRateLimit, pruneRateLimit } from './rate-limit.js';
import { getDailyUsage } from './cost-cap.js';
import { attachWebSocketServer } from './ws.js';
import type { ApiError, ChatRequest, ChatResponse } from './types.js';

// ─── Sentry-Init (no-op ohne DSN) ────────────────────────────────────────────

const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  });
}

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
const SECRET = process.env.OPENCLAW_SECRET;
if (!SECRET) {
  console.error('[openclaw-agent] OPENCLAW_SECRET env-var missing — refusing to start');
  process.exit(2);
}

const CORS_ORIGINS = (process.env.OPENCLAW_CORS_ORIGINS ?? 'https://realsyncdynamicsai.de')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ─── Hono-App ────────────────────────────────────────────────────────────────

const app = new Hono();

app.use(
  '*',
  cors({
    origin: CORS_ORIGINS,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  }),
);

app.get('/healthz', (c) => {
  return c.json({
    ok: true,
    service: 'openclaw-agent',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    daily_usage: getDailyUsage(),
  });
});

app.post('/api/chat', async (c) => {
  // Bearer-Auth
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json<ApiError>(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'missing bearer token' } },
      401,
    );
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (token !== SECRET) {
    return c.json<ApiError>(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'invalid token' } },
      401,
    );
  }

  // Rate-Limit per IP
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown';
  if (!checkRateLimit(ip)) {
    return c.json<ApiError>(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'too many requests, slow down' } },
      429,
    );
  }

  // Body-Validation
  let body: ChatRequest;
  try {
    body = (await c.req.json()) as ChatRequest;
  } catch {
    return c.json<ApiError>(
      { ok: false, error: { code: 'BAD_JSON', message: 'request body must be valid JSON' } },
      400,
    );
  }
  if (!body.message || typeof body.message !== 'string') {
    return c.json<ApiError>(
      { ok: false, error: { code: 'VALIDATION', message: 'message (string) required' } },
      400,
    );
  }
  if (body.message.length > 8000) {
    return c.json<ApiError>(
      { ok: false, error: { code: 'TOO_LARGE', message: 'message exceeds 8000 chars' } },
      413,
    );
  }

  // Run agent
  try {
    const result: ChatResponse = await runAgent(body.message, body.context ?? {});
    return c.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    if (message === 'DAILY_CAP_EXCEEDED') {
      return c.json<ApiError>(
        {
          ok: false,
          error: {
            code: 'DAILY_CAP_EXCEEDED',
            message: 'Daily OpenAI token cap reached. Resets 00:00 UTC.',
          },
        },
        429,
      );
    }
    if (SENTRY_DSN) Sentry.captureException(e);
    return c.json<ApiError>(
      { ok: false, error: { code: 'AGENT_ERROR', message } },
      500,
    );
  }
});

// ─── Boot ────────────────────────────────────────────────────────────────────

const httpServer = serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`[openclaw-agent] HTTP on :${PORT}`);
console.log(`[openclaw-agent] CORS origins: ${CORS_ORIGINS.join(', ')}`);

// httpServer ist tatsaechlich ein http.Server-kompatibles Objekt — fuer
// WebSocket-Attach.
attachWebSocketServer(httpServer as unknown as Parameters<typeof attachWebSocketServer>[0], SECRET);
console.log(`[openclaw-agent] WebSocket on :${PORT}/ws`);

// Cron-style cleanup fuer Rate-Limit-Buckets
const pruneInterval = setInterval(pruneRateLimit, 60_000);

// Graceful-Shutdown
function shutdown(signal: string): void {
  console.log(`[openclaw-agent] ${signal} received, shutting down...`);
  clearInterval(pruneInterval);
  httpServer.close(() => {
    console.log('[openclaw-agent] http server closed');
    if (SENTRY_DSN) {
      void Sentry.close(2000).then(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });
  setTimeout(() => {
    console.error('[openclaw-agent] forced exit after 5s');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
