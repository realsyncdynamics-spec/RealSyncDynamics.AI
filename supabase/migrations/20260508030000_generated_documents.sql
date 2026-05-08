-- Generated Documents — automatisch erstellte DSGVO-Dokumente, die aus
-- einem Audit-Lauf abgeleitet wurden (Datenschutzerklärung / AVV / VVT /
-- TOM). Wird von der generate-document Edge Function geschrieben.
--
-- tenant_id ist nullable: Public-Audit-Flow (kein Login) erzeugt anonyme
-- Doku-Records, sobald ein Pro/Comply-Tenant existiert kann tenant_id
-- gesetzt werden. Audit_id ist FK auf gdpr_audits damit man pro Audit
-- nachvollziehen kann welche Dokumente generiert wurden.

CREATE TABLE IF NOT EXISTS public.generated_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID,                                                    -- optional, future Pro/Comply
    audit_id      UUID REFERENCES public.gdpr_audits(id) ON DELETE SET NULL,
    doc_type      TEXT NOT NULL CHECK (doc_type IN ('dse', 'avv', 'vvt', 'tom')),
    domain        TEXT NOT NULL,
    company       TEXT,                                                    -- snapshot at generation time
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

-- Super-admin read: Outbound + Support brauchen Einsicht über alle Mandanten
DROP POLICY IF EXISTS "generated_documents super_admin_read" ON public.generated_documents;
CREATE POLICY "generated_documents super_admin_read"
    ON public.generated_documents FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

-- Tenant-read: eigene Tenant-Dokumente sichtbar (Pro/Comply-Self-Service).
-- Nutzt is_tenant_member SECURITY-DEFINER-Helper aus
-- 20260430180000_tenant_rls_and_webhook_events.sql.
DROP POLICY IF EXISTS "generated_documents tenant_read" ON public.generated_documents;
CREATE POLICY "generated_documents tenant_read"
    ON public.generated_documents FOR SELECT
    USING (
      tenant_id IS NOT NULL
      AND public.is_tenant_member(tenant_id)
    );

-- INSERT/DELETE nur via service_role (Edge Function generate-document).

COMMENT ON TABLE public.generated_documents IS
  'Auto-generated DSGVO documents (DSE/AVV/VVT/TOM) per audit run.';
COMMENT ON COLUMN public.generated_documents.tenant_id IS
  'Optional. Set wenn aus authenticated Pro/Comply-Flow erzeugt; NULL für Public-Audit-Flow.';
COMMENT ON COLUMN public.generated_documents.audit_id IS
  'FK auf gdpr_audits — der Audit-Lauf aus dem die Findings stammen die ins Dokument einflossen.';
