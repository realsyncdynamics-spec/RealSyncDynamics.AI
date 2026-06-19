-- Strukturierte Annex-III- / Art.-11-Felder auf governance_assets.
--
-- governance_assets ist das festgelegte System-of-Record für das KI-System-
-- Inventar (treibt /app/ai-systems). Der AI Act verlangt für Hochrisiko-
-- Systeme strukturierte Kontextangaben statt Freitext: Annex-III-Kategorie,
-- Rolle im Wirtschaftskreislauf (Provider/Importer/Distributor/Deployer),
-- Zweckbestimmung, Einsatzkontext und betroffene Personengruppen.
--
-- Additiv und default-sicher: alle Spalten nullable, bestehende Zeilen bleiben
-- gültig. CHECK-Constraints lassen NULL zu (Constraint ist bei NULL erfüllt).

ALTER TABLE public.governance_assets
  ADD COLUMN IF NOT EXISTS annex_iii_category TEXT
    CHECK (annex_iii_category IS NULL OR annex_iii_category IN (
      'biometrics',
      'critical_infrastructure',
      'education',
      'employment',
      'essential_services',
      'law_enforcement',
      'migration',
      'justice_democracy'
    )),
  ADD COLUMN IF NOT EXISTS provider_role TEXT
    CHECK (provider_role IS NULL OR provider_role IN (
      'provider',
      'importer',
      'distributor',
      'deployer',
      'authorized_representative'
    )),
  ADD COLUMN IF NOT EXISTS intended_purpose TEXT,
  ADD COLUMN IF NOT EXISTS deployment_context TEXT,
  ADD COLUMN IF NOT EXISTS affected_groups TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_governance_assets_annex_iii
  ON public.governance_assets(tenant_id, annex_iii_category)
  WHERE annex_iii_category IS NOT NULL;

COMMENT ON COLUMN public.governance_assets.annex_iii_category IS
  'EU-AI-Act Annex-III-Hochrisiko-Kategorie (synchron zu src/rules/annex-iii.json).';
COMMENT ON COLUMN public.governance_assets.provider_role IS
  'Rolle des Tenants für dieses System im AI-Act-Sinn (Art. 3): provider/importer/distributor/deployer/authorized_representative.';
COMMENT ON COLUMN public.governance_assets.intended_purpose IS
  'Zweckbestimmung (intended purpose, Art. 3 Nr. 12) — Grundlage der Risikoklassifizierung.';
COMMENT ON COLUMN public.governance_assets.deployment_context IS
  'Einsatzkontext/Domäne, in der das System betrieben wird.';
COMMENT ON COLUMN public.governance_assets.affected_groups IS
  'Von Entscheidungen des Systems betroffene Personengruppen.';
