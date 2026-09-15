-- B1 — `profiles.is_super_admin` ist clientseitig setzbar (P0, Rechteausweitung)
--
-- ── BEFUND, gegen das Live-Projekt gemessen (ebljyceifhnlzhjfyxup, 2026-09-15) ─
--
-- 1. GRANTS (`information_schema`): `anon` UND `authenticated` halten auf
--    `public.profiles` einen **Grant auf Tabellenebene** fuer UPDATE — nicht
--    einzelne Spaltenrechte. Damit ist jede Spalte schreibbar, `is_super_admin`
--    eingeschlossen.
--
-- 2. POLICIES (`pg_policy`): Genau zwei, SELECT und UPDATE. Die UPDATE-Policy
--    lautet `USING ((SELECT auth.uid()) = id)`, `polwithcheck IS NULL`, und
--    `polroles` ist leer — sie gilt also fuer PUBLIC und traegt **kein**
--    WITH CHECK. Eine Policy ohne WITH CHECK prueft nur, WELCHE ZEILE ein
--    UPDATE treffen darf, nie, WELCHEN INHALT sie danach hat.
--
-- Beides zusammen ergibt: Jeder eingeloggte Nutzer kann sich selbst zum
-- Plattform-Administrator machen. `is_super_admin` steht in 25 Migrationen, 5
-- Edge Functions (darunter `mfa-admin-reset` — fremdes MFA zuruecksetzen) und
-- 12 Frontend-Ansichten als Berechtigungsnachweis.
--
-- ── WARUM DIE NAHELIEGENDE KORREKTUR NICHT TRAEGT ───────────────────────────
--
-- `REVOKE UPDATE (is_super_admin) ON public.profiles FROM authenticated`
-- bewirkt **nichts**. PostgreSQL kennt keinen Spalten-REVOKE, der einen
-- bestehenden Tabellen-Grant einschraenkt: Der Tabellen-Grant deckt weiterhin
-- alle Spalten ab. Der Weg ist erst der Tabellen-REVOKE, dann eine
-- **Positivliste** der erlaubten Spalten.
--
-- Ebenso wenig reicht `WITH CHECK` allein: Es begrenzt den Zeilenzustand, nicht
-- die Spaltenauswahl. `WITH CHECK ((SELECT auth.uid()) = id)` laesst
-- `SET is_super_admin = true` auf der eigenen Zeile unveraendert durch.
--
-- ── DIE KLEINSTE WIRKSAME KORREKTUR ─────────────────────────────────────────
--
-- Zwei Abschnitte, mehr nicht. Abschnitt 1 ist die Sicherheitsgrenze.
-- Abschnitt 2 haelt sie, wenn Abschnitt 1 von aussen wieder aufgemacht wird —
-- kein hypothetischer Fall, sondern der Vorfall vom 2026-08-23
-- (Out-of-Band-Bulk-Revoke/-Grant, CLAUDE.md §5). Eine Grenze, die ein
-- einziges `GRANT ... ON ALL TABLES` aufhebt, ist fuer ein Produkt mit
-- Pruefpfad-Zusage keine Grenze.
--
-- Eine dritte Schicht war entworfen und ist wieder entfallen, weil die
-- Messung sie widerlegt hat — die Begruendung steht weiter unten bei der
-- Policy. Sie fehlt hier nicht aus Nachlaessigkeit.
--
-- Additiv: keine Spalte, keine Zeile, kein Datentyp wird angefasst; SELECT,
-- INSERT und DELETE bleiben unberuehrt; `service_role` behaelt alles.
--
-- EU AI Act Art. 14 (menschliche Aufsicht): Wer Aufsicht ausuebt, darf sich
-- diese Rolle nicht selbst zuteilen. DSGVO Art. 5 Abs. 1 lit. f / Art. 32:
-- Schutz vor unbefugter Rechteausweitung auf personenbezogene Daten.


