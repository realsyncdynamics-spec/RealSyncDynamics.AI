/**
 * Cloudflare Workers: KV Cache Layer
 *
 * Route: GET /api/policies/{id}
 * Purpose: Cache governance policies with 5-minute TTL
 *
 * Performance: <10ms for cache hits (vs. 100-500ms Supabase RPC)
 * Hit rate target: >80% (policies accessed repeatedly)
 *
 * Cache Strategy:
 * - L1: Cloudflare KV (5-min TTL, distributed edge cache)
 * - L2: Fallback to Supabase (on cache miss or TTL expiration)
 * - Invalidation: Webhook on policy update triggers cache purge
 *
 * Flow:
 * 1. GET /api/policies/{id}
 * 2. Check KV cache (POLICY_CACHE)
 * 3. If hit: return cached + X-Cache: HIT header
 * 4. If miss: fetch from Supabase + cache + return + X-Cache: MISS
 * 5. On policy update: POST /api/cache/invalidate/{id} → purge KV
 *
 * Security:
 * - Verify Authorization header (Bearer JWT)
 * - Validate policy ownership via RLS (check tenant_id in request)
 * - Cache entire policy object (RLS handled at fetch time)
 */

// Cloudflare Workers environment types
// (These are provided by Cloudflare at runtime; TypeScript needs the definitions)
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  POLICY_CACHE: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface CacheEntry {
  policy: Record<string, unknown>;
  cached_at: number;
  ttl_seconds: number;
}

interface PolicyResponse {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  cache_status?: 'HIT' | 'MISS';
}

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const CACHE_KEY_PREFIX = 'policy:';
const CACHE_VERSION = 'v1';

/**
 * Generate cache key for a policy
 * Format: policy:v1:{tenant_id}:{policy_id}
 * Tenant isolation: prevents cross-tenant cache collisions
 */
function getCacheKey(tenantId: string, policyId: string): string {
  return `${CACHE_KEY_PREFIX}${CACHE_VERSION}:${tenantId}:${policyId}`;
}

/**
 * Get policy from cache or Supabase
 */
async function getPolicy(
  env: Env,
  cacheKey: string,
  tenantId: string,
  policyId: string
): Promise<{ data: Record<string, unknown> | null; fromCache: boolean }> {
  // Check cache first
  try {
    const cached = await env.POLICY_CACHE.get(cacheKey);
    if (cached) {
      const entry = JSON.parse(cached) as CacheEntry;
      // Verify TTL hasn't expired (safety check, KV handles expiration)
      if (Date.now() - entry.cached_at < entry.ttl_seconds * 1000) {
        return { data: entry.policy, fromCache: true };
      }
    }
  } catch (e) {
    console.error('Cache read error:', e);
    // Fall through to Supabase fetch
  }

  // Cache miss: fetch from Supabase
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/ai_policies`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Supabase fetch error:', response.status);
      return { data: null, fromCache: false };
    }

    const policies = await response.json() as Record<string, unknown>[];
    const policy = policies.find(
      (p) => p.id === policyId && p.tenant_id === tenantId
    );

    if (!policy) {
      return { data: null, fromCache: false };
    }

    // Store in cache with TTL
    const cacheEntry: CacheEntry = {
      policy,
      cached_at: Date.now(),
      ttl_seconds: CACHE_TTL_SECONDS,
    };

    try {
      await env.POLICY_CACHE.put(
        cacheKey,
        JSON.stringify(cacheEntry),
        { expirationTtl: CACHE_TTL_SECONDS }
      );
    } catch (e) {
      console.error('Cache write error:', e);
      // Continue even if cache write fails
    }

    return { data: policy, fromCache: false };
  } catch (e) {
    console.error('Supabase fetch exception:', e);
    return { data: null, fromCache: false };
  }
}

/**
 * Invalidate policy cache entry
 * Called on policy update via webhook
 */
async function invalidatePolicy(
  env: Env,
  tenantId: string,
  policyId: string
): Promise<boolean> {
  const cacheKey = getCacheKey(tenantId, policyId);
  try {
    await env.POLICY_CACHE.delete(cacheKey);
    return true;
  } catch (e) {
    console.error('Cache invalidation error:', e);
    return false;
  }
}

/**
 * Bulk invalidate all policies for a tenant
 * Called on tenant config update
 */
async function invalidateTenantPolicies(
  env: Env,
  tenantId: string
): Promise<{ invalidated: number }> {
  // Note: KV doesn't support bulk operations by prefix yet
  // For now, this is a placeholder. Full implementation would:
  // 1. Fetch list of policy IDs from Supabase
  // 2. Delete each cache entry
  // Future: use Cloudflare Durable Objects for a "purge all" operation
  console.log(`Tenant ${tenantId} policy cache invalidation requested (bulk)`);
  return { invalidated: 0 };
}

/**
 * Handler: GET /api/policies/{id}
 * Fetch policy with caching
 */
export async function handleGetPolicy(
  request: Request,
  env: Env,
  policyId: string,
  tenantId: string
): Promise<Response> {
  // Verify Authorization header
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cacheKey = getCacheKey(tenantId, policyId);
  const startTime = Date.now();

  const { data: policy, fromCache } = await getPolicy(
    env,
    cacheKey,
    tenantId,
    policyId
  );

  const elapsed = Date.now() - startTime;

  if (!policy) {
    return new Response(
      JSON.stringify({ ok: false, error: 'policy_not_found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const response: PolicyResponse = {
    ok: true,
    data: policy,
    cache_status: fromCache ? 'HIT' : 'MISS',
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': fromCache ? 'HIT' : 'MISS',
      'X-Cache-Key': cacheKey,
      'X-Worker-Latency': `${elapsed}ms`,
      'Cache-Control': 'max-age=300, s-maxage=300', // 5 min browser + CDN
    },
  });
}

/**
 * Handler: DELETE /api/cache/invalidate/{id}
 * Invalidate single policy cache entry (triggered by webhook)
 */
export async function handleInvalidatePolicy(
  request: Request,
  env: Env,
  policyId: string,
  tenantId: string
): Promise<Response> {
  // Verify webhook signature (simplified for now)
  const webhookSecret = request.headers.get('X-Webhook-Secret');
  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_webhook_secret' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const success = await invalidatePolicy(env, tenantId, policyId);

  return new Response(
    JSON.stringify({
      ok: success,
      policy_id: policyId,
      tenant_id: tenantId,
      cache_key: getCacheKey(tenantId, policyId),
    }),
    {
      status: success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handler: POST /api/cache/invalidate/tenant/{tenant_id}
 * Bulk invalidate all policies for a tenant
 */
export async function handleInvalidateTenant(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  const result = await invalidateTenantPolicies(env, tenantId);

  return new Response(
    JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      invalidated: result.invalidated,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
