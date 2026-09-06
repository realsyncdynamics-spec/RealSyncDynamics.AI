-- P2-2 · Microsoft 365 als erste echte Fremdintegration (Durchsetzbarkeits-Klasse C)
--
-- ZWECK
--
-- Der Enforcement-Plan §5.4 fuehrt P2-2 als „Graph-OAuth, Audit-Log-Ingest,
-- Reaktion statt Block. Ehrlich als nachgelagert ausgewiesen". Genau in dieser
-- Reihenfolge liegt der Schwerpunkt: Das Schwierige an dieser Anbindung ist
-- nicht das Abholen der Daten, sondern die Ehrlichkeit ueber das, was danach
-- moeglich ist.
--
-- WAS MICROSOFT 365 IST UND WAS NICHT
--
-- Microsoft Graph liefert Prueferereignisse **nachdem** die Handlung geschehen
-- ist. Es gibt in diesem Produkt keinen Punkt, an dem eine Datei-Freigabe oder
-- eine Anmeldung angehalten werden koennte — dafuer braeuchte es Microsoft
-- Purview DLP, einen Netzwerkproxy oder eine Geraeteebene. Deshalb steht
-- `microsoft365` in `connector_enforcement_class()` auf 'C' und deshalb sind
-- hier nur `log_only`, `warn` und `react` ehrliche Verdikte.
--
-- SICHERHEITSRELEVANZ
--
-- 1. Zugangsdaten: Ein Graph-App-Geheimnis oeffnet das gesamte Postfach- und
--    Dateisystem eines Kunden. Es liegt hier ausschliesslich AES-256-GCM
--    versiegelt (`credentials_enc`, `_shared/secretBox.ts`) und ist per
--    Spaltenrecht fuer Clients nicht lesbar — dieselbe Konstruktion wie bei
--    `integration_configs` (Migration 20260824110000, Plan P0-1). Es gibt
--    keinen Klartext-Fallback.
-- 2. Herabstufung des Verdikts: Ein `block` des PDP kann hier nicht eingeloest
--    werden. Die Spalte `verdict_downgraded_from` haelt fest, dass eine Regel
--    sperren wollte und die Klasse es nicht hergab. Ohne dieses Feld saehe
--    „die Regel hat nicht gegriffen" genauso aus wie „es gab keine Regel" —
--    dieselbe K1-Fehlerklasse wie beim Publish Gate (P2-3).
-- 3. Ein CHECK erzwingt, dass in dieser Tabelle nie ein blockierendes Verdikt
--    als angewandt gespeichert wird. Die Ehrlichkeit haengt damit nicht am
--    Wohlverhalten des aufrufenden Codes.
--
-- EU AI Act Art. 12 (Aufzeichnung), Art. 13 (Transparenz ueber die
-- Faehigkeiten des Systems), Art. 14 (menschliche Aufsicht setzt Wissen
-- darueber voraus, worauf man sich verlassen kann). DSGVO Art. 5 Abs. 1
-- lit. c (Datenminimierung — es werden Merkmale gespeichert, keine Inhalte),
-- Art. 5 Abs. 2 (Rechenschaftspflicht), Art. 32 (Stand der Technik).
--
-- ADDITIV: Keine bestehende Tabelle wird geaendert; zwei CHECK-Bedingungen
-- werden **erweitert** (nie verengt), damit die neuen Quellen ueberhaupt
-- eingetragen werden koennen.

BEGIN;

-- ============================================================
-- 1. Die Verbindung — Zugangsdaten versiegelt, nie im Client
-- ============================================================

