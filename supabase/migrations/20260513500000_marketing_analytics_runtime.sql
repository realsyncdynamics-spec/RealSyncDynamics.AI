-- Marketing Performance Analytics Runtime
--
-- Stores conversion-funnel events (e.g. checkout_started), per-channel
-- revenue attribution snapshots, and findings emitted by the Compliance
-- Drift Intelligence Agent. DSGVO-konform: keine IP, keine User-Agent-
-- Rohwerte, metadata wird durch sanitizeMetadata() im Runtime-Layer
-- bereinigt. Daten verfallen nach 365 Tagen (Funnel-Analyse-Bedarf > 90d,
-- weniger als gesetzliche Aufbewahrungsfrist).
--
-- Hinweis: Compliance-Findings sind technische Heuristiken zur internen
-- Selbstprüfung und stellen KEINE Rechtsberatung dar.

-- 1) Roh-Events der Marketing-Runtime ---------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_name      TEXT NOT NULL,                     -- e.g. checkout_started, lead_captured, purchase
    event_value     NUMERIC(14, 2),                    -- monetary value (EUR), optional
    currency        TEXT,                              -- ISO-4217, default EUR
    plan_key        TEXT,                              -- pro_monthly, scale_monthly, etc.
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    referrer_host   TEXT,                              -- host only, no path/query
    session_hash    TEXT,                              -- opaque session correlation
    user_id         UUID,                              -- optional, FK to auth.users
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,-- sanitized, capped 4KB
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_tenant_time
    ON public.marketing_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_events_name
    ON public.marketing_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_events_session
    ON public.marketing_events(session_hash) WHERE session_hash IS NOT NULL;

ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_events tenant_read" ON public.marketing_events;
CREATE POLICY "marketing_events tenant_read"
    ON public.marketing_events FOR SELECT
    USING (
      tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
      )
    );

-- 2) Revenue-Attribution-Snapshots ------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_attribution (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    model           TEXT NOT NULL,                     -- last_touch | first_touch | linear
    utm_source      TEXT NOT NULL DEFAULT '(direct)',
    utm_medium      TEXT,
    utm_campaign    TEXT,
    touchpoints     INTEGER NOT NULL DEFAULT 0,
    conversions     INTEGER NOT NULL DEFAULT 0,
    revenue_eur     NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_attribution_tenant
    ON public.marketing_attribution(tenant_id, window_end DESC);

ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_attribution tenant_read" ON public.marketing_attribution;
CREATE POLICY "marketing_attribution tenant_read"
    ON public.marketing_attribution FOR SELECT
    USING (
      tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
      )
    );

-- 3) Findings der Compliance-Drift-Intelligence -----------------------------
CREATE TABLE IF NOT EXISTS public.marketing_compliance_findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    rule_id         TEXT NOT NULL,                     -- e.g. missing_utm_consent, claim_drift
    severity        TEXT NOT NULL,                     -- info | low | medium | high
    summary         TEXT NOT NULL,
    evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    CONSTRAINT marketing_compliance_findings_severity_chk
      CHECK (severity IN ('info','low','medium','high'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_compliance_findings_tenant
    ON public.marketing_compliance_findings(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_compliance_findings_open
    ON public.marketing_compliance_findings(tenant_id, severity)
    WHERE resolved_at IS NULL;

ALTER TABLE public.marketing_compliance_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_compliance_findings tenant_read"
    ON public.marketing_compliance_findings;
CREATE POLICY "marketing_compliance_findings tenant_read"
    ON public.marketing_compliance_findings FOR SELECT
    USING (
      tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
      )
    );

-- 4) Cleanup-Jobs (365d Events, 180d Findings) ------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('marketing-events-cleanup-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marketing-events-cleanup-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'marketing-events-cleanup-daily',
  '15 3 * * *',
  $cron$
    DELETE FROM public.marketing_events
     WHERE created_at < now() - interval '365 days';
    DELETE FROM public.marketing_compliance_findings
     WHERE detected_at < now() - interval '180 days' AND resolved_at IS NOT NULL;
  $cron$
);

COMMENT ON TABLE public.marketing_events IS
  'Sanitized marketing-funnel events. metadata is pre-cleaned by sanitizeMetadata() — no IP, no raw UA, no email.';
COMMENT ON TABLE public.marketing_compliance_findings IS
  'Technical heuristics emitted by Compliance Drift Intelligence Agent. Not legal advice.';
