// Mirror of src/lib/governance/findingFingerprint.ts — MUST stay
// byte-for-byte equivalent. Deno cannot import from src/, so the
// helper is duplicated here for Edge Function use.
//
// SQL counterpart: supabase/migrations/20260612000000_findings_fingerprint.sql
// Test: test/lib/governance/findingFingerprint.test.ts

export interface FingerprintInput {
  detector:      string;
  website_id?:   string | null;
  category:      string;
  evidence_ref?: string | null;
}

export async function computeFindingFingerprint(input: FingerprintInput): Promise<string> {
  const parts = [
    (input.detector ?? '').trim().toLowerCase(),
    input.website_id ?? '',
    (input.category ?? '').trim().toLowerCase(),
    (input.evidence_ref ?? '').trim().toLowerCase(),
  ];
  const data = new TextEncoder().encode(parts.join('|'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
