-- Migration: get_rebuild_status_by_token RPC
-- Ermoeglicht Public-Status-Check ohne Auth fuer Kunden ohne Account.
-- Token = rebuild_id + sha256(lower(customer_email)) als Hex.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.get_rebuild_status_by_token(
    p_rebuild_id uuid,
    p_email_hash text
  )
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rebuild  public.website_rebuilds%ROWTYPE;
  v_steps    jsonb;
  v_hash     text;
BEGIN
  SELECT * INTO v_rebuild
  FROM public.website_rebuilds
  WHERE id = p_rebuild_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_hash := encode(digest(lower(v_rebuild.customer_email), 'sha256'), 'hex');
  IF v_hash <> lower(p_email_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'step_name', s.step_name, 'status', s.status,
          'started_at', s.started_at, 'completed_at', s.completed_at,
          'duration_ms', s.duration_ms, 'summary', s.summary,
          'error_detail', s.error_detail
        ) ORDER BY s.created_at
      ) INTO v_steps
  FROM public.website_rebuild_steps s
  WHERE s.rebuild_id = p_rebuild_id;

  RETURN jsonb_build_object(
        'ok', true,
        'id', v_rebuild.id,
        'source_domain', v_rebuild.source_domain,
        'source_url', v_rebuild.source_url,
        'company', v_rebuild.company,
        'tier', v_rebuild.tier,
        'status', v_rebuild.status,
        'current_step', v_rebuild.current_step,
        'completed_steps', v_rebuild.completed_steps,
        'preview_url', v_rebuild.preview_url,
        'error_code', v_rebuild.error_code,
        'error_detail', v_rebuild.error_detail,
        'workflow_version', v_rebuild.workflow_version,
        'started_at', v_rebuild.started_at,
        'completed_at', v_rebuild.completed_at,
        'created_at', v_rebuild.created_at,
        'steps', COALESCE(v_steps, '[]'::jsonb)
      );
END;
$$;

REVOKE ALL ON FUNCTION public.get_rebuild_status_by_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rebuild_status_by_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_rebuild_status_by_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rebuild_status_by_token(uuid, text) TO service_role;

COMMENT ON FUNCTION public.get_rebuild_status_by_token IS
'Public rebuild status lookup without auth. Token = sha256(lower(email)) hex. Does not expose customer_email or bundle_path.';
