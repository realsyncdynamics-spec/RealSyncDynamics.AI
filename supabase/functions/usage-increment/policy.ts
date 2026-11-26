// Authorization policy for usage-increment.
//
// - Only tenant owners and admins may report usage through this endpoint.
// - Only known entitlement keys (present in usage_limits_config) are accepted.
// - Keys billed by consumption (billing_mode 'metered' / 'overage') are measured
//   server-side only and cannot be reported by clients.

export const CLIENT_USAGE_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

const KEY_PATTERN = /^limit\.[a-z0-9_]{1,64}$/;

export type PolicyResult =
  | { ok: true }
  | { ok: false; status: number; code: 'BAD_REQUEST' | 'FORBIDDEN'; message: string };

export function checkRole(role: unknown): PolicyResult {
  if (typeof role === 'string' && CLIENT_USAGE_ROLES.has(role)) return { ok: true };
  return { ok: false, status: 403, code: 'FORBIDDEN', message: 'role not permitted to report usage' };
}

export function isWellFormedKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}

export function checkEntitlementKey(
  key: unknown,
  config: { billing_mode?: string | null } | null | undefined,
): PolicyResult {
  if (!isWellFormedKey(key) || !config) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'unknown entitlement_key' };
  }
  if (config.billing_mode !== 'included') {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'entitlement_key is measured server-side' };
  }
  return { ok: true };
}
