-- get_rebuild_status_by_token V2
-- Extends the RPC to support two token schemes:
--
-- V1 (post-payment, email known):
--   token = sha256(lower(customer_email))
--
-- V2 (pre-payment, email may be null):
--   token = sha256(rebuild_id || ':' || source_url)
--   This is the token embedded in the Stripe success_url by the
--   checkout-website-rebuild function.
--
-- The RPC tries V1 first (email hash); if customer_email IS NULL it falls
-- through to V2 (source_url hash). This makes the status page work
-- immediately after Stripe redirects the user back (before the webhook fires
-- and fills in customer_email).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.get_rebuild_status_by_token(
  p_rebuild_id uuid,
  p_token      text   -- hex string: sha256(email) or sha256(rebuild_id:source_url)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rebuild public.website_rebuilds%ROWTYPE;
  v_steps   jsonb;
  v_email_hash   text;
  v_url_hash     text;
  v_token_lower  text;
BEGIN
  SELECT * INTO v_rebuild
  FROM public.website_rebuilds
  WHERE id = p_rebuild_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_token_lower := lower(p_token);

  -- V1: verify via sha256(lower(email))
  IF v_rebuild.customer_email IS NOT NULL THEN
    v_email_hash := encode(digest(lower(v_rebuild.customer_email), 'sha256'), 'hex');
    IF v_email_hash = v_token_lower THEN
      -- token valid
      NULL;
    ELSE
      -- Try V2 even if email is set (edge case: token was generated before email was filled)
      v_url_hash := encode(
        digest(v_rebuild.id::text || ':' || v_rebuild.source_url, 'sha256'), 'hex'
      );
      IF v_url_hash <> v_token_lower THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      END IF;
    END IF;
  ELSE
    -- V2: email not yet set (pending_payment state), verify via sha256(rebuild_id:source_url)
    v_url_hash := encode(
      digest(v_rebuild.id::text || ':' || v_rebuild.source_url, 'sha256'), 'hex'
    );
    IF v_url_hash <> v_token_lower THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',           s.id,
      'step_name',    s.step_name,
      'status',       s.status,
      'started_at',   s.started_at,
      'completed_at', s.completed_at,
      'duration_ms',  s.duration_ms,
      'summary',      s.summary,
      'error_detail', s.error_detail
    ) ORDER BY s.created_at
  ) INTO v_steps
  FROM public.website_rebuild_steps s
  WHERE s.rebuild_id = p_rebuild_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'id',               v_rebuild.id,
    'source_domain',    v_rebuild.source_domain,
    'source_url',       v_rebuild.source_url,
    'company',          v_rebuild.company,
    'tier',             v_rebuild.tier,
    'status',           v_rebuild.status,
    'current_step',     v_rebuild.current_step,
    'completed_steps',  v_rebuild.completed_steps,
    'preview_url',      v_rebuild.preview_url,
    'error_code',       v_rebuild.error_code,
    'error_detail',     v_rebuild.error_detail,
    'workflow_version', v_rebuild.workflow_version,
    'started_at',       v_rebuild.started_at,
    'completed_at',     v_rebuild.completed_at,
    'created_at',       v_rebuild.created_at,
    'steps',            COALESCE(v_steps, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_rebuild_status_by_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rebuild_status_by_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_rebuild_status_by_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rebuild_status_by_token(uuid, text) TO service_role;

COMMENT ON FUNCTION public.get_rebuild_status_by_token IS
'Public rebuild status lookup. Accepts two token types: V1=sha256(email), V2=sha256(rebuild_id:source_url). V2 works before payment completes (pending_payment state).';
