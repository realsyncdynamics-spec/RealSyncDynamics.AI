// HMAC-based subject_ref derivation + verification + rotation.
//
// Implements RFC §P2.2 (Key-Lookup) + §P2.3 (Lifecycle-States) +
// §P2.4 (Key-Rotation-Procedure). Pure helper module — vitest-importable.
//
// Why HMAC instead of plain sha256:
//   - Plain hashing leaks the input distribution (rainbow tables on small
//     spaces like IPv4). HMAC with a per-tenant secret blunts that.
//   - Per-tenant secrets prevent cross-tenant rainbow tables: an attacker
//     with one tenant's mapping cannot reverse another's.
//
// Forward integration:
//   - anon_chat_runs.ip_hash today is plain sha256 (#393). Migrating it to
//     subject_ref requires picking a synthetic tenant key (e.g. a global
//     'anon' tenant row). That swap is a separate operation; this module
//     supports both per-tenant lookup and a future helper that consumes
//     it for the anon path.

export type SubjectKind = 'email' | 'ip' | 'user_id' | 'session';

export type KeyStatus = 'active' | 'rotating' | 'retired';

export interface SubjectRefKeyRow {
  tenant_id:         string;
  key_version:       number;
  algorithm:         string;
  vault_secret_name: string;
  status:            KeyStatus;
}

export interface ComputeArgs {
  tenant_id:    string;
  subject_kind: SubjectKind;
  value:        string;
}

export interface ComputeResult {
  subject_ref: string;
  key_version: number;
}

export interface VerifyArgs {
  tenant_id:   string;
  subject_kind: SubjectKind;
  candidate:   string;
  subject_ref: string;
}

export interface RotateArgs {
  tenant_id:         string;
  vault_secret_name: string;
}

export interface RotateResult {
  key_version: number;
  status:      'active';
}

// Loose admin shape so vitest can mock without pulling the supabase-js
// type via the Deno-only `jsr:` specifier. The real client (imported in
// the Edge Function entry) satisfies this shape structurally.
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

interface VaultResolver {
  (vaultName: string): Promise<string | null>;
}

// ──────────────────────────────────────────────────────────────────────
// HMAC primitive — SubtleCrypto, available in both Deno and Node ≥ 19.
// ──────────────────────────────────────────────────────────────────────

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  if (!secret) throw new Error('hmacSha256Hex: empty secret');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * Canonicalise the HMAC input. The leading kind-tag prevents cross-kind
 * collisions (an email 'a@b' must never derive the same ref as a user_id 'a@b').
 */
function canonicalMessage(kind: SubjectKind, value: string): string {
  return `${kind}:${value}`;
}

// ──────────────────────────────────────────────────────────────────────
// Vault key resolution. Default uses get_app_secret RPC (same pattern as
// supabase/functions/_shared/providers.ts). Tests inject a mock resolver.
// ──────────────────────────────────────────────────────────────────────

