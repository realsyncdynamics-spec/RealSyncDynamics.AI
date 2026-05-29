-- Findings — Evidence-First-UX-Felder: confidence / evidence_level / verification_status.
--
-- Strategische Kategorie-Korrektur (siehe PR-Bündel mit fix(tone)):
-- weg von "automatische juristische Wahrheit", hin zu "technisch
-- beobachtete Governance-Ereignisse mit Konfidenz und Verifikations-
-- status". Jeder Befund trägt jetzt explizit:
--
--   confidence_score (0..1)
--     Detector-Konfidenz für die Beobachtung selbst.
--     1.0 = direkte Beobachtung (z. B. HTTP-Request beobachtet)
--     0.5 = inferiert aus Indizien
--     0.0 = reine Hypothese (sollte nicht persistiert werden)
--
--   evidence_level
--     'observed'     — Signal direkt im Scan beobachtet (DOM/Network/Header)
--     'inferred'     — aus Beobachtungen abgeleitet (z. B. Vendor erraten)
--     'reported'     — von dritter Stelle gemeldet (Kunde, externer Scanner)
--     'unverifiable' — Aussage über Nicht-Beobachtbares (z. B. server-side masking)
--
--   verification_status
--     'verified'   — durch zweite Methode bestätigt (Re-Scan, manuell)
--     'partial'    — teilweise bestätigt, Lücken bekannt
--     'unverified' — nur eine Beobachtung, noch keine Bestätigung
--     'disputed'   — Kunde hat widersprochen, Re-Verifikation steht aus
--
-- UI nutzt diese Felder, um "Confidence: 0.71 · partial · observed"
-- statt absolute Behauptungen anzuzeigen. Score-Berechnung kann später
-- (separate PR) low-confidence-Befunde dämpfen.
--
-- Additiv, NOT NULL mit DEFAULT für Backfill bestehender Rows.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS evidence_level   TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT;

-- Backfill existing rows — Default-Werte spiegeln die alte semantische
-- Welt ("alles ist eine direkte Beobachtung mit 100% Konfidenz"),
-- damit Bestandsdaten nicht plötzlich unverifiziert wirken.
UPDATE public.findings
  SET confidence_score    = COALESCE(confidence_score, 1.00),
      evidence_level      = COALESCE(evidence_level, 'observed'),
      verification_status = COALESCE(verification_status, 'unverified')
  WHERE confidence_score IS NULL
     OR evidence_level   IS NULL
     OR verification_status IS NULL;

-- Constraints jetzt setzen, nachdem alle Bestandsrows befüllt sind.
ALTER TABLE public.findings
  ALTER COLUMN confidence_score    SET DEFAULT 1.00,
  ALTER COLUMN confidence_score    SET NOT NULL,
  ALTER COLUMN evidence_level      SET DEFAULT 'observed',
  ALTER COLUMN evidence_level      SET NOT NULL,
  ALTER COLUMN verification_status SET DEFAULT 'unverified',
  ALTER COLUMN verification_status SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.findings
    ADD CONSTRAINT findings_confidence_score_range
      CHECK (confidence_score >= 0 AND confidence_score <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.findings
    ADD CONSTRAINT findings_evidence_level_check
      CHECK (evidence_level IN ('observed', 'inferred', 'reported', 'unverifiable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.findings
    ADD CONSTRAINT findings_verification_status_check
      CHECK (verification_status IN ('verified', 'partial', 'unverified', 'disputed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.findings.confidence_score IS
  'Detector confidence (0..1) for the observation itself. 1.0 = direct observation, 0.5 = inferred, never persist <0.3.';
COMMENT ON COLUMN public.findings.evidence_level IS
  'observed | inferred | reported | unverifiable. Anti-overclaim guardrail — anything not directly observed must be labelled.';
COMMENT ON COLUMN public.findings.verification_status IS
  'verified | partial | unverified | disputed. Tracks whether a finding has been cross-checked by a second method.';

-- Partial index — surfaces low-confidence rows for periodic review.
-- Auditors care about: "what claims do we make that we have low
-- confidence in?" — this answers it without a full table scan.
CREATE INDEX IF NOT EXISTS findings_low_confidence_idx
  ON public.findings (tenant_id, created_at DESC)
  WHERE confidence_score < 0.7;
