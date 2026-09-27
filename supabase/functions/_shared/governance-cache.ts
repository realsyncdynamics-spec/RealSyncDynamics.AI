// Shared cache helpers for governance policy evaluation
// Used by edge functions to reduce policy evaluation latency

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Generate standardized cache key for governance policies
 * Pattern: governance:policy:{tenant_id}:{policy_id}:{version}
 */
export function generateCacheKey(
  tenant_id: string,
  policy_id: string,
  version: string
): string {
  return `governance:policy:${tenant_id}:${policy_id}:${version}`;
}

/**
 * Retrieve from cache with TTL validation
 * Returns null if not found or expired
 */
export async function getFromCache<T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  try {
    const cached = (await kv.get(key, "json")) as CacheEntry<T> | null;

    if (!cached) {
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    // Check if entry has expired
    if (age > cached.ttl) {
      // Clean up expired entry
      await kv.delete(key);
      return null;
    }

    return cached.value;
  } catch {
    return null;
  }
}

/**
 * Store in cache with TTL (in seconds)
 * Default TTL: 3600 seconds (1 hour)
 */
export async function setInCache<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  ttl_seconds: number = 3600
): Promise<void> {
  const entry: CacheEntry<T> = {
    value,
    timestamp: Date.now(),
    ttl: ttl_seconds * 1000, // Convert to milliseconds
  };

  await kv.put(key, JSON.stringify(entry), {
    expirationTtl: ttl_seconds,
  });
}

/**
 * Delete a single cache entry
 */
export async function deleteFromCache(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}

/**
 * Invalidate cache by pattern (glob-style matching)
 * Example: governance:policy:org_123:* (matches all policies for org_123)
 */
export async function invalidatePolicyPattern(
  kv: KVNamespace,
  pattern: string
): Promise<number> {
  let invalidated = 0;

  try {
    const keys = await kv.list({ prefix: pattern });

    for (const key of keys.keys) {
      await kv.delete(key.name);
      invalidated++;
    }
  } catch {
    // If list fails, return 0
  }

  return invalidated;
}

/**
 * Get cache statistics (for monitoring)
 * Lists all cache entries matching prefix
 */
export async function getCacheStats(
  kv: KVNamespace,
  prefix: string = "governance:policy:"
): Promise<{ total: number; expired: number }> {
  try {
    const keys = await kv.list({ prefix });
    let expired = 0;
    const now = Date.now();

    for (const key of keys.keys) {
      try {
        const cached = (await kv.get(key.name, "json")) as CacheEntry<unknown> | null;
        if (cached && now - cached.timestamp > cached.ttl) {
          expired++;
        }
      } catch {
        // Skip entries that can't be read
      }
    }

    return {
      total: keys.keys.length,
      expired,
    };
  } catch {
    return { total: 0, expired: 0 };
  }
}
