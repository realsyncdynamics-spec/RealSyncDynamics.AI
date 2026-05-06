-- 1. Default-deny RLS policies for orphan tables (no rows, no usage)
DROP POLICY IF EXISTS "provenance_records deny_all" ON public.provenance_records;
CREATE POLICY "provenance_records deny_all"
  ON public.provenance_records FOR ALL
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "subscription_addons deny_all" ON public.subscription_addons;
CREATE POLICY "subscription_addons deny_all"
  ON public.subscription_addons FOR ALL
  USING (false) WITH CHECK (false);

-- 2. Lock down mutable search_path on public functions
ALTER FUNCTION public.handle_updated_at() SET search_path = '';
ALTER FUNCTION public.update_modified_column() SET search_path = '';

-- 3. Lock down mutable search_path on agentos.* functions
ALTER FUNCTION agentos.current_role_level() SET search_path = '';
ALTER FUNCTION agentos.current_tenant_id() SET search_path = '';
ALTER FUNCTION agentos.set_updated_at() SET search_path = '';
ALTER FUNCTION agentos.detach_old_audit_partitions() SET search_path = '';
ALTER FUNCTION agentos.create_monthly_partitions() SET search_path = '';
ALTER FUNCTION agentos.drop_old_idempotency_partitions() SET search_path = '';
