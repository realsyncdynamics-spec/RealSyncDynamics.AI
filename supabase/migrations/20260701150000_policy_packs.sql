-- Policy Packs — aktivierbare, vorkonfigurierte Compliance-Regelwerke.
--
-- Setzt auf framework_controls / asset_control_mappings auf und ergänzt:
--   policy_pack_catalog       globaler Katalog aktivierbarer Packs
--   policy_pack_controls      welche Controls gehören zu welchem Pack
--   policy_pack_activations   welcher Tenant hat welchen Pack aktiviert
--
-- Aktivierung = der Tenant übernimmt den kuratierten Control-Satz (die Controls
-- liegen global in framework_controls; die Aktivierung steuert Sichtbarkeit/
-- Abdeckungs-Analyse). Kuratierte Foundational-Sets pro Framework — keine
-- vollständigen 150+-Kataloge (Folge-Erweiterung).

-- ─── 0. TISAX zur framework_controls-Whitelist ergänzen (additiv) ────────────
ALTER TABLE public.framework_controls DROP CONSTRAINT IF EXISTS framework_controls_framework_check;
ALTER TABLE public.framework_controls ADD CONSTRAINT framework_controls_framework_check
    CHECK (framework IN ('GDPR','TDDDG','EU_AI_ACT','ISO_27001','SOC_2','NIS2','DORA','TISAX','CUSTOM'));

