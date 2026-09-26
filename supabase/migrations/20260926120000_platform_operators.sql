-- D5 (ADR 0011) — eine einzige Quelle für die Plattform-Rolle
--
-- ── DAS PROBLEM ─────────────────────────────────────────────────────────────
--
-- `profiles.is_super_admin` ist heute die Plattform-Rolle. Die Spalte hat drei
-- Eigenschaften, die für einen Berechtigungsnachweis alle drei falsch sind:
-- Sie liegt in einer Tabelle, die dem Nutzer selbst gehört; sie trägt keine
-- Historie (wer hat wann wem Plattformrechte gegeben?); und sie hat keinen
-- Vergabeweg — der eine vorhandene Super-Admin wurde von Hand in der Datenbank
-- gesetzt, an Repo und Prüfpfad vorbei.
--
-- B1 (20260915120000) hat die Spalte gegen clientseitige Änderung gesperrt.
-- Das war die Notbremse. Diese Migration gibt der Rolle ein Zuhause.
--
-- ── DER BEFUND, gemessen am 2026-09-26 gegen ebljyceifhnlzhjfyxup ───────────
--
--   Super-Admins live                                 1
--   Policies, die is_super_admin lesen               30  (über 27 Tabellen)
--   public-Funktionen, die es lesen                   7
--   Frontend-Dateien, die es lesen                   14
--   Stellen, die es SCHREIBEN                         0
--
-- Die letzte Zahl entscheidet den Entwurf. Es gibt keinen Schreibpfad — weder
-- im Frontend noch in einer Edge Function noch in einer Migration. Die Spalte
-- wird ausschliesslich gelesen.
--
-- ── WARUM DIE 37 LESESTELLEN NICHT UMGESCHRIEBEN WERDEN ─────────────────────
--
-- Der naheliegende Weg wäre, 30 Policies und 7 Funktionen von
-- `p.is_super_admin = true` auf `is_platform_operator()` umzustellen. Dagegen
-- sprechen drei gemessene Gründe:
--
-- 1. **Aussperr-Risiko ohne Gegenwert.** Es gibt genau EINEN Super-Admin. Ein
--    Fehler in einer von 30 Policies sperrt ihn aus 27 Tabellen aus, darunter
--    der Document Vault und die Business-Metriken.
-- 2. **Die Repo-Texte sind nicht der Live-Stand.** Im Repo stehen 44
--    Vorkommen in 26 Migrationen, live existieren 30 Policies. Ein Umbau aus
--    den Repo-Dateien heraus würde den gemessenen Produktionsstand
--    überschreiben — dieselbe Klasse Fehler wie der ACL-Vorfall 2026-08-23.
-- 3. **Er löst das Problem gar nicht.** Das Problem ist nicht, WO gelesen
--    wird, sondern dass es keinen kontrollierten Ort zum SCHREIBEN gibt.
--
-- ── DER ENTWURF ─────────────────────────────────────────────────────────────
--
-- `platform_operators` wird die einzige **schreibbare** Quelle.
-- `profiles.is_super_admin` wird zur **Projektion** davon, per Trigger
-- gepflegt, und ist selbst nicht mehr direkt setzbar — auch nicht per
-- Service-Role. Damit gibt es genau einen Vergabeweg, und die 30 Policies, 7
-- Funktionen und 14 Ansichten laufen unverändert weiter.
--
-- Das ist kein zweiter Wahrheitsort, sondern dasselbe Muster, das dieses Repo
-- bei Preisen schon fährt: `shared/pricing.ts` ist die Quelle,
-- `src/config/pricing.ts` die Projektion.
--
-- Die Umstellung der Lesestellen auf `is_platform_operator()` bleibt möglich
-- und wird durch diese Migration **einfacher statt dringender**: Sie ist danach
-- eine Aufräumarbeit ohne Sicherheitsfrist, weil die Quelle bereits stimmt.
--
-- EU AI Act Art. 12 (Aufzeichnung): Wer Plattformrechte hält, ist ab hier eine
-- Zeile mit Zeitpunkt und Urheber statt eines Flags ohne Herkunft.
-- Art. 14 (menschliche Aufsicht): Die Aufsichtsrolle bekommt einen benannten
-- Vergabeweg. DSGVO Art. 5 Abs. 1 lit. f / Art. 32: Cross-Tenant-Zugriff hängt
-- an dieser Rolle; ihre Vergabe gehört protokolliert.


