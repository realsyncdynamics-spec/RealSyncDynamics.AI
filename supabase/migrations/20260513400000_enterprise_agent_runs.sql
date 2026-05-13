-- Enterprise AI OS — Agent run persistence.
--
-- Stores every dispatch through the Enterprise AI OS agent runtime so
-- the dashboard can show recent activity and the audit trail is
-- reconstructable. Append-only.

CREATE TABLE IF NOT EXISTS public.enterprise_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  agent_id TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL
    CHECK (status IN ('success', 'blocked', 'requires_approval', 'error')),
  summary TEXT NOT NULL DEFAULT '',
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_agent_runs_tenant_idx
  ON public.enterprise_agent_runs(tenant_id);
CREATE INDEX IF NOT EXISTS enterprise_agent_runs_agent_idx
  ON public.enterprise_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS enterprise_agent_runs_created_idx
  ON public.enterprise_agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS enterprise_agent_runs_status_idx
  ON public.enterprise_agent_runs(status);

ALTER TABLE public.enterprise_agent_runs ENABLE ROW LEVEL SECURITY;

-- Service-role only for now. Tenant-scoped read RLS comes in a follow-up
-- migration alongside the multi-tenant pairing PR.