CREATE TABLE IF NOT EXISTS public.m365_connections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Die Azure-Mandantenkennung des Kunden (GUID) und die Anwendungs-ID der
    -- registrierten App. Beides ist kein Geheimnis: Ohne das Geheimnis ist
    -- damit nichts anzufangen, und der Kunde muss beides sehen koennen, um
    -- seine Einrichtung zu pruefen.
    azure_tenant_id text NOT NULL,
    client_id       text NOT NULL,

    -- Das App-Geheimnis, AES-256-GCM versiegelt. Format v1:<iv>:<ct>.
    -- Fuer Clients per Spaltenrecht unerreichbar (siehe unten).
    credentials_enc text,

    -- Der Umfang in Worten des Kunden, nicht in Graph-Scopes — die Zeile wird
    -- von Menschen gelesen (dieselbe Ueberlegung wie connector_registry.scope).
    scope           text,

    -- Welche Graph-Protokolle abgeholt werden. Bewusst eine Auswahl statt
    -- „alles": Jeder zusaetzliche Strom ist zusaetzliche Verarbeitung
    -- personenbezogener Daten und gehoert bewusst eingeschaltet.
    streams         text[] NOT NULL DEFAULT ARRAY['directory_audits']::text[],

    -- Die Hauptdomaene des Mandanten, um interne von externen Handelnden zu
    -- unterscheiden. Wird beim Verbindungstest aus Graph gelesen, nicht
    -- eingegeben — eine eingegebene Domaene koennte jeden Externen zum
    -- Internen erklaeren.
    primary_domain  text,

    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('connected', 'pending', 'error', 'disabled')),
    last_sync_at    timestamptz,
    last_error      text,

    -- Zeiger auf die Registratur aus P2-1. Dort steht die Klasse; hier stehen
    -- die Betriebsdaten. Kein zweiter Ort fuer dieselbe Aussage.
    registry_id     uuid REFERENCES public.connector_registry(id) ON DELETE SET NULL,

    created_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- Eine Verbindung je Azure-Mandant und Kunde. Zwei Verbindungen auf
    -- dasselbe Azure-Verzeichnis wuerden dieselben Ereignisse doppelt holen
    -- und zweimal bewerten.
    UNIQUE (tenant_id, azure_tenant_id)
);

COMMENT ON TABLE public.m365_connections IS
    'P2-2: Microsoft-365-Anbindung je Mandant. Klasse C (nachgelagert) — '
    'die Klasse selbst steht in connector_registry, abgeleitet aus dem Systemtyp.';
COMMENT ON COLUMN public.m365_connections.credentials_enc IS
    'AES-256-GCM-Siegel des App-Geheimnisses. Fuer Clients per Spaltenrecht '
    'nicht lesbar; entsiegelt wird ausschliesslich in Edge Functions.';

CREATE INDEX IF NOT EXISTS m365_connections_tenant_idx
    ON public.m365_connections (tenant_id, status);

ALTER TABLE public.m365_connections ENABLE ROW LEVEL SECURITY;

-- Lesen darf das Team (ohne Geheimnis, siehe Spaltenrechte), schreiben nur
-- owner/admin: Welches Fremdsystem angebunden ist, ist Governance-Stammdatum
-- und steht in Pruefberichten — kein Selbstbedienungsfeld.
DROP POLICY IF EXISTS m365_connections_tenant_select ON public.m365_connections;
CREATE POLICY m365_connections_tenant_select
    ON public.m365_connections FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS m365_connections_admin_write ON public.m365_connections;
CREATE POLICY m365_connections_admin_write
    ON public.m365_connections FOR ALL
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

-- Spaltenrechte: `credentials_enc` erreicht einen Client nie — auch nicht
-- versiegelt. Ein Siegel im Browser waere ein Angriffsziel ohne Nutzen, denn
-- entsiegeln kann es dort ohnehin niemand. Anlegen und Aendern laeuft
-- ausschliesslich ueber die Edge Function `microsoft365-connect`.
REVOKE ALL ON public.m365_connections FROM anon;
REVOKE SELECT, INSERT, UPDATE ON public.m365_connections FROM authenticated;
GRANT SELECT (id, tenant_id, azure_tenant_id, client_id, scope, streams,
              primary_domain, status, last_sync_at, last_error, registry_id,
              created_by, created_at, updated_at)
    ON public.m365_connections TO authenticated;

-- ============================================================
-- 2. Der Fortschrittszeiger je Protokollstrom
-- ============================================================
--
-- WOZU eine eigene Tabelle statt einer Spalte an der Verbindung: Die Stroeme
-- laufen unabhaengig. Ein Fehler beim Anmelde-Protokoll darf nicht dazu
-- fuehren, dass die Verzeichnis-Ereignisse erneut ab dem Anfang geholt werden.