async function defaultVaultResolver(
  admin: AdminClient,
  vaultName: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  if (error) return null;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

// ──────────────────────────────────────────────────────────────────────
// Key fetching. We do NOT cache — per-request RPC keeps the threat model
// simple (revocation is immediate, no stale-secret window).
// ──────────────────────────────────────────────────────────────────────

async function fetchKeys(
  admin: AdminClient,
  tenant_id: string,
  statuses: KeyStatus[],
): Promise<SubjectRefKeyRow[]> {
  const { data, error } = await admin
    .from('subject_ref_keys')
    .select('tenant_id, key_version, algorithm, vault_secret_name, status')
    .eq('tenant_id', tenant_id)
    .in('status', statuses)
    .order('key_version', { ascending: false });
  if (error) {
    throw new Error(`subject-ref fetchKeys failed: ${error.message}`);
  }
  return (data ?? []) as SubjectRefKeyRow[];
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Compute the subject_ref for a value under the tenant's currently ACTIVE
 * key. Throws if no active key exists — caller must surface to operator
 * (a missing active key is a Vault-provisioning bug, not a runtime branch).
 */
export async function computeSubjectRef(
  admin: AdminClient,
  args: ComputeArgs,
  resolver: VaultResolver = (n) => defaultVaultResolver(admin, n),
): Promise<ComputeResult> {
  const keys = await fetchKeys(admin, args.tenant_id, ['active']);
  if (keys.length === 0) {
    throw new Error(`computeSubjectRef: no active key for tenant ${args.tenant_id}`);
  }
  if (keys.length > 1) {
    throw new Error(
      `computeSubjectRef: ${keys.length} active keys for tenant ${args.tenant_id} — rotation aborted mid-flight`,
    );
  }
  const key = keys[0];
  const secret = await resolver(key.vault_secret_name);
  if (!secret) {
    throw new Error(
      `computeSubjectRef: vault secret '${key.vault_secret_name}' resolved empty (tenant ${args.tenant_id})`,
    );
  }
  const subject_ref = await hmacSha256Hex(secret, canonicalMessage(args.subject_kind, args.value));
  return { subject_ref, key_version: key.key_version };
}

/**
 * Verify a candidate plaintext against a stored subject_ref. Iterates over
 * 'active' AND 'rotating' keys (RFC §P2.3 — rotating keys remain readable
 * for backward-verify during the dual-read window).
 *
 * Returns `{matched: true, key_version}` on first match, otherwise
 * `{matched: false}`. Constant-time-ish: iterates all keys before exiting
 * to avoid leaking which key matched via timing.
 */
export async function verifySubjectRef(
  admin: AdminClient,
  args: VerifyArgs,
  resolver: VaultResolver = (n) => defaultVaultResolver(admin, n),
): Promise<{ matched: boolean; key_version?: number }> {
  const keys = await fetchKeys(admin, args.tenant_id, ['active', 'rotating']);
  if (keys.length === 0) {
    return { matched: false };
  }
  let result: { matched: boolean; key_version?: number } = { matched: false };
  for (const key of keys) {
    const secret = await resolver(key.vault_secret_name);
    if (!secret) continue;
    const candidateRef = await hmacSha256Hex(
      secret,
      canonicalMessage(args.subject_kind, args.candidate),
    );
    if (timingSafeEqualHex(candidateRef, args.subject_ref) && !result.matched) {
      result = { matched: true, key_version: key.key_version };
      // Intentionally continue: we do NOT early-exit. Verifier cost is
      // small (~ keys.length HMACs) and the constant-time property is
      // worth more than the microsecond savings on a match.
    }
  }
  return result;
}

/**
 * Rotate to a new active key. Delegates the atomic table updates to the
 * SECURITY DEFINER RPC `public.rotate_subject_ref_key` (migration
 * 20260607000000). Caller MUST pre-create the Vault secret named
 * `vault_secret_name` before invoking this.
 */
export async function rotateSubjectRefKey(
  admin: AdminClient,
  args: RotateArgs,
): Promise<RotateResult> {
  const { data, error } = await admin.rpc('rotate_subject_ref_key', {
    p_tenant_id:         args.tenant_id,
    p_vault_secret_name: args.vault_secret_name,
  });
  if (error) {
    throw new Error(`rotateSubjectRefKey failed: ${error.message}`);
  }
  // RPC returns a single-row result-set; supabase-js may surface as an
  // array or a single object depending on column shape — handle both.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.key_version !== 'number') {
    throw new Error('rotateSubjectRefKey: RPC returned unexpected shape');
  }
  return { key_version: row.key_version, status: 'active' };
}

// ──────────────────────────────────────────────────────────────────────
// Hex constant-time comparison. Both inputs are expected to be the
// same-length hex digest from this module; short-circuiting on length
// mismatch is intentional (any mismatch there is a programmer error,
// not an attacker-controlled signal).
// ──────────────────────────────────────────────────────────────────────

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Internal exports for tests — DO NOT use from production code.
export const __internals = {
  hmacSha256Hex,
  canonicalMessage,
  timingSafeEqualHex,
};
