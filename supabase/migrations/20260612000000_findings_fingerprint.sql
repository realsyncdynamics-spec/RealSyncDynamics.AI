-- Findings fingerprint — stable identity for "the same logical violation".
--
-- The MVP-domain review (post-PR-5) flagged that the current Finding row
-- has no stable identifier for "this finding is the same compliance
-- problem we saw last scan". `id` is per-row, `evidence_ref` rotates
-- when URLs do, and a Multi-Detector emission (two detectors flagging
-- the same site for the same category) creates two rows that the score
-- counts twice.
--
-- This migration introduces `fingerprint TEXT` as the stable identity:
--
--   fingerprint = sha256_hex(
--     detector + "|" + (website_id ?? "") + "|" + category + "|" +
--     normalized(evidence_ref)
--   )
--
-- where `normalized` is lowercase-trim of the wire-format string. Future
-- migrations can refine the normalization (URL host-canonicalization,
-- query-string stripping, etc.) without changing the column shape — only
-- the values get rewritten.
--
-- Scope-strict for this PR:
--   - Column + non-unique index for lookups
--   - Backfill for existing rows via SQL helper (idempotent)
--   - NO unique constraint yet (paired with first_seen_at /
--     last_seen_at / occurrence_count + UPSERT-semantics in a follow-up)
--   - NO scoring change yet (dedup-aware scoring is a separate PR)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

COMMENT ON COLUMN public.findings.fingerprint IS
  'sha256_hex(detector|website_id|category|normalized(evidence_ref)). Stable identity for "the same logical violation" across scan runs and detectors. Computed by the adapter on insert; backfilled in migration 20260612000000.';

-- Lookup index — supports "find existing finding with this fingerprint
-- in this tenant" reads. Non-unique by design (see header).
CREATE INDEX IF NOT EXISTS findings_tenant_fingerprint_idx
  ON public.findings (tenant_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Backfill — compute fingerprint for any row that doesn't have one.
-- Uses the same formula as the adapter (lowercased + trimmed inputs).
-- pgcrypto.digest()/encode() is deterministic, so re-running this is
-- a no-op for already-backfilled rows.
UPDATE public.findings
SET fingerprint = encode(
  digest(
    lower(trim(coalesce(detector, '')))    || '|' ||
    coalesce(website_id::text, '')         || '|' ||
    lower(trim(coalesce(category, '')))    || '|' ||
    lower(trim(coalesce(evidence_ref, ''))),
    'sha256'
  ),
  'hex'
)
WHERE fingerprint IS NULL;
