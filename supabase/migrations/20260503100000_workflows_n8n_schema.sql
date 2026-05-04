-- n8n / Workflow-Engine Foundation
--
-- Ergänzt die bestehende public.workflows Tabelle um Multi-Tenant-Awareness
-- und n8n-Verknüpfung. Legt die Audit/Run-Tabelle workflow_runs an. Fügt
-- die Entitlement-Quota limit.workflow_runs_monthly mit Plan-Defaults hinzu.
--
-- Architektur (siehe deploy/ + supabase/functions/workflow-* nach diesem Commit):
--   Frontend ─► public.workflows (CRUD)
--             └► Edge `workflow-trigger` ─POST─► n8n (n8n.realsyncdynamicsai.de)
--                                                  └─ async callback ─►
--                                                  Edge `workflow-callback`
--                                                  └─► public.workflow_runs

-- ─── 1. workflows: tenant_id + n8n-Verknüpfung + RLS umstellen ──────────────
ALTER TABLE public.workflows
    ADD COLUMN IF NOT EXISTS tenant_id        UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS n8n_workflow_id  TEXT,
    ADD COLUMN IF NOT EXISTS version          INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_run_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS run_count        INTEGER NOT NULL DEFAULT 0;

-- Backfill tenant_id für eventuelle Bestandsdaten: erste Membership des Owners.
UPDATE public.workflows w
   SET tenant_id = (
       SELECT m.tenant_id
         FROM public.memberships m
        WHERE m.user_id = w.owner_id
        ORDER BY m.created_at ASC
        LIMIT 1
   )
 WHERE tenant_id IS NULL;

-- Bisherige owner-only RLS durch tenant-aware ersetzen.
DROP POLICY IF EXISTS "Besitzer können ihre eigenen Workflows verwalten" ON public.workflows;

CREATE POLICY "workflows tenant-member-read"
    ON public.workflows FOR SELECT
    USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id));

CREATE POLICY "workflows tenant-owner-admin-write"
    ON public.workflows FOR ALL
    USING (
        tenant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.memberships m
             WHERE m.tenant_id = workflows.tenant_id
               AND m.user_id   = auth.uid()
               AND m.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        tenant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.memberships m
             WHERE m.tenant_id = workflows.tenant_id
               AND m.user_id   = auth.uid()
               AND m.role IN ('owner', 'admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON public.workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_n8n_id ON public.workflows(n8n_workflow_id) WHERE n8n_workflow_id IS NOT NULL;

-- ─── 2. workflow_runs: Audit-Log jeder Ausführung ───────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    triggered_by    UUID,                     -- auth.users.id, NULL für system/cron
    status          TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error', 'timeout', 'cancelled')),
    input_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_payload  JSONB,
    error_code      TEXT,
    error_message   TEXT,
    cost_usd        NUMERIC NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    n8n_execution_id TEXT,                     -- ID auf der n8n-Seite, für Cross-Reference
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_started   ON public.workflow_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_started ON public.workflow_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status_pending   ON public.workflow_runs(status) WHERE status IN ('pending', 'running');

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_runs tenant-read" ON public.workflow_runs;
CREATE POLICY "workflow_runs tenant-read"
    ON public.workflow_runs FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- INSERT/UPDATE nur über service_role (Edge Functions). Default RLS = deny.

COMMENT ON TABLE public.workflow_runs IS
    'Audit + Cost-Trail jeder Workflow-Ausführung. Tenant-Member-RLS für SELECT. INSERT/UPDATE nur über service_role (Edge-Functions workflow-trigger / workflow-callback).';

-- ─── 3. Entitlement-Quota: workflow_runs pro Monat ──────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('limit.workflow_runs_monthly', 'Workflow-Ausführungen pro Monat', 'limit'),
    ('ai.tool.workflows',           'Feature: Workflow-Engine',        'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.workflow_runs_monthly', NULL, NULL, 'included', 'Workflow-Runs; Plan-Caps via product_entitlements.')
ON CONFLICT (entitlement_key) DO NOTHING;

-- Plan-Bindings: Free/Bronze keine Workflows, Silver 100, Gold 1000, Enterprise unlimited.
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('free',              'ai.tool.workflows',            0),
    ('free',              'limit.workflow_runs_monthly',  0),

    ('bronze',            'ai.tool.workflows',            0),
    ('bronze',            'limit.workflow_runs_monthly',  0),

    ('silver',            'ai.tool.workflows',            1),
    ('silver',            'limit.workflow_runs_monthly',  100),

    ('gold',              'ai.tool.workflows',            1),
    ('gold',              'limit.workflow_runs_monthly',  1000),

    ('enterprise_public', 'ai.tool.workflows',            1),
    ('enterprise_public', 'limit.workflow_runs_monthly', -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
