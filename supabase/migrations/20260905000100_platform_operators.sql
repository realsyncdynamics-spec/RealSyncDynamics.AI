-- ADR 0011, D5 — eigene Quelle fuer die Plattform-Berechtigung.
--
-- Entscheidung: Die Plattform-Berechtigung bekommt eine eigene Tabelle statt
-- einer weiteren Spalte auf public.profiles. profiles beschreibt den Benutzer
-- im normalen Produktkontext; der Plattform-Operator ist eine privilegierte
-- interne Berechtigung, die gerade NICHT aus einem Tenant-Kontext abgeleitet
-- werden darf. Die Sicherheitsgrenze wird damit explizit:
--
--     is_platform_operator()  →  platform_operators  →  auth.uid()
--
-- und nicht:
--
--     tenant_id  →  profiles  →  irgendwelche Tenant-Rollen
--
-- Diese Migration ist die erste der Agenten-Organisationsebene, obwohl D4 die
-- Reihenfolge mit org_units beginnen laesst: Die erste Platform-Scope-Policy
-- ruft is_platform_operator() auf, die Funktion muss also vorher existieren.
--
-- EU AI Act Art. 14 (menschliche Aufsicht): Wer den Platform Scope einsehen
-- darf, ist eine Aufsichtsentscheidung — sie gehoert in eine Quelle, die der
-- Beaufsichtigte nicht selbst beschreiben kann (siehe ADR 0011, Befund B1).

CREATE TABLE IF NOT EXISTS public.platform_operators (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Das Rollen-Vokabular ist in ADR 0011 ausdruecklich offen. Deshalb hier
    -- bewusst KEIN CHECK-Constraint: Er wuerde eine Entscheidung vorwegnehmen,
    -- die noch aussteht. is_platform_operator() wertet role heute nicht aus.
    role        TEXT NOT NULL DEFAULT 'operator',
    active      BOOLEAN NOT NULL DEFAULT true,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.platform_operators IS
    'Plattform-Operatoren (RSD-intern). Quelle fuer is_platform_operator(). '
    'Bewusst ohne tenant_id: eine Plattform-Berechtigung ist kein Tenant-Datum. '
    'ADR 0011, D5.';
COMMENT ON COLUMN public.platform_operators.active IS
    'Entzug ohne Loeschen — die Zeile bleibt als Nachweis erhalten, wer die '
    'Berechtigung wann hatte (Pruefpfad).';

-- ── RLS: an, und bewusst OHNE jede Client-Policy ─────────────────────────────
-- Eine Berechtigungsquelle, die ihr eigenes Subjekt beschreiben darf, ist
-- keine Sicherheitsgrenze — dann waere die Rechteausweitung aus Befund B1 nur
-- um eine Tabelle weitergewandert. Gepflegt wird ausschliesslich per
-- Service-Role (Edge Function) oder Migration.
--
-- RLS ohne Policy heisst fuer anon/authenticated: kein Lesen, kein Schreiben.
-- Das ist hier kein vergessener Baustein, sondern der Zweck. Der Zugriff der
-- Clients laeuft ueber is_platform_operator(), das nur boolean zurueckgibt und
-- keine Zeile preisgibt.
ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

-- Explizit, weil Supabase Default-Privileges neuen Tabellen in `public`
-- automatisch Rechte fuer anon/authenticated geben. RLS wuerde sie ohnehin
-- abweisen; der REVOKE nimmt die zweite Ebene dazu.
REVOKE ALL ON public.platform_operators FROM anon;
REVOKE ALL ON public.platform_operators FROM authenticated;
GRANT ALL ON public.platform_operators TO service_role;

-- ── is_platform_operator() ───────────────────────────────────────────────────
-- Muster identisch zu public.is_tenant_member (20260723000001): STABLE,
-- SECURITY DEFINER, gesetzter search_path. SECURITY DEFINER ist noetig, weil
-- die Tabelle fuer Clients gesperrt ist — die Funktion ist der einzige Weg
-- daran vorbei, und sie gibt ausschliesslich boolean zurueck.
CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_operators po
        WHERE po.user_id = (SELECT auth.uid())
          AND po.active
    );
$fn$;

COMMENT ON FUNCTION public.is_platform_operator() IS
    'True gdw. auth.uid() ein aktiver Plattform-Operator ist. Grobkoernig boolean: '
    'role wird nicht ausgewertet, feinere Pruefungen bekommen eigene Funktionen. '
    'ADR 0011, D5.';

-- EXECUTE auch fuer anon — bewusst, und aus Erfahrung: Wird eine Policy fuer
-- eine Rolle ausgewertet, die die Funktion nicht ausfuehren darf, bricht die
-- Abfrage mit "permission denied for function" ab, statt false zu liefern.
-- Genau das war das Schadensbild des ACL-Vorfalls vom 2026-08-23. Fuer anon
-- ist auth.uid() NULL, das Ergebnis also immer false — kein Zugewinn an
-- Rechten, aber ein sauberer Fehlerfall.
REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO anon, authenticated, service_role;

-- ── Uebernahme des Bestands ──────────────────────────────────────────────────
-- Damit die neue Quelle vom ersten Moment an denselben Stand hat wie die alte.
-- role = 'super_admin' spiegelt die Herkunft (ADR 0005) und dokumentiert sie;
-- ausgewertet wird sie heute nicht. Idempotent.
INSERT INTO public.platform_operators (user_id, role, note)
SELECT p.id, 'super_admin', 'Uebernommen aus profiles.is_super_admin (ADR 0011, D5)'
FROM public.profiles p
WHERE p.is_super_admin
ON CONFLICT (user_id) DO NOTHING;
