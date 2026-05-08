-- Website-Rebuild Jobs — vollautomatisches Re-Build der Kunden-Homepage zu
-- DSGVO-konform + AI-Ready. Triggert nach Stripe-Checkout der Managed-
-- Website-Tier. Behält das visuelle Design der Quelle (DOM-Klon), entfernt
-- Tracker / 3rd-Party-Embeds, fügt Cookie-Consent + DSGVO-Docs + AI-Readiness
-- (llms.txt, JSON-LD, /api/ai-info) hinzu.
--
-- Workflow-Steps (siehe rebuild-website Edge-Function):
--   1. scrape          — HTML/CSS/Assets der Quell-URL holen
--   2. audit           — bestehender gdpr-audit liefert Findings
--   3. strip_trackers  — entfernt GA / FB-Pixel / 3rd-Party-Fonts / Iframes
--   4. self_host       — Web-Fonts + nicht-kritische Embeds selbst hosten
--   5. inject_consent  — Cookie-Banner-SDK ins <head>
--   6. legal_pages     — DSE / Impressum / AVV via generate-document
--   7. ai_ready        — llms.txt + JSON-LD + ai-info-Endpoint + OG-Meta
--   8. package_deploy  — bundlen, in Storage ablegen, Preview-URL liefern

CREATE TABLE IF NOT EXISTS public.website_rebuilds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,                                                 -- nullable für Public-Trial
    audit_id        UUID REFERENCES public.gdpr_audits(id) ON DELETE SET NULL,
    source_url      TEXT NOT NULL,
    source_domain   TEXT NOT NULL,
    customer_email  TEXT NOT NULL,
    company         TEXT,
    tier            TEXT NOT NULL DEFAULT 'managed' CHECK (tier IN ('managed', 'premium', 'enterprise')),
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'preview_ready', 'live', 'failed', 'cancelled')),
    current_step    TEXT,
    completed_steps TEXT[] NOT NULL DEFAULT '{}',
    preview_url     TEXT,                                                 -- Public-URL des Preview-Builds
    bundle_path     TEXT,                                                 -- Storage-Pfad zum gepackten Bundle
    error_code      TEXT,
    error_detail    TEXT,
    workflow_version TEXT NOT NULL DEFAULT '2026.05.0',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_rebuilds_tenant
    ON public.website_rebuilds(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_website_rebuilds_status_created
    ON public.website_rebuilds(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_rebuilds_email
    ON public.website_rebuilds(customer_email);

-- Step-Log: jeder Step bekommt einen Eintrag mit Start/Ende/Logs/Output.
-- Ermöglicht Resume nach Crash + transparente Audit-Trails für den Kunden.
CREATE TABLE IF NOT EXISTS public.website_rebuild_steps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rebuild_id   UUID NOT NULL REFERENCES public.website_rebuilds(id) ON DELETE CASCADE,
    step_name    TEXT NOT NULL CHECK (step_name IN (
                    'scrape', 'audit', 'strip_trackers', 'self_host',
                    'inject_consent', 'legal_pages', 'ai_ready', 'package_deploy'
                  )),
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms  INTEGER,
    summary      TEXT,                                                  -- Human-readable result
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- Step-spezifische Daten
    error_detail TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_rebuild_steps_rebuild
    ON public.website_rebuild_steps(rebuild_id, created_at);

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION public.tg_website_rebuilds_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_rebuilds_updated ON public.website_rebuilds;
CREATE TRIGGER website_rebuilds_updated
    BEFORE UPDATE ON public.website_rebuilds
    FOR EACH ROW EXECUTE FUNCTION public.tg_website_rebuilds_updated();

-- RLS
ALTER TABLE public.website_rebuilds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_rebuild_steps ENABLE ROW LEVEL SECURITY;

-- Super-admin read
DROP POLICY IF EXISTS "website_rebuilds super_admin_read" ON public.website_rebuilds;
CREATE POLICY "website_rebuilds super_admin_read"
    ON public.website_rebuilds FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

DROP POLICY IF EXISTS "website_rebuild_steps super_admin_read" ON public.website_rebuild_steps;
CREATE POLICY "website_rebuild_steps super_admin_read"
    ON public.website_rebuild_steps FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

-- Tenant-Scoped read (Customer-Self-Service-Dashboard)
DROP POLICY IF EXISTS "website_rebuilds tenant_read" ON public.website_rebuilds;
CREATE POLICY "website_rebuilds tenant_read"
    ON public.website_rebuilds FOR SELECT
    USING (
      tenant_id IS NOT NULL
      AND public.is_tenant_member(tenant_id)
    );

DROP POLICY IF EXISTS "website_rebuild_steps tenant_read" ON public.website_rebuild_steps;
CREATE POLICY "website_rebuild_steps tenant_read"
    ON public.website_rebuild_steps FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.website_rebuilds wr
       WHERE wr.id = website_rebuild_steps.rebuild_id
         AND wr.tenant_id IS NOT NULL
         AND public.is_tenant_member(wr.tenant_id)
    ));

-- Public-Trial: Lookup per ID + email-hash (kein Login nötig zum Status-Check)
-- Wird via SECURITY-DEFINER-RPC public.get_rebuild_status_by_token implementiert.

COMMENT ON TABLE public.website_rebuilds IS
  'Vollautomatischer DSGVO-konformer Website-Rebuild — orchestriert via rebuild-website Edge-Function.';
COMMENT ON COLUMN public.website_rebuilds.completed_steps IS
  'Append-only Liste der erfolgreich abgeschlossenen Workflow-Steps für Resume-Logik.';
COMMENT ON COLUMN public.website_rebuilds.tier IS
  'managed = automatischer Rebuild only · premium = + manuelle Review · enterprise = + Migration-Support';
