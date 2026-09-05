-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 7/8 — agent_kg_nodes, agent_kg_edges
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D4. Modell: Artifact v0.2, §05 und §06.
--
-- Der Knowledge Graph ist eine NAVIGATIONS- UND RETRIEVAL-SCHICHT, keine
-- Ersatz-Quelle der Wahrheit. Sicherheits- und compliance-relevante Fakten
-- bleiben zusaetzlich in ai_evidence_events hash-verkettet (Modell §05, §09).
-- Wer den Graph als Pruefpfad zitiert, hat die Schicht verwechselt.
--
-- Zeitlich gueltige Kanten (valid_from/valid_to), damit sich der Graph auch
-- historisch befragen laesst: „welche Tickets betrafen diese Komponente in den
-- letzten 90 Tagen".
--
-- OFFEN, aus ADR 0011 Befund B4 uebernommen und hier nicht entschieden:
-- agent_kg_* ueberschneidet sich fachlich mit den vorhandenen
-- agent_knowledge_base und agent_memory (Letztere ist RFC-003-Gegenstand,
-- CLAUDE.md §5). Diese Migration legt den Graph als eigene Schicht an, weil D4
-- ihn nennt; ob er die beiden ersetzt, ergaenzt oder in sie aufgeht, ist ein
-- eigener Entscheid. Solange er leer bleibt, entsteht daraus kein Schaden —
-- aber auch kein Nutzen. Das gehoert geklaert, bevor Schreiber entstehen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_kg_nodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  node_type  text NOT NULL CHECK (node_type IN
               ('component', 'team', 'agent', 'ticket', 'commit', 'customer', 'control', 'incident')),
  ref_id     uuid NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_kg_nodes IS
  'Entitaeten des Knowledge Graph (ADR 0011). Navigationsschicht — die '
  'hash-verkettete Quelle bleibt ai_evidence_events.';
COMMENT ON COLUMN public.agent_kg_nodes.ref_id IS
  'Verweis auf die Ursprungszeile, z.B. agent_tickets.id. Bewusst OHNE '
  'Fremdschluessel: der Knotentyp entscheidet die Zieltabelle, und ein '
  'polymorpher FK ist in Postgres nicht ausdrueckbar. Der schreibende Service '
  'ist fuer die Gueltigkeit zustaendig.';

CREATE TABLE IF NOT EXISTS public.agent_kg_edges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.agent_kg_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.agent_kg_nodes(id) ON DELETE CASCADE,
  relation       text NOT NULL,
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_kg_edges_no_self_loop CHECK (source_node_id <> target_node_id),
  CONSTRAINT agent_kg_edges_valid_range  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

COMMENT ON TABLE public.agent_kg_edges IS
  'Zeitlich gueltige Beziehungen, z.B. belongs_to, fixes, reported, affects, '
  'escalated_to. valid_to IS NULL = aktuell gueltig.';
COMMENT ON COLUMN public.agent_kg_edges.relation IS
  'Frei, absichtlich ohne CHECK: Das Beziehungsvokabular waechst mit dem '
  'Modell und ist — anders als agent_tickets.category — nicht Grundlage einer '
  'Freigabeentscheidung. Kein Gate, also kein Enum.';

CREATE INDEX IF NOT EXISTS agent_kg_nodes_tenant_idx   ON public.agent_kg_nodes (tenant_id);
CREATE INDEX IF NOT EXISTS agent_kg_nodes_ref_idx      ON public.agent_kg_nodes (node_type, ref_id);
CREATE INDEX IF NOT EXISTS agent_kg_edges_tenant_idx   ON public.agent_kg_edges (tenant_id);
CREATE INDEX IF NOT EXISTS agent_kg_edges_source_idx   ON public.agent_kg_edges (source_node_id);
CREATE INDEX IF NOT EXISTS agent_kg_edges_target_idx   ON public.agent_kg_edges (target_node_id);

ALTER TABLE public.agent_kg_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_kg_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_kg_nodes_select ON public.agent_kg_nodes;
CREATE POLICY agent_kg_nodes_select
  ON public.agent_kg_nodes FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

DROP POLICY IF EXISTS agent_kg_edges_select ON public.agent_kg_edges;
CREATE POLICY agent_kg_edges_select
  ON public.agent_kg_edges FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.agent_kg_nodes FROM anon, authenticated;
REVOKE ALL ON public.agent_kg_edges FROM anon, authenticated;
GRANT SELECT ON public.agent_kg_nodes TO authenticated;
GRANT SELECT ON public.agent_kg_edges TO authenticated;

COMMIT;
