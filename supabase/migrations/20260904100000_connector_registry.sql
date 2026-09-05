-- P2-1 · Connector-Rahmenwerk mit Durchsetzbarkeits-Klasse
--
-- ZWECK
--
-- Der Enforcement-Plan §1.4 nennt Fragmentierung als Hauptbefund: Angebundene
-- Systeme liegen heute in vier Tabellen nebeneinander — `integrations`
-- (globaler Katalog), `integration_configs` (Zugangsdaten je Mandant),
-- `integration_connectors` (ausgehende Ticket-/Meldewege) und
-- `enterprise_connectors` (Fremdsysteme). Keine davon sagt, **was die
-- Plattform an dieser Stelle wirklich durchsetzen kann**.
--
-- Diese Migration legt keine fünfte Insel an. Sie legt eine **Registratur**
-- darüber: eine Zeile je angebundenem System, die auf die Bestandszeile
-- zeigt und die governance-relevanten Tatsachen trägt — vor allem die
-- Durchsetzbarkeits-Klasse.
--
-- WARUM ADDITIV UND NICHT ERSETZEND: Die vier Tabellen tragen laufende
-- Kundendaten und werden von bestehendem Code geschrieben. Sie zu ersetzen
-- hiesse, funktionierende Pfade zu brechen — ausdrücklich untersagt.
--
-- SICHERHEITSRELEVANZ — der Kern dieser Migration
--
-- Die Klasse ist **keine Kundeneinstellung**. Dürfte ein Mandant seinen
-- Microsoft-365-Connector auf 'A' setzen, behauptete die Oberfläche eine
-- Blockierfähigkeit, die es nicht gibt. Genau das ist die Scheinimplementierung,
-- die der Auftrag untersagt. Deshalb:
--
--   * `connector_enforcement_class()` leitet die Klasse aus dem Systemtyp ab.
--   * Ein BEFORE-Trigger **überschreibt** jeden mitgeschickten Wert.
--   * Unbekannte Typen ergeben 'C', nicht 'A' — im Zweifel das Vorsichtigere.
--
-- EU AI Act Art. 13 (Transparenz über die Fähigkeiten des Systems) und Art. 14
-- (menschliche Aufsicht setzt voraus, dass der Mensch weiss, worauf er sich
-- verlassen kann). DSGVO Art. 5 Abs. 2 (Rechenschaftspflicht: eine zugesagte
-- technische Massnahme muss belegbar sein).
--
-- ⚠️ Die Zuordnung Systemtyp → Klasse steht doppelt: hier und in
-- `shared/enforcement-classes.ts`. Nie einseitig ändern —
-- `test/governance/enforcement-class-parity.test.ts` bricht sonst. Gleiches
-- Verfahren wie bei RFC-003 (CLAUDE.md §5).

BEGIN;

-- ============================================================
-- 1. Ableitung der Klasse — die einzige Stelle, die sie bestimmt
-- ============================================================

