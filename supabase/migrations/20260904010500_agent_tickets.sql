-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 5/8 — agent_tickets
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D4 (visibility, CHECK-Constraint) und D1 (Grenze ist
-- serverseitig, kein Feld). Modell: Artifact v0.2, §02, §03, §06, §09, §10.
--
-- Tickets werden von jedem Agenten strukturiert eroeffnet und nie von ihm
-- selbst geschlossen. Browser Agent X07 meldet, er behebt nicht.
--
-- ── visibility verengt, es erweitert nie ───────────────────────────────────
--
-- tenant_shared bedeutet NICHT „fuer den Tenant oeffentlich". Die
-- tenant_id-Zugehoerigkeit muss weiterhin erfuellt sein; visibility kommt
-- als ZUSAETZLICHE Bedingung obendrauf (ADR 0011 D4). Ein Tenant sieht damit
-- „Ihr System XY wurde geprueft, 0 offene Findings" — nie interne
-- Engineering-Details.
--
-- Und: tenant_shared bei tenant_id IS NULL ist ein Widerspruch — mit wem
-- geteilt? Das schliesst ein CHECK aus, nicht eine Konvention (ADR 0011 D4,
-- abgeleitete Regel). Konventionen halten so lange, wie jemand sie kennt.
--
-- ── Was hier bewusst NICHT steht ───────────────────────────────────────────
--
-- Kein Feld fuer „darf autonom deployt werden". Die Grenze aus D1 prueft die
-- Policy Engine serverseitig aus severity und category. Ein Flag auf der
-- Ticket-Zeile waere genau die Selbstauskunft, die D1 ausschliesst.
--
-- ── Offener Punkt, hier sichtbar gemacht statt stillschweigend entschieden ──
--
-- Der Wertebereich von severity und category ist laut ADR 0011 NICHT
-- festgeschrieben. Die Listen unten stammen aus §06 des Modells. Die
-- Beispieltabelle zu D1 nennt zusaetzlich severity 'error' und schreibt
-- category 'ux' statt 'ui_bug' — diese Abweichung ist offen und gehoert
-- entschieden, bevor die Policy Engine ihre Positivliste daraus ableitet.
-- Bis dahin gilt Default-Deny: Was das Gate nicht kennt, ist nicht autonom.
-- Eine Erweiterung ist ein Constraint-Tausch, additiv und ohne Datenverlust.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_code         text NOT NULL UNIQUE,
  source_agent_id     uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  category            text NOT NULL CHECK (category IN
                        ('ui_bug', 'performance', 'a11y', 'security', 'compliance', 'customer_feedback')),
  severity            text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  status              text NOT NULL DEFAULT 'open' CHECK (status IN
                        ('open', 'routed', 'in_progress', 'fixed', 'verifying', 'closed', 'reopened')),
  evidence            jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_team_id    uuid NULL REFERENCES public.agent_teams(id) ON DELETE SET NULL,
  related_incident_id uuid NULL REFERENCES public.governance_incidents(id) ON DELETE SET NULL,
  github_pr_url       text,
  visibility          text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'tenant_shared')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_tickets_shared_needs_tenant
    CHECK (NOT (tenant_id IS NULL AND visibility = 'tenant_shared'))
);

COMMENT ON TABLE public.agent_tickets IS
  'Strukturierte Befunde der Agenten-Ebene (ADR 0011). Ergaenzt '
  'governance_incidents, ersetzt es nicht.';
COMMENT ON COLUMN public.agent_tickets.visibility IS
  'internal · tenant_shared. VERENGT, erweitert nie: die tenant_id-Zugehoerigkeit '
  'bleibt Voraussetzung. tenant_shared bei tenant_id IS NULL ist per CHECK '
  'ausgeschlossen (ADR 0011 D4).';
COMMENT ON COLUMN public.agent_tickets.related_incident_id IS
  'Nur gesetzt, wenn ein ueberwachtes Tenant-KI-System betroffen ist. '
  'Verlinkt, ersetzt nicht — governance_incidents bleibt die fachliche Quelle.';
COMMENT ON COLUMN public.agent_tickets.severity IS
  'info · warn · critical (Modell §06). Wertebereich laut ADR 0011 noch nicht '
  'abschliessend; die D1-Beispieltabelle nennt zusaetzlich ''error''. Offen.';
COMMENT ON COLUMN public.agent_tickets.category IS
  'Wertebereich laut ADR 0011 noch nicht abschliessend (D1-Tabelle nennt ''ux'' '
  'statt ''ui_bug''). Die Positivliste der Policy Engine leitet sich hiervon ab '
  '— eine Aenderung hier ist deshalb sicherheitsrelevant, nicht kosmetisch.';
COMMENT ON COLUMN public.agent_tickets.source_agent_id IS
  'ON DELETE RESTRICT: Ein Ticket ohne Melder waere ein Befund ohne Herkunft.';

CREATE INDEX IF NOT EXISTS agent_tickets_tenant_idx   ON public.agent_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS agent_tickets_status_idx   ON public.agent_tickets (status);
CREATE INDEX IF NOT EXISTS agent_tickets_team_idx     ON public.agent_tickets (assigned_team_id);
CREATE INDEX IF NOT EXISTS agent_tickets_incident_idx ON public.agent_tickets (related_incident_id);

ALTER TABLE public.agent_tickets ENABLE ROW LEVEL SECURITY;

-- Platform Scope: nur Ops. Tenant Scope: Mitglieder, UND nur was ausdruecklich
-- geteilt ist. Interne Tickets eines Tenant-Scopes sieht kein Client — sie
-- bleiben der Service-Role vorbehalten. Das ist die Verengung, nicht ein Loch.
DROP POLICY IF EXISTS agent_tickets_select ON public.agent_tickets;
CREATE POLICY agent_tickets_select
  ON public.agent_tickets FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND visibility = 'tenant_shared')
  );

REVOKE ALL ON public.agent_tickets FROM anon, authenticated;
GRANT SELECT ON public.agent_tickets TO authenticated;

COMMIT;
