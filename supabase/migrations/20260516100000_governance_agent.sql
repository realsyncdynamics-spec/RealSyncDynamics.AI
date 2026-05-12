-- Governance Agent — session state + run trace for the conversational
-- compliance agent (Edge Function `governance-agent`).
--
-- Two tables:
--   agent_sessions  — one row per (tenant, user, session). Holds the
--                     rolling conversation history (last N turns) so the
--                     Edge Function can stay stateless.
--   agent_runs      — one row per single `chat` invocation. Captures the
--                     full tool-use trace + token cost for audit + cost
--                     dashboards (joins to token_usage via run_id).

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,                       -- auth.users(id); FK skipped to keep RLS-only auth contract
  history      JSONB NOT NULL DEFAULT '[]',         -- array of {role, content}
  last_turn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_user
  ON public.agent_sessions(tenant_id, user_id, last_turn_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id   UUID NOT NULL,
  actor_email     TEXT,
  user_message    TEXT NOT NULL,
  final_response  TEXT,
  tool_calls      JSONB NOT NULL DEFAULT '[]',      -- [{tool, input, output, iter}]
  iterations      INT  NOT NULL DEFAULT 0,
  llm_provider    TEXT NOT NULL,                    -- 'anthropic' | 'mistral' | 'openai'
  llm_model       TEXT NOT NULL,
  input_tokens    INT  NOT NULL DEFAULT 0,
  output_tokens   INT  NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10,6),
  duration_ms     INT,
  outcome         TEXT NOT NULL CHECK (outcome IN ('success','tool_error','llm_error','budget_exceeded','timeout')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_created
  ON public.agent_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_session
  ON public.agent_runs(session_id, created_at);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs     ENABLE ROW LEVEL SECURITY;

-- service_role writes everything (Edge Function uses service-role client).
CREATE POLICY "agent_sessions_service_all" ON public.agent_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "agent_runs_service_all" ON public.agent_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated users can read their own sessions + their tenant's runs.
CREATE POLICY "agent_sessions_self_read" ON public.agent_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "agent_runs_tenant_read" ON public.agent_runs
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));
