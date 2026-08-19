-- Wartelisten-Interesse: `bots` als gültigen Wert aufnehmen.
--
-- Die Landingpage bietet „Bot-Laufzeit" zur Auswahl an und sendet dafür
-- `use_case: 'bots'` (src/components/landing/WaitlistForm.tsx). Die Edge
-- Function `sales-lead` liess den Wert bisher nicht zu und schrieb `other`;
-- die Datenbank hätte ihn ebenfalls abgelehnt. Ergebnis: Wer sich gezielt für
-- das Bot-Modul eintrug, landete als „Etwas anderes" in der Liste —
-- ausgerechnet bei dem Modul, das noch nicht ausliefert und dessen Nachfrage
-- den Ausschlag geben soll.
--
-- Additiv: Der neue Wertebereich ist eine Obermenge des alten, bestehende
-- Zeilen bleiben gültig. DROP und ADD laufen in derselben Transaktion wie die
-- Migration, es entsteht kein Fenster ohne Constraint.

ALTER TABLE public.waitlist_signups
  DROP CONSTRAINT IF EXISTS waitlist_signups_interest_check;

ALTER TABLE public.waitlist_signups
  ADD CONSTRAINT waitlist_signups_interest_check
  CHECK (interest IN (
    'runtime', 'siteos', 'evidence', 'provenance', 'audit', 'bots', 'other'
  ));

COMMENT ON COLUMN public.waitlist_signups.interest IS
  'Modul-Interesse: runtime, siteos, evidence, provenance, audit, bots oder other. '
  'Spiegel von WAITLIST_INTERESTS in supabase/functions/sales-lead/index.ts und '
  'src/components/landing/WaitlistForm.tsx — alle drei Ebenen müssen denselben '
  'Wertebereich führen.';
