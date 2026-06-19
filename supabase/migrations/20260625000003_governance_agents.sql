-- Persistentes Agenten-Register pro Tenant (governance_agents).
--
-- Bisher war AgentRegistryView eine reine Anzeige des hartkodierten
-- DEMO_AGENTS-Sets ohne Datenquelle (Audit-Befund K7). Diese Tabelle hält
-- dieselbe Struktur (GovernanceAgent) pro Arbeitsbereich. Default-Agenten
-- werden vom Frontend beim ersten Laden angelegt (seed-on-read).

CREATE TABLE IF NOT EXISTS public.governance_agents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_key             TEXT NOT NULL,                  -- stabiler Schlüssel für Default-Agenten / seed-Idempotenz
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    type                  TEXT NOT NULL CHECK (type IN ('detection','classification','evidence','policy','triage','remediation')),
    status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','review_required','disabled')),
    risk_level            TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
    tools                 TEXT[] NOT NULL DEFAULT '{}',
    permissions           TEXT[] NOT NULL DEFAULT '{}',
    restricted_actions    TEXT[] NOT NULL DEFAULT '{}',
    requires_human_review TEXT[] NOT NULL DEFAULT '{}',
    evidence_refs         TEXT[] NOT NULL DEFAULT '{}',
    owner_role            TEXT NOT NULL DEFAULT 'governance.owner',
    last_run_at           TIMESTAMPTZ,
    sort_order            INTEGER NOT NULL DEFAULT 100,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_governance_agents_tenant
    ON public.governance_agents(tenant_id, sort_order);

ALTER TABLE public.governance_agents ENABLE ROW LEVEL SECURITY;

-- service_role darf alles (Runtime-Ausführung via Edge-Functions/n8n).
CREATE POLICY "service_role_all_governance_agents"
    ON public.governance_agents
    FOR ALL
    USING (auth.role() = 'service_role');

-- Tenant-Mitglieder verwalten die Agenten ihres Arbeitsbereichs.
CREATE POLICY "members_manage_own_tenant_governance_agents"
    ON public.governance_agents
    FOR ALL
    USING ((SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.governance_agents IS
    'Pro-Tenant Agenten-Register (kontrollierte Governance-Agenten). Default-Set wird vom Frontend beim ersten Laden angelegt (seed-on-read).';
