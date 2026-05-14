-- Tax Evidence Runtime — Foundation
-- Auth-gated module that organizes tax-relevant documents by year,
-- classifies them, links them to operations events, prepares export
-- packages for management / tax advisors, and records audit events.
--
-- IMPORTANT — Positioning (DO NOT change without legal review):
--   This runtime PREPARES tax documentation. It does NOT provide
--   tax advice and does NOT file tax returns. The final tax
--   assessment, review and submission stays with the customer's
--   management or their Steuerberater.
--
-- This is NOT a public surface. /finance is auth-gated in App.tsx.

BEGIN;

-- ── tax_years ─────────────────────────────────────────────────────
-- One row per fiscal year per tenant. Status drives UI gating:
--   open       → documents can still be added
--   locked     → no further mutations (management-side freeze)
--   exported   → an export package has been generated
--   archived   → year is past retention review; read-only
CREATE TABLE IF NOT EXISTS public.tax_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL CHECK (year BETWEEN 1990 AND 2100),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','locked','exported','archived')),
  notes       TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year)
);
CREATE INDEX IF NOT EXISTS tax_years_tenant_idx ON public.tax_years (tenant_id);

-- ── tax_documents ─────────────────────────────────────────────────
-- Belegsammlung — the actual receipts / invoices / contracts.
-- file_path points at a Supabase Storage object (path within the
-- tenant's bucket). file content is NEVER stored in this table.
CREATE TABLE IF NOT EXISTS public.tax_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_year_id           UUID NOT NULL REFERENCES public.tax_years(id) ON DELETE CASCADE,
  source_type           TEXT NOT NULL
                          CHECK (source_type IN (
                            'invoice_inbound','invoice_outbound','payment',
                            'inventory','payroll','receipt','contract','other'
                          )),
  document_date         DATE NOT NULL,
  file_name             TEXT NOT NULL,
  file_path             TEXT,                                    -- Supabase Storage path
  mime_type             TEXT,
  amount_net            NUMERIC(14, 2),
  amount_gross          NUMERIC(14, 2),
  currency              TEXT NOT NULL DEFAULT 'EUR',
  counterparty_name     TEXT,
  ai_summary            TEXT,                                    -- short technical summary, no advice
  classification_status TEXT NOT NULL DEFAULT 'pending'
                          CHECK (classification_status IN ('pending','classified','needs_review')),
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_documents_tenant_idx    ON public.tax_documents (tenant_id);
CREATE INDEX IF NOT EXISTS tax_documents_year_idx      ON public.tax_documents (tax_year_id);
CREATE INDEX IF NOT EXISTS tax_documents_date_idx      ON public.tax_documents (document_date DESC);
CREATE INDEX IF NOT EXISTS tax_documents_source_idx    ON public.tax_documents (source_type);
CREATE INDEX IF NOT EXISTS tax_documents_class_idx     ON public.tax_documents (classification_status);

-- ── tax_document_links ────────────────────────────────────────────
-- Loose cross-module link: a tax document can reference an
-- inventory_movement, supplier, purchase_order, etc. Stored as
-- (entity_type, entity_id) rather than FK so this module can be
-- deployed independently of the Operations Runtime.
CREATE TABLE IF NOT EXISTS public.tax_document_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_document_id      UUID NOT NULL REFERENCES public.tax_documents(id) ON DELETE CASCADE,
  related_entity_type  TEXT NOT NULL
                         CHECK (related_entity_type IN (
                           'inventory_movement','purchase_order','supplier',
                           'customer','payment','manual'
                         )),
  related_entity_id    UUID NOT NULL,
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_document_links_tenant_idx ON public.tax_document_links (tenant_id);
CREATE INDEX IF NOT EXISTS tax_document_links_doc_idx    ON public.tax_document_links (tax_document_id);
CREATE INDEX IF NOT EXISTS tax_document_links_target_idx ON public.tax_document_links (related_entity_type, related_entity_id);

-- ── tax_evidence_exports ─────────────────────────────────────────
-- Manifest entry per generated export package. The ZIP/PDF itself
-- lives in Supabase Storage; this row records type, checksum, and
-- audit-relevant metadata. checksum is sha256 hex.
CREATE TABLE IF NOT EXISTS public.tax_evidence_exports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_year_id  UUID NOT NULL REFERENCES public.tax_years(id) ON DELETE CASCADE,
  export_type  TEXT NOT NULL
                 CHECK (export_type IN ('steuerberater_package','management_review','audit_archive')),
  status       TEXT NOT NULL DEFAULT 'preparing'
                 CHECK (status IN ('preparing','ready','downloaded','failed')),
  export_path  TEXT,                                            -- Supabase Storage path
  checksum     TEXT,                                            -- sha256 hex
  document_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2),
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at     TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tax_evidence_exports_tenant_idx ON public.tax_evidence_exports (tenant_id);
CREATE INDEX IF NOT EXISTS tax_evidence_exports_year_idx   ON public.tax_evidence_exports (tax_year_id);
CREATE INDEX IF NOT EXISTS tax_evidence_exports_status_idx ON public.tax_evidence_exports (status);

-- ── tax_reminders ────────────────────────────────────────────────
-- Cron-style reminders: monthly / quarterly / year-end review or
-- "export package is ready for review".
CREATE TABLE IF NOT EXISTS public.tax_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_year_id   UUID NOT NULL REFERENCES public.tax_years(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL
                  CHECK (reminder_type IN (
                    'monthly_review','quarterly_review','year_end','export_ready'
                  )),
  title         TEXT NOT NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','sent','dismissed','completed')),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_reminders_tenant_idx ON public.tax_reminders (tenant_id);
CREATE INDEX IF NOT EXISTS tax_reminders_year_idx   ON public.tax_reminders (tax_year_id);
CREATE INDEX IF NOT EXISTS tax_reminders_due_idx    ON public.tax_reminders (due_at);
CREATE INDEX IF NOT EXISTS tax_reminders_status_idx ON public.tax_reminders (status);

-- ── tax_audit_events ─────────────────────────────────────────────
-- Compliance log. Personal data MUST NOT be stored here.
CREATE TABLE IF NOT EXISTS public.tax_audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,                                  -- "document.create", "export.ready", …
  entity_type   TEXT NOT NULL,                                  -- "tax_document" | "tax_year" | …
  entity_id     UUID,
  before_state  JSONB,
  after_state   JSONB,
  source        TEXT NOT NULL DEFAULT 'ui'
                  CHECK (source IN ('ui','api','import','agent','migration')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_audit_events_tenant_idx ON public.tax_audit_events (tenant_id);
CREATE INDEX IF NOT EXISTS tax_audit_events_event_idx  ON public.tax_audit_events (event_type);
CREATE INDEX IF NOT EXISTS tax_audit_events_when_idx   ON public.tax_audit_events (created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'tax_years','tax_documents','tax_document_links',
      'tax_evidence_exports','tax_reminders','tax_audit_events'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         USING (tenant_id IN (
           SELECT m.tenant_id FROM public.memberships m
           WHERE m.user_id = auth.uid()
         ))
         WITH CHECK (tenant_id IN (
           SELECT m.tenant_id FROM public.memberships m
           WHERE m.user_id = auth.uid()
         ))',
      t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ── Updated-at maintenance ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_tax_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['tax_years','tax_documents'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                   'trg_' || t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_tax_touch_updated_at()',
      'trg_' || t || '_touch', t);
  END LOOP;
END $$;

COMMIT;