CREATE TABLE IF NOT EXISTS public.m365_sync_state (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id  uuid NOT NULL REFERENCES public.m365_connections(id) ON DELETE CASCADE,
    stream         text NOT NULL CHECK (stream IN ('directory_audits', 'sign_ins')),

    -- Zeitstempel des zuletzt gesehenen Ereignisses. Der naechste Lauf holt
    -- ab genau diesem Punkt; die Eindeutigkeit auf `graph_id` faengt die
    -- Ereignisse an der Grenze ab, die dieselbe Sekunde tragen.
    watermark_at   timestamptz,
    last_run_at    timestamptz,
    last_error     text,
    events_seen    bigint NOT NULL DEFAULT 0,

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    UNIQUE (connection_id, stream)
);

COMMENT ON TABLE public.m365_sync_state IS
    'P2-2: Fortschrittszeiger je Protokollstrom einer Microsoft-365-Verbindung.';

ALTER TABLE public.m365_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS m365_sync_state_tenant_select ON public.m365_sync_state;
CREATE POLICY m365_sync_state_tenant_select
    ON public.m365_sync_state FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Geschrieben wird ausschliesslich vom Abholjob (service_role). Ein Client,
-- der den Zeiger vorstellen koennte, koennte Ereignisse ueberspringen lassen —
-- fuer ein Pruefprotokoll waere das die wirksamste Manipulation ueberhaupt.
REVOKE INSERT, UPDATE, DELETE ON public.m365_sync_state FROM authenticated, anon;
GRANT SELECT ON public.m365_sync_state TO authenticated;

-- ============================================================
-- 3. Die abgeholten Ereignisse samt Bewertung
-- ============================================================
--
-- DATENMINIMIERUNG: Hier stehen Merkmale, keine Inhalte. Kein Betreff, kein
-- Dateiinhalt, kein Anzeigename. `actor_ref` ist ein SHA-256 des UPN — stabil
-- genug, um Haeufungen zu erkennen, ohne die Person im Klartext zu fuehren.
-- Wer Klartext braucht, findet ihn im Quellsystem, wo er ohnehin liegt.

CREATE TABLE IF NOT EXISTS public.m365_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id   uuid NOT NULL REFERENCES public.m365_connections(id) ON DELETE CASCADE,

    -- Die Kennung des Ereignisses bei Microsoft. Traegt die Idempotenz des
    -- ganzen Abholpfads: Derselbe Lauf zweimal ausgefuehrt darf nicht zwei
    -- Bewertungen desselben Vorgangs erzeugen.
    graph_id        text NOT NULL,
    stream          text NOT NULL CHECK (stream IN ('directory_audits', 'sign_ins')),

    occurred_at     timestamptz NOT NULL,
    ingested_at     timestamptz NOT NULL DEFAULT now(),

    -- Normalisierte Taetigkeit aus einer festen Liste, NICHT der Rohtext von
    -- Microsoft. Der Rohtext ist von Nutzern beeinflussbar (Dateinamen,
    -- Anzeigenamen) und darf keine Entscheidungsgrundlage werden — K6.
    activity_kind   text NOT NULL,
    result          text NOT NULL DEFAULT 'unknown'
                    CHECK (result IN ('success', 'failure', 'unknown')),

    -- Pseudonym des Handelnden (SHA-256 des UPN) und die abgeleitete Frage,
    -- ob er ausserhalb der Hauptdomaene des Mandanten steht.
    actor_ref       text,
    actor_external  boolean NOT NULL DEFAULT false,
    target_count    integer NOT NULL DEFAULT 0,

    -- Erkannte Signalnamen (aus _shared/pdp/classify.ts), nie Treffer.
    signals         text[] NOT NULL DEFAULT '{}',
    classification  text,

    -- ── Die Bewertung ────────────────────────────────────────────────────
    --
    -- `verdict` ist das, was hier TATSAECHLICH gilt. `verdict_downgraded_from`
    -- ist das, was der PDP entschieden hat, wenn die Klasse es nicht hergab.
    verdict         text NOT NULL DEFAULT 'log_only'
                    CHECK (verdict IN ('log_only', 'warn', 'react')),
    verdict_downgraded_from text
                    CHECK (verdict_downgraded_from IS NULL
                           OR verdict_downgraded_from IN ('block', 'require_approval')),
    pdp_status      text NOT NULL DEFAULT 'consulted'
                    CHECK (pdp_status IN ('consulted', 'not_enforcing', 'unavailable')),
    reasons         jsonb NOT NULL DEFAULT '[]',
    matched_policy_ids uuid[] NOT NULL DEFAULT '{}',

    -- Der ausgeloeste Vorgang, sofern reagiert wurde.
    incident_id     uuid REFERENCES public.governance_incidents(id) ON DELETE SET NULL,

    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, graph_id)
);

