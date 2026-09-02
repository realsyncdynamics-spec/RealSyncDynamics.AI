-- Skill- und Workflow-Beschriftung der Agentenlaeufe (Zielarchitektur §8).
-- Vokabular: packages/siteos-core/src/workflows/{skills,workflows}.ts
--
-- ## Was diese Migration tut
--
-- Sie gibt jedem Agentenlauf zwei Namen: unter welchem **Skill** er laeuft
-- und aus welchem **Anlass** (Workflow). Beides sind zusaetzliche Spalten an
-- einer bestehenden Tabelle — kein neues Laufobjekt, kein neuer Ausfuehrer.
--
-- ## Warum das eine Migration wert ist
--
-- §8 Regel 1: „Ein Einstiegspunkt in der Oberflaeche ist die Sicht auf einen
-- Skill oder Workflow, nicht auf eine Funktion." Heute laesst sich das nicht
-- bauen: `siteos_agent_runs` weiss, welcher Agent lief, aber nicht, unter
-- welchem Skill und aus welchem Anlass. Ein Kunde sieht sieben Agenten
-- arbeiten und nicht, dass es sich um seine „Continuous Compliance" handelt.
--
-- Die Werte kommen aus dem Kern (`skillForFindingCodes`,
-- `workflowForScanTrigger`) und werden beim Einreihen gesetzt — nicht
-- nachtraeglich geraten.
--
-- ## Warum nullable und ohne Backfill
--
-- Bestandslaeufe haben keinen belegbaren Anlass. Einen zu erfinden waere
-- schlimmer als die Luecke: die Beschriftung ist ein Governance-Fakt, und ein
-- geratener Fakt entwertet die belegten. NULL heisst hier „vor Einfuehrung
-- des Vokabulars entstanden" und ist damit selbst eine ehrliche Aussage.
--
-- ## Bewusst NICHT in dieser Migration
--
-- Ein Laufobjekt fuer die vier `portfolio`-Workflows (AI Governance,
-- Continuous Compliance, Change Monitoring, Incident Response). Diese
-- spannen ueber Assetgrenzen, `siteos_agent_runs` haengt aber an genau einem
-- `blueprint_id`. Dafuer braucht es einen Dispatcher, der noch nicht
-- existiert — und eine Tabelle ohne Consumer ist die Sorte Vorbau, die
-- spaeter niemand mehr einordnen kann.

-- ── 1. Die zwei Spalten ─────────────────────────────────────────────────────
-- CHECK statt Fremdschluessel auf eine Vokabeltabelle: Das Vokabular ist im
-- Kern deklariert und wird ueber `npm test` gegen diese Liste geprueft
-- (test/siteos/workflow-vocabulary.test.ts). Eine zweite Quelle in der
-- Datenbank waere ein zweiter Ort, an dem sie auseinanderlaufen kann.

ALTER TABLE public.siteos_agent_runs
  ADD COLUMN IF NOT EXISTS skill TEXT,
  ADD COLUMN IF NOT EXISTS workflow TEXT;

-- Die Constraints getrennt und idempotent, damit ein erneuter Lauf der
-- Migration nicht an einem bereits vorhandenen Namen scheitert.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'siteos_agent_runs_skill_check'
  ) THEN
    ALTER TABLE public.siteos_agent_runs
      ADD CONSTRAINT siteos_agent_runs_skill_check CHECK (
        skill IS NULL OR skill IN (
          'website', 'privacy', 'security', 'content',
          'seo', 'ai-risk', 'accessibility', 'transformation'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'siteos_agent_runs_workflow_check'
  ) THEN
    ALTER TABLE public.siteos_agent_runs
      ADD CONSTRAINT siteos_agent_runs_workflow_check CHECK (
        workflow IS NULL OR workflow IN (
          'website-transformation', 'privacy-review', 'ai-governance',
          'continuous-compliance', 'change-monitoring', 'incident-response',
          'content-governance', 'publishing-governance'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.siteos_agent_runs.skill IS
  'Skill, unter dem dieser Lauf gefuehrt wird (§8). Aus den Dimensionen der '
  'Befundcodes abgeleitet, nicht aus dem Agenten: der Compliance-Agent '
  'bedient privacy UND ai-risk. NULL = vor Einfuehrung des Vokabulars.';

COMMENT ON COLUMN public.siteos_agent_runs.workflow IS
  'Anlass des Laufs (§8). Aus siteos_runtime_scans.trigger abgeleitet. '
  'NULL = vor Einfuehrung des Vokabulars.';

-- ── 2. Abfragepfad der Oberflaeche ──────────────────────────────────────────
-- Die Sicht, die §8 Regel 1 verlangt, ist „alle Laeufe dieses Workflows" bzw.
-- „dieses Skills" — beides je Mandant und nach Zeit sortiert. Ohne Index
-- waere das ein Seq Scan ueber alle Laeufe des Mandanten.

CREATE INDEX IF NOT EXISTS siteos_agent_runs_workflow_idx
  ON public.siteos_agent_runs (tenant_id, workflow, queued_at DESC)
  WHERE workflow IS NOT NULL;

CREATE INDEX IF NOT EXISTS siteos_agent_runs_skill_idx
  ON public.siteos_agent_runs (tenant_id, skill, queued_at DESC)
  WHERE skill IS NOT NULL;

-- RLS bleibt unangetastet: die Tabelle traegt ihre Policies aus
-- 20260728000000_siteos_core.sql, und zwei zusaetzliche Spalten aendern
-- nichts an der Frage, wer die Zeile sehen darf.