CREATE OR REPLACE FUNCTION public.connector_enforcement_class(p_system_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE p_system_type
        -- Klasse A — wir liegen im Datenpfad und können vorher anhalten.
        WHEN 'ai_gateway'     THEN 'A'
        WHEN 'agent_runtime'  THEN 'A'
        WHEN 'sdk_preflight'  THEN 'A'
        WHEN 'chatbot'        THEN 'A'
        WHEN 'whatsapp'       THEN 'A'
        WHEN 'voice'          THEN 'A'
        -- Klasse B — die Schranke am Übergang gehört uns.
        WHEN 'siteos_publish' THEN 'B'
        WHEN 'cicd_gate'      THEN 'B'
        -- Klasse C — wir erfahren es nachgelagert und können reagieren.
        WHEN 'microsoft365'   THEN 'C'
        WHEN 'crm'            THEN 'C'
        WHEN 'erp'            THEN 'C'
        WHEN 'warenwirtschaft' THEN 'C'
        WHEN 'logistik'       THEN 'C'
        WHEN 'ticketing'      THEN 'C'
        WHEN 'messaging'      THEN 'C'
        WHEN 'custom_api'     THEN 'C'
        -- Klasse D — kein technischer Zugriff.
        WHEN 'browser_direct' THEN 'D'
        -- Unbekannt: vorsichtig. Ein unbekanntes System ist im Zweifel eines,
        -- das wir nur beobachten können.
        ELSE 'C'
    END;
$$;

COMMENT ON FUNCTION public.connector_enforcement_class(TEXT) IS
    'Leitet die Durchsetzbarkeits-Klasse (A/B/C/D) aus dem Systemtyp ab. '
    'Einzige Quelle in der Datenbank; Zwilling in shared/enforcement-classes.ts, '
    'gehalten durch test/governance/enforcement-class-parity.test.ts.';

REVOKE ALL ON FUNCTION public.connector_enforcement_class(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connector_enforcement_class(TEXT)
    TO authenticated, service_role;

-- ============================================================
-- 2. Die Registratur
-- ============================================================

CREATE TABLE IF NOT EXISTS public.connector_registry (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Was für ein System. Bestimmt die Klasse und ist damit das
    -- governance-relevanteste Feld der Zeile.
    system_type    text NOT NULL,
    display_name   text NOT NULL,

    -- Zeiger auf die Bestandszeile, die dieser Eintrag beschreibt. Bewusst
    -- ohne Fremdschlüssel: Die vier Quelltabellen haben unterschiedliche
    -- Lebenszyklen, und ein FK auf eine von ihnen würde die Registratur an
    -- eine davon fesseln. Verwaiste Zeiger sind hier das kleinere Übel als
    -- eine Registratur, die nur die Hälfte abbilden kann.
    source_table   text CHECK (source_table IS NULL OR source_table IN (
                       'integration_configs',
                       'integration_connectors',
                       'enterprise_connectors',
                       'ai_systems'
                   )),
    source_id      uuid,

    -- Wie authentifiziert sich die Verbindung.
    auth_kind      text NOT NULL DEFAULT 'unknown'
                   CHECK (auth_kind IN ('api_key', 'oauth2', 'webhook', 'mtls', 'none', 'unknown')),

    -- Umfang der Anbindung in Worten des Kunden ("Postfach, Kalender"),
    -- nicht in Scopes des Anbieters — die Zeile wird von Menschen gelesen.
    scope          text,

    status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('connected', 'pending', 'error', 'disabled')),
    last_sync_at   timestamptz,
    last_error     text,

    -- Wer verantwortet diese Anbindung. Zeigt auf das Subjektmodell aus P1-1,
    -- damit „Verantwortlicher" dieselbe Bedeutung hat wie überall sonst.
    owner_principal_id uuid REFERENCES public.principals(id) ON DELETE SET NULL,

    -- ABGELEITET, NIE EINGEGEBEN. Der Trigger unten setzt den Wert; ein
    -- mitgeschickter wird verworfen. Als Spalte gespeichert statt berechnet,
    -- damit danach gefiltert und indiziert werden kann.
    enforcement_class text NOT NULL DEFAULT 'C'
                      CHECK (enforcement_class IN ('A', 'B', 'C', 'D')),

    notes          text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.connector_registry IS
    'P2-1: Eine Zeile je angebundenem System, mit der Durchsetzbarkeits-Klasse. '
    'Legt sich additiv über die vier Bestandstabellen, ersetzt keine davon.';
COMMENT ON COLUMN public.connector_registry.enforcement_class IS
    'Abgeleitet aus system_type, nie vom Client gesetzt — siehe Trigger '
    'connector_registry_derive_class_trg.';

-- Dieselbe Bestandszeile darf nicht zweimal registriert werden; sonst stünden
-- zwei Klassen für dasselbe System nebeneinander.
CREATE UNIQUE INDEX IF NOT EXISTS connector_registry_source_uidx
    ON public.connector_registry (tenant_id, source_table, source_id)
    WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS connector_registry_tenant_idx
    ON public.connector_registry (tenant_id, enforcement_class);
CREATE INDEX IF NOT EXISTS connector_registry_status_idx
    ON public.connector_registry (tenant_id, status);

-- ============================================================
-- 3. Der Trigger, der die Klasse unfälschbar macht
-- ============================================================

CREATE OR REPLACE FUNCTION public.connector_registry_derive_class()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Bewusst ohne Rücksicht auf NEW.enforcement_class: Ein mitgeschickter
    -- Wert wird nicht geprüft, sondern ersetzt. Prüfen hiesse, dem Aufrufer
    -- die Möglichkeit zu lassen, es richtig zu treffen und dabei zu lügen.
    NEW.enforcement_class := public.connector_enforcement_class(NEW.system_type);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connector_registry_derive_class_trg ON public.connector_registry;
CREATE TRIGGER connector_registry_derive_class_trg
    BEFORE INSERT OR UPDATE ON public.connector_registry
    FOR EACH ROW EXECUTE FUNCTION public.connector_registry_derive_class();

REVOKE ALL ON FUNCTION public.connector_registry_derive_class() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connector_registry_derive_class() TO service_role;

-- ============================================================
-- 4. RLS — lesen darf das Team, ändern nur owner/admin
-- ============================================================
--
-- WARUM Schreiben nur für owner/admin: Welche Systeme angebunden sind und wer
-- sie verantwortet, ist Governance-Stammdatum. Es steht in Prüfberichten und
-- begründet, warum eine Regel greift oder nicht — kein Selbstbedienungsfeld.

ALTER TABLE public.connector_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_registry_tenant_select ON public.connector_registry;
CREATE POLICY connector_registry_tenant_select
    ON public.connector_registry FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS connector_registry_admin_insert ON public.connector_registry;
CREATE POLICY connector_registry_admin_insert
    ON public.connector_registry FOR INSERT
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS connector_registry_admin_update ON public.connector_registry;
CREATE POLICY connector_registry_admin_update
    ON public.connector_registry FOR UPDATE
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS connector_registry_admin_delete ON public.connector_registry;
CREATE POLICY connector_registry_admin_delete
    ON public.connector_registry FOR DELETE
    USING (public.is_tenant_owner_or_admin(tenant_id));

-- ============================================================
-- 5. Überblick je Mandant — was kann hier wirklich durchgesetzt werden?
-- ============================================================
--
-- WOZU eine eigene Funktion: Die Frage „wie viele unserer Anbindungen können
-- eine Aktion tatsächlich verhindern?" ist die erste, die ein Prüfer stellt.
-- Sie soll nicht jedes Mal im Frontend zusammengerechnet werden, wo eine
-- falsche Formel unbemerkt bliebe.

CREATE OR REPLACE FUNCTION public.connector_enforcement_summary(p_tenant_id UUID)
RETURNS TABLE (
    enforcement_class text,
    kann_blockieren   boolean,
    anzahl            bigint,
    verbunden         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        c.enforcement_class,
        c.enforcement_class IN ('A', 'B') AS kann_blockieren,
        count(*)                          AS anzahl,
        count(*) FILTER (WHERE c.status = 'connected') AS verbunden
    FROM public.connector_registry c
    WHERE c.tenant_id = p_tenant_id
      -- Mitgliedschaft im SECURITY-DEFINER-Pfad selbst prüfen: Die Funktion
      -- umgeht RLS, also muss sie die Grenze wieder herstellen.
      AND public.is_tenant_member(p_tenant_id)
    GROUP BY c.enforcement_class
    ORDER BY c.enforcement_class;
$$;

COMMENT ON FUNCTION public.connector_enforcement_summary(UUID) IS
    'Zaehlt die Anbindungen eines Mandanten je Durchsetzbarkeits-Klasse. '
    'Prueft die Mitgliedschaft selbst, weil SECURITY DEFINER die RLS umgeht.';

REVOKE ALL ON FUNCTION public.connector_enforcement_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connector_enforcement_summary(UUID)
    TO authenticated, service_role;

COMMIT;
