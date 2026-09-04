-- ADR 0011, D4 — agent_roles: das Rollen-Vokabular der Agentenebene.
--
-- Entscheid des Eigentümers vom 2026-09-04: `AgentRole` aus
-- `src/core/trainer-agent/types.ts` wird kanonisch und in die Datenbank
-- gespiegelt. Damit endet der Zustand aus Befund B4 — zwei Vokabulare
-- nebeneinander (`AgentRole` in TypeScript, `agent_profiles.type` gelebt) —
-- nicht dadurch, dass ein drittes entsteht, sondern dadurch, dass eines
-- davon die Quelle wird.
--
-- Die Tabelle ist ein globaler Katalog ohne `tenant_id`, wie
-- `agent_profiles` (20260624000000). Das ist hier richtig und keine
-- Ausnahme von CLAUDE.md §3: Eine Rolle beschreibt eine Gattung von Agenten,
-- kein Mandantendatum. Lesen darf jeder Eingeloggte, Schreiben nur die
-- Service-Role — der Wertebereich ist Plattform-Vokabular, keine Nutzereingabe.
--
-- ACHTUNG, Doppelpflege: Die Werte stehen ab jetzt an zwei Stellen — hier und
-- in `ALL_AGENT_ROLES`. `test/governance/agent-roles-sql-parity.test.ts` bricht,
-- wenn sie auseinanderlaufen. Dasselbe Muster wie bei RFC-003 (CLAUDE.md §5).

CREATE TABLE IF NOT EXISTS public.agent_roles (
    key         TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_roles IS
    'Globaler Katalog der Agentenrollen. Kanonische Quelle ist diese Tabelle; '
    'ALL_AGENT_ROLES in src/core/trainer-agent/types.ts ist ihr Spiegel. '
    'ADR 0011, D4 — Entscheid 2026-09-04.';

ALTER TABLE public.agent_roles ENABLE ROW LEVEL SECURITY;

-- Lesen für alle Eingeloggten: Das Vokabular ist keine Verschlusssache, und
-- die Oberfläche braucht es, um eine Rolle überhaupt anzeigen zu können.
-- Kein Schreibrecht für Clients — dafür gibt es keine Policy, und ohne Policy
-- ist geschlossen. Änderungen kommen per Migration, damit der Spiegel in
-- TypeScript mitgezogen wird.
DROP POLICY IF EXISTS agent_roles_read ON public.agent_roles;
CREATE POLICY agent_roles_read
    ON public.agent_roles FOR SELECT TO authenticated
    USING (true);

INSERT INTO public.agent_roles (key, description) VALUES
    ('ResearchAgent',   'Recherchiert Sachverhalte und beschafft Belege.'),
    ('MemoryAgent',     'Pflegt Wissens- und Zustandsgedaechtnis (siehe RFC-003).'),
    ('PlanningAgent',   'Zerlegt Ziele in Schritte und Abhaengigkeiten.'),
    ('SimulationAgent', 'Spielt Handlungsoptionen durch, bevor sie ausgefuehrt werden.'),
    ('PromotionAgent',  'Bereitet Ergebnisse fuer Veroeffentlichung und Aussenwirkung auf.'),
    ('MonitoringAgent', 'Ueberwacht Laufzeit, SLOs und Abweichungen.'),
    ('DecisionAgent',   'Erzeugt Entscheidungsvorlagen; entscheidet nicht selbst (ADR 0011, D1).'),
    ('OutputAgent',     'Erzeugt die ausgelieferten Artefakte.'),
    ('TrainerAgent',    'Beobachtet, coacht und prueft die uebrigen Agenten.')
ON CONFLICT (key) DO NOTHING;
