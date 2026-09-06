-- Beobachtungsbetrieb auswertbar machen — die Grundlage der Umschaltentscheidung
--
-- ZWECK
--
-- Der Enforcement-Plan §7 macht den Umschaltzeitpunkt der sechs Schalter von
-- einer Auswertung des `pdp_shadow_log` abhaengig: „Vor dem Umschalten
-- `pdp_shadow_log` auswerten". Sechs Kanaele schreiben inzwischen hinein
-- (ai-gateway, governance-ingest, telemetry-ai-event, siteos_publish, die drei
-- Bot-Kanaele und m365-audit) — **gelesen hat ihn bis heute nichts**: kein
-- Code, keine Oberflaeche, kein Skript. Die Entscheidung, an der alles haengt,
-- hatte damit keine Datengrundlage.
--
-- DER KERN DIESER MIGRATION IST EINE EHRLICHKEITSREGEL
--
-- Ein leeres Protokoll bedeutet **nicht** „keine Abweichungen". Es bedeutet
-- zuerst „nachsehen, ob ueberhaupt geschrieben wird". Genau dieser Fall ist
-- am 2026-09-04 eingetreten: Der Publish Gate rief `logShadowComparison`
-- falsch auf, der Fehler verschwand in einem `catch`, und der
-- Beobachtungsbetrieb sammelte tagelang nichts, ohne dass es auffiel.
-- Haette damals jemand auf eine Auswertung geschaut, die stillschweigend nur
-- vorhandene Zeilen gruppiert, haette er „keine Divergenzen" gelesen und
-- umgeschaltet.
--
-- Deshalb geht `pdp_shadow_readiness()` **von der Kanalliste aus, nicht von
-- den Zeilen**: Jeder Kanal, der schreiben koennte, erscheint in der Antwort —
-- mit `beobachtet = false`, wenn er es nie getan hat. Ein Kanal ohne Eintrag
-- ist ein unbeobachteter Kanal, kein unauffaelliger.
--
-- WARUM DIE RICHTUNG DER ABWEICHUNG MITGEZAEHLT WIRD
--
-- „12 Divergenzen" ist keine Entscheidungsgrundlage. Die Frage ist, in welche
-- Richtung: Ist v2 strenger, kostet das Umschalten Arbeitsfaehigkeit (R5,
-- Schatten-IT). Ist v2 lockerer, ist die heutige Zusage bereits ungedeckt —
-- das ist der schwerere Fall und gehoert getrennt gezaehlt.
--
-- EU AI Act Art. 12 (Aufzeichnung) und Art. 14 (menschliche Aufsicht setzt
-- voraus, dass der Mensch die Grundlage seiner Entscheidung sieht).
-- DSGVO Art. 5 Abs. 2 (Rechenschaftspflicht).
--
-- ADDITIV: Keine bestehende Tabelle, Spalte oder Policy wird veraendert.

BEGIN;

-- ============================================================
-- 1. Strenge eines Verdikts — die Grundlage der Richtungsaussage
-- ============================================================
--
-- Beide Engines schreiben ihr eigenes Vokabular in das Protokoll. Um „strenger"
-- von „lockerer" zu unterscheiden, braucht es eine Ordnung ueber beide.
-- Unbekanntes ergibt NULL, nicht 0: Ein nicht einordenbares Verdikt als
-- „harmlos" zu zaehlen waere die stille Variante des Fehlers, den diese
-- Migration verhindern soll.

