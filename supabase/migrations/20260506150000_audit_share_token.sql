-- Public audit-share — adds is_shareable flag + sanitized read RPC.
--
-- The audit row's id IS the public token. Users already receive audit_id
-- in the gdpr-audit response so no extra plumbing needed. is_shareable
-- (default true) lets us revoke individual shares without deleting rows.
--
-- The RPC public.audit_share_get(id) returns ONLY non-PII fields
-- (score, severity, issues, domain, created_at) — never email/company/url.

ALTER TABLE public.gdpr_audits
  ADD COLUMN IF NOT EXISTS is_shareable BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.audit_share_get(p_id UUID)
RETURNS TABLE (
  share_token  UUID,
  domain       TEXT,
  score        INTEGER,
  severity     TEXT,
  issues       JSONB,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    g.id,
    g.domain,
    g.score,
    g.severity,
    g.issues,
    g.created_at
  FROM public.gdpr_audits g
  WHERE g.id = p_id
    AND g.is_shareable = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.audit_share_get(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_share_get(UUID) TO anon, authenticated;
