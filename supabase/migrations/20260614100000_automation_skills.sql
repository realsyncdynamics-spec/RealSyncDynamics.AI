-- Automatisierungs-Skills — Phase 2 Datenmodell + Run-Pipeline
--
-- Ergänzt das Phase-1-Modul (`src/content/automationSkills.ts`, rein
-- statisch, siehe docs/product/automation-skills.md) um eine echte
-- Run-Pipeline:
--
--   /app/automations
--     → Skill auswählen
--     → Edge `automation-trigger`  ─POST─► n8n (n8n.realsyncdynamicsai.de)
--                                            └─ async callback ─►
--                                            Edge `automation-callback`
--                                            └─► automation_runs / automation_run_events / automation_outputs
--
-- additiv, RLS-geschützt, multi-tenant. Kein Breaking Change an Phase 1 —
-- `src/content/automationSkills.ts` bleibt die UI-Quelle; `automation_skills`
-- ist der Backend-Katalog für Runs.

-- ─── 1. automation_skills: Katalog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_skills (
    id              TEXT PRIMARY KEY,             -- matches src/content/automationSkills.ts ids
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('available', 'beta', 'planned')),
    required_plan   TEXT NOT NULL DEFAULT 'free',
    input_schema    JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_schema   JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- n8n webhook path on N8N_INTERNAL_URL, e.g. "automation-dsgvo-audit".
    -- NULL = Skill ist noch nicht mit n8n verbunden (automation-trigger
    -- antwortet dann mit 503 NOT_CONNECTED statt einen Run zu starten).
    n8n_workflow_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.automation_skills (id, name, category, description, status, required_plan, n8n_workflow_id) VALUES
    ('dsgvo-audit',       'DSGVO Audit Skill',          'compliance', 'Prüft Website, Tracker, Consent, Header und Pflichtseiten auf DSGVO-Risiken.', 'available', 'free',   NULL),
    ('dokumenten-skill',  'Dokumenten Skill',           'dokumente',  'Erzeugt aus Audit-Befunden Datenschutzerklärung, AVV, VVT und TOM.',          'available', 'bronze', NULL),
    ('meeting-compliance','Meeting Compliance Skill',   'meetings',   'Erkennt Aufgaben, Risiken und DSGVO-/AI-Act-relevante Aussagen in Meeting-Notizen.', 'beta', 'silver', NULL),
    ('screenshot-feedback','Screenshot Feedback Skill', 'support',    'Wandelt Screenshots von Kunden/Beta-Nutzern in strukturierte Bug-Tickets um.', 'beta', 'silver', NULL),
    ('lead-risk',         'Lead Risk Skill',            'vertrieb',   'Scannt Lead-Websites auf DSGVO-Risiken und erstellt Outreach-Texte.',         'available', 'bronze', NULL),
    ('support-skill',     'Support Skill',              'support',    'Beantwortet Kundenfragen anhand der Wissensbasis — mit Quellen.',             'planned', 'gold',   NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. automation_runs: ein Lauf ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    skill_id        TEXT NOT NULL REFERENCES public.automation_skills(id),
    triggered_by    UUID,                     -- auth.users.id, NULL für system/cron
    status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error', 'timeout', 'cancelled')),
    input           JSONB NOT NULL DEFAULT '{}'::jsonb,
    result          JSONB,
    evidence_refs   JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_code      TEXT,
    error_message   TEXT,
    cost_usd        NUMERIC NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    n8n_execution_id TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_started ON public.automation_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_skill_started  ON public.automation_runs(skill_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status_pending ON public.automation_runs(status) WHERE status IN ('queued', 'running');

-- ─── 3. automation_run_events: Fortschritts-/Status-Events ──────────────────
CREATE TABLE IF NOT EXISTS public.automation_run_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_run_events_run ON public.automation_run_events(run_id, created_at);

-- ─── 4. automation_outputs: generierte Artefakte ────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_outputs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    output_type   TEXT NOT NULL,             -- 'report' | 'document' | 'protocol' | 'ticket' | ...
    content       JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_hash TEXT,                      -- SHA-256, analog src/core/runtime/evidence.ts
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_outputs_tenant_created ON public.automation_outputs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_outputs_run            ON public.automation_outputs(run_id);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.automation_skills     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_outputs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_skills read" ON public.automation_skills;
CREATE POLICY "automation_skills read"
    ON public.automation_skills FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "automation_runs tenant-read" ON public.automation_runs;
CREATE POLICY "automation_runs tenant-read"
    ON public.automation_runs FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "automation_run_events tenant-read" ON public.automation_run_events;
CREATE POLICY "automation_run_events tenant-read"
    ON public.automation_run_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.automation_runs r
         WHERE r.id = automation_run_events.run_id
           AND public.is_tenant_member(r.tenant_id)
    ));

DROP POLICY IF EXISTS "automation_outputs tenant-read" ON public.automation_outputs;
CREATE POLICY "automation_outputs tenant-read"
    ON public.automation_outputs FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- INSERT/UPDATE auf automation_runs / automation_run_events / automation_outputs
-- nur über service_role (Edge Functions automation-trigger / automation-callback).
-- Default RLS = deny.

COMMENT ON TABLE public.automation_skills IS
    'Backend-Katalog der Automatisierungs-Skills (Phase 2). UI-Quelle bleibt src/content/automationSkills.ts; n8n_workflow_id verbindet einen Skill mit einem n8n-Webhook auf N8N_INTERNAL_URL.';
COMMENT ON TABLE public.automation_runs IS
    'Audit + Cost-Trail jeder Automation-Skill-Ausführung. Tenant-Member-RLS für SELECT. INSERT/UPDATE nur über service_role (Edge-Functions automation-trigger / automation-callback).';
COMMENT ON TABLE public.automation_run_events IS
    'Fortschritts-/Status-Events pro automation_runs-Eintrag.';
COMMENT ON TABLE public.automation_outputs IS
    'Generierte Artefakte (Reports, Dokumente, Tickets) eines automation_runs, mit optionalem Evidence-Hash.';

-- ─── 6. Entitlements: Automation-Runs pro Monat ─────────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('limit.automation_runs_monthly', 'Automatisierungs-Skill-Läufe pro Monat', 'limit'),
    ('ai.tool.automations',           'Feature: Automatisierungs-Skills',       'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.automation_runs_monthly', NULL, NULL, 'included', 'Automation-Skill-Runs; Plan-Caps via product_entitlements.')
ON CONFLICT (entitlement_key) DO NOTHING;

WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('free',              'ai.tool.automations',           1),
    ('free',              'limit.automation_runs_monthly', 3),

    ('bronze',            'ai.tool.automations',           1),
    ('bronze',            'limit.automation_runs_monthly', 20),

    ('silver',            'ai.tool.automations',           1),
    ('silver',            'limit.automation_runs_monthly', 100),

    ('gold',              'ai.tool.automations',           1),
    ('gold',              'limit.automation_runs_monthly', 500),

    ('enterprise_public', 'ai.tool.automations',           1),
    ('enterprise_public', 'limit.automation_runs_monthly', -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
