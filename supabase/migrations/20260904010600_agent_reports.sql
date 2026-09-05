-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 6/8 — agent_reports
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D3 (taeglicher Snapshot, KEINE Versionskette) und D4
-- (visibility). Modell: Artifact v0.2, §04 und §06.
--
-- ── Snapshot, kein Event Store ─────────────────────────────────────────────
--
-- agent_reports haelt EINEN komprimierten Zustands-Snapshot pro Tag und Ebene,
-- maximal zehn Punkte. Kein Event-per-Change. Der Entwurf v0.1 sah hier
-- version/supersedes vor; D3 hat das verworfen, weil die Semantik sonst
-- verschwimmt:
--
--     ai_tool_runs   = technische Ausfuehrung
--     agent_tickets  = operative Arbeit
--     agent_kg_*     = Wissens-/Zustandsmodell
--     agent_reports  = Governance-Snapshot
--
-- Aenderungen innerhalb eines Tages bleiben ueber agent_tickets, agent_kg_*
-- und ai_tool_runs nachvollziehbar. Der Report ERSETZT DEN PRUEFPFAD NICHT
-- und darf nicht als solcher zitiert werden — die hash-verkettete Quelle
-- bleibt ai_evidence_events (CLAUDE.md §3).
--
-- ── NULLS NOT DISTINCT, und warum das hier zaehlt ──────────────────────────
--
-- Die Eindeutigkeit pro (Scope, Tag) muss auch fuer den Platform Scope gelten,
-- und dort ist tenant_id NULL. Ohne NULLS NOT DISTINCT behandelt Postgres
-- jedes NULL als verschieden — die Regel „ein Snapshot pro Tag" waere genau
-- dort wirkungslos, wo Browser Agent X07 taeglich schreibt. Verfuegbar ab
-- PG15; lokal laeuft PG15 (supabase/config.toml), in Produktion PG17.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id      uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  org_unit_id   uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  period        text NOT NULL CHECK (period IN ('daily', 'weekly')),
  report_day    date NOT NULL,
  bullet_points text[] NOT NULL DEFAULT '{}',
  rollup_of     uuid[] NOT NULL DEFAULT '{}',
  visibility    text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'tenant_shared')),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Die Kompressionsregel aus §04, in der Datenbank statt nur im Prozess.
  -- coalesce, weil array_length auf dem leeren Array NULL liefert und
  -- NULL <= 10 zu NULL auswertet — der CHECK wuerde stillschweigend passieren.
  CONSTRAINT agent_reports_max_ten_bullets
    CHECK (coalesce(array_length(bullet_points, 1), 0) <= 10),

  CONSTRAINT agent_reports_shared_needs_tenant
    CHECK (NOT (tenant_id IS NULL AND visibility = 'tenant_shared'))
);

-- D3: Eindeutigkeit pro (Scope, Tag) statt Append-Historie.
CREATE UNIQUE INDEX IF NOT EXISTS agent_reports_scope_day_uidx
  ON public.agent_reports (org_unit_id, tenant_id, period, report_day) NULLS NOT DISTINCT;

COMMENT ON TABLE public.agent_reports IS
  'Ein komprimierter Governance-Snapshot pro Tag und Ebene, max. 10 Punkte '
  '(ADR 0011 D3). Zustandsbild, kein Event Store — ersetzt den Pruefpfad nicht.';
COMMENT ON COLUMN public.agent_reports.report_day IS
  'Tag des Snapshots. Zusammen mit org_unit_id, tenant_id und period eindeutig '
  '(agent_reports_scope_day_uidx). Ein zweiter Schreibvorgang am selben Tag '
  'aktualisiert, er haengt nicht an.';
COMMENT ON COLUMN public.agent_reports.rollup_of IS
  'Report-IDs, die dieser Bericht zusammenfasst. Jede Pfeilspitze nach oben ist '
  'eine Kompressionsstufe, keine Weiterleitung (Modell §04).';

CREATE INDEX IF NOT EXISTS agent_reports_tenant_idx   ON public.agent_reports (tenant_id);
CREATE INDEX IF NOT EXISTS agent_reports_org_unit_idx ON public.agent_reports (org_unit_id);
CREATE INDEX IF NOT EXISTS agent_reports_agent_idx    ON public.agent_reports (agent_id);

ALTER TABLE public.agent_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_reports_select ON public.agent_reports;
CREATE POLICY agent_reports_select
  ON public.agent_reports FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND visibility = 'tenant_shared')
  );

REVOKE ALL ON public.agent_reports FROM anon, authenticated;
GRANT SELECT ON public.agent_reports TO authenticated;

COMMIT;
