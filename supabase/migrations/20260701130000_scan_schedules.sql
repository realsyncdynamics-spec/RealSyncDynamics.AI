-- Enterprise Scheduler — benutzerdefinierte, wiederkehrende Scans pro Tenant.
--
-- Ergänzt die hartcodierten globalen Crons um pro-Tenant-Zeitpläne
-- (täglich/wöchentlich/monatlich zu fester Uhrzeit, UTC). Ein pg_cron-Job
-- ruft alle 15 Min die Dispatch-Funktion, die fällige Zeitpläne ausführt
-- (Bulk-Scan-Batch anlegen) + next_run_at fortschreibt + benachrichtigt.
--
-- Wiederverwendung: bulk_scan_* (Ausführung), governance_webhooks +
-- webhookFormat.ts (Slack/Teams/Generic-Benachrichtigung), Resend (E-Mail).

-- ─── 1. Zeitplan-Tabelle ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scan_schedules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    label          TEXT,
    -- Zu scannende Domains (normalisiert, via src/lib/bulk).
    domains        TEXT[] NOT NULL DEFAULT '{}',
    frequency      TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    hour           INT NOT NULL DEFAULT 3 CHECK (hour BETWEEN 0 AND 23),
    minute         INT NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
    weekday        INT CHECK (weekday BETWEEN 0 AND 6),          -- nur weekly (So=0)
    day_of_month   INT CHECK (day_of_month BETWEEN 1 AND 28),    -- nur monthly
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    paused         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Benachrichtigungskanäle: { "email": "...", "webhook_id": "uuid" }.
    notify         JSONB NOT NULL DEFAULT '{}'::jsonb,
    next_run_at    TIMESTAMPTZ NOT NULL,
    last_run_at    TIMESTAMPTZ,
    created_by     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_schedules_tenant ON public.scan_schedules(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_due
    ON public.scan_schedules(next_run_at)
    WHERE enabled = TRUE AND paused = FALSE;

-- ─── 2. Fällige Zeitpläne (für Dispatch, service_role) ───────────────────────
CREATE OR REPLACE FUNCTION public.scan_schedules_due(p_limit INT DEFAULT 100)
RETURNS SETOF public.scan_schedules
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
      FROM public.scan_schedules
     WHERE enabled = TRUE
       AND paused = FALSE
       AND next_run_at <= now()
     ORDER BY next_run_at ASC
     LIMIT GREATEST(1, p_limit);
$$;

-- ─── 3. RLS: Tenant-Mitglieder lesen; Schreiben nur service_role ─────────────
ALTER TABLE public.scan_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_schedules tenant-select" ON public.scan_schedules;
CREATE POLICY "scan_schedules tenant-select" ON public.scan_schedules
    FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.scan_schedules IS
    'Benutzerdefinierte wiederkehrende Scans pro Tenant (Enterprise Scheduler). Lesen per RLS; Schreiben nur über Edge-Function scheduler (service_role). Dispatch via scheduler-dispatch (pg_cron alle 15 Min).';

-- ─── 4. Entitlement: Scheduler ab Agency ─────────────────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('scheduler.enabled', 'Enterprise Scheduler: benutzerdefinierte wiederkehrende Scans', 'boolean')
ON CONFLICT (key) DO NOTHING;

WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('agency',     'scheduler.enabled', 1),
    ('scale',      'scheduler.enabled', 1),
    ('enterprise', 'scheduler.enabled', 1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

-- ─── 5. pg_cron: Dispatch alle 15 Minuten ────────────────────────────────────
-- cron.schedule ist Upsert per Name. Der Job-Body wird erst zur Laufzeit
-- ausgewertet (current_setting greift dann auf die Projekt-Settings zu).
SELECT cron.schedule(
  'scan-scheduler-dispatch',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/scheduler-dispatch',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    )
  $$
);
