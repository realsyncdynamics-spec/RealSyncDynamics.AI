-- B1 — Rechteausweitung über public.profiles.is_super_admin schliessen.
--
-- Befund (ADR 0011, gemessen 2026-09-01 gegen das Live-Projekt):
--   Die UPDATE-Policy auf public.profiles lautete
--     USING ((SELECT auth.uid()) = id)   -- ohne WITH CHECK, polroles = PUBLIC
--   Postgres verwendet ohne WITH CHECK den USING-Ausdruck auch als Check. Die
--   Policy prueft damit nur, WELCHE ZEILE geschrieben wird — nie, WELCHE
--   SPALTEN. Zusammen mit dem tabellenweiten UPDATE-Grant fuer authenticated
--   (und anon) und ohne Schutz-Trigger konnte jeder eingeloggte Nutzer
--     update public.profiles set is_super_admin = true where id = auth.uid()
--   ausfuehren und sich damit selbst zum Plattform-Administrator machen.
--
-- Sicherheitsrelevanz: is_super_admin gatet 51 Stellen in 24 Migrationen
-- (RLS-Policies und Admin-RPCs), 4 Edge Functions — darunter mfa-admin-reset,
-- also das Zuruecksetzen fremder MFA — und 12 Frontend-Ansichten. Dahinter
-- liegt Cross-Tenant-Lesezugriff auf Kunden-, Lead-, Onboarding-, Analytics-
-- und Audit-Daten.
--
-- DSGVO Art. 32 Abs. 1 lit. b (Vertraulichkeit), Art. 5 Abs. 1 lit. f.
-- EU AI Act Art. 12 (Aufzeichnungspflichten) und Art. 14 (menschliche
-- Aufsicht) setzen beide voraus, dass die Aufsichtsrolle nicht vom
-- Beaufsichtigten selbst vergeben werden kann.
--
-- Dreifach abgesichert, weil eine Ebene allein in diesem Repo schon
-- gebrochen wurde:
--
--   1. WITH CHECK auf der Policy + Bindung an `authenticated`.
--   2. Trigger als PRIMAERE Verteidigung. Grants allein genuegen nicht: Ein
--      spaeteres `GRANT ... ON ALL TABLES IN SCHEMA public` hebt jede
--      Spalten-Einschraenkung wieder auf — genau das tut der db-Job in
--      .github/workflows/ci.yml, und genau diese Klasse Bulk-Operation war
--      der ACL-Vorfall vom 2026-08-23 (CLAUDE.md §5). Der Trigger ueberlebt
--      beides.
--   3. Spalten-Grants als Tiefenstaffelung.

-- ── 1. Policy: WITH CHECK ergaenzen, an authenticated binden ─────────────────
-- Ohne WITH CHECK koennte auch die Ziel-Zeile (NEW.id) unbemerkt wandern.
-- `TO authenticated` nimmt anon aus der Policy: auth.uid() ist dort NULL, die
-- Policy traf also ohnehin nie zu — die Rollenbindung macht das explizit
-- statt es einer Eigenschaft von auth.uid() zu ueberlassen.
DROP POLICY IF EXISTS "Nutzer können ihr eigenes Profil aktualisieren" ON public.profiles;
CREATE POLICY "Nutzer können ihr eigenes Profil aktualisieren"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- ── 2. Trigger: is_super_admin ist fuer Clients unveraenderlich ──────────────
-- SECURITY INVOKER (Default) ist hier wesentlich: current_user muss den
-- AUFRUFER zeigen. Als SECURITY DEFINER wuerde die Funktion immer 'postgres'
-- sehen und jede Aenderung durchlassen — der Schutz waere ein Placebo.
--
-- service_role und postgres bleiben erlaubt: Die Rolle wird per Edge Function
-- oder Migration vergeben, also serverseitig, wo sie hingehoert.
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
            'profiles.is_super_admin ist clientseitig unveraenderlich (Rolle: %)', current_user
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.profiles_guard_privileged_columns() IS
    'Verhindert, dass ein Client sich selbst zum Plattform-Administrator macht. '
    'SECURITY INVOKER, damit current_user den Aufrufer zeigt — als DEFINER waere der Schutz wirkungslos. '
    'Siehe ADR 0011, Befund B1.';

DROP TRIGGER IF EXISTS trig_profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER trig_profiles_guard_privileged_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- ── 3. Spalten-Grants statt Tabellen-Grant ──────────────────────────────────
-- Ein tabellenweiter Grant laesst sich NICHT durch REVOKE einzelner Spalten
-- einschraenken (PostgreSQL: "the table-level grant is unaffected by a
-- column-level operation"). Deshalb erst der Tabellen-REVOKE, dann die
-- Positivliste.
--
-- Die Liste ist aus den tatsaechlichen Schreibpfaden im Frontend abgeleitet,
-- nicht geraten: SettingsView (full_name, organization_name),
-- AiResidencySettings (ai_data_residency), OnboardingTour (onboarding_step,
-- onboarding_completed_at, onboarding_dismissed_at). avatar_url ist
-- Selbstbedienungsfeld derselben Art und bleibt schreibbar.
--
-- Bewusst NICHT in der Liste: is_super_admin (Plattform-Berechtigung),
-- role (Altlast aus 00001, wird nirgends fuer Autorisierung gelesen —
-- gesperrt, damit das so bleibt), welcome_email_sent_at (setzt eine Edge
-- Function), id, created_at, updated_at (Trigger).
--
-- anon verliert das Schreibrecht ganz: Die Policy trifft dort nicht mehr zu.
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
    full_name,
    organization_name,
    avatar_url,
    ai_data_residency,
    onboarding_step,
    onboarding_completed_at,
    onboarding_dismissed_at
) ON public.profiles TO authenticated;

COMMENT ON COLUMN public.profiles.is_super_admin IS
    'Plattform-Administrator (RSD-intern, ADR 0005). Nur serverseitig setzbar: '
    'Spalten-Grant fehlt und trig_profiles_guard_privileged_columns blockt. '
    'Neue Berechtigungen gehoeren nach public.platform_operators (ADR 0011, D5).';
