-- Market Intelligence — Aggregat-RPC für das Super-Admin-Cockpit.
--
-- Hintergrund
-- -----------
-- Der `market-scanner` läuft seit dem 2026-05-05 täglich um 06:00 UTC und hat
-- (Messung 2026-09-06 gegen das Live-Projekt) 129 Lücken, 122 CEO-Briefs und
-- 129 Läufe erzeugt — bei 124 von 124 erfolgreichen Cron-Läufen. Der Bestand
-- steht dabei **vollständig im Eingangszustand**: alle 129 Lücken auf
-- `identified`, alle 122 Briefs auf `draft`. Es wird gesammelt, aber nichts
-- ausgewertet und nichts verschickt.
--
-- Diese Funktion liefert genau die Kennzahlen, die clientseitig nicht in einer
-- Abfrage erreichbar sind: den Trichter über beide Tabellen, den Brief-
-- Rückstand samt Alter, und die Betriebslage des Scanners. Die Bewertung der
-- einzelnen Lücken passiert bewusst **nicht** hier, sondern in
-- `src/core/market-intelligence/score.ts` — dort ist sie testbar und steht nur
-- einmal.
--
-- Sicherheit
-- ----------
-- SECURITY DEFINER mit leerem `search_path`, Muster von
-- `admin_system_health()` (20260506190000). Zugriff ausschließlich für
-- `profiles.is_super_admin` — dies ist RealSync-internes Intel, keine
-- Mandantendaten; die Tabellen tragen deshalb auch keine `tenant_id`. Ohne
-- Admin-Flag kommt `{"error":"forbidden"}` zurück, nicht etwa ein leeres
-- Ergebnis: Ein leeres Ergebnis wäre von „keine Daten" nicht unterscheidbar.
--
-- Additiv: legt nichts an, ändert keine Policy, fasst keine bestehende
-- Funktion an.

