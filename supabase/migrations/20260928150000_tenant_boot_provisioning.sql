-- Tenant-Boot (Release 1): ein idempotenter Provisioner statt fuenf Oberflaechen.
--
-- Rein additiv. Keine Spalte wird entfernt oder umbenannt, keine Zeile
-- geloescht, kein bestehender Default geaendert.
--
-- 1. tenant_provisioning_runs  — ein beobachtbarer Boot-Status je Tenant
-- 2. policy_rule_templates     — geteilte Regel-Vorlagen je Policy Pack
-- 3. governance_policies       — Herkunft (Pack/Template/Version) + Mode
-- 4. governance_ingest_keys    — Connector-Verifikation (first_event_at)
-- 5. Pack `tdddg-consent`      — TDDDG §25 als Baseline neben DSGVO
--
-- Hintergrund: Bisher wurden Packs nur in policy_pack_activations
-- „aktiviert". governance-ingest wertet aber ausschliesslich
-- governance_policies des Tenants aus — ein frisch onboardeter Tenant hatte
-- damit null wirksame Regeln. Der Boot klont die Templates in den Tenant.

-- ─── 1. Boot-Status ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_provisioning_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger      TEXT NOT NULL CHECK (trigger IN ('self_service','free_audit','checkout','sales','agency_child')),
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','partial','failed')),
  steps        JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempts     INT NOT NULL DEFAULT 1 CHECK (attempts > 0),
  requested_by UUID,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_provisioning_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_provisioning_runs_member_read ON public.tenant_provisioning_runs;
CREATE POLICY tenant_provisioning_runs_member_read
  ON public.tenant_provisioning_runs FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_provisioning_runs_service_all ON public.tenant_provisioning_runs;
CREATE POLICY tenant_provisioning_runs_service_all
  ON public.tenant_provisioning_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.tenant_provisioning_runs FROM anon;
GRANT SELECT ON public.tenant_provisioning_runs TO authenticated;

-- ─── 2. Regel-Vorlagen ─────────────────────────────────────────────────────
-- Vorlagen sind Katalog, keine Policies: sie tragen keinen tenant_id und
-- werden von der Engine nie direkt ausgewertet.

