-- DSGVO-konformes Pageview-Tracking — kein Cookie, IP-Hash statt IP, kein PII.
--
-- Schema bewusst minimal: nur was wir für Conversion-Funnel brauchen.
-- Daten verfallen nach 90 Tagen (DSGVO Art. 5 Abs. 1 lit. e).

CREATE TABLE IF NOT EXISTS public.page_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path            TEXT NOT NULL,
    referrer        TEXT,                              -- where they came from (anonymized — no query strings)
    visitor_hash    TEXT NOT NULL,                     -- sha256(ip + ua + day) — same visitor on same day = same hash
    session_hash    TEXT,                              -- visitor_hash + first-visit-day for funnel grouping
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    is_bot          BOOLEAN NOT NULL DEFAULT false,    -- best-effort UA classification
    country         TEXT,                              -- 2-letter ISO from CF-IPCountry header (DE/AT/CH targeting)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_path     ON public.page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor  ON public.page_views(visitor_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_created  ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_source   ON public.page_views(utm_source) WHERE utm_source IS NOT NULL;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_views super_admin_read" ON public.page_views;
CREATE POLICY "page_views super_admin_read"
    ON public.page_views FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

-- Auto-Cleanup nach 90 Tagen via pg_cron
DO $$
BEGIN
  PERFORM cron.unschedule('page-views-cleanup-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'page-views-cleanup-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'page-views-cleanup-daily',
  '0 3 * * *',  -- 03:00 UTC täglich
  $cron$ DELETE FROM public.page_views WHERE created_at < now() - interval '90 days'; $cron$
);

COMMENT ON TABLE public.page_views IS
  'DSGVO-konforme Visitor-Analytics. visitor_hash = sha256(ip+ua+day), löscht sich selbst nach 90d.';
