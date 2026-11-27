// Shared service-role HMAC subject identity provisioner for DSR intake and
// cron recovery. Never log email or HMAC secret. Missing active Vault key
// remains pending for operator repair; never overwrite a key once active.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

async function getActiveKey(admin: SupabaseClient, tenantId: string): Promise<{ key_version: number; vault_secret_name: string } | null> {
  const { data } = await admin.from('subject_ref_keys')
    .select('key_version, vault_secret_name')
    .eq('tenant_id', tenantId).eq('status', 'active')
    .order('key_version', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Resolve the HMAC subject_ref for an email, provisioning a per-tenant key
// (metadata row + Vault secret) on first use. Best-effort: returns null on
// any failure so DSR intake is never blocked.
export async function ensureSubjectRef(admin: SupabaseClient, tenantId: string, email: string): Promise<{ subject_ref: string; key_version: number } | null> {
  try {
    let key = await getActiveKey(admin, tenantId);
    if (!key) {
      // Mint key v1: metadata via rotate RPC, then write the actual HMAC
      // secret to Vault under the deterministic vault_secret_name.
      const { error: rotErr } = await admin.rpc('rotate_subject_ref_key', { p_tenant_id: tenantId });
      if (rotErr) return null;
      key = await getActiveKey(admin, tenantId);
      if (!key) return null;
      const { error: setErr } = await admin.rpc('set_app_secret', { secret_name: key.vault_secret_name, secret_value: randomHex(32) });
      if (setErr) return null;
    }
    const { data, error } = await admin.rpc('subject_ref_compute', {
      p_tenant_id: tenantId, p_subject_kind: 'email', p_value: email,
    });
    if (error || typeof data !== 'string' || data.length < 8) return null;
    return { subject_ref: data, key_version: key.key_version };
  } catch {
    return null;
  }
}

