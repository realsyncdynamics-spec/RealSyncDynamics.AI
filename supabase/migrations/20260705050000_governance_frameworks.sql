-- Compliance Frameworks (DSGVO, AI Act, NIS2, ISO 27001, ISO 42001)
-- Multi-framework support for unified governance OS


-- ─── 1. Compliance Frameworks (DSGVO, AI Act, NIS2, ISO 27001, ISO 42001) ───

CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'gdpr', 'ai_act', 'nis2', 'iso27001', 'iso42001'
  name TEXT NOT NULL, -- "DSGVO", "EU AI Act", "NIS2", "ISO 27001", "ISO 42001"
  description TEXT,
  version TEXT, -- "2024-03-15" or "2024-12"
  authority TEXT, -- "EU Commission", "ISO", "ENISA"
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_frameworks public_read"
  ON public.compliance_frameworks FOR SELECT
  USING (true);

-- ─── 2. Framework Controls (structured requirements) ───

CREATE TABLE IF NOT EXISTS public.framework_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
  control_code TEXT NOT NULL, -- 'GDPR_Art_33', 'ISO_27001_A.5.1', 'AI_ACT_Art_73'
  control_name TEXT NOT NULL,
  description TEXT,
  guidance TEXT, -- Implementation hints
  severity TEXT CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  category TEXT, -- 'data_protection', 'incident_response', 'risk_management', 'documentation'
  parent_control_id UUID REFERENCES public.framework_controls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(framework_id, control_code)
);

-- Add missing columns if they don't exist (in case table was created by earlier migration)
ALTER TABLE public.framework_controls
  ADD COLUMN IF NOT EXISTS framework_id UUID;

ALTER TABLE public.framework_controls
  ADD COLUMN IF NOT EXISTS control_name TEXT;

ALTER TABLE public.framework_controls
  ADD COLUMN IF NOT EXISTS guidance TEXT;

ALTER TABLE public.framework_controls
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical'));

ALTER TABLE public.framework_controls
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.framework_controls
  ADD COLUMN IF NOT EXISTS parent_control_id UUID;

-- Migrate data from old schema (title -> control_name) for existing rows
UPDATE public.framework_controls
SET control_name = title
WHERE control_name IS NULL AND title IS NOT NULL;

-- Drop NOT NULL constraints on old schema columns to allow new records with only framework_id/control_name
-- (We're transitioning from framework TEXT + title TEXT to framework_id UUID + control_name TEXT)
ALTER TABLE public.framework_controls
  ALTER COLUMN framework DROP NOT NULL;

ALTER TABLE public.framework_controls
  ALTER COLUMN title DROP NOT NULL;

ALTER TABLE public.framework_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "framework_controls public_read"
  ON public.framework_controls FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_framework_controls_framework_id
  ON public.framework_controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_controls_code
  ON public.framework_controls(control_code);

-- ─── 3. Framework Implementation Tracking ───

CREATE TABLE IF NOT EXISTS public.framework_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
  control_id UUID NOT NULL REFERENCES public.framework_controls(id) ON DELETE CASCADE,

  status TEXT CHECK (status IN ('not_started', 'planned', 'in_progress', 'implemented', 'optimized', 'accepted_risk')) DEFAULT 'not_started',
  last_verified_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, framework_id, control_id)
);

ALTER TABLE public.framework_implementations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "framework_implementations tenant_read"
  ON public.framework_implementations FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "framework_implementations service_only"
  ON public.framework_implementations FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_framework_implementations_tenant_id
  ON public.framework_implementations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_framework_implementations_framework_id
  ON public.framework_implementations(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_implementations_status
  ON public.framework_implementations(status);

-- ─── 4. Seed Frameworks (Global, no tenant_id) ───

INSERT INTO public.compliance_frameworks (code, name, description, version, authority, website_url)
VALUES
  ('gdpr', 'DSGVO', 'Datenschutz-Grundverordnung (EU) 2016/679', '2024-03-15', 'EU Commission', 'https://gdpr-info.eu'),
  ('ai_act', 'EU AI Act', 'Verordnung (EU) 2024/1689', '2024-12-02', 'EU Commission', 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai'),
  ('nis2', 'NIS2-Richtlinie', 'Richtlinie (EU) 2022/2555', '2024-10-17', 'ENISA', 'https://www.enisa.europa.eu/topics/nis-directive'),
  ('iso27001', 'ISO/IEC 27001', 'Information Security Management System', '2022', 'ISO', 'https://www.iso.org/standard/82875.html'),
  ('iso42001', 'ISO/IEC 42001', 'Artificial Intelligence Management System', '2024', 'ISO', 'https://www.iso.org/standard/81230.html')
ON CONFLICT (code) DO NOTHING;

-- ─── 5. Seed Core Controls (subset — full catalog loaded separately) ───

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'GDPR_Art_5',
  'Datenschutzprinzipien',
  'Rechtmäßigkeit, Fairness, Transparenz, Zweckbindung, Datenminimierung, Speicherbegrenzung, Integrität, Vertraulichkeit',
  'critical',
  'data_protection'
FROM public.compliance_frameworks f WHERE f.code = 'gdpr';

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'GDPR_Art_33',
  'Meldung von Datenschutzverletzungen',
  'Benachrichtigung der Aufsichtsbehörde (innerhalb 72 Stunden) und der betroffenen Person (ohne unangemessene Verzögerung)',
  'critical',
  'incident_response'
FROM public.compliance_frameworks f WHERE f.code = 'gdpr';

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'AI_ACT_Art_5',
  'Verbotene KI-Systeme',
  'Systematische Massenüberwachung, Verzerrung, Bewertung oder Klassifizierung basierend auf geschützten Merkmalen',
  'critical',
  'risk_management'
FROM public.compliance_frameworks f WHERE f.code = 'ai_act';

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'AI_ACT_Art_73',
  'Dokumentation und Aufzeichnungen',
  'Aufbewahrung von Dokumenten zur Gewährleistung der Nachvollziehbarkeit und Rechenschaftspflicht',
  'high',
  'documentation'
FROM public.compliance_frameworks f WHERE f.code = 'ai_act';

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'NIS2_Incident_Report',
  'Incident Reporting Obligations',
  'Meldung kritischer Vorfälle an zuständige Behörde (72 Stunden für Betreiber, 24 Stunden für digitale Services)',
  'critical',
  'incident_response'
FROM public.compliance_frameworks f WHERE f.code = 'nis2';

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'ISO27001_A_5_1',
  'Richtlinien zur Informationssicherheit',
  'Formulierung und Verbreitung von Richtlinien zur Informationssicherheit',
  'high',
  'risk_management'
FROM public.compliance_frameworks f WHERE f.code = 'iso27001';

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, severity, category)
SELECT
  f.id,
  'ISO42001_A_4_1',
  'AI-Management-System etablieren',
  'Definition von Kontext, Beteiligung von Stakeholdern, Dokumentation',
  'high',
  'risk_management'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001';

-- ─── RPC: Calculate compliance score ───

CREATE OR REPLACE FUNCTION public.calculate_compliance_score(p_tenant_id UUID, p_framework_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(
      (
        COUNT(CASE WHEN fi.status IN ('implemented', 'optimized') THEN 1 END)::NUMERIC /
        NULLIF(COUNT(fi.id)::NUMERIC, 0)
      ) * 100
    )::INT,
    0
  ) AS score
  FROM public.framework_implementations fi
  WHERE fi.tenant_id = p_tenant_id
    AND fi.framework_id = p_framework_id;
$$;
