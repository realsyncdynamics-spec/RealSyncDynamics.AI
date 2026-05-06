-- Erweitert audit_share_get um Score-Delta + History für die selbe Domain.
-- Wenn dieselbe Site mehrfach geprüft wird, zeigt die Public-Share-Page jetzt
-- "Score 87 (+15 seit 14 Tagen)" plus eine Trend-Historie.
-- Discovery-Mechanik: Re-Engagement-Loop, Customer fixed Site → re-runs audit
-- → sieht Score-Progression → teilt verbesserten Score → Social-Proof-Loop.

DROP FUNCTION IF EXISTS public.audit_share_get(UUID);

CREATE OR REPLACE FUNCTION public.audit_share_get(p_id UUID)
RETURNS TABLE (
  share_token       UUID,
  domain            TEXT,
  score             INTEGER,
  severity          TEXT,
  issues            JSONB,
  created_at        TIMESTAMPTZ,
  previous_score    INTEGER,
  previous_at       TIMESTAMPTZ,
  history           JSONB
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH cur AS (
    SELECT g.id, g.domain, g.score, g.severity, g.issues, g.created_at
    FROM public.gdpr_audits g
    WHERE g.id = p_id AND g.is_shareable = true
    LIMIT 1
  ),
  prev AS (
    SELECT g.score AS prev_score, g.created_at AS prev_at
    FROM public.gdpr_audits g, cur
    WHERE g.domain = cur.domain
      AND g.is_shareable = true
      AND g.created_at < cur.created_at
    ORDER BY g.created_at DESC
    LIMIT 1
  ),
  hist AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'score', g.score,
        'severity', g.severity,
        'created_at', g.created_at,
        'issue_count', jsonb_array_length(g.issues)
      ) ORDER BY g.created_at ASC
    ) AS history_data
    FROM public.gdpr_audits g, cur
    WHERE g.domain = cur.domain
      AND g.is_shareable = true
  )
  SELECT
    cur.id,
    cur.domain,
    cur.score,
    cur.severity,
    cur.issues,
    cur.created_at,
    prev.prev_score,
    prev.prev_at,
    hist.history_data
  FROM cur
  LEFT JOIN prev ON true
  LEFT JOIN hist ON true;
$$;

REVOKE ALL ON FUNCTION public.audit_share_get(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_share_get(UUID) TO anon, authenticated;