CREATE TABLE IF NOT EXISTS public.policy_rule_templates (
  id             TEXT PRIMARY KEY,
  pack_id        TEXT NOT NULL REFERENCES public.policy_pack_catalog(id) ON DELETE CASCADE,
  version        INT NOT NULL DEFAULT 1 CHECK (version > 0),
  name           TEXT NOT NULL,
  description    TEXT,
  framework      TEXT,
  control_code   TEXT,
  policy_type    TEXT NOT NULL CHECK (policy_type IN (
    'data_transfer','model_usage','human_review','logging_required',
    'vendor_restriction','retention','security','ai_act','gdpr')),
  severity       TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  enforce_action TEXT NOT NULL CHECK (enforce_action IN ('allow','log','warn','block','require_approval')),
  -- Leere Bedingung matcht in der Engine jedes Event — fuer Vorlagen verboten.
  condition      JSONB NOT NULL CHECK (jsonb_typeof(condition) = 'object' AND condition <> '{}'::jsonb),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_rule_templates_pack ON public.policy_rule_templates(pack_id);

ALTER TABLE public.policy_rule_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_rule_templates_read ON public.policy_rule_templates;
CREATE POLICY policy_rule_templates_read
  ON public.policy_rule_templates FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS policy_rule_templates_service_all ON public.policy_rule_templates;
CREATE POLICY policy_rule_templates_service_all
  ON public.policy_rule_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.policy_rule_templates FROM anon;
GRANT SELECT ON public.policy_rule_templates TO authenticated;

-- ─── 3. Herkunft + Mode auf Tenant-Policies ───────────────────────────────

ALTER TABLE public.governance_policies
  ADD COLUMN IF NOT EXISTS source_pack_id     TEXT,
  ADD COLUMN IF NOT EXISTS source_template_id TEXT,
  ADD COLUMN IF NOT EXISTS template_version   INT,
  ADD COLUMN IF NOT EXISTS enforce_action     TEXT,
  ADD COLUMN IF NOT EXISTS mode               TEXT NOT NULL DEFAULT 'enforce';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_policies_mode_check') THEN
    ALTER TABLE public.governance_policies
      ADD CONSTRAINT governance_policies_mode_check CHECK (mode IN ('observe','enforce'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_policies_enforce_action_check') THEN
    ALTER TABLE public.governance_policies
      ADD CONSTRAINT governance_policies_enforce_action_check
      CHECK (enforce_action IS NULL OR enforce_action IN ('allow','log','warn','block','require_approval'));
  END IF;
END $$;

-- Idempotenter Klon: ein Template landet hoechstens einmal je Tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_policies_tenant_template
  ON public.governance_policies(tenant_id, source_template_id)
  WHERE source_template_id IS NOT NULL;

-- ─── 4. Connector-Verifikation ─────────────────────────────────────────────

ALTER TABLE public.governance_ingest_keys
  ADD COLUMN IF NOT EXISTS connector_kind TEXT,
  ADD COLUMN IF NOT EXISTS first_event_at TIMESTAMPTZ;

-- Genau ein aktiver Boot-Key je Tenant (parallele Boot-Laeufe).
CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_ingest_keys_boot_active
  ON public.governance_ingest_keys(tenant_id)
  WHERE connector_kind = 'boot' AND revoked_at IS NULL;

-- ─── 5. TDDDG-Pack + Vorlagen ──────────────────────────────────────────────

INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
  ('TDDDG', '§25', 'Schutz der Privatsphäre bei Endeinrichtungen',
   'Speichern/Auslesen auf Endgeraeten nur mit Einwilligung, ausser technisch unbedingt erforderlich.')
ON CONFLICT (framework, control_code) DO NOTHING;

INSERT INTO public.policy_pack_catalog (id, name, description, industry, frameworks) VALUES
  ('tdddg-consent', 'TDDDG Consent', 'Tracker, Cookies und Einwilligung nach TDDDG §25.', 'all', ARRAY['TDDDG'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
  ('tdddg-consent', 'TDDDG', '§25')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

INSERT INTO public.policy_rule_templates
  (id, pack_id, version, name, description, framework, control_code, policy_type, severity, enforce_action, condition)
VALUES
  ('dsgvo.logging-baseline', 'dsgvo-essentials', 1,
   'Protokollierung aller Sensor-Events',
   'Jedes Event aus einem Sensor wird mit Policy-Snapshot protokolliert (Verzeichnis, Nachweis).',
   'GDPR', 'Art.30', 'logging_required', 'info', 'log',
   '{"event_source":["website_scanner","browser_extension","sdk","api","github","ci_cd","agent_runtime"]}'),
  ('dsgvo.personal-data-transfer', 'dsgvo-essentials', 1,
   'Personenbezogene Daten an Dritte/KI-Anbieter',
   'Uebermittlung personenbezogener Daten braucht eine Rechtsgrundlage und Freigabe.',
   'GDPR', 'Art.6', 'data_transfer', 'high', 'require_approval',
   '{"data_types":["personal_data","customer_data","employee_data"]}'),
  ('dsgvo.special-category', 'dsgvo-essentials', 1,
   'Besondere Kategorien personenbezogener Daten',
   'Gesundheits-, biometrische und andere Art.-9-Daten nur nach DSFA.',
   'GDPR', 'Art.35', 'gdpr', 'critical', 'block',
   '{"data_types":["health_data","biometric_data","special_category"]}'),
  ('tdddg.tracker-before-consent', 'tdddg-consent', 1,
   'Tracker/Cookie vor Einwilligung',
   'Nicht notwendige Speicherung/Zugriffe vor Einwilligung.',
   'TDDDG', '§25', 'gdpr', 'high', 'block',
   '{"event_type":["tracker.detected","cookie.set_before_consent"]}'),
  ('tdddg.consent-missing', 'tdddg-consent', 1,
   'Einwilligungsbanner fehlt',
   'Kein Consent-Mechanismus bei vorhandenen nicht notwendigen Diensten.',
   'TDDDG', '§25', 'gdpr', 'medium', 'warn',
   '{"event_type":["consent.missing"]}'),
  ('aiact.high-risk-human-oversight', 'eu-ai-act-high-risk', 1,
   'Hochrisiko-KI: menschliche Aufsicht',
   'Events an Hochrisiko-Systemen brauchen eine menschliche Freigabe.',
   'EU_AI_ACT', 'Art.14', 'ai_act', 'high', 'require_approval',
   '{"ai_act_class":"high"}'),
  ('aiact.prohibited-practice', 'eu-ai-act-high-risk', 1,
   'Verbotene KI-Praktik',
   'Systeme mit Klassifizierung prohibited duerfen nicht betrieben werden.',
   'EU_AI_ACT', 'Art.9', 'ai_act', 'critical', 'block',
   '{"ai_act_class":"prohibited"}'),
  ('aiact.agent-logging', 'eu-ai-act-high-risk', 1,
   'Protokollierung von Agent-Laeufen',
   'Automatische Aufzeichnung von Agent-Aktionen.',
   'EU_AI_ACT', 'Art.12', 'logging_required', 'info', 'log',
   '{"event_source":"agent_runtime"}'),
  ('iso.secret-exposure', 'iso-27001-foundation', 1,
   'Offengelegte Zugangsdaten',
   'Secrets in Repos, Logs oder Prompts.',
   'ISO_27001', 'A.8', 'security', 'critical', 'block',
   '{"event_type":["secret.exposed","credential.leak"]}'),
  ('nis2.security-incident', 'nis2-cybersecurity', 1,
   'Sicherheitsvorfall mit Meldepflicht',
   '24h-Fruehwarnung / 72h-Meldung vorbereiten.',
   'NIS2', 'Art.23', 'security', 'high', 'require_approval',
   '{"event_type":["security.incident"]}')
ON CONFLICT (id) DO NOTHING;