COMMENT ON TABLE public.m365_audit_events IS
    'P2-2: Nachgelagert festgestellte Microsoft-365-Ereignisse mit ihrer '
    'Bewertung. Merkmale statt Inhalte (DSGVO Art. 5 Abs. 1 lit. c).';
COMMENT ON COLUMN public.m365_audit_events.verdict_downgraded_from IS
    'Gesetzt, wenn der PDP block/require_approval entschieden hat und die '
    'Klasse C das nicht einloesen kann. Ohne dieses Feld saehe eine nicht '
    'durchsetzbare Regel wie eine nicht vorhandene aus.';

-- Der Kern der Ehrlichkeit, maschinell erzwungen: In dieser Tabelle kann
-- niemals ein blockierendes Verdikt als angewandt stehen. Selbst wenn der
-- aufrufende Code es versuchte, weist die Datenbank es ab — dieselbe
-- Ueberlegung wie beim CHECK auf siteos_publish_evaluations (P2-3) und beim
-- Klassen-Trigger auf connector_registry (P2-1).
ALTER TABLE public.m365_audit_events
    DROP CONSTRAINT IF EXISTS m365_audit_events_class_c_honest;
ALTER TABLE public.m365_audit_events
    ADD CONSTRAINT m365_audit_events_class_c_honest
    CHECK (verdict IN ('log_only', 'warn', 'react'));

-- Eine Herabstufung ohne Reaktion waere folgenlos: Wenn eine Regel sperren
-- wollte, ist die schwaechste ehrliche Antwort die Reaktion, nicht das
-- Wegloggen.
ALTER TABLE public.m365_audit_events
    DROP CONSTRAINT IF EXISTS m365_audit_events_downgrade_reacts;
ALTER TABLE public.m365_audit_events
    ADD CONSTRAINT m365_audit_events_downgrade_reacts
    CHECK (verdict_downgraded_from IS NULL OR verdict = 'react');

CREATE INDEX IF NOT EXISTS m365_audit_events_tenant_time_idx
    ON public.m365_audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS m365_audit_events_verdict_idx
    ON public.m365_audit_events (tenant_id, verdict)
    WHERE verdict <> 'log_only';
CREATE INDEX IF NOT EXISTS m365_audit_events_downgrade_idx
    ON public.m365_audit_events (tenant_id, occurred_at DESC)
    WHERE verdict_downgraded_from IS NOT NULL;

ALTER TABLE public.m365_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS m365_audit_events_tenant_select ON public.m365_audit_events;
CREATE POLICY m365_audit_events_tenant_select
    ON public.m365_audit_events FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Kein INSERT/UPDATE/DELETE fuer Clients — bewusst und ohne Ausnahme.
-- Ein Pruefprotokoll, das der Geprueste bearbeiten kann, ist keines.
-- Das Lesen wird ausdruecklich erteilt statt auf die Default-Privilegien der
-- Plattform zu vertrauen: Die RLS-Policy oben ist wirkungslos, wenn die Rolle
-- gar kein SELECT-Recht auf der Tabelle hat — und ob sie es hat, haengt an
-- einer Einstellung ausserhalb dieser Migration.
REVOKE INSERT, UPDATE, DELETE ON public.m365_audit_events FROM authenticated, anon;
GRANT SELECT ON public.m365_audit_events TO authenticated;

-- ============================================================
-- 4. Zwei CHECK-Bedingungen erweitern (nie verengen)
-- ============================================================

