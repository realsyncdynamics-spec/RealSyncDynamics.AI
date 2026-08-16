-- Reconciliation: drei Migrationen stehen im Prod-Ledger, ihre Tabellen fehlen
--
-- BEFUND (gegen die Live-DB erhoben, 2026-08-15)
-- Das Frontend fragt 152 Tabellen ab, 13 davon liefern in Produktion HTTP 404
-- (PGRST205). Bei drei Migrationen ist die Ursache dieselbe historische
-- Divergenz wie bei `audit_evidence` (#1022): der Ledger-Eintrag existiert, die
-- Tabelle nie. Ein erneuter `db push` ueberspringt sie deshalb fuer immer.
--
--   20260507110000_audit_jobs_queue.sql   -> audit_jobs
--   20260509020000_monitoring_tables.sql  -> monitored_domains, audit_monitor_results
--   20260516300000_runtime_core.sql       -> runtime_executions, runtime_approval_gates
--
-- Betroffene Feature-Pfade, alle aktiv im Code (kein toter Code):
--   src/features/smb/useSmbBusinessData.ts      -> audit_jobs
--   src/pages/RiskDashboard.tsx                 -> monitored_domains
--   src/core/runtime/supabase/tracer.ts         -> runtime_executions
--   src/core/runtime/supabase/gates.ts          -> runtime_approval_gates
--
-- Vorgehen wie bei den Reconcile-Migrationen vom 2026-08-11: Inhalt der
-- Original-Migration erneut ausfuehren, durchgehend idempotent.
--
-- BEWUSST NICHT UEBERNOMMEN: `runtime_events` aus 20260516300000.
-- Produktion fuehrt die partitionierte Backbone-Variante (relkind='p', 25
-- Spalten, u. a. event_tier/retention_class/prev_hash) — die runtime_core-
-- Definition ist eine andere, unpartitionierte Tabelle ohne execution_id.
-- Ein Replay wuerde entweder still nichts tun oder Policies gegen ein fremdes
-- Schema legen. Welche der beiden Definitionen gelten soll, ist eine offene
-- Architekturentscheidung (siehe docs/runbooks/p0-2-migration-reconciliation.md)
-- und wird hier nicht nebenbei getroffen.
--
-- Die uebrigen neun 404-Tabellen sind KEIN Ledger-Problem: sie sind im ganzen
-- Repo nie definiert worden. Das ist ein eigener Befund und braucht pro Tabelle
-- eine Entscheidung (Schema nachziehen vs. Frontend auf die vorhandene Tabelle
-- umbiegen) — nicht Teil dieser Migration.

BEGIN;

-- ============================================================
-- §1 audit_jobs — aus 20260507110000_audit_jobs_queue.sql
-- ============================================================
-- Async-Audit-Job-Queue via Postgres LISTEN/NOTIFY.

CREATE TABLE IF NOT EXISTS public.audit_jobs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  audit_id        uuid,
  domain          text not null,
  status          text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'failed', 'timeout', 'cancelled')),
  scan_options    jsonb not null default '{}'::jsonb,
  result_summary  jsonb,
  error_message   text,
  attempts        int not null default 0,
  max_attempts    int not null default 3,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  next_retry_at   timestamptz,
  worker_id       text
);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_status_created ON public.audit_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_tenant ON public.audit_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_next_retry ON public.audit_jobs(next_retry_at)
  WHERE status = 'failed' AND attempts < max_attempts;

ALTER TABLE public.audit_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_jobs_tenant_read" ON public.audit_jobs;
CREATE POLICY "audit_jobs_tenant_read"
  ON public.audit_jobs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "audit_jobs_tenant_insert" ON public.audit_jobs;
CREATE POLICY "audit_jobs_tenant_insert"
  ON public.audit_jobs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "audit_jobs_service_write" ON public.audit_jobs;
CREATE POLICY "audit_jobs_service_write"
  ON public.audit_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_jobs_notify_worker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
