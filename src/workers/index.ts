/**
 * Cloudflare Workers Router
 *
 * Central entry point for all edge Workers:
 * - /api/auth/verify-jwt — JWT verification (5% canary)
 * - /api/policies/* — Policy caching layer (Phase 2b+)
 * - /api/evidence/* — Evidence Vault dual-write (Phase 2b+)
 *
 * Routing pattern:
 * 1. Extract pathname and method
 * 2. Route to appropriate handler
 * 3. Return response with timing + error details
 *
 * Canary deployment:
 * Traffic split is controlled via wrangler-workers.toml [[env.production.canary]]
 * Initial: 5% to verify-jwt Worker, 95% to origin (governance-agent current flow)
 * Post-validation: scale to 100% or fold into governance-agent directly
 */

import { handleVerifyJwt } from './verify-jwt/index.js';

export interface WorkersEnv {
  SUPABASE_JWT_SECRET: string;
  SUPABASE_URL: string;
  POLICY_CACHE: KVNamespace;
  SESSION_CACHE: KVNamespace;
  EVIDENCE_VAULT: R2Bucket;
}

/**
 * Error response formatter
 */
function errorResponse(status: number, error: string, message?: string) {
  return new Response(
    JSON.stringify({
      ok: false,
      error,
      message: message || error,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    }
  );
}

/**
 * Main fetch handler
 */
export default {
  async fetch(request: Request, env: WorkersEnv): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    try {
      // Route: POST /api/auth/verify-jwt
      if (url.pathname === '/api/auth/verify-jwt' && request.method === 'POST') {
        const response = await handleVerifyJwt(request, {
          SUPABASE_JWT_SECRET: env.SUPABASE_JWT_SECRET,
          SUPABASE_URL: env.SUPABASE_URL,
          POLICY_CACHE: env.POLICY_CACHE,
          SESSION_CACHE: env.SESSION_CACHE,
        });

        // Add timing header
        const elapsed = Date.now() - startTime;
        response.headers.set('X-Worker-Latency', `${elapsed}ms`);
        response.headers.set('X-Canary-Routing', 'verify-jwt@5pct');

        return response;
      }

      // Route: Future policy caching endpoints (Phase 2b+)
      if (url.pathname.startsWith('/api/policies/')) {
        return errorResponse(501, 'not_implemented', 'Policy caching endpoint (Phase 2b+)');
      }

      // Route: Future evidence vault endpoints (Phase 2b+)
      if (url.pathname.startsWith('/api/evidence/')) {
        return errorResponse(501, 'not_implemented', 'Evidence Vault endpoint (Phase 2b+)');
      }

      // Health check
      if (url.pathname === '/health' || url.pathname === '/api/health') {
        return new Response(
          JSON.stringify({
            ok: true,
            timestamp: new Date().toISOString(),
            version: '1.0.0-canary',
            endpoints: ['/api/auth/verify-jwt'],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 404: Unknown route
      return errorResponse(404, 'not_found', `Route ${url.pathname} not found`);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('Worker error:', {
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        elapsed_ms: elapsed,
      });

      return errorResponse(500, 'internal_error', 'Worker processing failed');
    }
  },
};
