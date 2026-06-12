-- Agent Operations Layer (PR1/5) — Scaffold: DB-Schema fuer 4 interne
-- Governance-Agenten (Automation, Support, Call Agent "Susi", Screenshot-Fix).
--
-- Globale Katalog-Tabellen (agent_profiles, workflow_templates):
--   lesbar fuer alle authenticated User, Schreibzugriff nur via service_role
--   (Edge Functions). Keine Tenant-Bindung.
--
-- Tenant-isolierte Tabellen (automation_suggestions, customer_workflows,
-- screenshot_reports, agent_knowledge_base, agent_actions_log):
--   `tenant_id uuid references tenants(id)`, RLS ueber is_tenant_member()
--   gemaess Konvention aus 20260430180000_tenant_rls_and_webhook_events.sql.
--
-- Reine Schema-Migration: keine Agenten-Logik, keine Edge Functions.
-- Additiv, idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. agent_profiles — globaler Katalog der internen Agenten
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    type          TEXT NOT NULL,
    description   TEXT,
    system_prompt TEXT,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_profiles read for authenticated" ON public.agent_profiles;
CREATE POLICY "agent_profiles read for authenticated"
    ON public.agent_profiles FOR SELECT
    TO authenticated
    USING (true);

COMMENT ON TABLE public.agent_profiles IS
    'Globaler Katalog der internen Governance-Agenten (Automation, Support, Susi, Screenshot-Fix). Lesbar fuer authenticated; Schreibzugriff nur via service_role (Edge Functions).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. workflow_templates — globaler Katalog "Wiederkehrende Automatisierungen"
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   TEXT NOT NULL,
    category                TEXT,
    description             TEXT,
    trigger_type            TEXT,
    required_integrations   TEXT[] NOT NULL DEFAULT '{}',
    workflow_schema         JSONB,
    implementation_notes    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_templates read for authenticated" ON public.workflow_templates;
CREATE POLICY "workflow_templates read for authenticated"
    ON public.workflow_templates FOR SELECT
    TO authenticated
    USING (true);

