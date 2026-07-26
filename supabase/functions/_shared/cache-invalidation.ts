/**
 * Cache Invalidation Utility for Edge Functions
 *
 * Provides functions to trigger Cloudflare KV cache invalidation
 * from Supabase edge functions when policies are updated.
 *
 * Usage:
 *   import { invalidatePolicy, invalidateTenant } from '../_shared/cache-invalidation.ts';
 *
 *   // After policy update
 *   await invalidatePolicy(tenantId, policyId);
 *
 *   // Bulk invalidate tenant policies
 *   await invalidateTenant(tenantId);
 */

const WORKERS_URL = Deno.env.get('CLOUDFLARE_WORKERS_URL') || 'https://workers.example.com';
const WEBHOOK_SECRET = Deno.env.get('CACHE_WEBHOOK_SECRET') || 'test-webhook-secret';

interface InvalidationResponse {
  ok: boolean;
  error?: string;
  message?: string;
  policy_id?: string;
  tenant_id?: string;
  invalidated?: number;
}

/**
 * Invalidate a single policy from cache
 * Triggered when policy content is updated
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param policyId - Policy ID to invalidate
 * @returns Success status and response details
 */
export async function invalidatePolicy(
  tenantId: string,
  policyId: string
): Promise<InvalidationResponse> {
  try {
    const response = await fetch(
      `${WORKERS_URL}/api/cache/invalidate/${tenantId}/${policyId}`,
      {
        method: 'DELETE',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = (await response.json()) as InvalidationResponse;

    if (!response.ok) {
      console.error(
        `Cache invalidation failed for policy ${policyId}:`,
        data.error
      );
      return {
        ok: false,
        error: data.error || 'invalidation_failed',
        message: `Failed to invalidate policy ${policyId}`,
      };
    }

    console.log(`✓ Invalidated policy cache: ${tenantId}/${policyId}`);
    return data;
  } catch (error) {
    console.error(
      `Cache invalidation error for policy ${policyId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return {
      ok: false,
      error: 'invalidation_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Invalidate all policies for a tenant
 * Triggered when tenant configuration changes
 *
 * @param tenantId - Tenant ID to invalidate
 * @returns Success status and number of invalidated entries
 */
export async function invalidateTenant(
  tenantId: string
): Promise<InvalidationResponse> {
  try {
    const response = await fetch(
      `${WORKERS_URL}/api/cache/invalidate/tenant/${tenantId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = (await response.json()) as InvalidationResponse;

    if (!response.ok) {
      console.error(
        `Bulk cache invalidation failed for tenant ${tenantId}:`,
        data.error
      );
      return {
        ok: false,
        error: data.error || 'bulk_invalidation_failed',
        message: `Failed to invalidate tenant ${tenantId} policies`,
      };
    }

    console.log(
      `✓ Invalidated tenant cache: ${tenantId} (${data.invalidated || 0} entries)`
    );
    return data;
  } catch (error) {
    console.error(
      `Bulk cache invalidation error for tenant ${tenantId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return {
      ok: false,
      error: 'bulk_invalidation_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch invalidate multiple policies
 * Useful for bulk updates affecting multiple policies
 *
 * @param entries - Array of { tenantId, policyId } tuples
 * @returns Array of invalidation results
 */
export async function invalidateBatch(
  entries: Array<{ tenantId: string; policyId: string }>
): Promise<InvalidationResponse[]> {
  const results = await Promise.all(
    entries.map(({ tenantId, policyId }) =>
      invalidatePolicy(tenantId, policyId)
    )
  );

  const successCount = results.filter((r) => r.ok).length;
  console.log(
    `Batch invalidation: ${successCount}/${entries.length} successful`
  );

  return results;
}
