-- Agent OS Substrate.
--
-- The 7 tables that turn isolated agents into a Multi-Agent
-- Operating System: structured memory, task queue, decision
-- proposals, plus immutable audit logs for inputs / outputs /
-- observations / events.
--
-- These tables back the in-memory stores under
-- src/core/agent-os/* via a setPersistHook() interface — Phase A
-- ships the schema + in-memory implementation; the hook can be
-- wired to a Postgres adapter in a Phase-B follow-up.
--
-- Positioning:
-- The substrate is intentionally TENANT-SCOPED via memberships
-- (mirrors the rest of the platform). System-wide agents
-- (TrainerAgent observations across tenants, etc.) use a
-- separate `system` tenant scope with a constant uuid.

BEGIN;

-- ── 1. agent_memory ───────────────────────────────────────────────
-- Structured memory: not chat history, deliberately. Each row is one
-- retrievable fact with topic / tags / importance. The MemoryAgent
-- (and any other agent with memory.read/write permission) operates
-- against this table.

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source          TEXT,                          -- origin: agent name | external system
  source_agent    TEXT,                          -- the agent that captured it (kebab-case)
  topic           TEXT NOT NULL,                 -- short subject label
  content         TEXT NOT NULL,                 -- the actual fact / observation
  tags            TEXT[] NOT NULL DEFAULT '{}',
  importance      INTEGER NOT NULL DEFAULT 3
                    CHECK (importance BETWEEN 1 AND 5),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','superseded','redacted')),
  superseded_by   UUID REFERENCES public.agent_memory(id) ON DELETE SET NULL,
  decided_action  TEXT,                          -- next action committed at capture time
  responsible_agent TEXT,                        -- who owns the follow-up
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_tenant_topic    ON public.agent_memory(tenant_id, topic);
CREATE INDEX IF NOT EXISTS idx_memory_tenant_active   ON public.agent_memory(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_tenant_tags     ON public.agent_memory USING gin(tags);

COMMENT ON TABLE public.agent_memory IS
  'Structured memory items. NOT chat history — every row is a retrievable fact with topic, tags, importance, status, optional decided_action + responsible_agent.';

-- ── 2. agent_tasks ────────────────────────────────────────────────
-- The task queue. An Orchestrator dispatches tasks to agents by
-- writing rows here; agents poll for their pending tasks.

CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent           TEXT NOT NULL,                 -- assigned agent name
  task            TEXT NOT NULL,                 -- short description
  priority        TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','critical')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','blocked','done','failed','cancelled')),
  input           JSONB NOT NULL DEFAULT '{}'::jsonb,
  output          JSONB,                         -- populated on done
  blocker_reason  TEXT,                          -- populated when status=blocked
  parent_task_id  UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  created_by      TEXT,                          -- agent | user | system
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_agent_status
  ON public.agent_tasks(tenant_id, agent, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_priority
  ON public.agent_tasks(tenant_id, priority, created_at);

COMMENT ON TABLE public.agent_tasks IS
  'The agent task queue. Status state machine: open → in_progress → done|failed|cancelled, plus blocked as a side-state.';

-- ── 3. agent_decisions ────────────────────────────────────────────
-- Decision proposals. An agent (or human) proposes a decision; a
-- designated approver moves it to approved | rejected. The agent OS
-- never auto-approves binding decisions.

CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_title  TEXT NOT NULL,
  problem         TEXT NOT NULL,                 -- what's being decided
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ label, pros, cons, ... }]
  recommendation  TEXT NOT NULL,                 -- agent's recommended option
  reason          TEXT NOT NULL,                 -- why this recommendation
  risk_level      TEXT NOT NULL DEFAULT 'medium'
                    CHECK (risk_level IN ('low','medium','high','critical')),
  reversibility   TEXT NOT NULL DEFAULT 'reversible'
                    CHECK (reversibility IN ('reversible','partially_reversible','irreversible')),
  status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','approved','rejected','superseded','withdrawn')),
  proposed_by     TEXT NOT NULL,                 -- agent name
  approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  superseded_by   UUID REFERENCES public.agent_decisions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant_status
  ON public.agent_decisions(tenant_id, status, created_at DESC);

COMMENT ON TABLE public.agent_decisions IS
  'Decision proposals. Status flips proposed → approved|rejected only on explicit human or DecisionAgent action. The Agent OS never auto-approves.';

-- ── 4. agent_inputs ───────────────────────────────────────────────
-- Append-only ingestion log: every external input the OS observes
-- (webhook, file upload, scheduled scan, etc.) is recorded here
-- before any agent processes it. Lets the OS replay an entire
-- session deterministically.

CREATE TABLE IF NOT EXISTS public.agent_inputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,                 -- 'webhook','scan','upload','schedule', …
  source_id       TEXT,                          -- external id when applicable
  payload         JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — append-only.
);

CREATE INDEX IF NOT EXISTS idx_inputs_tenant_received
  ON public.agent_inputs(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inputs_source
  ON public.agent_inputs(tenant_id, source);

-- ── 5. agent_outputs ──────────────────────────────────────────────
-- Append-only emission log: every output any agent produces lands
-- here, regardless of whether it later ships externally. The
-- TrainerAgent's quality reviews reference rows here by task_id.

CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  agent           TEXT NOT NULL,
  content         JSONB NOT NULL,
  self_confidence INTEGER CHECK (self_confidence BETWEEN 0 AND 100),
  evidence        TEXT[] NOT NULL DEFAULT '{}',  -- evidence-chain link IDs / URLs
  risk_dimensions TEXT[] NOT NULL DEFAULT '{}',
  produced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outputs_tenant_agent
  ON public.agent_outputs(tenant_id, agent, produced_at DESC);
CREATE INDEX IF NOT EXISTS idx_outputs_task
  ON public.agent_outputs(task_id);

-- ── 6. agent_observations ─────────────────────────────────────────
-- Monitoring-Agent + others write here when they notice something
-- worth surfacing but not yet escalated to a task or decision.

CREATE TABLE IF NOT EXISTS public.agent_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent           TEXT NOT NULL,                 -- observing agent
  category        TEXT NOT NULL,                 -- 'health','traffic','competitor','error','signal', …
  severity        TEXT NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('info','low','medium','high','critical')),
  title           TEXT NOT NULL,
  detail          TEXT,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_tenant_severity
  ON public.agent_observations(tenant_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_unack
  ON public.agent_observations(tenant_id, acknowledged) WHERE acknowledged = false;

-- ── 7. agent_events ───────────────────────────────────────────────
-- Append-only state-machine event log: every transition (task
-- started, memory updated, decision approved, observation made,
-- etc.). The replay surface that turns the substrate into a fully
-- auditable runtime.

CREATE TABLE IF NOT EXISTS public.agent_events (
  id              BIGSERIAL PRIMARY KEY,         -- monotonic seq for replay
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,                 -- 'task.created', 'memory.added', 'decision.proposed', …
  subject_type    TEXT NOT NULL,                 -- 'task','memory','decision','observation','input','output'
  subject_id      TEXT NOT NULL,                 -- the row id touched (stringly typed for cross-table)
  agent           TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — append-only.
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_seq
  ON public.agent_events(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_events_subject
  ON public.agent_events(tenant_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_events_type
  ON public.agent_events(tenant_id, event_type, created_at DESC);

-- ── updated_at triggers ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.agent_os_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_memory_updated_at ON public.agent_memory;
CREATE TRIGGER trg_agent_memory_updated_at
  BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.agent_os_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.agent_memory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_inputs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_outputs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events       ENABLE ROW LEVEL SECURITY;

-- Members of a tenant can SELECT all agent-OS rows for that tenant.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_memory','agent_tasks','agent_decisions',
    'agent_inputs','agent_outputs','agent_observations','agent_events'
  ]) LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_member_select ON public.%1$s;
      CREATE POLICY %1$s_member_select ON public.%1$s
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = %1$s.tenant_id
              AND m.user_id   = auth.uid()
          )
        );
    $f$, t);
  END LOOP;
END $$;

-- Owners + admins can INSERT into memory/decisions/observations.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['agent_memory','agent_decisions','agent_observations']) LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_admin_insert ON public.%1$s;
      CREATE POLICY %1$s_admin_insert ON public.%1$s
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = %1$s.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin')
          )
        );
    $f$, t);
  END LOOP;
END $$;

-- agent_tasks: owners+admins can INSERT + UPDATE (move status).
DROP POLICY IF EXISTS agent_tasks_admin_insert ON public.agent_tasks;
CREATE POLICY agent_tasks_admin_insert ON public.agent_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_tasks.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS agent_tasks_admin_update ON public.agent_tasks;
CREATE POLICY agent_tasks_admin_update ON public.agent_tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_tasks.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

-- Owners + admins can UPDATE decisions (approve/reject/withdraw).
DROP POLICY IF EXISTS agent_decisions_admin_update ON public.agent_decisions;
CREATE POLICY agent_decisions_admin_update ON public.agent_decisions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_decisions.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

-- agent_inputs / agent_outputs / agent_events: service_role only for
-- writes (no policy = denied for authenticated users). The agents
-- run with service_role; humans read via the SELECT policy above.
-- agent_observations: members read, owners+admins can acknowledge
-- (UPDATE policy below).

DROP POLICY IF EXISTS agent_observations_admin_update ON public.agent_observations;
CREATE POLICY agent_observations_admin_update ON public.agent_observations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_observations.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

COMMIT;