-- ─── 1. Kuratierte Controls seeden (idempotent) ──────────────────────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('GDPR','Art.5','Grundsätze der Verarbeitung','Rechtmäßigkeit, Zweckbindung, Datenminimierung, Richtigkeit, Speicherbegrenzung, Integrität.'),
    ('GDPR','Art.6','Rechtmäßigkeit der Verarbeitung','Gültige Rechtsgrundlage für jede Verarbeitung.'),
    ('GDPR','Art.30','Verzeichnis von Verarbeitungstätigkeiten','VVT geführt und aktuell.'),
    ('GDPR','Art.32','Sicherheit der Verarbeitung','TOMs angemessen zum Risiko.'),
    ('GDPR','Art.33','Meldung von Datenschutzverletzungen','72-Stunden-Meldeprozess etabliert.'),
    ('GDPR','Art.35','Datenschutz-Folgenabschätzung','DSFA bei hohem Risiko durchgeführt.'),
    ('EU_AI_ACT','Art.9','Risikomanagementsystem','Fortlaufendes Risikomanagement über den Lebenszyklus.'),
    ('EU_AI_ACT','Art.10','Daten und Daten-Governance','Trainings-/Validierungsdaten qualitätsgesichert.'),
    ('EU_AI_ACT','Art.12','Aufzeichnungspflichten','Automatische Protokollierung (Logging).'),
    ('EU_AI_ACT','Art.13','Transparenz und Bereitstellung von Informationen','Nutzer angemessen informiert.'),
    ('EU_AI_ACT','Art.14','Menschliche Aufsicht','Wirksame menschliche Aufsicht möglich.'),
    ('EU_AI_ACT','Art.15','Genauigkeit, Robustheit, Cybersicherheit','Angemessene Genauigkeit und Widerstandsfähigkeit.'),
    ('NIS2','Art.20','Governance','Leitungsorgane verantworten und überwachen Cybersicherheit.'),
    ('NIS2','Art.21','Risikomanagementmaßnahmen','10-Punkte-Maßnahmenkatalog umgesetzt.'),
    ('NIS2','Art.23','Berichterstattungspflichten','24h-Frühwarnung, 72h-Meldung, Abschlussbericht.'),
    ('DORA','Art.5','IKT-Risikomanagementrahmen','Dokumentierter IKT-Risikomanagementrahmen.'),
    ('DORA','Art.17','Management von IKT-Vorfällen','Prozess zur Erkennung/Behandlung von IKT-Vorfällen.'),
    ('DORA','Art.24','Testen der digitalen Resilienz','Regelmäßige Resilienztests.'),
    ('DORA','Art.28','Management des Drittparteienrisikos','Steuerung von IKT-Drittdienstleistern.'),
    ('ISO_27001','A.5','Organisatorische Controls','Richtlinien, Rollen, Verantwortlichkeiten (Annex A 2022).'),
    ('ISO_27001','A.6','Personenbezogene Controls','Screening, Awareness, Verantwortlichkeiten.'),
    ('ISO_27001','A.7','Physische Controls','Physische Sicherheit und Umgebung.'),
    ('ISO_27001','A.8','Technologische Controls','Zugriff, Kryptographie, Betrieb, Netzsicherheit.'),
    ('TISAX','ISA-1','Informationssicherheit (IS-Management)','ISMS nach VDA ISA etabliert.'),
    ('TISAX','ISA-5','Prototypenschutz','Schutz von Prototypen und Erlkönigen.'),
    ('TISAX','ISA-6','Datenschutz','Datenschutz nach VDA ISA (Anlehnung DSGVO).')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── 2. Katalog + Pack-Controls ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_pack_catalog (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    industry    TEXT NOT NULL DEFAULT 'all',
    frameworks  TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.policy_pack_controls (
    pack_id      TEXT NOT NULL REFERENCES public.policy_pack_catalog(id) ON DELETE CASCADE,
    framework    TEXT NOT NULL,
    control_code TEXT NOT NULL,
    PRIMARY KEY (pack_id, framework, control_code)
);

INSERT INTO public.policy_pack_catalog (id, name, description, industry, frameworks) VALUES
    ('dsgvo-essentials',     'DSGVO Essentials',          'Grundlegende DSGVO-Kontrollen für jede Organisation.', 'all',                    ARRAY['GDPR']),
    ('eu-ai-act-high-risk',  'EU AI Act – High-Risk',     'Pflichten für Hochrisiko-KI-Systeme (Art. 9–15).',     'ai',                     ARRAY['EU_AI_ACT']),
    ('nis2-cybersecurity',   'NIS2 Cybersicherheit',      'Governance, Maßnahmen und Meldepflichten nach NIS2.',  'critical-infrastructure',ARRAY['NIS2']),
    ('dora-financial',       'DORA – Digitale Resilienz', 'IKT-Risikomanagement und Resilienz für den Finanzsektor.','fintech',             ARRAY['DORA']),
    ('iso-27001-foundation', 'ISO 27001 Foundation',      'Annex-A-Themen (2022) als Einstiegs-Kontrollsatz.',    'all',                    ARRAY['ISO_27001']),
    ('tisax-automotive',     'TISAX Automotive',          'VDA-ISA-Module: IS-Management, Prototypenschutz, Datenschutz.','automotive',      ARRAY['TISAX']),
    ('fintech-compliance',   'FinTech Compliance',        'Kombiniertes Pack: DSGVO + NIS2 + DORA für FinTechs.', 'fintech',                ARRAY['GDPR','NIS2','DORA'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('dsgvo-essentials','GDPR','Art.5'),('dsgvo-essentials','GDPR','Art.6'),('dsgvo-essentials','GDPR','Art.30'),
    ('dsgvo-essentials','GDPR','Art.32'),('dsgvo-essentials','GDPR','Art.33'),('dsgvo-essentials','GDPR','Art.35'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.9'),('eu-ai-act-high-risk','EU_AI_ACT','Art.10'),('eu-ai-act-high-risk','EU_AI_ACT','Art.12'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.13'),('eu-ai-act-high-risk','EU_AI_ACT','Art.14'),('eu-ai-act-high-risk','EU_AI_ACT','Art.15'),
    ('nis2-cybersecurity','NIS2','Art.20'),('nis2-cybersecurity','NIS2','Art.21'),('nis2-cybersecurity','NIS2','Art.23'),
    ('dora-financial','DORA','Art.5'),('dora-financial','DORA','Art.17'),('dora-financial','DORA','Art.24'),('dora-financial','DORA','Art.28'),
    ('iso-27001-foundation','ISO_27001','A.5'),('iso-27001-foundation','ISO_27001','A.6'),('iso-27001-foundation','ISO_27001','A.7'),('iso-27001-foundation','ISO_27001','A.8'),
    ('tisax-automotive','TISAX','ISA-1'),('tisax-automotive','TISAX','ISA-5'),('tisax-automotive','TISAX','ISA-6'),
    ('fintech-compliance','GDPR','Art.5'),('fintech-compliance','GDPR','Art.32'),('fintech-compliance','NIS2','Art.21'),
    ('fintech-compliance','DORA','Art.5'),('fintech-compliance','DORA','Art.17'),('fintech-compliance','DORA','Art.28')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- ─── 3. Aktivierungen pro Tenant ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_pack_activations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    pack_id      TEXT NOT NULL REFERENCES public.policy_pack_catalog(id),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    UNIQUE (tenant_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_activations_tenant ON public.policy_pack_activations(tenant_id);

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.policy_pack_catalog     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_pack_controls    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_pack_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pack_catalog read-all" ON public.policy_pack_catalog;
CREATE POLICY "pack_catalog read-all" ON public.policy_pack_catalog FOR SELECT USING (true);

DROP POLICY IF EXISTS "pack_controls read-all" ON public.policy_pack_controls;
CREATE POLICY "pack_controls read-all" ON public.policy_pack_controls FOR SELECT USING (true);

DROP POLICY IF EXISTS "pack_activations tenant-select" ON public.policy_pack_activations;
CREATE POLICY "pack_activations tenant-select" ON public.policy_pack_activations
    FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.policy_pack_catalog IS
    'Globaler Katalog aktivierbarer Policy Packs (vorkonfigurierte Compliance-Regelwerke). Schreiben nur über Edge-Function policy-packs (service_role).';

-- ─── 5. Entitlement: policy.packs ab Agency ──────────────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('policy.packs', 'Policy Packs: aktivierbare Compliance-Regelwerke (DSGVO, AI Act, NIS2, DORA, ISO 27001, TISAX)', 'boolean')
ON CONFLICT (key) DO NOTHING;

WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('agency',     'policy.packs', 1),
    ('scale',      'policy.packs', 1),
    ('enterprise', 'policy.packs', 1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
