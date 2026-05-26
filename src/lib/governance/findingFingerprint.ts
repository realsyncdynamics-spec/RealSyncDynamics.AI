/**
 * Stable identity for "the same logical violation" across scan runs
 * and detectors. The DB column `findings.fingerprint` stores the same
 * value, computed via the equivalent SQL formula in migration
 * `20260612000000_findings_fingerprint.sql`.
 *
 * Formula:
 *   sha256_hex(
 *     lower(trim(detector))         + "|" +
 *     (website_id ?? "")            + "|" +
 *     lower(trim(category))         + "|" +
 *     lower(trim(evidence_ref ?? ""))
 *   )
 *
 * Why these four fields and not e.g. `summary`:
 *   - `summary` is detector-rendered and may differ across runs.
 *   - `severity` can change as the rules tighten without it being
 *     a different problem.
 *   - `status` is the lifecycle, not the identity.
 *   - `detector` IS part of the key on purpose for v1 — two detectors
 *     flagging "the same thing" produce two fingerprints, and a
 *     follow-up dedup-aware-scoring step collapses by (website_id,
 *     category, normalized_evidence) at scoring time. Keeping them
 *     distinct here preserves the auditable evidence chain.
 *
 * Mirror lives at supabase/functions/_shared/findingFingerprint.ts —
 * MUST stay byte-for-byte equivalent so DB-side backfill and Edge-
 * function emission produce the same value.
 */

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
