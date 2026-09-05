-- ═══════════════════════════════════════════════════════════════════════════
--  ai_tool_runs — Agenten-Zuordnung fuer die spaetere Kostensteuerung (D2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D2, und Befund B2 derselben ADR.
--
-- ── Der Befund, den diese Migration schliesst ──────────────────────────────
--
-- ai_tool_runs kennt heute tenant_id und user_id, aber kein Feld fuer Agent,
-- Team oder Director. Damit ist der Ledger zwar vollstaendig, aber nicht auf
-- die Hierarchie aus D2 auswertbar — genau die Achse, entlang derer spaeter
-- gedeckelt werden soll:
--
--     Platform
--       └── Team
--            └── Director / Agent
--
-- „Budgetfaehig" ist laut D2 keine Absichtserklaerung, sondern eine
-- Anforderung an DIESE Migration: Die Zuordnung muss von der ersten Zeile an
-- mitgeschrieben werden. Nachtraeglich laesst sie sich nicht rekonstruieren —
-- ein Aufruf, der nicht weiss, wer ihn ausgeloest hat, weiss es nie mehr.
--
-- ── Was diese Migration ausdruecklich NICHT tut ────────────────────────────
--
-- Keine Limits, keine Blocking-Logik, keine Budget-Spalten mit ausgedachten
-- Zahlen. D2: „Ein Cap mit ausgedachter Zahl ist schlechter als kein Cap — er
-- sieht aus wie eine Zusage." Enforcement kommt nach dem Business-Entscheid;
-- die konkreten Werte fuer team_monthly_budget, director_monthly_budget und
-- agent_daily_budget sind in ADR 0011 als offener Punkt gefuehrt.
--
-- ── Ehrlich zur Reichweite ─────────────────────────────────────────────────
--
-- Diese Spalten machen den Ledger auswertbar, sie machen ihn nicht
-- vollstaendig. Nach ai_tool_runs schreiben heute nur _shared/ai.ts und
-- log-tool-run; die Subsysteme agent-os-runner und Enterprise-Agents haengen
-- nicht daran (ADR 0011 B2, docs/architecture/agent-manager-roadmap.md §M2).
-- „Ledger fuer jeden Agent-Call" bleibt bis M2 eine Zusage, keine Tatsache.
--
-- Rein additiv: zwei nullable Spalten ohne Default. Bestehende Zeilen bleiben
-- unveraendert, bestehende Schreiber brechen nicht.

BEGIN;

ALTER TABLE public.ai_tool_runs
  ADD COLUMN IF NOT EXISTS agent_id    uuid NULL REFERENCES public.agents(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_unit_id uuid NULL REFERENCES public.org_units(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ai_tool_runs.agent_id IS
  'Welcher Agent den Aufruf ausgeloest hat (ADR 0011 D2). NULL fuer Aufrufe '
  'ausserhalb der Agenten-Ebene — das ist heute der Normalfall, nicht ein Fehler.';
COMMENT ON COLUMN public.ai_tool_runs.org_unit_id IS
  'Organisationseinheit des Aufrufs (Team/Director). Traegt die Achse fuer '
  'spaetere Budgets. Denormalisiert neben agent_id, damit die Zuordnung auch '
  'dann erhalten bleibt, wenn der Agent spaeter geloescht wird.';

CREATE INDEX IF NOT EXISTS ai_tool_runs_agent_idx    ON public.ai_tool_runs (agent_id)    WHERE agent_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_tool_runs_org_unit_idx ON public.ai_tool_runs (org_unit_id) WHERE org_unit_id IS NOT NULL;

COMMIT;
