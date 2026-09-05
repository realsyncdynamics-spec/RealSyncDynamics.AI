-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 4/8 — agent_teams, agent_team_members
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D4. Modell: Artifact v0.2, §01 und §06.
--
-- Ein Team ist eine org_unit vom Typ 'team' plus genau ein Teamleiter und
-- beliebig viele Fach-Agenten. Die n:m-Zuordnung steht in agent_team_members.
--
-- Beide Tabellen kommen in EINER Migration, weil agent_team_members ohne
-- agent_teams keinen Zustand hat, den man sinnvoll absichern koennte. Die
-- D4-Regel, auf die es ankommt, ist eingehalten: Tabelle, RLS, Policy und
-- Grants stehen zusammen — nicht „RLS in einer Folgemigration".

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id   uuid NOT NULL UNIQUE REFERENCES public.org_units(id) ON DELETE CASCADE,
  lead_agent_id uuid NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_teams IS
  'Team als Gruppierung von Agenten unter einem Lead (ADR 0011).';
COMMENT ON COLUMN public.agent_teams.org_unit_id IS
  'UNIQUE: genau ein Team je org_unit. Die org_unit muss unit_type = ''team'' '
  'tragen — das prueft der schreibende Service, nicht die Datenbank: ein '
  'CHECK ueber eine Fremdtabelle ist in Postgres nicht ausdrueckbar, und ein '
  'Trigger dafuer waere mehr Maschinerie als Nutzen. Bewusst so, nicht vergessen.';
COMMENT ON COLUMN public.agent_teams.lead_agent_id IS
  'Teamleiter-Instanz. ON DELETE SET NULL: ein Team ohne Lead ist ein '
  'sichtbarer Missstand, ein geloeschtes Team waere ein stiller.';

CREATE TABLE IF NOT EXISTS public.agent_team_members (
  team_id   uuid NOT NULL REFERENCES public.agent_teams(id) ON DELETE CASCADE,
  agent_id  uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, agent_id)
);

COMMENT ON TABLE public.agent_team_members IS
  'n:m-Zuordnung Agent ↔ Team. tenant_id denormalisiert, damit die RLS-Policy '
  'ohne Join auskommt (siehe agent_roles).';

CREATE INDEX IF NOT EXISTS agent_teams_tenant_idx         ON public.agent_teams (tenant_id);
CREATE INDEX IF NOT EXISTS agent_team_members_agent_idx   ON public.agent_team_members (agent_id);
CREATE INDEX IF NOT EXISTS agent_team_members_tenant_idx  ON public.agent_team_members (tenant_id);

ALTER TABLE public.agent_teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_teams_select ON public.agent_teams;
CREATE POLICY agent_teams_select
  ON public.agent_teams FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

DROP POLICY IF EXISTS agent_team_members_select ON public.agent_team_members;
CREATE POLICY agent_team_members_select
  ON public.agent_team_members FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.agent_teams        FROM anon, authenticated;
REVOKE ALL ON public.agent_team_members FROM anon, authenticated;
GRANT SELECT ON public.agent_teams        TO authenticated;
GRANT SELECT ON public.agent_team_members TO authenticated;

COMMIT;
