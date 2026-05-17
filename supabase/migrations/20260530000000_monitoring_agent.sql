-- MonitoringAgent — SLO-defined observability over the AgentOS event stream.
--
-- One new table: per-tenant SLO definitions. The agent itself emits
-- alerts via the existing agent_observations table (substrate),
-- preserving a single audit surface.
--
-- Spec §14 hard safety:
--   MonitoringAgent observes + reports. It NEVER pauses agents,
--   modifies tasks, or executes corrective action. The output is
--   purely informational; humans (or DecisionAgent) decide what to
--   do about an alert.

BEGIN;

-- ── monitoring_agent_slos ────────────────────────────────────────
-- Each row is one SLO. SLOs are scoped to a tenant + (optionally)
-- a single agent (kebab-case name). When agent IS NULL, the SLO
-- applies across the whole tenant.

CREATE TABLE IF NOT EXISTS public.monitoring_agent_slos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name                TEXT NOT NULL,
  description         TEXT,

  -- Scope. NULL agent = whole tenant.
  agent               TEXT,

  -- The metric we evaluate. Allowed values match the agent-OS
  -- event/task semantics:
  --   'task_failure_rate'      — failed / (done + failed) in window
  --   'decision_escalation_rate'  — escalated / total_routed
  --   'task_open_count'        — current count of 'open' tasks
  --   'task_blocked_count'     — current count of 'blocked' tasks
  --   'observation_unack_count' — observations with severity>=high
  --                              and acknowledged=false
  metric              TEXT NOT NULL
                        CHECK (metric IN (
                          'task_failure_rate',
                          'decision_escalation_rate',
                          'task_open_count',
                          'task_blocked_count',
                          'observation_unack_count'
                        )),

  -- Comparator + threshold. We support 'gt' (>) and 'lt' (<) only —
  -- enough for "rate exceeds X" and "count below Y" cases.
  comparator          TEXT NOT NULL CHECK (comparator IN ('gt','lt')),
  threshold           NUMERIC NOT NULL,

  -- Time window for rate metrics. Counts ignore this. Default 24h.
  window_hours        INT NOT NULL DEFAULT 24
                        CHECK (window_hours > 0 AND window_hours <= 720),

  -- Severity to attach to the emitted observation.
  alert_severity      TEXT NOT NULL DEFAULT 'high'
                        CHECK (alert_severity IN ('info','low','medium','high','critical')),

  enabled             BOOLEAN NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT monitoring_agent_slos_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS monitoring_agent_slos_tenant_enabled_idx
  ON public.monitoring_agent_slos(tenant_id, enabled);

CREATE OR REPLACE FUNCTION public.monitoring_agent_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monitoring_agent_slos_set_updated_at ON public.monitoring_agent_slos;
CREATE TRIGGER monitoring_agent_slos_set_updated_at
  BEFORE UPDATE ON public.monitoring_agent_slos
  FOR EACH ROW EXECUTE FUNCTION public.monitoring_agent_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.monitoring_agent_slos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monitoring_agent_slos_member_select ON public.monitoring_agent_slos;
CREATE POLICY monitoring_agent_slos_member_select ON public.monitoring_agent_slos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = monitoring_agent_slos.tenant_id
              AND m.user_id   = auth.uid())
  );

DROP POLICY IF EXISTS monitoring_agent_slos_owner_write ON public.monitoring_agent_slos;
CREATE POLICY monitoring_agent_slos_owner_write ON public.monitoring_agent_slos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = monitoring_agent_slos.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = monitoring_agent_slos.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

COMMIT;
