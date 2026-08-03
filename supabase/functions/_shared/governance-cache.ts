// Shared: Governance Policy Cache Helper
// Purpose: Centralized cache management for governance policies
// KV Namespace: GOVERNANCE_CACHE (5bb700e74b83404caee6223533db1e90)

const CACHE_TTL = 3600; // 1 hour in seconds
const CACHE_KEY_PREFIX = "governance:policy";

export interface CachedPolicy {
  policy_id: string;
  tenant_id: string;
  version: number;
  controls: unknown[];
  cached_at: string;
  expires_at: string;
}

/**
 * Generate cache key for a governance policy
 * Pattern: governance:policy:{tenant_id}:{policy_id}:{version}
 */
export function generateCacheKey(
  tenantId: string,
  policyId: string,
  version: number
): string {
  return `${CACHE_KEY_PREFIX}:${tenantId}:${policyId}:${version}`;
}

/**
 * Get policy from cache (when KV is bound to the function)
 * Usage: const cached = await getFromCache(kv, tenantId, policyId, 1);
 */
export async function getFromCache(
  kv: any, // Cloudflare KV binding
  tenantId: string,
  policyId: string,
  version: number
): Promise<CachedPolicy | null> {
  const key = generateCacheKey(tenantId, policyId, version);
  const cached = await kv.get(key, "json");

  if (!cached) {
    return null;
  }

  // Check if cache has expired
  const expiresAt = new Date(cached.expires_at);
  if (new Date() > expiresAt) {
    // Cache expired, delete it
    await kv.delete(key);
    return null;
  }

  return cached as CachedPolicy;
}

/**
 * Store policy in cache
 * Usage: await setInCache(kv, policy, tenantId, policyId, version);
 */
export async function setInCache(
  kv: any, // Cloudflare KV binding
  policy: any,
  tenantId: string,
  policyId: string,
  version: number
): Promise<void> {
  const key = generateCacheKey(tenantId, policyId, version);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL * 1000);

  const cachedPolicy: CachedPolicy = {
    policy_id: policyId,
    tenant_id: tenantId,
    version,
    controls: policy.controls || [],
    cached_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  await kv.put(key, JSON.stringify(cachedPolicy), {
    expirationTtl: CACHE_TTL,
  });
}

/**
 * Delete policy from cache (called during invalidation)
 */
export async function deleteFromCache(
  kv: any,
  tenantId: string,
  policyId: string,
  version: number
): Promise<void> {
  const key = generateCacheKey(tenantId, policyId, version);
  await kv.delete(key);
}

/**
 * Invalidate all versions of a policy across all tenants (pattern delete)
 * Pattern: governance:policy:*:{policyId}:*
 */
export async function invalidatePolicyPattern(
  kv: any,
  policyId: string
): Promise<number> {
  const prefix = `${CACHE_KEY_PREFIX}:`;
  let deletedCount = 0;

  // List all keys with the prefix and delete matching pattern
  const keys = await kv.list({ prefix });
  for (const key of keys.keys) {
    // Check if key matches pattern: governance:policy:*:{policyId}:*
    if (key.name.includes(`:${policyId}:`)) {
      await kv.delete(key.name);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Example usage in a governance edge function:
 *
 * export default async (req: Request, { GOVERNANCE_CACHE }) => {
 *   const tenantId = "tenant-123";
 *   const policyId = "policy-456";
 *   const version = 1;
 *
 *   // Try cache first
 *   let policy = await getFromCache(
 *     GOVERNANCE_CACHE,
 *     tenantId,
 *     policyId,
 *     version
 *   );
 *
 *   if (!policy) {
 *     // Cache miss - fetch from database
 *     policy = await db.getPolicyEvaluation(tenantId, policyId, version);
 *
 *     // Store in cache
 *     await setInCache(
 *       GOVERNANCE_CACHE,
 *       policy,
 *       tenantId,
 *       policyId,
 *       version
 *     );
 *   }
 *
 *   return policy;
 * };
 */