-- ── 1. Die Quelle ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_operators (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Bewusst OHNE CHECK-Liste: Welche Rollen es gibt, ist offen (ADR 0011,
    -- „Offene Punkte"). Eine neue Rolle soll eine Zeile sein, keine
    -- Schemaänderung. Solange is_platform_operator() grobkörnig boolean
    -- antwortet, ist das Feld ohnehin nur Dokumentation.
    role       TEXT NOT NULL DEFAULT 'operator',

    -- Stilllegen statt löschen: Die Zeile bleibt als Nachweis erhalten, wer
    -- wann Plattformrechte hatte. Löschen würde den Prüfpfad schneiden.
    active     BOOLEAN NOT NULL DEFAULT true,

    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.platform_operators IS
    'D5/ADR 0011: einzige schreibbare Quelle der Plattform-Rolle. '
    'profiles.is_super_admin ist die per Trigger gepflegte Projektion davon.';

-- RLS an, aber BEWUSST OHNE JEDE CLIENT-POLICY. Eine Policy hier wäre der
-- Rückweg zu genau der Rechteausweitung, die B1 geschlossen hat — sie wäre nur
-- eine Tabelle weitergewandert. Wer Operator wird, entscheidet der Betreiber
-- per Service-Role, nicht der Browser.
ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_operators FROM anon;
REVOKE ALL ON public.platform_operators FROM authenticated;
GRANT ALL ON public.platform_operators TO service_role;


-- ── 2. Die Abfrage ──────────────────────────────────────────────────────────
--
-- SECURITY DEFINER, weil die aufrufende Rolle die Tabelle nicht lesen darf und
-- auch nicht soll. Die Funktion gibt ausschliesslich `boolean` zurück und
-- reicht nichts aus der Tabelle nach aussen.
--
-- EXECUTE auch für `anon`: Fehlt einer Rolle das Ausführungsrecht, BRICHT die
-- Policy-Auswertung ab, statt `false` zu liefern — der Unterschied zwischen
-- „kein Zugriff" und „Fehler 42501 auf jeder Seite". Das ist die Lehre aus dem
-- ACL-Vorfall vom 2026-08-23.

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_operators po
         WHERE po.user_id = (SELECT auth.uid()) AND po.active
    );
$fn$;

REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO anon, authenticated, service_role;


-- ── 3. Übernahme des Bestands ───────────────────────────────────────────────
--
-- Additiv und idempotent. Ohne diesen Schritt verlöre der vorhandene Super-
-- Admin beim ersten Sync seine Rechte — die Projektion würde ihn auf false
-- setzen, weil keine Zeile existiert.

INSERT INTO public.platform_operators (user_id, role, note)
SELECT p.id, 'super_admin',
       'Uebernommen aus profiles.is_super_admin bei Einfuehrung von platform_operators (ADR 0011, D5)'
  FROM public.profiles p
 WHERE p.is_super_admin
ON CONFLICT (user_id) DO NOTHING;


-- ── 4. Die Projektion ───────────────────────────────────────────────────────
--
-- Hält profiles.is_super_admin an platform_operators. Einbahnstrasse: Die
-- Tabelle bestimmt das Flag, nie umgekehrt.
--
-- Der Sitzungsmarker ist die Eintrittskarte durch den Wächter aus Abschnitt 5.
-- `set_config(..., true)` ist transaktionslokal; er gilt für dieses UPDATE und
-- nicht darüber hinaus.

CREATE OR REPLACE FUNCTION public.platform_operators_sync_profile_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
    ziel UUID := COALESCE(NEW.user_id, OLD.user_id);
    soll BOOLEAN;
BEGIN
    -- Bei DELETE ist die Zeile hier bereits fort, EXISTS liefert dann false.
    SELECT EXISTS (
        SELECT 1 FROM public.platform_operators po
         WHERE po.user_id = ziel AND po.active
    ) INTO soll;

    PERFORM set_config('rsd.platform_operator_sync', '1', true);
    UPDATE public.profiles
       SET is_super_admin = soll
     WHERE id = ziel
       AND is_super_admin IS DISTINCT FROM soll;
    PERFORM set_config('rsd.platform_operator_sync', '', true);

    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trig_platform_operators_sync ON public.platform_operators;
CREATE TRIGGER trig_platform_operators_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.platform_operators
    FOR EACH ROW EXECUTE FUNCTION public.platform_operators_sync_profile_flag();


-- ── 5. Der Wächter wird nachgezogen ─────────────────────────────────────────
--
-- Ersetzt die Fassung aus 20260915120000 (B1). Dort durfte `service_role` das
-- Flag noch direkt setzen — das war richtig, solange es den administrativen Weg
-- war. Ab jetzt ist es das nicht mehr: Direkt gesetzt würde das Flag von
-- platform_operators abweichen, und die Projektion wäre keine.
--
-- Die Sperre gilt deshalb für JEDE Rolle ausser der Projektion selbst. Sie
-- bleibt SECURITY INVOKER — als DEFINER wäre `current_user` immer `postgres`
-- und die Fehlermeldung nutzlos.
--
-- Notfallweg, bewusst dokumentiert statt versteckt: Wer als `postgres` wirklich
-- direkt schreiben muss, setzt in derselben Transaktion
-- `select set_config('rsd.platform_operator_sync','1',true);`. Das ist dann
-- eine sichtbare, absichtliche Umgehung und kein Versehen.

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
       AND coalesce(current_setting('rsd.platform_operator_sync', true), '') <> '1'
    THEN
        RAISE EXCEPTION
            'profiles.is_super_admin ist abgeleitet — Plattformrechte werden in public.platform_operators vergeben (Rolle: %)',
            current_user
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.profiles_guard_privileged_columns() IS
    'B1 + D5: profiles.is_super_admin ist weder clientseitig noch direkt setzbar. '
    'Einziger Weg ist public.platform_operators; der Sync-Trigger traegt den '
    'Sitzungsmarker rsd.platform_operator_sync.';

-- Der Trigger selbst ist unveraendert aus 20260915120000; hier nur zur
-- Sicherheit neu gesetzt, falls er fehlt.
DROP TRIGGER IF EXISTS trig_profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER trig_profiles_guard_privileged_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();
