-- Automatisierungs-Skills: Datenmodell für echte Runs (Phase 2)
--
-- Phase 1 (siehe src/content/automationSkills.ts, docs/product/automation-skills.md)
-- war rein Frontend/Content. Diese Migration legt das additive Datenmodell für
-- echte Backend-Runs an, analog zu workflow_runs / workflow-trigger / workflow-callback
-- (siehe 20260503100000_workflows_n8n_schema.sql):
--
--   Frontend ─► Edge `automation-trigger` ─POST─► n8n
--                                                   └─ async callback ─►
--                                                   Edge `automation-callback`
--                                                   └─► public.automation_runs
--
-- Tabellen:
--   automation_skills      — Katalog (spiegelt src/content/automationSkills.ts)
--   automation_runs        — ein Lauf eines Skills (Status, Input, Result, Kosten)
--   automation_run_events  — Fortschritts-/Status-Events pro Lauf
--   automation_outputs     — generierte Artefakte (Report, Dokument, Ticket, Protokoll)
--
-- Entitlement-Quota limit.automation_runs_monthly mit Plan-Defaults.

-- ─── 1. automation_skills: Katalog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_skills (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('compliance', 'vertrieb', 'support', 'dokumente', 'meetings')),
    status          TEXT NOT NULL CHECK (status IN ('available', 'beta', 'planned')),
    description     TEXT NOT NULL DEFAULT '',
    input_schema    JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_schema   JSONB NOT NULL DEFAULT '{}'::jsonb,
    n8n_workflow_id TEXT,
    required_plan   TEXT NOT NULL CHECK (required_plan IN ('free', 'bronze', 'silver', 'gold', 'enterprise_public')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_skills public-read" ON public.automation_skills;
CREATE POLICY "automation_skills public-read"
    ON public.automation_skills FOR SELECT
    USING (true);

COMMENT ON TABLE public.automation_skills IS
    'Katalog der Automatisierungs-Skills (Phase 2). Spiegelt src/content/automationSkills.ts. INSERT/UPDATE nur über service_role.';

-- Seed: 6 Skills aus Phase 1, n8n_workflow_id noch nicht verdrahtet (NULL = Skill
-- läuft weiterhin über den Phase-1-Link, automation-trigger lehnt Trigger mit
-- NOT_BOUND ab, solange n8n_workflow_id fehlt).
INSERT INTO public.automation_skills (id, title, category, status, description, required_plan) VALUES
    ('dsgvo-audit',         'DSGVO Audit Skill',          'compliance', 'available', 'Prüft Website, Tracker, Consent, Header und Pflichtseiten auf DSGVO-Risiken.', 'free'),
    ('dokumenten-skill',    'Dokumenten Skill',           'dokumente',  'available', 'Erzeugt aus den Audit-Befunden Datenschutzerklärung, AVV, VVT und TOM.',       'bronze'),
    ('meeting-compliance',  'Meeting Compliance Skill',   'meetings',   'beta',      'Erkennt Aufgaben, Risiken und DSGVO-/AI-Act-relevante Aussagen in Meeting-Notizen.', 'silver'),
    ('screenshot-feedback', 'Screenshot Feedback Skill',  'support',    'beta',      'Wandelt Screenshots von Kunden und Beta-Nutzern in strukturierte Bug-Tickets um.', 'silver'),
    ('lead-risk',           'Lead Risk Skill',            'vertrieb',   'available', 'Scannt potenzielle Kunden-Websites auf DSGVO-Risiken und erstellt Outreach-Texte.', 'bronze'),
    ('support-skill',       'Support Skill',              'support',    'planned',   'Beantwortet Kundenfragen anhand der eigenen Wissensbasis — mit Quellen.',      'gold')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. automation_runs: ein Lauf eines Skills ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    skill_id         TEXT NOT NULL REFERENCES public.automation_skills(id) ON DELETE RESTRICT,
    triggered_by     UUID,                     -- auth.users.id, NULL für system/cron
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error', 'timeout', 'cancelled')),
    input            JSONB NOT NULL DEFAULT '{}'::jsonb,
    result           JSONB,
    error_code       TEXT,
    error_message    TEXT,
    cost_usd         NUMERIC NOT NULL DEFAULT 0,
    duration_ms      INTEGER,
    n8n_execution_id TEXT,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_started ON public.automation_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_skill_started  ON public.automation_runs(skill_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status_pending ON public.automation_runs(status) WHERE status IN ('pending', 'running');

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_runs tenant-read" ON public.automation_runs;
CREATE POLICY "automation_runs tenant-read"
    ON public.automation_runs FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- INSERT/UPDATE nur über service_role (Edge Functions automation-trigger / automation-callback).

COMMENT ON TABLE public.automation_runs IS
    'Ein Lauf eines Automatisierungs-Skills. Tenant-Member-RLS für SELECT. INSERT/UPDATE nur über service_role (Edge-Functions automation-trigger / automation-callback).';

-- ─── 3. automation_run_events: Fortschritts-/Status-Events pro Lauf ─────────
CREATE TABLE IF NOT EXISTS public.automation_run_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL CHECK (event_type IN ('queued', 'progress', 'log', 'result', 'error')),
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_run_events_run_created ON public.automation_run_events(run_id, created_at);

ALTER TABLE public.automation_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_run_events tenant-read" ON public.automation_run_events;
CREATE POLICY "automation_run_events tenant-read"
    ON public.automation_run_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.automation_runs r
         WHERE r.id = automation_run_events.run_id
           AND public.is_tenant_member(r.tenant_id)
    ));