begin
  if NEW.status = 'queued' then
    perform pg_notify('audit_job_queued', json_build_object(
      'job_id', NEW.id, 'domain', NEW.domain,
      'tenant_id', NEW.tenant_id, 'attempts', NEW.attempts
    )::text);
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_audit_jobs_notify ON public.audit_jobs;
CREATE TRIGGER trg_audit_jobs_notify
  AFTER INSERT OR UPDATE OF status ON public.audit_jobs
  FOR EACH ROW EXECUTE FUNCTION public.audit_jobs_notify_worker();

-- Atomic claim via FOR UPDATE SKIP LOCKED — mehrere Worker duerfen parallel ziehen.
CREATE OR REPLACE FUNCTION public.audit_jobs_claim_next(p_worker_id text)
RETURNS TABLE (id uuid, tenant_id uuid, domain text, scan_options jsonb, attempts int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
declare
  v_id uuid;
begin
  update public.audit_jobs
     set status = 'running', started_at = now(),
         attempts = attempts + 1, worker_id = p_worker_id
   where id = (
     select aj.id from public.audit_jobs aj
      where aj.status = 'queued'
         or (aj.status = 'failed' and aj.attempts < aj.max_attempts
             and (aj.next_retry_at is null or aj.next_retry_at <= now()))
      order by created_at asc
      for update skip locked
      limit 1
   )
   returning audit_jobs.id into v_id;

  if v_id is null then
    return;
  end if;

  return query
    select aj.id, aj.tenant_id, aj.domain, aj.scan_options, aj.attempts
      from public.audit_jobs aj where aj.id = v_id;
end;
$$;

REVOKE ALL    ON FUNCTION public.audit_jobs_claim_next(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.audit_jobs_claim_next(text) TO service_role;

CREATE OR REPLACE FUNCTION public.audit_jobs_complete(
  p_job_id uuid, p_status text, p_audit_id uuid DEFAULT NULL,
  p_summary jsonb DEFAULT NULL, p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
begin
  if p_status not in ('success', 'failed', 'timeout', 'cancelled') then
    raise exception 'invalid completion status %', p_status;
  end if;

  update public.audit_jobs
     set status = p_status, completed_at = now(),
         audit_id = coalesce(p_audit_id, audit_id),
         result_summary = coalesce(p_summary, result_summary),
         error_message = p_error,
         next_retry_at = case
           when p_status = 'failed' and attempts < max_attempts
             then now() + (interval '1 minute' * power(2, attempts))
           else null
         end
   where id = p_job_id;
end;
$$;

REVOKE ALL    ON FUNCTION public.audit_jobs_complete(uuid, text, uuid, jsonb, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.audit_jobs_complete(uuid, text, uuid, jsonb, text) TO service_role;

COMMENT ON TABLE public.audit_jobs IS
  'Async-Audit-Job-Queue. LISTEN/NOTIFY auf channel "audit_job_queued" weckt Worker. Atomic claim via FOR UPDATE SKIP LOCKED.';

-- ============================================================
-- §2 monitored_domains + audit_monitor_results
--    aus 20260509020000_monitoring_tables.sql
-- ============================================================

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

DROP POLICY IF EXISTS "tenant_owns_monitored_domain" ON public.monitored_domains;
CREATE POLICY "tenant_owns_monitored_domain"
  ON public.monitored_domains FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1
  ));

DROP POLICY IF EXISTS "service_role_full_access_monitored_domains" ON public.monitored_domains;
CREATE POLICY "service_role_full_access_monitored_domains"
  ON public.monitored_domains FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitored_domains_active_scan
  ON public.monitored_domains (active, last_scan_at ASC NULLS FIRST);

-- public.set_updated_at() existiert in Prod bereits und wird hier bewusst
-- nicht neu definiert — CREATE OR REPLACE wuerde eine ggf. abweichende
-- Live-Version ueberschreiben.
DROP TRIGGER IF EXISTS trg_monitored_domains_updated_at ON public.monitored_domains;
CREATE TRIGGER trg_monitored_domains_updated_at
  BEFORE UPDATE ON public.monitored_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  ON public.audit_monitor_results FOR SELECT
  USING (tenant_id = (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1
  ));

DROP POLICY IF EXISTS "service_role_full_access_monitor_results" ON public.audit_monitor_results;
CREATE POLICY "service_role_full_access_monitor_results"
  ON public.audit_monitor_results FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitor_results_tenant_domain
  ON public.audit_monitor_results (tenant_id, domain, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitor_results_drift
  ON public.audit_monitor_results (tenant_id, drift_detected, scanned_at DESC);

CREATE OR REPLACE FUNCTION public.get_compliance_timeline(
  p_domain text, p_tenant_id uuid, p_limit integer DEFAULT 30
) RETURNS TABLE (
  scanned_at timestamptz, risk_score integer, risk_level text,
  trackers text[], drift boolean, new_t text[], scan_type text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT scanned_at, risk_score, risk_level, trackers,
         drift_detected, new_trackers, scan_type
    FROM public.audit_monitor_results
   WHERE tenant_id = p_tenant_id AND domain = p_domain
   ORDER BY scanned_at DESC
   LIMIT p_limit;
$$;

-- ============================================================
-- §3 runtime_executions + runtime_approval_gates
--    aus 20260516300000_runtime_core.sql (ohne runtime_events, siehe Kopf)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.runtime_executions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  agent_id        text not null,
  skill_id        text not null,
  status          text not null
                    check (status in (
                      'pending', 'running', 'awaiting_approval',
                      'completed', 'failed', 'cancelled'
                    )),
  input_hash      text not null,
  output_hash     text,
  error_code      text,
  idempotency_key text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS runtime_executions_tenant_started_idx
  ON public.runtime_executions (tenant_id, started_at desc);
CREATE INDEX IF NOT EXISTS runtime_executions_skill_idx
  ON public.runtime_executions (tenant_id, skill_id);
CREATE INDEX IF NOT EXISTS runtime_executions_status_idx
  ON public.runtime_executions (status)
  WHERE status IN ('pending', 'running', 'awaiting_approval');

CREATE TABLE IF NOT EXISTS public.runtime_approval_gates (
  id               uuid primary key default gen_random_uuid(),
  execution_id     uuid not null references public.runtime_executions(id) on delete cascade,
  reason           text not null,
  risk_level       text not null
                     check (risk_level in ('low', 'medium', 'high', 'critical')),
  requested_action text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'granted', 'denied', 'expired')),
  decided_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);

CREATE INDEX IF NOT EXISTS runtime_approval_gates_pending_idx
  ON public.runtime_approval_gates (execution_id)
  WHERE status = 'pending';

ALTER TABLE public.runtime_executions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_approval_gates ENABLE ROW LEVEL SECURITY;

-- is_tenant_member() ist der repoweit einheitliche Check (20260723000001),
-- SECURITY DEFINER, damit die Policy keine RLS-Rekursion auf memberships ausloest.
DROP POLICY IF EXISTS runtime_executions_tenant_select ON public.runtime_executions;
CREATE POLICY runtime_executions_tenant_select
  ON public.runtime_executions FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS runtime_executions_tenant_insert ON public.runtime_executions;
CREATE POLICY runtime_executions_tenant_insert
  ON public.runtime_executions FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS runtime_executions_tenant_update ON public.runtime_executions;
CREATE POLICY runtime_executions_tenant_update
  ON public.runtime_executions FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Approval Gates erben den Tenant-Scope ihrer Execution.
DROP POLICY IF EXISTS runtime_approval_gates_tenant_select ON public.runtime_approval_gates;
CREATE POLICY runtime_approval_gates_tenant_select
  ON public.runtime_approval_gates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.runtime_executions e
     WHERE e.id = runtime_approval_gates.execution_id
       AND public.is_tenant_member(e.tenant_id)
  ));

DROP POLICY IF EXISTS runtime_approval_gates_tenant_insert ON public.runtime_approval_gates;
CREATE POLICY runtime_approval_gates_tenant_insert
  ON public.runtime_approval_gates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.runtime_executions e
     WHERE e.id = runtime_approval_gates.execution_id
       AND public.is_tenant_member(e.tenant_id)
  ));

DROP POLICY IF EXISTS runtime_approval_gates_tenant_update ON public.runtime_approval_gates;
CREATE POLICY runtime_approval_gates_tenant_update
  ON public.runtime_approval_gates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.runtime_executions e
     WHERE e.id = runtime_approval_gates.execution_id
       AND public.is_tenant_member(e.tenant_id)
  ));

COMMIT;
