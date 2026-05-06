-- /admin/customers verbindet subscriptions + tenants + memberships + profiles
-- für eine konsolidierte Customer-Sicht. RPC mit super_admin-Gate inside.

CREATE OR REPLACE FUNCTION public.admin_customers_list()
RETURNS TABLE (
  tenant_id           UUID,
  tenant_name         TEXT,
  owner_email         TEXT,
  plan_key            TEXT,
  status              TEXT,
  trial_end           TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  current_period_end  TIMESTAMPTZ,
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  created_at          TIMESTAMPTZ,
  member_count        BIGINT
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    (SELECT u.email FROM auth.users u
       INNER JOIN public.memberships m ON m.user_id = u.id
       WHERE m.tenant_id = t.id AND m.role = 'owner'
       LIMIT 1) AS owner_email,
    s.plan_key,
    s.status,
    NULL::timestamptz AS trial_end,
    s.cancel_at_period_end,
    s.current_period_end,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    t.created_at,
    (SELECT count(*) FROM public.memberships m WHERE m.tenant_id = t.id) AS member_count
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  ORDER BY t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_customers_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customers_list() TO authenticated;
