-- Tenant-Branche für signalbasierte Policy-Pack-Empfehlung (Phase 2).
--
-- Rein additiv: eine nullable Spalte `industry` auf public.tenants. Die
-- Empfehlungslogik (recommend.ts) nutzt sie als Branchen-Signal; ohne Wert
-- (NULL) verhält sie sich exakt wie bisher (nur Framework-/KI-Signale).
--
-- Freitext bewusst nicht per CHECK eingeengt: die Menge der Branchen wächst
-- mit dem Pack-Katalog. Das Frontend bietet eine kuratierte Auswahl an; der
-- Abgleich in recommend.ts ist ein simpler Gleichheitsvergleich gegen
-- policy_pack_catalog.industry.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN public.tenants.industry IS
    'Branche des Tenants (frei, kuratierte Auswahl im Frontend). Signal für die Policy-Pack-Empfehlung; NULL = kein Branchen-Signal. Abgleich gegen policy_pack_catalog.industry.';

-- Kein neuer RLS-Bedarf: SELECT über "tenants member-read", UPDATE über
-- "tenants owner-update" decken die neue Spalte automatisch ab.
