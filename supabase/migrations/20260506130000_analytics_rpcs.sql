-- Aggregierte Analytics-Funktionen für /admin/analytics.
-- SECURITY DEFINER mit super_admin-Check; nur Authenticated user können callen,
-- die Function selbst checked is_super_admin und gibt sonst 0 rows zurück.

CREATE OR REPLACE FUNCTION public.analytics_pageviews_daily(days int DEFAULT 14)
RETURNS TABLE (day date, views bigint, unique_visitors bigint, audit_views bigint, contact_views bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    date_trunc('day', created_at)::date,
    count(*)::bigint,
    count(DISTINCT visitor_hash)::bigint,
    count(*) FILTER (WHERE path = '/audit')::bigint,
    count(*) FILTER (WHERE path = '/contact-sales')::bigint
  FROM public.page_views
  WHERE created_at > now() - (days || ' days')::interval
    AND is_bot = false
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  GROUP BY 1 ORDER BY 1 DESC;
$$;

CREATE OR REPLACE FUNCTION public.analytics_top_pages(days int DEFAULT 14, lim int DEFAULT 20)
RETURNS TABLE (path text, views bigint, unique_visitors bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.path, count(*)::bigint, count(DISTINCT p.visitor_hash)::bigint
  FROM public.page_views p
  WHERE p.created_at > now() - (days || ' days')::interval
    AND p.is_bot = false
    AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_super_admin = true)
  GROUP BY 1 ORDER BY 2 DESC LIMIT lim;
$$;

CREATE OR REPLACE FUNCTION public.analytics_sources(days int DEFAULT 14)
RETURNS TABLE (utm_source text, views bigint, unique_visitors bigint, lead_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH allowed AS (
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true) AS ok
  ),
  pv AS (
    SELECT coalesce(p.utm_source, '(direct)') AS source,
           count(*)::bigint AS views,
           count(DISTINCT p.visitor_hash)::bigint AS unique_visitors
    FROM public.page_views p, allowed
    WHERE allowed.ok AND p.created_at > now() - (days || ' days')::interval AND p.is_bot = false
    GROUP BY 1
  ),
  sl AS (
    SELECT coalesce(s.source, '(direct)') AS source, count(*)::bigint AS lead_count
    FROM public.sales_leads s, allowed
    WHERE allowed.ok AND s.created_at > now() - (days || ' days')::interval
    GROUP BY 1
  )
  SELECT coalesce(pv.source, sl.source),
         coalesce(pv.views, 0),
         coalesce(pv.unique_visitors, 0),
         coalesce(sl.lead_count, 0)
  FROM pv FULL OUTER JOIN sl ON pv.source = sl.source
  ORDER BY 2 DESC, 4 DESC;
$$;

CREATE OR REPLACE FUNCTION public.analytics_funnel(days int DEFAULT 30)
RETURNS TABLE (
  unique_visitors bigint, landing_views bigint, audit_views bigint,
  audits_completed bigint, contact_views bigint, leads_captured bigint, pricing_views bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH allowed AS (
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true) AS ok
  )
  SELECT
    (SELECT count(DISTINCT visitor_hash) FROM public.page_views WHERE created_at > now() - (days || ' days')::interval AND is_bot = false)::bigint,
    (SELECT count(*) FROM public.page_views WHERE path = '/' AND created_at > now() - (days || ' days')::interval AND is_bot = false)::bigint,
    (SELECT count(*) FROM public.page_views WHERE path = '/audit' AND created_at > now() - (days || ' days')::interval AND is_bot = false)::bigint,
    (SELECT count(*) FROM public.gdpr_audits WHERE created_at > now() - (days || ' days')::interval)::bigint,
    (SELECT count(*) FROM public.page_views WHERE path = '/contact-sales' AND created_at > now() - (days || ' days')::interval AND is_bot = false)::bigint,
    (SELECT count(*) FROM public.sales_leads WHERE created_at > now() - (days || ' days')::interval)::bigint,
    (SELECT count(*) FROM public.page_views WHERE path = '/pricing' AND created_at > now() - (days || ' days')::interval AND is_bot = false)::bigint
  FROM allowed WHERE allowed.ok;
$$;

REVOKE ALL ON FUNCTION public.analytics_pageviews_daily(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_top_pages(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_sources(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_funnel(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_pageviews_daily(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_top_pages(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_sources(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_funnel(int) TO authenticated;