-- 4a. `governance_events.event_source` kennt Microsoft 365 noch nicht.
--     Ohne diese Erweiterung koennte eine Reaktion keinen Vorgang anlegen,
--     denn `governance_incidents.event_id` ist NOT NULL.
DO $$
DECLARE
    v_name text;
BEGIN
    -- Den Namen NICHT raten: Die urspruengliche Bedingung wurde als
    -- Spalten-CHECK in CREATE TABLE geschrieben und traegt einen von
    -- PostgreSQL vergebenen Namen. Wer hier einen Namen annimmt und daneben
    -- liegt, laesst die alte Bedingung stehen — und die weist 'microsoft365'
    -- weiterhin ab, waehrend die Migration gruen durchlaeuft.
    FOR v_name IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.governance_events'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%website_scanner%'
    LOOP
        EXECUTE format('ALTER TABLE public.governance_events DROP CONSTRAINT %I', v_name);
    END LOOP;

    ALTER TABLE public.governance_events
        ADD CONSTRAINT governance_events_event_source_check
        CHECK (event_source IN (
            'website_scanner', 'browser_extension', 'sdk', 'api',
            'github', 'ci_cd', 'manual', 'agent_runtime',
            -- neu mit P2-2
            'microsoft365'
        ));
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'governance_events fehlt — CHECK-Erweiterung uebersprungen';
END $$;

-- 4b. `pdp_shadow_log.source` um den neuen Kanal erweitern. Ohne das sammelt
--     der Beobachtungsbetrieb fuer Microsoft 365 nichts — genau der Fehler,
--     der beim Publish Gate erst nach Tagen auffiel (Plan §10).
DO $$
DECLARE
    v_name text;
BEGIN
    FOR v_name IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.pdp_shadow_log'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%telemetry-ai-event%'
    LOOP
        EXECUTE format('ALTER TABLE public.pdp_shadow_log DROP CONSTRAINT %I', v_name);
    END LOOP;

    ALTER TABLE public.pdp_shadow_log
        ADD CONSTRAINT pdp_shadow_log_source_check
        CHECK (source IN (
            'telemetry-ai-event', 'governance-ingest', 'ai-gateway',
            'siteos_publish',
            'bot-chat', 'bot-whatsapp', 'bot-voice',
            -- neu mit P2-2
            'm365-audit'
        ));
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'pdp_shadow_log fehlt — CHECK-Erweiterung uebersprungen';
END $$;

-- ============================================================
-- 5. Ueberblick: was hat die Anbindung festgestellt?
-- ============================================================
--
-- WOZU in der Datenbank: Die Frage „wie oft wollte eine Regel sperren, konnte
-- es hier aber nicht?" ist die ehrlichste Kennzahl dieser Integration und die
-- erste, die ein Pruefer stellt. Im Frontend zusammengerechnet bliebe eine
-- falsche Formel unbemerkt.

CREATE OR REPLACE FUNCTION public.m365_reaction_summary(
    p_tenant_id UUID,
    p_since     TIMESTAMPTZ DEFAULT (now() - interval '30 days')
)
RETURNS TABLE (
    verdict          text,
    anzahl           bigint,
    herabgestuft     bigint,
    letztes_ereignis timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        e.verdict,
        count(*)                                                    AS anzahl,
        count(*) FILTER (WHERE e.verdict_downgraded_from IS NOT NULL) AS herabgestuft,
        max(e.occurred_at)                                          AS letztes_ereignis
    FROM public.m365_audit_events e
    WHERE e.tenant_id = p_tenant_id
      AND e.occurred_at >= p_since
      -- SECURITY DEFINER umgeht RLS, also die Grenze hier selbst herstellen.
      AND public.is_tenant_member(p_tenant_id)
    GROUP BY e.verdict
    ORDER BY e.verdict;
$$;

COMMENT ON FUNCTION public.m365_reaction_summary(UUID, TIMESTAMPTZ) IS
    'Zaehlt die nachgelagerten Microsoft-365-Bewertungen je Verdikt und weist '
    'aus, wie viele davon eine nicht einloesbare Sperre waren.';

REVOKE ALL ON FUNCTION public.m365_reaction_summary(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.m365_reaction_summary(UUID, TIMESTAMPTZ)
    TO authenticated, service_role;

COMMIT;
