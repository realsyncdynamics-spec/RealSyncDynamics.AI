-- AP-1a — Shadow-Protokoll bekommt eine ehrliche Beobachtungsart
--
-- ## Der Befund
--
-- `pdp_shadow_log` kennt bisher nur eine Zeilenart: den Vergleich zweier
-- Engines (`legacy_status` vs. `v2_status`, `diverged = legacy <> v2`).
-- Die Master-Reihenfolge (AP-1c/AP-1d) will aber Kanäle anschließen, die
-- **keinen** Legacy-Pfad haben (ai-gateway, governance-router). Würden diese
-- Kanäle über die bestehende Semantik schreiben, entstünde ein erfundener
-- A/B-Vergleich: `legacy_status = NULL` gegen ein echtes v2-Verdikt zählte
-- als „Divergenz", obwohl es nie zwei Engines gab. Die Auswertung, an der
-- die Umschaltentscheidung hängt, würde mit Phantom-Abweichungen geflutet —
-- oder, schlimmer, jemand „repariert" das, indem er die Zeilen weglässt,
-- und der Kanal wäre wieder unbeobachtet.
--
-- ## Entscheidung (2026-09-21, bestätigt)
--
-- `pdp_shadow_log` wird Beobachtungslog mit expliziter Beobachtungsart:
--
--   * `comparison`    — zwei Engines, Divergenz ist eine echte Aussage.
--   * `decision_only` — eine Engine beobachtet; es gibt nichts zu vergleichen.
--
-- `tenant_id` bleibt ausdrücklich NOT NULL: Der tenantlose Gateway wird
-- nicht durch Aufweichen der Evidence-Schicht schreibfähig gemacht
-- (das löst AP-1b über verifizierten Tenant-Kontext, nicht diese Migration).
--
-- ## Ehrlichkeitsregel als CHECK, nicht als Konvention
--
-- Eine `decision_only`-Zeile darf weder ein Legacy-Verdikt tragen noch als
-- divergent zählen — sonst wäre die Trennung nur ein Etikett. Das erzwingt
-- die Datenbank, nicht der Aufrufer: Ein Aufrufer, der die Semantik
-- missversteht, fällt beim Insert auf statt die Auswertung zu verfälschen.
--
-- EU AI Act Art. 12 (Aufzeichnungen müssen wiedergeben, was tatsächlich
-- geschah — ein protokollierter Vergleich, der nie stattfand, ist keine
-- Aufzeichnung, sondern eine Behauptung). DSGVO Art. 5 Abs. 2.
--
-- ## Additiv
--
-- Bestehende Zeilen waren sämtlich Vergleiche; der DEFAULT 'comparison'
-- beschreibt sie korrekt. Keine Zeile wird verändert, kein zulässiger Wert
-- fällt weg, alle bestehenden Aufrufer schreiben unverändert gültig.

BEGIN;

-- ============================================================
-- 1. Beobachtungsart
-- ============================================================

ALTER TABLE public.pdp_shadow_log
  ADD COLUMN IF NOT EXISTS observation_kind text NOT NULL DEFAULT 'comparison';

ALTER TABLE public.pdp_shadow_log
  DROP CONSTRAINT IF EXISTS pdp_shadow_log_observation_kind_check;

ALTER TABLE public.pdp_shadow_log
  ADD CONSTRAINT pdp_shadow_log_observation_kind_check
  CHECK (observation_kind IN ('comparison', 'decision_only'));

COMMENT ON COLUMN public.pdp_shadow_log.observation_kind IS
  'Beobachtungsart der Zeile: comparison = zwei Engines, Divergenz ist eine '
  'echte Aussage; decision_only = eine Engine beobachtet, es gibt nichts zu '
  'vergleichen. Erweiterbar nur additiv.';

-- Die Ehrlichkeitsregel: decision_only kennt keinen Legacy-Pfad und damit
-- keine Divergenz. NOT VALID + VALIDATE, damit die Regel auch dann greift,
-- wenn die Tabelle bereits groß ist, ohne den Schreibpfad zu blockieren.

ALTER TABLE public.pdp_shadow_log
  DROP CONSTRAINT IF EXISTS pdp_shadow_log_decision_only_honest;

