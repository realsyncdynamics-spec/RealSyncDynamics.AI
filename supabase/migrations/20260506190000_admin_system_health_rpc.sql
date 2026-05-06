-- /admin/system uses this RPC to probe overall system health.
-- super_admin gate inside (returns null otherwise).

CREATE OR REPLACE FUNCTION public.admin_system_health()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_is_admin boolean;
  v_result jsonb;
  v_resend_set boolean;
  v_anthropic_set boolean;
  v_google_set boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'resend_api_key') INTO v_resend_set;
  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'anthropic_api_key') INTO v_anthropic_set;
  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'google_api_key') INTO v_google_set;

  v_result := jsonb_build_object(
    'last_hour', jsonb_build_object(
      'audits',       (SELECT count(*) FROM public.gdpr_audits WHERE created_at > now() - interval '1 hour'),
      'leads',        (SELECT count(*) FROM public.sales_leads WHERE created_at > now() - interval '1 hour'),
      'pageviews',    (SELECT count(*) FROM public.page_views WHERE created_at > now() - interval '1 hour' AND is_bot = false),
      'unique_visitors', (SELECT count(DISTINCT visitor_hash) FROM public.page_views WHERE created_at > now() - interval '1 hour' AND is_bot = false)
    ),
    'last_24h', jsonb_build_object(
      'audits',       (SELECT count(*) FROM public.gdpr_audits WHERE created_at > now() - interval '24 hours'),
      'leads',        (SELECT count(*) FROM public.sales_leads WHERE created_at > now() - interval '24 hours'),
      'pageviews',    (SELECT count(*) FROM public.page_views WHERE created_at > now() - interval '24 hours' AND is_bot = false),
      'audits_unsent_email', (SELECT count(*) FROM public.gdpr_audits WHERE email_sent_at IS NULL AND created_at > now() - interval '24 hours')
    ),
    'totals', jsonb_build_object(
      'audits',     (SELECT count(*) FROM public.gdpr_audits),
      'leads',      (SELECT count(*) FROM public.sales_leads),
      'tenants',    (SELECT count(*) FROM public.tenants),
      'profiles',   (SELECT count(*) FROM public.profiles),
      'subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'active'),
      'outreach_contacts', (SELECT count(*) FROM public.outreach_contacts),
      'market_gaps', (SELECT count(*) FROM public.market_gaps),
      'ceo_briefs',  (SELECT count(*) FROM public.ceo_briefs)
    ),
    'integrations', jsonb_build_object(
      'resend_key_set',     v_resend_set,
      'anthropic_key_set',  v_anthropic_set,
      'google_key_set',     v_google_set
    ),
    'cron_jobs', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', jobname, 'schedule', schedule, 'active', active
      ) ORDER BY jobname)
      FROM cron.job
    ),
    'recent_http_responses', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT id, status_code, created
        FROM net._http_response
        ORDER BY created DESC
        LIMIT 10
      ) r
    ),
    'generated_at', now()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'partial', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_system_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_system_health() TO authenticated;
