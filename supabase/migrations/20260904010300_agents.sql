-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 3/8 — agents
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D4. Modell: Artifact v0.2, §00 und §06.
--
-- Die Faehigkeit: welche konkrete KI-Instanz eine Rolle heute ausfuellt.
-- Getrennt von agent_roles, damit die Besetzung wechseln kann, ohne das
-- Organigramm anzufassen — und damit Kosten, Latenz und Modellwahl pro Rolle
-- unabhaengig steuerbar bleiben.
--
-- Der Name public.agents war frei: gemessen 2026-09-01 gegen das Live-Projekt
-- existierte keine solche Tabelle (ADR 0011, Messung und Befund B5). Die
-- Migration 20260705180000 legt heute autonomous_* an, nicht agents.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_id           uuid NOT NULL REFERENCES public.agent_roles(id) ON DELETE RESTRICT,
  agent_key         text NOT NULL,
  capability_type   text NOT NULL CHECK (capability_type IN ('llm', 'agent', 'multi_agent', 'tool_runner')),
  model             text,
  specialization    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
  last_heartbeat_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_scope_key_uidx
  ON public.agents (tenant_id, agent_key) NULLS NOT DISTINCT;

COMMENT ON TABLE public.agents IS
  'Konkrete KI-Instanz, die eine Rolle besetzt (ADR 0011). Austauschbar, ohne '
  'das Organigramm zu aendern.';
COMMENT ON COLUMN public.agents.capability_type IS
  'llm · agent · multi_agent · tool_runner. Beschreibt, WIE die Rolle Aufgaben '
  'loest — nicht, was sie entscheiden darf.';
COMMENT ON COLUMN public.agents.model IS
  'z.B. claude-sonnet-5 oder gemma3:4b (Ollama, EU-lokal). Frei, weil die '
  'Modellwahl pro Rolle wechselt; die Abrechnung laeuft ueber ai_tool_runs.';
COMMENT ON COLUMN public.agents.last_heartbeat_at IS
  'Liveness fuer das Monitoring. NULL = seit dem Anlegen nie gelaufen. Ein '
  'registrierter Agent ist noch kein laufender — dieselbe Lehre wie beim '
  'pg_cron-Job memory-decay-hourly (CLAUDE.md §5): an cron.job_run_details '
  'pruefen, nicht an der Registrierung.';
COMMENT ON COLUMN public.agents.role_id IS
  'ON DELETE RESTRICT: Eine Rolle, die noch besetzt ist, darf nicht '
  'verschwinden — sonst haette der Prüfpfad einen Agenten ohne Berichtslinie.';

CREATE INDEX IF NOT EXISTS agents_role_idx   ON public.agents (role_id);
CREATE INDEX IF NOT EXISTS agents_tenant_idx ON public.agents (tenant_id);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agents_select ON public.agents;
CREATE POLICY agents_select
  ON public.agents FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.agents FROM anon, authenticated;
GRANT SELECT ON public.agents TO authenticated;

COMMIT;
