-- siteos_publish_evaluations: Anspruch auf eine Freigabe (O-WP6).
--
-- Anlass: `siteos/publish-approve` schreibt seit O-WP6 vor jeder Freigabe
-- einen Custody-Eintrag (Evidence vor Freigabe, fail-closed). Zwei
-- gleichzeitige Freigaben derselben Bewertung lasen beide „noch nicht
-- freigegeben", schrieben beide einen Nachweis, und nur eine Freigabe
-- wurde gespeichert. Der Verlierer hinterließ einen `audited`-Eintrag für
-- eine Freigabe, die es nicht gab.
--
-- `approved_at` kann diesen Anspruch nicht tragen: Die CHECK-Bedingung
-- `siteos_publish_approval_complete` verlangt approved_by, approved_at und
-- approval_reason nur gemeinsam. Daher eine eigene Spalte:
--
--   1. Handler setzt approval_claimed_at atomar (nur wenn NULL oder älter
--      als die Verfallszeit) — wer verliert, bricht ohne Nachweis ab.
--   2. Nachweis schreiben; scheitert er, Anspruch wieder freigeben.
--   3. approved_by/approved_at/approval_reason setzen, nur für den eigenen
--      Anspruch.
--
-- Die Spalte ist kein Freigabe-Signal; `runEvaluation` wertet weiterhin nur
-- `approved_by`. Rein additiv: neue nullable Spalte, kein Default, keine
-- Daten-, RLS- oder Rechteänderung.

ALTER TABLE public.siteos_publish_evaluations
  ADD COLUMN IF NOT EXISTS approval_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.siteos_publish_evaluations.approval_claimed_at IS
  'Laufender Freigabe-Anspruch von siteos/publish-approve (kein Freigabe-Signal). Verfällt nach 5 Minuten.';
