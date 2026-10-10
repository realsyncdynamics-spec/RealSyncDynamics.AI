/**
 * Cloudflare Worker security gate.
 *
 * IMPORTANT:
 * - There is intentionally NO route/custom-domain in wrangler-workers.toml.
 * - Only JWT verification and health are wired here.
 * - Tenant-scoped policy/cache/evidence handlers are deliberately NOT imported.
 *   Their legacy implementations rely on privileged credentials and do not yet
 *   establish user -> membership -> tenant authorization. Keeping them
 *   unreachable is a security control, not missing functionality.
 */

import { handleVerifyJwt, type VerifyJwtEnv } from './verify-jwt/index.js';

export interface WorkersEnv extends VerifyJwtEnv {}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: WorkersEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth/verify-jwt') {
      return handleVerifyJwt(request, env);
    }

    if ((url.pathname === '/health' || url.pathname === '/api/health') && request.method === 'GET') {
      return json(200, {
        ok: true,
        status: 'isolated',
        routes_enabled: false,
        endpoints: ['/api/auth/verify-jwt (POST)', '/api/health (GET)'],
      });
    }

    return json(404, { ok: false, error: 'not_found' });
  },
};
