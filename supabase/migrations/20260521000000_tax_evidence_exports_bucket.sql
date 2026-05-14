-- Storage bucket for the Evidence Export Runtime — holds the generated
-- ZIP packages. Private; access only via signed URL produced by the
-- `evidence-export` Edge Function (which itself runs with the
-- service_role key and so bypasses bucket RLS).
--
-- Object naming convention:
--   tenants/<tenant_id>/<tax_year>/<export_id>.zip
-- That layout keeps an obvious tenant-scoped prefix for any later
-- folder-level RLS or signed-URL filtering.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-evidence-exports', 'tax-evidence-exports', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Read-only RLS for tenant members. Writes happen via the service-role
-- key from the Edge Function, which bypasses RLS by definition.
DROP POLICY IF EXISTS "tax_evidence_exports_tenant_read" ON storage.objects;
CREATE POLICY "tax_evidence_exports_tenant_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tax-evidence-exports'
    AND (storage.foldername(name))[1] = 'tenants'
    AND (storage.foldername(name))[2]::uuid IN (
      SELECT m.tenant_id::text::uuid
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
    )
  );

COMMIT;