COMMENT ON TABLE public.automation_run_events IS
    'Fortschritts-/Status-Events eines automation_runs (Prüfpfad). Tenant-Member-RLS für SELECT via Join. INSERT nur über service_role.';

-- ─── 4. automation_outputs: generierte Artefakte ────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_outputs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    output_type   TEXT NOT NULL CHECK (output_type IN ('report', 'document', 'ticket', 'protocol')),
    storage_path  TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_outputs_run ON public.automation_outputs(run_id);

ALTER TABLE public.automation_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_outputs tenant-read" ON public.automation_outputs;
CREATE POLICY "automation_outputs tenant-read"
    ON public.automation_outputs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.automation_runs r
         WHERE r.id = automation_outputs.run_id
           AND public.is_tenant_member(r.tenant_id)
    ));

COMMENT ON TABLE public.automation_outputs IS
    'Generierte Artefakte (Report/Dokument/Ticket/Protokoll) eines automation_runs, mit Herkunftsnachweis-Metadaten. Tenant-Member-RLS für SELECT via Join. INSERT nur über service_role.';

-- ─── 5. Entitlement-Quota: automation_runs pro Monat ────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('limit.automation_runs_monthly', 'Automatisierungs-Skill-Ausführungen pro Monat', 'limit'),
    ('ai.tool.automations',           'Feature: Automatisierungs-Skills',              'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.automation_runs_monthly', NULL, NULL, 'included', 'Automation-Skill-Runs; Plan-Caps via product_entitlements.')
ON CONFLICT (entitlement_key) DO NOTHING;

-- Plan-Bindings: alle Pläne haben Zugriff auf das Modul (Skill-Gating erfolgt
-- pro Skill über automation_skills.required_plan), Run-Kontingent steigt mit dem Plan.
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('free',              'ai.tool.automations',            1),
    ('free',              'limit.automation_runs_monthly',  5),

    ('bronze',            'ai.tool.automations',            1),
    ('bronze',            'limit.automation_runs_monthly',  20),

    ('silver',            'ai.tool.automations',            1),
    ('silver',            'limit.automation_runs_monthly',  100),

    ('gold',              'ai.tool.automations',            1),
    ('gold',              'limit.automation_runs_monthly',  1000),

    ('enterprise_public', 'ai.tool.automations',            1),
    ('enterprise_public', 'limit.automation_runs_monthly', -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
