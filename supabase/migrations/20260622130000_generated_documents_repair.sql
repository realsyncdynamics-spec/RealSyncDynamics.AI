-- Repair: generated_documents table was recorded as migrated
-- (20260508030000) but was absent in the live database, so the
-- generate-document Edge Function and the Dokumente dashboard could
-- not persist or read documents. Re-create idempotently (table +
-- indexes + RLS), matching 20260508030000_generated_documents.sql.

CREATE TABLE IF NOT EXISTS public.generated_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID,
    audit_id      UUID REFERENCES public.gdpr_audits(id) ON DELETE SET NULL,
    doc_type      TEXT NOT NULL CHECK (doc_type IN ('dse', 'avv', 'vvt', 'tom')),
    domain        TEXT NOT NULL,
    company       TEXT,
    html_content  TEXT NOT NULL,
    methodology_version TEXT NOT NULL DEFAULT '2026.05.0',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_documents_audit
    ON public.generated_documents(audit_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_tenant
    ON public.generated_documents(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_documents_doc_type_created
    ON public.generated_documents(doc_type, created_at DESC);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generated_documents super_admin_read" ON public.generated_documents;
CREATE POLICY "generated_documents super_admin_read"
    ON public.generated_documents FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

DROP POLICY IF EXISTS "generated_documents tenant_read" ON public.generated_documents;
CREATE POLICY "generated_documents tenant_read"
    ON public.generated_documents FOR SELECT
    USING (
      tenant_id IS NOT NULL
      AND public.is_tenant_member(tenant_id)
    );

COMMENT ON TABLE public.generated_documents IS
  'Auto-generated DSGVO documents (DSE/AVV/VVT/TOM) per audit run.';
