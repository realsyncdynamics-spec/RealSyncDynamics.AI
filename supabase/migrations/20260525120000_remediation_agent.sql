-- Developer Remediation Agent — Phase-A foundation.
--
-- A strictly review-bounded agent that converts governance findings
-- into technical remediation artifacts (fix snippets, plans, GitHub
-- payloads, PR-comment drafts). NEVER auto-applies, NEVER merges,
-- NEVER deploys, NEVER touches secrets.
--
-- Every output of this agent surfaces with `review_required = true`.
-- A human reviewer (role: owner | admin in app code; role: developer |
-- technical_owner in the agent contract) MUST approve before any
-- downstream action can be taken on the suggestion.
--
-- Positioning:
-- This table tracks remediation INTENT, not application. Applying a
-- fix happens out-of-band (developer copies snippet, opens PR in
-- their own tooling). The agent never holds merge rights.

BEGIN;

-- ── remediation_plans ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.remediation_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Loose FK references — the source finding/evidence may live in
  -- governance_events, ai_evidence_events or a future findings table.
  -- We don't enforce FK so the agent can also be triggered manually
  -- from a one-off finding id provided in the API request.
  finding_id        UUID NOT NULL,
  evidence_id       UUID,

  status            TEXT NOT NULL DEFAULT 'review_required'
                      CHECK (status IN ('draft','review_required','approved','rejected','applied')),

  affected_system   TEXT NOT NULL
                      CHECK (affected_system IN
                        ('website','api','edge_function','ci_cd','consent_layer','unknown')),
  technology        TEXT NOT NULL
                      CHECK (technology IN
                        ('react','vite','nginx','apache','cloudflare','vercel','supabase','unknown')),

  summary           TEXT NOT NULL,
  steps             JSONB NOT NULL DEFAULT '[]'::jsonb,
  snippets          JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.0
                      CHECK (confidence >= 0.0 AND confidence <= 1.0),

  review_required   BOOLEAN NOT NULL DEFAULT true,

  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remediation_plans_tenant_created
  ON public.remediation_plans (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remediation_plans_status
  ON public.remediation_plans (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_remediation_plans_finding
  ON public.remediation_plans (tenant_id, finding_id);

COMMENT ON TABLE  public.remediation_plans IS
  'Developer Remediation Agent output. Intent only — never auto-applied. Every row defaults to review_required=true.';
COMMENT ON COLUMN public.remediation_plans.snippets IS
  'JSONB array of { path, language, content, notes }. Snippets are copy-paste-ready, not merged.';
COMMENT ON COLUMN public.remediation_plans.review_required IS
  'Always true at creation. Approved/rejected status reflects a human review event, not an automatic outcome.';

-- ── remediation_agent_events ──────────────────────────────────────
-- Append-only audit of every agent action for this tenant.
-- Conforms to the spirit of ECS v1.0 (append-only, content-hashable)
-- without yet wiring the full hash chain — that is Phase-B work.
CREATE TABLE IF NOT EXISTS public.remediation_agent_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  remediation_plan_id   UUID REFERENCES public.remediation_plans(id) ON DELETE CASCADE,

  event_type            TEXT NOT NULL
                          CHECK (event_type IN (
                            'remediation.plan.created',
                            'fix.snippet.generated',
                            'github.issue.prepared',
                            'github.pr_draft.prepared',
                            'pull_request.comment.created',
                            'remediation.review_required'
                          )),
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remediation_events_tenant_created
  ON public.remediation_agent_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remediation_events_plan
  ON public.remediation_agent_events (remediation_plan_id, created_at DESC);

COMMENT ON TABLE public.remediation_agent_events IS
  'Append-only audit trail for the Developer Remediation Agent. No UPDATE/DELETE granted to app roles.';

-- ── updated_at trigger for remediation_plans ──────────────────────
CREATE OR REPLACE FUNCTION public.remediation_plans_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remediation_plans_updated_at ON public.remediation_plans;
CREATE TRIGGER trg_remediation_plans_updated_at
  BEFORE UPDATE ON public.remediation_plans
  FOR EACH ROW EXECUTE FUNCTION public.remediation_plans_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.remediation_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_agent_events  ENABLE ROW LEVEL SECURITY;

-- Members of a tenant can SELECT remediation plans for that tenant.
DROP POLICY IF EXISTS remediation_plans_member_select ON public.remediation_plans;
CREATE POLICY remediation_plans_member_select ON public.remediation_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = remediation_plans.tenant_id
        AND m.user_id   = auth.uid()
    )
  );

-- Owners + admins can INSERT remediation plans (typically the agent
-- runs under service_role; this policy enables manual UI-driven
-- creation in a future PR).
DROP POLICY IF EXISTS remediation_plans_admin_insert ON public.remediation_plans;
CREATE POLICY remediation_plans_admin_insert ON public.remediation_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = remediation_plans.tenant_id
        AND m.user_id   = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

-- Owners + admins can UPDATE (status changes only — DB-level we allow
-- full update; app code restricts to status field).
DROP POLICY IF EXISTS remediation_plans_admin_update ON public.remediation_plans;
CREATE POLICY remediation_plans_admin_update ON public.remediation_plans
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = remediation_plans.tenant_id
        AND m.user_id   = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

-- No DELETE policy for authenticated users — plans are never deleted
-- (audit trail). service_role bypasses RLS for archival operations.

-- Events: members read, service_role writes.
DROP POLICY IF EXISTS remediation_events_member_select ON public.remediation_agent_events;
CREATE POLICY remediation_events_member_select ON public.remediation_agent_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = remediation_agent_events.tenant_id
        AND m.user_id   = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated users on the events table.
-- The Edge Function writes via service_role (RLS-bypassing), preserving
-- the append-only property at the app boundary.

COMMIT;
