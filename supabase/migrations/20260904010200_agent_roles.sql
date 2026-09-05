-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 2/8 — agent_roles
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D1 (decision_scope ist KEIN Gate) und D4.
-- Modell: Artifact „Organisationsmodell …" v0.2, §00 und §06.
--
-- Rolle ist nicht Faehigkeit. Eine Rolle beschreibt Verantwortung,
-- Berichtslinie und Zustaendigkeit — unabhaengig davon, welches Modell sie
-- heute ausfuellt. Die Besetzung steht in `agents` (naechste Migration).
--
-- WICHTIG ZU decision_scope: Das Feld dokumentiert den Zustaendigkeitsbereich
-- der Rolle. Es ist ausdruecklich KEIN Gate. Die Autonomiegrenze aus D1
--     severity ∈ {info, warn} AND category ∉ {compliance, security}
-- ist eine serverseitige Pruefung der Policy Engine, kein Feld auf der Rollen-
-- oder Agenten-Zeile (ADR 0011, „Was die Entscheidungen binden", Punkt 3).
-- Ein Agent, der seine eigene Autonomiegrenze auswertet, ist kein Gate — er
-- ist eine Selbstauskunft. Wer hier ein Recht ableitet, hat das Modell gebrochen.
--
-- tenant_id: Rollen sind Teil des Organigramms und erben dessen Geltungsbereich.
-- Die Spalte steht denormalisiert an jeder Tabelle dieser Ebene, damit die
-- RLS-Policy ohne Join auskommt. Joins in Policies sind in diesem Repo schon
-- einmal teuer geworden (20260723000001, RLS-Rekursion auf memberships).
-- Preis der Denormalisierung: Der schreibende Service muss tenant_id konsistent
-- zur org_unit halten. Das ist bewusst so entschieden, nicht uebersehen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_roles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key                text NOT NULL,
  title              text NOT NULL,
  org_unit_id        uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  authority_level    int  NOT NULL CHECK (authority_level BETWEEN 0 AND 4),
  decision_scope     text[] NOT NULL DEFAULT '{}',
  escalation_role_id uuid NULL REFERENCES public.agent_roles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- key ist je Geltungsbereich eindeutig, nicht global: Ein Kunde darf eine
-- Rolle `team_lead` haben, ohne mit der plattforminternen zu kollidieren.
-- NULLS NOT DISTINCT, damit der Platform Scope (tenant_id IS NULL) ebenfalls
-- genau einen `team_lead` hat statt beliebig vieler.
CREATE UNIQUE INDEX IF NOT EXISTS agent_roles_scope_key_uidx
  ON public.agent_roles (tenant_id, key) NULLS NOT DISTINCT;

COMMENT ON TABLE public.agent_roles IS
  'Rollen der Agenten-Ebene: Verantwortung und Berichtslinie, unabhaengig von '
  'der Besetzung (ADR 0011).';
COMMENT ON COLUMN public.agent_roles.authority_level IS
  '0=CEO … 4=Ausfuehrungs-Agent. Ordnet die Berichtslinie. Leitet KEIN '
  'Deploy-Recht ab — das entscheidet die Policy Engine (D1).';
COMMENT ON COLUMN public.agent_roles.decision_scope IS
  'Dokumentiert den Zustaendigkeitsbereich der Rolle, z.B. {ui_bug, performance}. '
  'AUSDRUECKLICH KEIN GATE: Die Autonomiegrenze aus ADR 0011 D1 prueft die '
  'Policy Engine serverseitig. Dieses Feld darf nie Grundlage einer '
  'Freigabeentscheidung sein.';

CREATE INDEX IF NOT EXISTS agent_roles_org_unit_idx ON public.agent_roles (org_unit_id);
CREATE INDEX IF NOT EXISTS agent_roles_tenant_idx   ON public.agent_roles (tenant_id);

ALTER TABLE public.agent_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_roles_select ON public.agent_roles;
CREATE POLICY agent_roles_select
  ON public.agent_roles FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.agent_roles FROM anon, authenticated;
GRANT SELECT ON public.agent_roles TO authenticated;

COMMIT;