CREATE OR REPLACE FUNCTION public.pdp_verdict_rank(p_verdict TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE lower(coalesce(p_verdict, ''))
        WHEN 'allow'            THEN 0
        WHEN 'log'              THEN 1
        WHEN 'log_only'         THEN 1
        WHEN 'warn'             THEN 2
        WHEN 'react'            THEN 2  -- Klasse C: sichtbar, aber nicht sperrend
        WHEN 'require_approval' THEN 3
        WHEN 'block'            THEN 4
        ELSE NULL
    END;
$$;

COMMENT ON FUNCTION public.pdp_verdict_rank(TEXT) IS
    'Ordnet Verdikte beider Engines nach Strenge (allow < log < warn < '
    'require_approval < block). Unbekanntes ergibt NULL, nie 0.';

REVOKE ALL ON FUNCTION public.pdp_verdict_rank(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdp_verdict_rank(TEXT) TO authenticated, service_role;

-- ============================================================
-- 2. Welche Kanaele es ueberhaupt gibt
-- ============================================================
--
-- ⚠️ ZWILLING: Diese Liste muss zur CHECK-Bedingung `pdp_shadow_log_source_check`
-- passen (zuletzt erweitert in 20260905100000). Sie steht hier zusaetzlich,
-- weil eine CHECK-Bedingung nicht abfragbar ist, ohne den Katalog zu parsen —
-- und die Auswertung genau diese Liste braucht, um fehlende Kanaele zu
-- erkennen. Nie einseitig aendern; `test/governance/shadow-readiness.test.ts`
-- haelt beide Seiten zusammen. Gleiches Verfahren wie bei RFC-003 und den
-- Durchsetzbarkeits-Klassen (CLAUDE.md §5).

CREATE OR REPLACE FUNCTION public.pdp_shadow_known_sources()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT ARRAY[
        'telemetry-ai-event',
        'governance-ingest',
        'ai-gateway',
        'siteos_publish',
        'bot-chat',
        'bot-whatsapp',
        'bot-voice',
        'm365-audit'
    ]::text[];
$$;

COMMENT ON FUNCTION public.pdp_shadow_known_sources() IS
    'Alle Kanaele, die in pdp_shadow_log schreiben koennen. Zwilling der '
    'CHECK-Bedingung pdp_shadow_log_source_check; gehalten durch '
    'test/governance/shadow-readiness.test.ts.';

REVOKE ALL ON FUNCTION public.pdp_shadow_known_sources() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdp_shadow_known_sources() TO authenticated, service_role;

-- ============================================================
-- 3. Die Auswertung
-- ============================================================
--
-- Der LEFT JOIN von der Kanalliste auf das Protokoll ist die ganze Pointe:
-- Ein GROUP BY ueber die Zeilen wuerde einen Kanal, der nie geschrieben hat,
-- gar nicht erst zeigen. Er saehe damit aus wie ein Kanal ohne Befund.

CREATE OR REPLACE FUNCTION public.pdp_shadow_readiness(
    p_tenant_id UUID,
    p_since     TIMESTAMPTZ DEFAULT (now() - interval '30 days')
)
RETURNS TABLE (
    source          text,
    -- FALSE heisst: dieser Kanal hat im Zeitraum nichts geschrieben. Das ist
    -- eine Aussage ueber die Beobachtung, nicht ueber die Richtlinien.
    beobachtet      boolean,
    eintraege       bigint,
    erste           timestamptz,
    letzte          timestamptz,
    divergenzen     bigint,
    -- Richtung der Abweichung, getrennt gezaehlt.
    v2_strenger     bigint,
    v2_lockerer     bigint,
    -- Was `enforce` bewirkt haette: Faelle, in denen v2 gesperrt oder eine
    -- Freigabe verlangt haette.
    wuerde_sperren  bigint,
    -- Verdikte, die die Rangordnung nicht kennt — ein Hinweis auf ein neues
    -- Vokabular, das niemand nachgetragen hat.
    unbekannt       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        k.source,
        count(l.id) > 0                                              AS beobachtet,
        count(l.id)                                                  AS eintraege,
        min(l.created_at)                                            AS erste,
        max(l.created_at)                                            AS letzte,
        count(l.id) FILTER (WHERE l.diverged)                        AS divergenzen,
        count(l.id) FILTER (
            WHERE public.pdp_verdict_rank(l.v2_status)
                > public.pdp_verdict_rank(l.legacy_status)
        )                                                            AS v2_strenger,
        count(l.id) FILTER (
            WHERE public.pdp_verdict_rank(l.v2_status)
                < public.pdp_verdict_rank(l.legacy_status)
        )                                                            AS v2_lockerer,
        count(l.id) FILTER (
            WHERE public.pdp_verdict_rank(l.v2_status) >= 3
        )                                                            AS wuerde_sperren,
        count(l.id) FILTER (
            WHERE l.v2_status IS NOT NULL
              AND public.pdp_verdict_rank(l.v2_status) IS NULL
        )                                                            AS unbekannt
    FROM unnest(public.pdp_shadow_known_sources()) AS k(source)
    LEFT JOIN public.pdp_shadow_log l
           ON l.source = k.source
          AND l.tenant_id = p_tenant_id
          AND l.created_at >= p_since
    -- SECURITY DEFINER umgeht RLS, also die Grenze hier selbst herstellen.
    WHERE public.is_tenant_member(p_tenant_id)
    GROUP BY k.source
    ORDER BY k.source;
$$;

COMMENT ON FUNCTION public.pdp_shadow_readiness(UUID, TIMESTAMPTZ) IS
    'Beobachtungsstand je Kanal als Grundlage der Umschaltentscheidung. Geht '
    'von der Kanalliste aus, nicht von den Zeilen: Ein Kanal ohne Eintrag '
    'erscheint mit beobachtet = false statt gar nicht.';

REVOKE ALL ON FUNCTION public.pdp_shadow_readiness(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdp_shadow_readiness(UUID, TIMESTAMPTZ)
    TO authenticated, service_role;

-- ============================================================
-- 4. Index fuer die Auswertung je Kanal
-- ============================================================
--
-- Der vorhandene Teil-Index deckt nur `WHERE diverged` ab. Die Auswertung
-- zaehlt aber ueber alle Zeilen je Kanal und Zeitraum.

CREATE INDEX IF NOT EXISTS pdp_shadow_log_source_time_idx
    ON public.pdp_shadow_log (tenant_id, source, created_at DESC);

COMMIT;
