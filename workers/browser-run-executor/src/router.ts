// Worker-Eingang des Cloudflare-Executors: derselbe HTTP-Vertrag wie
// deploy/playwright-scanner/server.ts, damit browser-execute
// (_shared/browser-runtime/executor.ts) ohne Änderung spricht:
//
//   GET  /health          Health + Capabilities (aus Browser Run limits())
//   POST /session/open    { session_id }
//   POST /session/frame   { session_id }
//   POST /session/close   { session_id }
//   POST /execute         { session_id, actions, require_session, include_frame, expected_url }
//
// Jede Session-Anfrage geht an das Durable Object namens session_id, in der
// EU-Jurisdiktion (Ausführung und Speicher des Objekts in der EU). Auth:
// SCANNER_API_KEY als Bearer/x-api-key, Vergleich in konstanter Zeit — Pflicht
// auch für /health. Die /scan/*-Endpunkte des Node-Scanners gibt es hier nicht.

import { maxSessions, type Env } from './env.js';
import { healthBody, type BrowserRunLimits } from './health.js';
import { apiKeyMatches, errorResponse, json, presentedKey, readJsonBody, sessionIdOf } from './http.js';

export interface RouterDeps {
  limits(env: Env): Promise<BrowserRunLimits>;
  now?: () => number;
  startedAt?: number;
  log?: (event: Record<string, unknown>) => void;
}

const SESSION_ROUTES: Record<string, string> = {
  '/session/open': '/open',
  '/session/frame': '/frame',
  '/session/close': '/close',
  '/execute': '/execute',
};

export function createRouter(deps: RouterDeps) {
  const now = deps.now ?? (() => Date.now());
  // Erst bei der ersten Anfrage: im globalen Gültigkeitsbereich eines Workers
  // steht die Uhr nicht verlässlich.
  let startedAt = deps.startedAt ?? null;
  const log = deps.log ?? (() => undefined);

  return async function handle(request: Request, env: Env): Promise<Response> {
    startedAt ??= now();
    const path = new URL(request.url).pathname;
    if (!env.SCANNER_API_KEY) {
      // Ohne Secret kein Betrieb — fail closed statt offen.
      log({ event: 'misconfigured', missing: 'SCANNER_API_KEY' });
      return json(503, { ok: false, error: 'EXECUTOR_NOT_CONFIGURED' });
    }
    if (!(await apiKeyMatches(presentedKey(request), env.SCANNER_API_KEY))) {
      return json(401, { ok: false, error: 'UNAUTHORIZED' });
    }

    if (path === '/health') {
      if (request.method !== 'GET') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      const limits = await deps.limits(env).catch(() => null);
      return json(200, healthBody(limits, maxSessions(env), startedAt, now()));
    }

    if (path.startsWith('/scan/')) {
      return json(501, { ok: false, error: 'SCAN_NOT_SUPPORTED_ON_THIS_RUNTIME' });
    }

    const target = SESSION_ROUTES[path];
    if (!target) return json(404, { ok: false, error: 'NOT_FOUND' });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

    try {
      const body = await readJsonBody(request);
      const sessionId = sessionIdOf(body);
      const namespace = env.SESSIONS.jurisdiction('eu');
      const stub = namespace.get(namespace.idFromName(sessionId));
      return await stub.fetch(`https://executor-session${target}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return errorResponse(err, log);
    }
  };
}