CREATE OR REPLACE FUNCTION public.admin_market_intelligence()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_is_admin boolean;
  v_result   jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND is_super_admin = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_result := jsonb_build_object(

    -- Trichter: Wo bleiben die Befunde stehen? Beide Tabellen nebeneinander,
    -- weil genau der Übergang Lücke → Brief → Versand heute nicht stattfindet.
    'funnel', jsonb_build_object(
      'gaps_by_status', COALESCE((
        SELECT jsonb_object_agg(status, n)
          FROM (SELECT status, count(*) AS n FROM public.market_gaps GROUP BY status) s
      ), '{}'::jsonb),
      'briefs_by_status', COALESCE((
        SELECT jsonb_object_agg(status, n)
          FROM (SELECT status, count(*) AS n FROM public.ceo_briefs GROUP BY status) s
      ), '{}'::jsonb),
      'gaps_total',   (SELECT count(*) FROM public.market_gaps),
      'briefs_total', (SELECT count(*) FROM public.ceo_briefs),
      -- Lücken mit hohem Potential, für die kein Brief existiert: der Scanner
      -- legt Briefs nur für high/very_high an, ein Rückstand hier wäre ein Fehler.
      'high_value_without_brief', (
        SELECT count(*) FROM public.market_gaps g
         WHERE g.revenue_potential IN ('high', 'very_high')
           AND NOT EXISTS (SELECT 1 FROM public.ceo_briefs b WHERE b.market_gap_id = g.id)
      )
    ),

    -- Brief-Rückstand: Wie lange liegen die ältesten Entwürfe schon?
    'brief_backlog', jsonb_build_object(
      'draft',  (SELECT count(*) FROM public.ceo_briefs WHERE status = 'draft'),
      'sent',   (SELECT count(*) FROM public.ceo_briefs WHERE status = 'sent'),
      'oldest_draft_at', (
        SELECT min(created_at) FROM public.ceo_briefs WHERE status = 'draft'
      ),
      'oldest_draft_age_days', (
        SELECT floor(EXTRACT(EPOCH FROM (now() - min(created_at))) / 86400)::int
          FROM public.ceo_briefs WHERE status = 'draft'
      )
    ),

    -- Betriebslage des Scanners. Ein Cockpit, das den Bestand zeigt, muss auch
    -- zeigen, ob er noch wächst — sonst sieht ein stehengebliebener Scanner
    -- genauso aus wie ein ruhiger Markt.
    'scanner', jsonb_build_object(
      'runs_total',    (SELECT count(*) FROM public.research_runs),
      'runs_by_status', COALESCE((
        SELECT jsonb_object_agg(status, n)
          FROM (SELECT status, count(*) AS n FROM public.research_runs GROUP BY status) s
      ), '{}'::jsonb),
      'last_run_at',     (SELECT max(started_at) FROM public.research_runs),
      'last_run_status', (
        SELECT status FROM public.research_runs ORDER BY started_at DESC LIMIT 1
      ),
      'hours_since_last_run', (
        SELECT floor(EXTRACT(EPOCH FROM (now() - max(started_at))) / 3600)::int
          FROM public.research_runs
      ),
      'runs_last_14d', (
        SELECT count(*) FROM public.research_runs
         WHERE started_at > now() - interval '14 days'
      ),
      'errors_last_14d', (
        SELECT count(*) FROM public.research_runs
         WHERE started_at > now() - interval '14 days' AND status = 'error'
      )
    ),

    -- Branchen-Rollup inkl. Frische. `days_since_last` zeigt, welche Branche
    -- der 12-Tage-Rotation zuletzt drankam.
    'industries', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.gaps DESC)
        FROM (
          SELECT industry,
                 count(*)::int                         AS gaps,
                 count(DISTINCT job_category)::int     AS distinct_jobs,
                 round(avg(urgency_score), 1)::float   AS avg_urgency,
                 max(scanned_at)                       AS last_scanned_at,
                 floor(EXTRACT(EPOCH FROM (now() - max(scanned_at))) / 86400)::int
                                                       AS days_since_last
            FROM public.market_gaps
           GROUP BY industry
        ) r
    ), '[]'::jsonb),

    -- Mehrfach bestätigte Themen: dieselbe Job-Kategorie, an mehreren
    -- **verschiedenen Scan-Tagen** unabhängig gefunden. Der Scanner läuft
    -- einmal täglich, ein Tag ist also ein Lauf; zwei Zeilen aus demselben Lauf
    -- zählen nicht doppelt. Das ist das einzige Signal im Bestand, das nicht
    -- vom Modell behauptet, sondern aus den Daten berechnet ist — deshalb trägt
    -- es im Scoring das größte Einzelgewicht.
    'corroborated_themes', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.confirmed_days DESC, r.job_category)
        FROM (
          SELECT job_category,
                 max(industry)                        AS industry,
                 count(DISTINCT scanned_at::date)::int AS confirmed_days,
                 count(*)::int                        AS gaps
            FROM public.market_gaps
           GROUP BY job_category
          HAVING count(DISTINCT scanned_at::date) > 1
           ORDER BY count(DISTINCT scanned_at::date) DESC
           LIMIT 15
        ) r
    ), '[]'::jsonb),

    -- Branchenübergreifende Themen. Gemessen am 2026-09-06: **null**. Die Zahl
    -- steht hier, damit diese Abwesenheit ein ausgewiesener Befund bleibt und
    -- nicht als „nichts gefunden" durchgeht — die Job-Kategorien sind
    -- branchengebundene Rollentitel, ein Treffer über Branchen hinweg wäre die
    -- Ausnahme, nicht die Regel.
    'cross_industry_themes', (
      SELECT count(*)::int FROM (
        SELECT job_category FROM public.market_gaps
         GROUP BY job_category HAVING count(DISTINCT industry) > 1
      ) x
    ),

    'generated_at', now()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- Wie beim Vorbild: Teil-Ergebnis melden statt die Seite leer zu lassen.
  RETURN jsonb_build_object('error', SQLERRM, 'partial', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_market_intelligence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_market_intelligence() TO authenticated;

COMMENT ON FUNCTION public.admin_market_intelligence() IS
  'Aggregate für das Market-Intelligence-Cockpit (Trichter, Brief-Rückstand, Scanner-Betrieb, Branchen, wiederkehrende Themen). Nur für profiles.is_super_admin.';
