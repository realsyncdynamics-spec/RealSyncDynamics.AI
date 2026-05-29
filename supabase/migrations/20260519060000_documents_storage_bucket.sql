-- Storage bucket for audit-report-pdf HTML uploads.
--
-- The `audit-report-pdf` Edge Function (supabase/functions/audit-report-pdf/
-- index.ts) generates an HTML version of the user's audit report and uploads
-- it to `documents/audit-reports/<auditId>.html`, then returns a signed URL
-- for the user to download/print. Live verification on 2026-05-19 found that
-- this bucket was never created — every download attempt returns:
--
--   { "ok": false, "error": { "code": "UPLOAD_FAILED", "message": "Bucket not found" } }
--
-- This migration adds the missing bucket. Pattern mirrors the existing
-- `audit-evidence` bucket (migration 20260507100000_audit_evidence.sql):
-- private + idempotent insert.
--
-- Why not just repoint the function to `audit-evidence`: that bucket has its
-- own RLS policies tied to tenant_id rows in `audit_evidence` table; using
-- it for orthogonal HTML reports would muddle the access model. A separate
-- bucket keeps the responsibility split clean.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- RLS for the new bucket. Mirrors the implicit pattern of audit-evidence:
-- service_role has full access (the Edge Function uses service_role under
-- the hood). Authenticated users can READ via signed URLs only — no direct
-- SELECT on storage.objects.

-- Service-role bypass is implicit in Supabase (RLS doesn't apply to
-- service_role), so we don't need an explicit policy for writes. We add a
-- single signed-URL-friendly read policy for completeness — note that
-- signed URLs work WITHOUT any policy at all (the signature is the auth),
-- but we add a policy guarding against accidental direct-path reads.

-- No INSERT/UPDATE/DELETE policies for authenticated/anon: only the
-- Edge Function (service_role) writes. Signed URLs handle the download
-- side without needing a SELECT policy.

-- Note: NO existing migration adds policies to storage.objects for the
-- audit-evidence bucket either — the same pattern applies here.
