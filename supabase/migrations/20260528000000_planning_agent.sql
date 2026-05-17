-- PlanningAgent — strategic plans + milestones + human reviews.
--
-- Sits on top of the AgentOS substrate (20260526000000_agent_os_substrate.sql).
-- A Plan decomposes into Milestones; on approval, milestones are
-- materialised as agent_tasks rows for the assigned agent. Reviews
-- live in their own table for full audit history (one plan can have
-- many review records across its lifecycle).
--
-- Spec §12 hard safety:
--   PlanningAgent recommends + decomposes — never auto-activates.
--   Every plan starts as 'draft'. The only way to 'approved' is via
--   recordReview(); the only way to 'active' is via activatePlan()
--   AFTER 'approved'. Schema enforces this with CHECK constraints
--   on the status transitions where possible (e.g., approved_by
--   must be set when status='approved').

BEGIN;

-- ── 1. planning_agent_plans ──────────────────────────────────────
-- One row per strategic plan. Source-tracking columns link back to
-- the Hermes signal / market gap that triggered the plan (nullable
-- — plans can also be created from scratch by a human).

CREATE TABLE IF NOT EXISTS public.planning_agent_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title               TEXT NOT NULL,
  objective           TEXT NOT NULL,                 -- what success looks like
  rationale           TEXT,                          -- why this plan exists

  -- Source attribution. Plans triggered by Hermes carry signal_ids
  -- or gap_ids; plans triggered by humans carry neither.
  source_signal_ids   TEXT[] NOT NULL DEFAULT '{}',
  source_gap_ids      TEXT[] NOT NULL DEFAULT '{}',
  source_handoff_id   TEXT,                          -- hermes_agent_handoffs.id

  priority            TEXT NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low','normal','high','critical')),

  -- Lifecycle. 'pending_review' is the gate before 'approved'.
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft','pending_review',
                          'approved','rejected',
                          'active','completed','cancelled'
                        )),

  -- Assignment.
  owner_role          TEXT,                          -- 'founder','cto','ops', …
  owner_agent         TEXT,                          -- kebab-case agent name (optional)

  -- Horizon.
  start_date          DATE,
  target_date         DATE,

  -- Success criterion + agent self-assessment.
  success_metric      TEXT,                          -- "GMV +20% MoM" style
  confidence_score    NUMERIC(3,2) NOT NULL DEFAULT 0.50
                        CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Approval bookkeeping (mirrors agent_decisions pattern).
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  rejected_reason     TEXT,

  created_by          TEXT,                          -- agent name | user id | 'system'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Cross-field invariant: an approved plan MUST have approved_by + approved_at.
  CONSTRAINT planning_agent_plans_approved_audit
    CHECK (
      status != 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    ),
  -- A rejected plan MUST have a rejected_reason.
  CONSTRAINT planning_agent_plans_rejected_reason
    CHECK (
      status != 'rejected' OR rejected_reason IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS planning_agent_plans_tenant_status_idx
  ON public.planning_agent_plans(tenant_id, status);
CREATE INDEX IF NOT EXISTS planning_agent_plans_tenant_priority_idx
  ON public.planning_agent_plans(tenant_id, priority);
CREATE INDEX IF NOT EXISTS planning_agent_plans_handoff_idx
  ON public.planning_agent_plans(source_handoff_id) WHERE source_handoff_id IS NOT NULL;

-- ── 2. planning_agent_milestones ─────────────────────────────────
-- A plan is a sequenced list of milestones. Each milestone may
-- depend on an earlier milestone (depends_on_milestone_id) and
-- specifies the agent intended to execute it.

CREATE TABLE IF NOT EXISTS public.planning_agent_milestones (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                  UUID NOT NULL REFERENCES public.planning_agent_plans(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  sequence                 INT NOT NULL CHECK (sequence >= 0),
  title                    TEXT NOT NULL,
  description              TEXT,

  -- Who does this. May be an agent name (kebab-case) OR a role token.
  assignee_agent           TEXT,                       -- e.g. 'promotion-agent'
  assignee_role            TEXT,                       -- e.g. 'founder' (when no agent)

  depends_on_milestone_id  UUID REFERENCES public.planning_agent_milestones(id) ON DELETE SET NULL,

  target_date              DATE,

  -- Materialisation: when the plan is activated, we create one
  -- agent_tasks row per milestone (if assignee_agent is set) and
  -- record its id here for traceability.
  materialised_task_id     UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,

  -- Lifecycle (parallel to AgentTask statuses but simpler).
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','active','done','skipped','failed')),

  requires_human_review    BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_required        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT planning_agent_milestones_sequence_unique
    UNIQUE (plan_id, sequence)
);

CREATE INDEX IF NOT EXISTS planning_agent_milestones_plan_seq_idx
  ON public.planning_agent_milestones(plan_id, sequence);
CREATE INDEX IF NOT EXISTS planning_agent_milestones_tenant_status_idx
  ON public.planning_agent_milestones(tenant_id, status);

-- ── 3. planning_agent_reviews ────────────────────────────────────
-- Full review history (one plan can be reviewed N times: rejected,
-- revised, re-submitted, approved, …).

CREATE TABLE IF NOT EXISTS public.planning_agent_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID NOT NULL REFERENCES public.planning_agent_plans(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  reviewer            TEXT NOT NULL,                  -- user id | agent name | 'system'
  reviewer_user_id    UUID REFERENCES auth.users(id), -- nullable: agent reviews allowed
  decision            TEXT NOT NULL
                        CHECK (decision IN ('approved','rejected','needs_revision')),

  notes               TEXT,
  -- For 'rejected' + 'needs_revision', we require a notes field. For
  -- 'approved' we don't, but we don't enforce that here — let the
  -- API layer decide whether to require notes for approved cases.

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planning_agent_reviews_plan_idx
  ON public.planning_agent_reviews(plan_id, created_at DESC);

-- ── updated_at triggers ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.planning_agent_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_agent_plans_set_updated_at ON public.planning_agent_plans;
CREATE TRIGGER planning_agent_plans_set_updated_at
  BEFORE UPDATE ON public.planning_agent_plans
  FOR EACH ROW EXECUTE FUNCTION public.planning_agent_set_updated_at();

DROP TRIGGER IF EXISTS planning_agent_milestones_set_updated_at ON public.planning_agent_milestones;
CREATE TRIGGER planning_agent_milestones_set_updated_at
  BEFORE UPDATE ON public.planning_agent_milestones
  FOR EACH ROW EXECUTE FUNCTION public.planning_agent_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.planning_agent_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_agent_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_agent_reviews    ENABLE ROW LEVEL SECURITY;

-- Members can SELECT every row for their tenant.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'planning_agent_plans','planning_agent_milestones','planning_agent_reviews'
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

-- Owners + admins can INSERT plans + milestones + reviews.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'planning_agent_plans','planning_agent_milestones','planning_agent_reviews'
  ]) LOOP
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

-- Owners + admins can UPDATE plans + milestones (approve, activate,
-- transition status). Reviews are append-only (no UPDATE policy).
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'planning_agent_plans','planning_agent_milestones'
  ]) LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_admin_update ON public.%1$s;
      CREATE POLICY %1$s_admin_update ON public.%1$s
        FOR UPDATE TO authenticated
        USING (
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

COMMIT;
