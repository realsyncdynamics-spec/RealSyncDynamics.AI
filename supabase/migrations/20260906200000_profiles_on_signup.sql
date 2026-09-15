-- profiles: die Tabelle hatte nie einen Erzeugungspfad
--
-- ── BEFUND (gegen das Live-Projekt erhoben, 2026-09-06) ──────────────────────
--
--   auth.users            6
--   public.profiles       1
--   Nutzer ohne Profil    5
--   memberships           6   (alle Nutzer haben eine)
--
-- Es ist keine Teilluecke, sondern ein geschlossener Kreis aus „geht nicht":
--
--   1. `handle_new_auth_user` (Trigger `on_auth_user_created`) legt Mandant und
--      Mitgliedschaft an — aber **kein Profil**.
--   2. Im ganzen Repo insertet **keine** Migration in `public.profiles`.
--   3. `profiles` traegt RLS-Policies fuer SELECT und UPDATE, aber **keine fuer
--      INSERT** — die SPA kann sich ihr Profil also auch nicht selbst anlegen.
--
-- Die eine vorhandene Zeile stammt nicht aus dem Anmeldeweg. Fuer jeden Nutzer,
-- der sich normal registriert hat, hat `profiles` nie existiert.
--
-- ── WAS DAS ANRICHTET ───────────────────────────────────────────────────────
--
-- 27 Stellen lesen die Tabelle. Drei Klassen, nach Schwere:
--
-- **Still falsch (die schlimmste).** `SettingsView.save()` und
-- `AiResidencySettings.saveUserPref()` schreiben mit `.update() … .eq('id', …)`.
-- Ein UPDATE, das keine Zeile trifft, ist **kein Fehler**: PostgREST liefert
-- `error: null`. Beide Oberflaechen melden daraufhin „gespeichert", und
-- gespeichert wurde nichts — Name, Organisation und die
-- **KI-Datenresidenz-Praeferenz** (`ai_data_residency`, EU-lokal vs. Cloud).
-- Fuer ein Produkt, das EU-Souveraenitaet zusagt, ist eine Einstellung, die
-- Zustimmung quittiert und nichts behaelt, ein eigener Befund.
--
-- **Unvollstaendige Auskunft.** `gdpr-export` exportiert `profiles` als
-- Abschnitt `profile`. Ohne Zeile fehlt er — bei einer Auskunft nach
-- Art. 15 DSGVO.
--
-- **Fail-closed, also unschaedlich.** Rund zehn Admin-Ansichten und
-- `mfa-admin-reset` / `audit-report-pdf` pruefen `is_super_admin` per
-- `maybeSingle()`. Ohne Zeile ist das `null` → kein Adminzugriff. Die Sperre
-- greift also in die sichere Richtung; sie sperrt nur auch den echten Admin aus.
--
-- ── FIX ─────────────────────────────────────────────────────────────────────
--
-- Additiv, idempotent, ohne Aenderung am bestehenden Verhalten: Der Trigger
-- bekommt einen Schritt dazu, die vorhandene Mandanten-/Mitgliedschaftslogik
-- bleibt Wort fuer Wort stehen. Danach ein Nachtrag fuer die fuenf Bestandsnutzer.
--
-- **Der Profil-Insert steht VOR dem Mitgliedschafts-Waechter.** Der bestehende
-- Early-Return ueberspringt alles Weitere, sobald eine Mitgliedschaft existiert —
-- genau der Zustand aller fuenf betroffenen Nutzer. Haenge man den Insert
-- dahinter, liefe er fuer niemanden, der schon einmal da war.
--
-- Bewusst **keine** INSERT-Policy fuer `authenticated`: Das Profil entsteht
-- serverseitig beim Anlegen des Kontos, der Browser braucht dafuer kein
-- Schreibrecht (CLAUDE.md §4).
--
-- ── PROBELAUF: der Trigger wurde AUSGELOEST, nicht nur angelegt ──────────────
--
-- CLAUDE.md §3 haelt seit dem 2026-09-06 fest, dass `Migration validation`
-- Funktionen anwendet, aber nie aufruft — PL/pgSQL prueft den Rumpf erst zur
-- Laufzeit, ein fehlerhafter Koerper laeuft in CI also gruen durch. Diese
-- Migration aendert genau so eine Funktion. Der erste Probelauf hatte sie nur
-- ersetzt; das genuegt nach dieser Regel nicht.
--
-- Nachgeholt am 2026-09-06 gegen das Live-Schema, alles in einer Transaktion
-- mit ROLLBACK: zwei Inserts in `auth.users` haben den Trigger tatsaechlich
-- gefeuert.
--
--   mit raw_user_meta_data.full_name  -> Profil da, full_name "Erika Musterfrau",
--                                        Mandant "Probe-A's Workspace", Rolle owner
--   ohne Metadaten                    -> Profil da, full_name NULL,
--                                        Mandant "Probe B's Workspace", Rolle owner
--
-- Danach zurueckgerollt und nachgeprueft: 6 Nutzer, 1 Profil, 6 Mandanten —
-- Produktion unveraendert.

BEGIN;

-- ============================================================
-- §1 Trigger-Funktion: Profil mit anlegen
-- ============================================================
-- Uebernommen aus der in Produktion laufenden Fassung (gemessen 2026-09-06),
-- nicht aus 20260501000000: Dort steht noch `SET search_path = public, auth`;
-- `20260506220000_security_revoke_excess_grants.sql` hat sie auf
-- `public, extensions, pg_temp` gehaertet. Ein Replay der aelteren Fassung
-- haette diese Haertung stillschweigend zurueckgenommen.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_local_part TEXT;
    v_tenant_name TEXT;
    v_tenant_id UUID;
BEGIN
    -- Profil zuerst: Der Waechter unten steigt aus, sobald eine Mitgliedschaft
    -- existiert. Stuende der Insert dahinter, bekaeme ihn kein Bestandsnutzer.
    -- `full_name` aus den Anmeldedaten, wenn der Anbieter einen mitschickt —
    -- erfunden wird nichts, ohne Angabe bleibt das Feld leer.
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        NULLIF(TRIM(COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            ''
        )), '')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Ab hier unveraendert gegenueber 20260501000000.
    IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_local_part := COALESCE(split_part(NEW.email, '@', 1), 'mein-team');
    v_tenant_name := initcap(replace(v_local_part, '.', ' ')) || '''s Workspace';

    INSERT INTO public.tenants (name)
    VALUES (v_tenant_name)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
    'Legt fuer jede neue auth.users-Zeile Profil, Mandant und Owner-Mitgliedschaft an. SECURITY DEFINER, weil der Auth-Trigger-Kontext keine App-Rolle hat, die RLS erfuellen koennte.';

-- CREATE OR REPLACE erhaelt die Rechte; die Sperre aus 20260506220000 wird
-- trotzdem erneut gesetzt, damit sie nicht an einer Annahme haengt.
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ============================================================
-- §2 Nachtrag fuer die Bestandsnutzer
-- ============================================================
-- Additiv: legt nur an, was fehlt, und aendert keine vorhandene Zeile.
-- `role`, `eu_compliance_mode` und die Zeitstempel kommen aus den
-- Spaltenvorgaben von 00001_initial_schema.sql.

INSERT INTO public.profiles (id, full_name)
SELECT u.id,
       NULLIF(TRIM(COALESCE(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           ''
       )), '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;
