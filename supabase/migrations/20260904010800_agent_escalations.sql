-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 8/8 — agent_escalations
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D1 und D4. Modell: Artifact v0.2, §03, §06, §09.
--
-- Die Uebergabe zwischen Ebenen, mit strukturierter Begruendung statt
-- Freitext-Chat. Ergaenzt governance_approvals, ersetzt es nicht: Tickets mit
-- Compliance- oder Security-Impact laufen zusaetzlich durch das bestehende
-- Vier-Augen-Prinzip (Modell §09).
--
-- ── Was diese Tabelle NICHT ist ────────────────────────────────────────────
--
-- Sie ist kein Freigabe-Gate. `decision` haelt fest, WAS entschieden wurde —
-- sie entscheidet nicht, was entschieden werden DARF. Die Autonomiegrenze aus
-- D1 prueft die Policy Engine serverseitig, bevor ueberhaupt eine Zeile hier
-- entsteht. Ein Datensatz, der seine eigene Zulaessigkeit begruendet, ist eine
-- Selbstauskunft.
--
-- ── Zwei offene Punkte, ausdruecklich nicht hier entschieden ───────────────
--
-- B3 (ADR 0011): governance_approvals traegt kein Feld fuer severity oder
-- category — also fuer genau die beiden Groessen, an denen D1 die Grenze
-- zieht. Ein abgelehnter Vorschlag landet dort ohne die Begruendung, warum er
-- nicht autonom war. Diese Migration fasst governance_approvals NICHT an: ob
-- D1 dort eine additive Spalte, ein strukturiertes requested_action-Format
-- oder einen eigenen Vorschlags-Datensatz bekommt, ist offen.
--
-- B4 (ADR 0011): public.agent_decisions existiert bereits und liegt inhaltlich
-- nah am Vorschlags-Objekt aus D1. Deshalb legt diese Migration KEIN zweites
-- Vorschlags-Modell an — sie bildet nur die Eskalation selbst ab. Ob D1 in
-- agent_decisions einhakt, gehoert entschieden, bevor ein konkurrierendes
-- Modell entsteht.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_escalations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id           uuid NOT NULL REFERENCES public.agent_tickets(id) ON DELETE CASCADE,
  from_org_unit_id    uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  to_org_unit_id      uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  reason              text NOT NULL,
  decided_by_agent_id uuid NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  decision            text NULL CHECK (decision IS NULL OR decision IN ('approved', 'rejected', 'deferred')),
  resolved_at         timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_escalations_no_self_escalation
    CHECK (from_org_unit_id <> to_org_unit_id),

  -- Entschieden heisst aufgeloest, und aufgeloest heisst entschieden. Sonst
  -- entstehen Eskalationen, die formal offen sind, obwohl jemand geantwortet
  -- hat — oder umgekehrt.
  CONSTRAINT agent_escalations_decision_and_resolution
    CHECK ((decision IS NULL) = (resolved_at IS NULL))
);

COMMENT ON TABLE public.agent_escalations IS
  'Uebergabe eines Tickets zwischen Organisationsebenen (ADR 0011). Haelt fest, '
  'was entschieden wurde — ist selbst kein Freigabe-Gate.';
COMMENT ON COLUMN public.agent_escalations.reason IS
  'Strukturierte Begruendung, kein Freitext-Chat. Teil des Pruefpfads: eine '
  'Eskalation ohne nachvollziehbaren Grund ist fuer ein Produkt mit '
  'EU-AI-Act-Zusage wertlos.';
COMMENT ON COLUMN public.agent_escalations.decision IS
  'approved · rejected · deferred. NULL, solange offen. Dokumentiert die '
  'Entscheidung; die Zulaessigkeit prueft die Policy Engine (D1).';

CREATE INDEX IF NOT EXISTS agent_escalations_tenant_idx ON public.agent_escalations (tenant_id);
CREATE INDEX IF NOT EXISTS agent_escalations_ticket_idx ON public.agent_escalations (ticket_id);
CREATE INDEX IF NOT EXISTS agent_escalations_open_idx   ON public.agent_escalations (to_org_unit_id) WHERE decision IS NULL;

ALTER TABLE public.agent_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_escalations_select ON public.agent_escalations;
CREATE POLICY agent_escalations_select
  ON public.agent_escalations FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.agent_escalations FROM anon, authenticated;
GRANT SELECT ON public.agent_escalations TO authenticated;

COMMIT;