-- ── 1. Spaltenrechte: Tabellen-Grant entziehen, Positivliste vergeben ───────
--
-- Die sechs Spalten sind aus den tatsaechlichen Schreibpfaden der SPA
-- abgeleitet, nicht geschaetzt. Vollstaendig erhoben am 2026-09-15:
--
--   src/features/settings/SettingsView.tsx:91      full_name, organization_name
--   src/features/settings/AiResidencySettings.tsx:83  ai_data_residency
--   src/components/OnboardingTour.tsx:87/95        onboarding_step,
--                                                  onboarding_completed_at,
--                                                  onboarding_dismissed_at
--
-- Nicht enthalten und damit ab hier clientseitig unveraenderlich:
-- `is_super_admin`, `role`, `eu_compliance_mode`, `avatar_url`, `id`,
-- `created_at`, `updated_at`, `welcome_email_sent_at`. Fuer keine dieser
-- Spalten existiert im Repo ein clientseitiger Schreibpfad — geprueft ueber
-- `src/` und `supabase/functions/`. `welcome_email_sent_at` schreibt
-- `welcome-email/index.ts:107` per Service-Role; die Rolle ist unten
-- ausdruecklich ausgenommen. `avatar_url` kommt im Code ueberhaupt nicht vor.
--
-- `anon` verliert UPDATE vollstaendig. Das ist verhaltensneutral: Die
-- UPDATE-Policy verlangt `auth.uid() = id`, und ohne Session ist `auth.uid()`
-- NULL — ein anonymes Profil-UPDATE konnte nie eine Zeile treffen. Das Recht
-- war nur die Angriffsflaeche ohne den Nutzen.

REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
    full_name,
    organization_name,
    ai_data_residency,
    onboarding_step,
    onboarding_completed_at,
    onboarding_dismissed_at
) ON public.profiles TO authenticated;


-- ── 2. Trigger: haelt die Grenze auch ohne Spaltenrechte ────────────────────
--
-- SECURITY INVOKER ist hier die ganze Pointe. Als SECURITY DEFINER liefe die
-- Funktion mit den Rechten ihres Eigentuemers, `current_user` waere immer
-- `postgres`, die Bedingung nie erfuellt — ein Waechter, der nie ausloest.
--
-- Die Ausnahmeliste ist eine Positivliste (fail-closed): Eine kuenftige neue
-- Client-Rolle laeuft in die Sperre, statt still durchgelassen zu werden. Ein
-- neuer administrativer Pfad faellt dafuer sichtbar aus und wird hier
-- nachgetragen — der laute Fehler ist die gewollte Richtung.
--
-- `IS DISTINCT FROM` statt `<>`: Bei NULL auf einer der beiden Seiten lieferte
-- `<>` NULL, die IF-Bedingung waere nicht wahr, und der Wechsel
-- NULL → true kaeme durch. Genau dieser Wechsel ist die Rechteausweitung.

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
       AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
    THEN
        RAISE EXCEPTION
            'profiles.is_super_admin ist clientseitig unveraenderlich (Rolle: %)',
            current_user
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trig_profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER trig_profiles_guard_privileged_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();


-- ── Die Policy bleibt unangetastet — bewusst ────────────────────────────────
--
-- Die naheliegende dritte Schicht waere ein `WITH CHECK` auf die
-- UPDATE-Policy, gegen die Uebergabe der eigenen Zeile an ein fremdes Konto
-- (`SET id = <fremde uuid>`). Sie waere wirkungslos, und das ist gemessen,
-- nicht vermutet:
--
--   Tabelle mit `FOR UPDATE USING (owner = 'ich')` und OHNE WITH CHECK,
--   `UPDATE t SET owner='fremd'` als `authenticated`
--   → ERROR: new row violates row-level security policy for table "t"
--
-- PostgreSQL verwendet bei UPDATE den `USING`-Ausdruck automatisch auch als
-- `WITH CHECK`, solange keiner definiert ist. Die Luecke, die ein
-- hinzugefuegtes WITH CHECK schliessen sollte, existiert also nicht — ein
-- zusaetzliches DROP/CREATE POLICY auf einer produktiv genutzten Tabelle
-- brauchte es dafuer nicht.
--
-- Diese Zeilen stehen hier, damit die naechste Sitzung die Frage nicht erneut
-- aufwirft: Die Policy ist geprueft und in Ordnung wie sie ist.


COMMENT ON FUNCTION public.profiles_guard_privileged_columns() IS
    'B1: Verhindert clientseitige Aenderung von profiles.is_super_admin. '
    'SECURITY INVOKER, damit current_user die aufrufende Rolle ist. '
    'Zweite Verteidigungslinie hinter den Spalten-Grants (Vorfall 2026-08-23).';