ALTER TABLE public.pdp_shadow_log
  ADD CONSTRAINT pdp_shadow_log_decision_only_honest
  CHECK (
    observation_kind <> 'decision_only'
    OR (legacy_status IS NULL AND diverged = false)
  ) NOT VALID;

ALTER TABLE public.pdp_shadow_log
  VALIDATE CONSTRAINT pdp_shadow_log_decision_only_honest;

-- ============================================================
-- 2. Auswertung: Vergleiche und reine Beobachtung getrennt zählen
-- ============================================================
--
-- Die Rückgabeform ändert sich (zwei neue Spalten), deshalb DROP statt
-- CREATE OR REPLACE — Postgres erlaubt keine Änderung des Rückgabetyps.
-- Alle bestehenden Spalten bleiben namens- und reihenfolgengleich; die
-- Oberfläche (ShadowReadinessView) liest per Feldname und bleibt gültig.
--
-- Divergenz-Metriken (divergenzen, v2_strenger, v2_lockerer) zählen ab jetzt
-- NUR über comparison-Zeilen: Eine decision_only-Zeile kann per Constraint
-- nicht divergieren, aber die Filterung macht die Absicht lesbar und bleibt
-- korrekt, falls das Vokabular je wächst. `wuerde_sperren` und `unbekannt`
-- zählen weiterhin über ALLE Zeilen — die Frage „was hätte enforce getan?"
-- stellt sich für jede beobachtete Entscheidung, egal ob verglichen wurde.

DROP FUNCTION IF EXISTS public.pdp_shadow_readiness(UUID, TIMESTAMPTZ);

CREATE FUNCTION public.pdp_shadow_readiness(
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
    -- Richtung der Abweichung, getrennt gezaehlt (nur Vergleiche).
    v2_strenger     bigint,
    v2_lockerer     bigint,
    -- Was `enforce` bewirkt haette: Faelle, in denen v2 gesperrt oder eine
    -- Freigabe verlangt haette (alle Beobachtungsarten).
    wuerde_sperren  bigint,
    -- Verdikte, die die Rangordnung nicht kennt — ein Hinweis auf ein neues
    -- Vokabular, das niemand nachgetragen hat.
    unbekannt       bigint,
    -- Beobachtungsarten getrennt: Ein Kanal mit nur decision_only-Zeilen ist
    -- beobachtet, traegt aber NICHTS zur Vergleichsgrundlage bei. Wer die
    -- Umschaltung auf „keine Divergenzen" stuetzt, muss sehen, aus wie
    -- vielen Vergleichen diese Aussage ueberhaupt besteht (n=0 nie gruen).
    vergleiche      bigint,
    entscheidungen  bigint
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
        count(l.id) FILTER (
            WHERE l.observation_kind = 'comparison' AND l.diverged
        )                                                            AS divergenzen,
        count(l.id) FILTER (
            WHERE l.observation_kind = 'comparison'
              AND public.pdp_verdict_rank(l.v2_status)
                > public.pdp_verdict_rank(l.legacy_status)
        )                                                            AS v2_strenger,
        count(l.id) FILTER (
            WHERE l.observation_kind = 'comparison'
              AND public.pdp_verdict_rank(l.v2_status)
                < public.pdp_verdict_rank(l.legacy_status)
        )                                                            AS v2_lockerer,
        count(l.id) FILTER (
            WHERE public.pdp_verdict_rank(l.v2_status) >= 3
        )                                                            AS wuerde_sperren,
        count(l.id) FILTER (
            WHERE l.v2_status IS NOT NULL
              AND public.pdp_verdict_rank(l.v2_status) IS NULL
        )                                                            AS unbekannt,
        count(l.id) FILTER (
            WHERE l.observation_kind = 'comparison'
        )                                                            AS vergleiche,
        count(l.id) FILTER (
            WHERE l.observation_kind = 'decision_only'
        )                                                            AS entscheidungen
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
    'erscheint mit beobachtet = false statt gar nicht. Divergenz-Metriken '
    'zaehlen nur comparison-Zeilen; vergleiche/entscheidungen weisen die '
    'Beobachtungsarten getrennt aus.';

REVOKE ALL ON FUNCTION public.pdp_shadow_readiness(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdp_shadow_readiness(UUID, TIMESTAMPTZ)
    TO authenticated, service_role;

COMMIT;
