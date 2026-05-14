-- Migration: 20260509020000_monitoring_tables.sql
-- Tabellen für Continuous Compliance Monitoring (Starter/Growth/Agency/Enterprise)

-- ─────────────────────────────────────────────────────────────────────────────
-- monitored_domains: Domains die täglich/monatlich gescannt werden
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitored_domains (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain           text NOT NULL,
  tier             text NOT NULL DEFAULT 'starter'
                   CHECK (tier IN ('starter','growth','agency','enterprise')),
  active           boolean NOT NULL DEFAULT true,
  alert_email      text,
  last_scan_at     timestamptz,
  last_risk_score  integer,
  last_trackers    text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain)
);

ALTER TABLE public.monitored_domains ENABLE ROW LEVEL SECURITY;

-- Tenant sieht nur eigene Domains
DROP POLICY IF EXISTS "tenant_owns_monitored_domain" ON public.monitored_domains;
CREATE POLICY "tenant_owns_monitored_domain"
  ON public.monitored_domains
  FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- Service-Role kann alles (für Cron-Job)
DROP POLICY IF EXISTS "service_role_full_access_monitored_domains" ON public.monitored_domains;
CREATE POLICY "service_role_full_access_monitored_domains"
  ON public.monitored_domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index für Cron-Job (sortiert nach last_scan_at)
CREATE INDEX IF NOT EXISTS idx_monitored_domains_active_scan
  ON public.monitored_domains (active, last_scan_at ASC NULLS FIRST);

-- updated_at auto-update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_monitored_domains_updated_at ON public.monitored_domains;
CREATE TRIGGER trg_monitored_domains_updated_at
  BEFORE UPDATE ON public.monitored_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_monitor_results: Scan-History + Drift-Detection-Ergebnisse
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_monitor_results (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_domain_id       uuid REFERENCES public.monitored_domains(id) ON DELETE CASCADE,
  tenant_id                 uuid NOT NULL,
  domain                    text NOT NULL,
  risk_score                integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_level                text GENERATED ALWAYS AS (
    CASE
      WHEN risk_score < 40 THEN 'critical'
      WHEN risk_score < 60 THEN 'high'
      WHEN risk_score < 80 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  trackers                  text[] NOT NULL DEFAULT '{}',
  cookie_count              integer NOT NULL DEFAULT 0,
  consent_manager_detected  boolean NOT NULL DEFAULT false,
  drift_detected            boolean NOT NULL DEFAULT false,
  new_trackers              text[] NOT NULL DEFAULT '{}',
  removed_trackers          text[] NOT NULL DEFAULT '{}',
  score_delta               integer NOT NULL DEFAULT 0,
  scan_type                 text NOT NULL DEFAULT 'fetch'
                            CHECK (scan_type IN ('fetch','playwright')),
  raw_result                jsonb,
  scanned_at                timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_monitor_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_reads_own_monitor_results" ON public.audit_monitor_results;
CREATE POLICY "tenant_reads_own_monitor_results"
  ON public.audit_monitor_results
  FOR SELECT
  USING (tenant_id = (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

DROP POLICY IF EXISTS "service_role_full_access_monitor_results" ON public.audit_monitor_results;
CREATE POLICY "service_role_full_access_monitor_results"
  ON public.audit_monitor_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitor_results_tenant_domain
  ON public.audit_monitor_results (tenant_id, domain, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitor_results_drift
  ON public.audit_monitor_results (tenant_id, drift_detected, scanned_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_compliance_timeline — für Risk Dashboard Frontend
-- Gibt die letzten N Scans einer Domain zurück (für Chart)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_compliance_timeline(
  p_domain text,
  p_tenant_id uuid,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  scanned_at  timestamptz,
  risk_score  integer,
  risk_level  text,
  trackers    text[],
  drift       boolean,
  new_t       text[],
  scan_type   text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    scanned_at, risk_score, risk_level, trackers,
    drift_detected, new_trackers, scan_type
  FROM public.audit_monitor_results
  WHERE tenant_id = p_tenant_id AND domain = p_domain
  ORDER BY scanned_at DESC
  LIMIT p_limit;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron Schedule (manuell im Supabase SQL-Editor ausführen nach Migration):
-- Setzt den täglichen Cron-Job für audit-monitor-cron
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT cron.schedule(
--   'audit-monitor-daily',
--   '0 3 * * *',
--   $$ SELECT net.http_post(
--     url := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/audit-monitor-cron',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   ) $$
-- );
