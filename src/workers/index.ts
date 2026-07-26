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
import {
  handleGetPolicy,
  handleInvalidatePolicy,
  handleInvalidateTenant,
} from './kv-cache/index.js';

// Cloudflare Workers environment types
// (These are provided by Cloudflare at runtime; TypeScript needs the definitions)
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}

export interface WorkersEnv {
  SUPABASE_JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
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

      // Route: GET /api/policies/{tenantId}/{policyId}
      if (url.pathname.match(/^\/api\/policies\/[^/]+\/[^/]+$/) && request.method === 'GET') {
        const pathParts = url.pathname.split('/');
        const tenantId = pathParts[3];
        const policyId = pathParts[4];

        const response = await handleGetPolicy(
          request,
          {
            POLICY_CACHE: env.POLICY_CACHE,
            SUPABASE_URL: env.SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
          },
          policyId,
          tenantId
        );

        const elapsed = Date.now() - startTime;
        response.headers.set('X-Worker-Latency', `${elapsed}ms`);
        return response;
      }

      // Route: DELETE /api/cache/invalidate/{tenantId}/{policyId}
      if (
        url.pathname.match(/^\/api\/cache\/invalidate\/[^/]+\/[^/]+$/) &&
        request.method === 'DELETE'
      ) {
        const pathParts = url.pathname.split('/');
        const tenantId = pathParts[4];
        const policyId = pathParts[5];

        const response = await handleInvalidatePolicy(
          request,
          {
            POLICY_CACHE: env.POLICY_CACHE,
            SUPABASE_URL: env.SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
          },
          policyId,
          tenantId
        );

        const elapsed = Date.now() - startTime;
        response.headers.set('X-Worker-Latency', `${elapsed}ms`);
        return response;
      }

      // Route: POST /api/cache/invalidate/tenant/{tenantId}
      if (url.pathname.match(/^\/api\/cache\/invalidate\/tenant\/[^/]+$/) && request.method === 'POST') {
        const pathParts = url.pathname.split('/');
        const tenantId = pathParts[5];

        const response = await handleInvalidateTenant(
          request,
          {
            POLICY_CACHE: env.POLICY_CACHE,
            SUPABASE_URL: env.SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
          },
          tenantId
        );

        const elapsed = Date.now() - startTime;
        response.headers.set('X-Worker-Latency', `${elapsed}ms`);
        return response;
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
            endpoints: [
              '/api/auth/verify-jwt (POST)',
              '/api/policies/{tenantId}/{policyId} (GET)',
              '/api/cache/invalidate/{tenantId}/{policyId} (DELETE)',
              '/api/cache/invalidate/tenant/{tenantId} (POST)',
            ],
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
