// Hono-Server Entry-Point für den Playwright-Scanner-Microservice.
//
// Endpoints:
//   GET  /health   — Liveness + Browser-Status
//   POST /scan     — Bearer-Auth + Rate-Limit + Playwright-Scan
//
// Run local: npm run dev (tsx watch)
// Build:     npm run build (esbuild → dist/index.js)
// Container: siehe Dockerfile + docker-compose.yml

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { closeBrowser, getBrowser, scan, ScanFailure } from './scanner.js';
import type { ScanError, ScanRequest } from './types.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const SCANNER_SECRET = process.env.SCANNER_SECRET ?? '';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT ?? '10', 10);
const SHUTDOWN_GRACE_MS = 10_000;

if (!SCANNER_SECRET) {
  console.error('[playwright-scanner] FATAL: SCANNER_SECRET env required');
  process.exit(1);
}

// ─── In-flight-Counter für Rate-Limit ────────────────────────────────────────
let activeScans = 0;

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// ─── Health-Check (no auth, für Container-Healthcheck) ───────────────────────
app.get('/health', async (c) => {
  let browserOk = false;
  try {
    const b = await getBrowser();
    browserOk = b.isConnected();
  } catch { /* browserOk = false */ }
  return c.json({
    status: browserOk ? 'ok' : 'degraded',
    active_scans: activeScans,
    max_concurrent: MAX_CONCURRENT,
    browser_connected: browserOk,
    uptime_seconds: Math.round(process.uptime()),
    version: '1.0.0',
  });
});

// ─── Scan-Endpoint ───────────────────────────────────────────────────────────
app.post('/scan', async (c) => {
  // Bearer-Auth
  const authHeader = c.req.header('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== SCANNER_SECRET) {
    return c.json<ScanError>({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Bearer token missing or invalid' },
    }, 401);
  }

  // Rate-Limit (process-local)
  if (activeScans >= MAX_CONCURRENT) {
    return c.json<ScanError>({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Max ${MAX_CONCURRENT} concurrent scans. Try again in a few seconds.`,
        details: { active_scans: activeScans },
      },
    }, 429);
  }

  // Body parsen
  let body: ScanRequest;
  try {
    body = await c.req.json<ScanRequest>();
  } catch {
    return c.json<ScanError>({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' },
    }, 400);
  }

  if (!body.url || typeof body.url !== 'string') {
    return c.json<ScanError>({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Field "url" is required (string)' },
    }, 400);
  }
  if (!/^https?:\/\//i.test(body.url)) {
    return c.json<ScanError>({
      ok: false,
      error: { code: 'INVALID_URL', message: 'URL must start with http:// or https://' },
    }, 400);
  }
  if (body.url.length > 2048) {
    return c.json<ScanError>({
      ok: false,
      error: { code: 'INVALID_URL', message: 'URL too long (max 2048 chars)' },
    }, 400);
  }

  activeScans++;
  try {
    const result = await scan(body.url, body.options ?? {});
    return c.json(result);
  } catch (err) {
    if (err instanceof ScanFailure) {
      return c.json<ScanError>({
        ok: false,
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      }, 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[playwright-scanner] scan failed:', msg);
    return c.json<ScanError>({
      ok: false,
      error: { code: 'SCAN_FAILED', message: msg },
    }, 500);
  } finally {
    activeScans--;
  }
});

// ─── 404-Fallback ────────────────────────────────────────────────────────────
app.notFound((c) => c.json<ScanError>({
  ok: false,
  error: { code: 'NOT_FOUND', message: `Unknown route: ${c.req.method} ${c.req.path}` },
}, 404));

app.onError((err, c) => {
  console.error('[playwright-scanner] uncaught:', err);
  return c.json<ScanError>({
    ok: false,
    error: { code: 'INTERNAL', message: err.message ?? 'Internal server error' },
  }, 500);
});

// ─── Server starten ──────────────────────────────────────────────────────────
const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`[playwright-scanner] listening on http://${info.address}:${info.port}`);
  console.log(`[playwright-scanner] max_concurrent=${MAX_CONCURRENT}`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[playwright-scanner] received ${signal}, shutting down...`);

  // Stop accepting new connections
  server.close();

  // Wait for in-flight scans (with grace period)
  const deadline = Date.now() + SHUTDOWN_GRACE_MS;
  while (activeScans > 0 && Date.now() < deadline) {
    console.log(`[playwright-scanner] waiting for ${activeScans} in-flight scan(s)...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await closeBrowser();
  console.log('[playwright-scanner] shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