COMMENT ON TABLE public.workflow_templates IS
    'Globaler Katalog wiederkehrender Automatisierungs-Workflows. Lesbar fuer authenticated; Schreibzugriff nur via service_role (Edge Functions).';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. automation_suggestions — tenant-isoliert
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_suggestions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id               UUID,
    agent_id              UUID REFERENCES public.agent_profiles(id),
    title                 TEXT NOT NULL,
    description           TEXT,
    priority              TEXT,
    status                TEXT NOT NULL DEFAULT 'new',
    suggested_workflow_id UUID REFERENCES public.workflow_templates(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_suggestions_tenant ON public.automation_suggestions (tenant_id);

ALTER TABLE public.automation_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members manage automation suggestions" ON public.automation_suggestions;
CREATE POLICY "tenant members manage automation suggestions"
    ON public.automation_suggestions FOR ALL
    USING ((SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.automation_suggestions IS
    'Vom Automation Governance Agent vorgeschlagene Automatisierungen pro Tenant.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. customer_workflows — tenant-isoliert
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_workflows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id  UUID REFERENCES public.workflow_templates(id),
    name         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'inactive',
    config       JSONB,
    last_run_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_workflows_tenant ON public.customer_workflows (tenant_id);

ALTER TABLE public.customer_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members manage customer workflows" ON public.customer_workflows;
CREATE POLICY "tenant members manage customer workflows"
    ON public.customer_workflows FOR ALL
    USING ((SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.customer_workflows IS
    'Pro Tenant aktivierte Automatisierungs-Workflows (aus workflow_templates instanziiert).';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. screenshot_reports — tenant-isoliert
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.screenshot_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id           UUID,
    image_url         TEXT,
    detected_issue    TEXT,
    severity          TEXT,
    suggested_fix     TEXT,
    linked_issue_id   TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screenshot_reports_tenant ON public.screenshot_reports (tenant_id);

ALTER TABLE public.screenshot_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members manage screenshot reports" ON public.screenshot_reports;
CREATE POLICY "tenant members manage screenshot reports"
    ON public.screenshot_reports FOR ALL
    USING ((SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.screenshot_reports IS
    'Vom Screenshot & Issue Fix Agent erfasste Probleme inkl. Vorschlag und verlinktem Issue.';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. agent_knowledge_base — global (tenant_id NULL) + tenant-eigene Eintraege
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_knowledge_base (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID REFERENCES public.agent_profiles(id),
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_type TEXT,
    title       TEXT,
    content     TEXT,
    tags        TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_base_tenant ON public.agent_knowledge_base (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_base_agent ON public.agent_knowledge_base (agent_id);

ALTER TABLE public.agent_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read global or own tenant knowledge" ON public.agent_knowledge_base;
CREATE POLICY "read global or own tenant knowledge"
    ON public.agent_knowledge_base FOR SELECT
    TO authenticated
    USING (
        tenant_id IS NULL
        OR (SELECT public.is_tenant_member(tenant_id))
    );

DROP POLICY IF EXISTS "tenant members write own knowledge" ON public.agent_knowledge_base;
CREATE POLICY "tenant members write own knowledge"
    ON public.agent_knowledge_base FOR INSERT
    WITH CHECK (
        tenant_id IS NOT NULL AND (SELECT public.is_tenant_member(tenant_id))
    );

DROP POLICY IF EXISTS "tenant members update own knowledge" ON public.agent_knowledge_base;
CREATE POLICY "tenant members update own knowledge"
    ON public.agent_knowledge_base FOR UPDATE
    USING (tenant_id IS NOT NULL AND (SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK (tenant_id IS NOT NULL AND (SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS "tenant members delete own knowledge" ON public.agent_knowledge_base;
CREATE POLICY "tenant members delete own knowledge"
    ON public.agent_knowledge_base FOR DELETE
    USING (tenant_id IS NOT NULL AND (SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.agent_knowledge_base IS
    'Wissensbasis pro Agent. tenant_id IS NULL = globales Wissen (lesbar fuer alle); sonst tenant-eigene Eintraege.';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. agent_actions_log — tenant-isoliert (Pruefpfad)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_actions_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID REFERENCES public.agent_profiles(id),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    input       JSONB,
    output      JSONB,
    status      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_log_tenant ON public.agent_actions_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_log_agent ON public.agent_actions_log (agent_id);

ALTER TABLE public.agent_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read agent actions log" ON public.agent_actions_log;
CREATE POLICY "tenant members read agent actions log"
    ON public.agent_actions_log FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

-- Bewusst keine INSERT/UPDATE/DELETE-Policy fuer authenticated:
-- agent_actions_log ist der Pruefpfad und wird ausschliesslich von
-- Edge Functions (service_role) geschrieben.

COMMENT ON TABLE public.agent_actions_log IS
    'Pruefpfad aller Agent-Aktionen pro Tenant. Schreibzugriff ausschliesslich via service_role (Edge Functions).';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Seed: agent_profiles (4 interne Governance-Agenten)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.agent_profiles (name, type, description, system_prompt, enabled)
SELECT v.name, v.type, v.description, v.system_prompt, true
FROM (
    VALUES
    (
        'Automation Governance Agent',
        'automation',
        'Analysiert Tenant-Aktivitaeten und schlaegt passende Automatisierungs-Workflows aus dem Katalog vor.',
        'Du bist der Automation Governance Agent von RealSyncDynamics.AI. Analysiere die Nutzungsmuster eines Tenants und schlage passende Workflows aus workflow_templates vor. Begruende jeden Vorschlag kurz und priorisiere nach Aufwand/Nutzen. (Platzhalter-Prompt, wird in PR2 implementiert.)'
    ),
    (
        'RealSync Support Agent',
        'support',
        'Beantwortet Support-Anfragen von Kunden anhand der Wissensbasis und eskaliert komplexe Faelle an das Team.',
        'Du bist der RealSync Support Agent. Beantworte Anfragen freundlich, praezise und auf Deutsch anhand der agent_knowledge_base. Eskaliere bei Unsicherheit oder rechtlichen Fragen an das Support-Team. (Platzhalter-Prompt, wird in PR3 implementiert.)'
    ),
    (
        'Call Agent Susi',
        'voice_call',
        'Telefonischer Voice-Agent. Bevorzugte Stimme: ElevenLabs "Susi"; bei Nichtverfuegbarkeit automatischer Fallback auf eine deutsche weibliche Stimme via Voice Search API.',
        'Du bist Susi, der telefonische Voice-Agent von RealSyncDynamics.AI. Nutze bevorzugt die ElevenLabs-Stimme "Susi"; ist diese nicht verfuegbar, wird automatisch ueber die Voice Search API eine passende deutsche weibliche Stimme als Fallback gewaehlt. Kommuniziere klar, freundlich und auf Deutsch. (Platzhalter-Prompt, wird in PR4 implementiert.)'
    ),
    (
        'Screenshot & Issue Fix Agent',
        'screenshot_fix',
        'Analysiert von Nutzern eingereichte Screenshots, erkennt UI-/Funktionsprobleme und schlaegt konkrete Fixes inkl. verlinktem Issue vor.',
        'Du bist der Screenshot & Issue Fix Agent. Analysiere eingereichte Screenshots, erkenne UI-Fehler oder Funktionsprobleme, bewerte den Schweregrad und formuliere einen konkreten Loesungsvorschlag inkl. Verknuepfung zu einem Issue-Tracker. (Platzhalter-Prompt, wird in PR5 implementiert.)'
    )
) AS v(name, type, description, system_prompt)
WHERE NOT EXISTS (
    SELECT 1 FROM public.agent_profiles existing WHERE existing.type = v.type
);

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Seed: workflow_templates (10 "Wiederkehrende Automatisierungen")
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflow_templates (title, category, description, trigger_type, required_integrations, workflow_schema, implementation_notes)
SELECT v.title, v.category, v.description, v.trigger_type, v.required_integrations, v.workflow_schema, v.implementation_notes
FROM (
    VALUES
    (
        'Neue Rechnung -> Buchhaltungs-Export',
        'finance',
        'Erstellt bei neuer Rechnung automatisch einen Buchhaltungs-Export und legt ihn im Tax-Evidence-Ordner ab.',
        'event:invoice.created',
        ARRAY['stripe', 'storage']::text[],
        '{"steps": ["fetch_invoice", "generate_export", "store_in_tax_evidence"]}'::jsonb,
        'Platzhalter: nutzt vorhandene TaxEvidenceView-Datenstruktur als Zielformat.'
    ),
    (
        'Onboarding-Checkliste fuer neue Tenants',
        'onboarding',
        'Versendet nach Tenant-Erstellung eine Schritt-fuer-Schritt-Checkliste per E-Mail und legt Onboarding-Tasks an.',
        'event:tenant.created',
        ARRAY['email', 'n8n']::text[],
        '{"steps": ["send_welcome_email", "create_onboarding_tasks"]}'::jsonb,
        'Platzhalter: Trigger an bestehende Tenant-Activation-Tracking-Migration (20260619000000) anbinden.'
    ),
    (
        'Wochenbericht: Compliance-Status',
        'compliance',
        'Erstellt woechentlich einen Compliance-Statusbericht und versendet ihn an die DPO-Rolle.',
        'schedule:weekly',
        ARRAY['email']::text[],
        '{"steps": ["aggregate_compliance_status", "render_report", "send_email"]}'::jsonb,
        'Platzhalter: Datenquelle GovernanceComplianceReportView.'
    ),
    (
        'Cookie-Scan -> Findings-Ticket',
        'compliance',
        'Wandelt neue Cookie-Scan-Findings automatisch in priorisierte Tickets um.',
        'event:scan.completed',
        ARRAY['n8n']::text[],
        '{"steps": ["fetch_new_findings", "prioritize", "create_ticket"]}'::jsonb,
        'Platzhalter: Quelle ScansListView/ScanDetailView Findings.'
    ),
    (
        'DSAR-Antrag -> Fristüberwachung',
        'compliance',
        'Startet bei eingehendem DSAR-Antrag automatisch eine Fristueberwachung mit Erinnerungen.',
        'event:dsr.created',
        ARRAY['email']::text[],
        '{"steps": ["start_deadline_timer", "send_reminders"]}'::jsonb,
        'Platzhalter: Integration mit GovernanceDsrTrackerView.'
    ),
    (
        'Neuer Vendor -> DPA-Check',
        'vendors',
        'Prueft bei neu angelegtem Vendor automatisch, ob ein AVV/DPA vorliegt und erinnert bei Fehlen.',
        'event:vendor.created',
        ARRAY['email']::text[],
        '{"steps": ["check_dpa_present", "notify_if_missing"]}'::jsonb,
        'Platzhalter: Datenquelle GovernanceVendorInventoryView.'
    ),
    (
        'Social-Media-Posting-Plan',
        'marketing',
        'Generiert wiederkehrend Social-Media-Beitragsvorschlaege basierend auf aktuellen Inhalten.',
        'schedule:weekly',
        ARRAY['n8n']::text[],
        '{"steps": ["collect_recent_content", "generate_post_drafts"]}'::jsonb,
        'Platzhalter: Quelle AdminSocialPreviewPage.'
    ),
    (
        'Lagerbestand-Schwellenwert -> Bestell-Hinweis',
        'operations',
        'Sendet einen Hinweis, wenn der Lagerbestand eines Artikels einen definierten Schwellenwert unterschreitet.',
        'event:stock.threshold',
        ARRAY['email']::text[],
        '{"steps": ["check_stock_levels", "notify_below_threshold"]}'::jsonb,
        'Platzhalter: Datenquelle InventoryItemsView/StockMovementsView.'
    ),
    (
        'Kunden-Feedback -> Wissensbasis-Update',
        'support',
        'Extrahiert wiederkehrende Fragen aus Support-Anfragen und schlaegt Ergaenzungen der Wissensbasis vor.',
        'schedule:weekly',
        ARRAY['n8n']::text[],
        '{"steps": ["analyze_support_tickets", "suggest_kb_entries"]}'::jsonb,
        'Platzhalter: Ziel agent_knowledge_base (source_type=support).'
    ),
    (
        'Rechnungs-Mahnwesen',
        'finance',
        'Erkennt ueberfaellige Rechnungen und versendet automatisiert Zahlungserinnerungen in Eskalationsstufen.',
        'schedule:daily',
        ARRAY['stripe', 'email']::text[],
        '{"steps": ["find_overdue_invoices", "send_reminder", "escalate"]}'::jsonb,
        'Platzhalter: Quelle Stripe-Rechnungsstatus.'
    ),
    (
        'Incident -> Status-Page-Update',
        'monitoring',
        'Erstellt bei neuem Incident automatisch einen Eintrag auf der Status-Page und benachrichtigt betroffene Tenants.',
        'event:incident.created',
        ARRAY['email', 'n8n']::text[],
        '{"steps": ["create_status_entry", "notify_affected_tenants"]}'::jsonb,
        'Platzhalter: Integration mit GovernanceIncidentsView und /status.'
    )
) AS v(title, category, description, trigger_type, required_integrations, workflow_schema, implementation_notes)
WHERE NOT EXISTS (
    SELECT 1 FROM public.workflow_templates existing WHERE existing.title = v.title
);
