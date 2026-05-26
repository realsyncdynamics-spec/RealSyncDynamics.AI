-- Strukturierte Triage für Beta-Feedback.
--
-- Erweitert enterprise_feedback_reports um Felder, die der Feedback-Agent
-- (Multi-Step-Wizard im FeedbackWidget) erhebt:
--   Wo? · Erwartetes Verhalten · Tatsächliches Verhalten · Schritte
-- plus automatisch berechnete Priorität (p0-p3) und Triage-Score (0-100),
-- sowie Tags für Routing (security, compliance, needs-screenshot, reproducible).
--
-- Additiv: alle Spalten NULLABLE oder mit DEFAULT, RLS unverändert.

BEGIN;

ALTER TABLE public.enterprise_feedback_reports
  ADD COLUMN IF NOT EXISTS location           TEXT,
  ADD COLUMN IF NOT EXISTS expected_behavior  TEXT,
  ADD COLUMN IF NOT EXISTS actual_behavior    TEXT,
  ADD COLUMN IF NOT EXISTS steps_to_reproduce TEXT,
  ADD COLUMN IF NOT EXISTS priority           TEXT,
  ADD COLUMN IF NOT EXISTS triage_score       INTEGER,
  ADD COLUMN IF NOT EXISTS tags               TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS page_url           TEXT,
  ADD COLUMN IF NOT EXISTS user_agent         TEXT,
  ADD COLUMN IF NOT EXISTS viewport           TEXT;

-- Priorität: p0 (sofort) · p1 (heute) · p2 (diese Woche) · p3 (Backlog).
-- NULL bleibt zulässig für Altdaten vor dieser Migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enterprise_feedback_reports_priority_check'
  ) THEN
    ALTER TABLE public.enterprise_feedback_reports
      ADD CONSTRAINT enterprise_feedback_reports_priority_check
      CHECK (priority IS NULL OR priority IN ('p0', 'p1', 'p2', 'p3'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enterprise_feedback_reports_triage_score_check'
  ) THEN
    ALTER TABLE public.enterprise_feedback_reports
      ADD CONSTRAINT enterprise_feedback_reports_triage_score_check
      CHECK (triage_score IS NULL OR (triage_score >= 0 AND triage_score <= 100));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS enterprise_feedback_reports_priority_idx
  ON public.enterprise_feedback_reports(priority);

CREATE INDEX IF NOT EXISTS enterprise_feedback_reports_triage_score_idx
  ON public.enterprise_feedback_reports(triage_score DESC);

CREATE INDEX IF NOT EXISTS enterprise_feedback_reports_tags_idx
  ON public.enterprise_feedback_reports USING GIN(tags);

COMMIT;
