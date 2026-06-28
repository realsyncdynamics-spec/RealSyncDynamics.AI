-- Hermes Governance-Brief — Prosa + Provenienz.
--
-- Ergänzt hermes_daily_briefs (Migration 20260527000000) um eine deutsche
-- Narrativ-Spalte (der eigentliche LLM-Mehrwert gegenüber den bereits
-- vorhandenen strukturierten JSONB-Facetten) und eine Provenienz-Spalte.
-- Rein additiv; RLS + Member-Read-Policies existieren bereits für die Tabelle.

ALTER TABLE public.hermes_daily_briefs
  ADD COLUMN IF NOT EXISTS narrative_de TEXT,
  ADD COLUMN IF NOT EXISTS generated_by TEXT;

COMMENT ON COLUMN public.hermes_daily_briefs.narrative_de IS
  'Kurzer deutscher Executive-Tagesbrief (vom Hermes-Agenten via ai-gateway erzeugt).';
COMMENT ON COLUMN public.hermes_daily_briefs.generated_by IS
  'Provenienz des Briefs, z. B. hermes-governance-agent.';
