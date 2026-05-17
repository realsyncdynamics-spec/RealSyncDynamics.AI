-- DecisionAgent — policy layer over the AgentOS agent_decisions table.
--
-- DecisionAgent does NOT own a 'decisions' table — those live in
-- agent_decisions from the AgentOS substrate. This migration ships:
--
--   1. decision_agent_policies   — per-tenant routing rules
--                                  (when to auto-approve, when to
--                                  escalate, to whom).
--   2. decision_agent_routings   — full audit log: every decision the
--                                  agent has touched, what it did,
--                                  who it routed to, response time.
--
-- Spec §13 hard safety:
--   - NEVER auto-approve decisions with risk_level='high' or 'critical'.
--   - NEVER auto-approve decisions with reversibility='irreversible'.
--   - Auto-approval requires confidence_score >= floor (policy).
--   - Every touched decision produces a routings row (audit).

BEGIN;

-- ── 1. decision_agent_policies ───────────────────────────────────
-- One row per tenant. Captures the rules the agent applies when
-- reviewing a DecisionProposal. Fields with NULL = "use the
-- platform default" (defined in code).

CREATE TABLE IF NOT EXISTS public.decision_agent_policies (
  tenant_id                 UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Auto-approval thresholds. NULL → platform default (0.70).
  auto_approve_confidence_floor  NUMERIC(3,2)
                                  CHECK (
                                    auto_approve_confidence_floor IS NULL OR
                                    (auto_approve_confidence_floor >= 0 AND auto_approve_confidence_floor <= 1)
                                  ),

  -- Risk levels eligible for auto-approval. Default ['low'] in code.
  -- 'high' and 'critical' are NEVER eligible regardless of this list
  -- (enforced in the agent's code, not by CHECK).
  auto_approve_risk_levels       TEXT[] NOT NULL DEFAULT ARRAY['low'],

  -- Reversibility levels eligible for auto-approval.
  -- 'irreversible' is NEVER eligible regardless.
  auto_approve_reversibility     TEXT[] NOT NULL DEFAULT ARRAY['reversible'],

  -- Routing target for escalations. Either a user id (UUID) or an
  -- email/handle string for off-platform handoff (Slack id, etc.).
  default_owner_user_id          UUID REFERENCES auth.users(id),
  default_owner_handle           TEXT,

  -- SLA in hours — how long the human has to respond before the
  -- decision goes 'overdue' (still 'proposed', just flagged).
  default_sla_hours              INT NOT NULL DEFAULT 24
                                  CHECK (default_sla_hours > 0),

  -- Hard kill-switch: when true, the agent never auto-approves
  -- regardless of policy (panic mode).
  paused                         BOOLEAN NOT NULL DEFAULT FALSE,

  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. decision_agent_routings ───────────────────────────────────
-- Append-only audit log. One row per "touch" — if the agent reviews
-- a decision once and then routes a re-review later, that's two
-- rows.

CREATE TABLE IF NOT EXISTS public.decision_agent_routings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id         UUID NOT NULL REFERENCES public.agent_decisions(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- What the agent did.
  action              TEXT NOT NULL
                        CHECK (action IN (
                          'auto_approved','escalated','rejected','overdue','superseded'
                        )),
  reason              TEXT NOT NULL,

  -- Routing context (only set when action='escalated').
  routed_to_user_id   UUID REFERENCES auth.users(id),
  routed_to_handle    TEXT,
  due_by              TIMESTAMPTZ,

  -- Snapshot of the decision at routing time (for audit replay).
  risk_level          TEXT,
  reversibility       TEXT,
  confidence_score    NUMERIC(3,2),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_agent_routings_decision_idx
  ON public.decision_agent_routings(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decision_agent_routings_tenant_action_idx
  ON public.decision_agent_routings(tenant_id, action, created_at DESC);

-- ── updated_at trigger for policies ──────────────────────────────

CREATE OR REPLACE FUNCTION public.decision_agent_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS decision_agent_policies_set_updated_at ON public.decision_agent_policies;
CREATE TRIGGER decision_agent_policies_set_updated_at
  BEFORE UPDATE ON public.decision_agent_policies
  FOR EACH ROW EXECUTE FUNCTION public.decision_agent_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.decision_agent_policies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_agent_routings  ENABLE ROW LEVEL SECURITY;

-- Members can SELECT.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['decision_agent_policies','decision_agent_routings']) LOOP
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

-- Owners only can INSERT/UPDATE policies. Admins+owners can INSERT
-- routings (the agent runs with service_role; humans get visibility).
DROP POLICY IF EXISTS decision_agent_policies_owner_write ON public.decision_agent_policies;
CREATE POLICY decision_agent_policies_owner_write ON public.decision_agent_policies
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = decision_agent_policies.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role = 'owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = decision_agent_policies.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role = 'owner')
  );

-- decision_agent_routings: append-only. No UPDATE/DELETE policy.

COMMIT;
