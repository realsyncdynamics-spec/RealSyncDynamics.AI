-- Security hardening — apply only to objects that exist in this environment.
-- All statements wrapped in DO blocks because some functions/tables are
-- production-only (agentos schema, update_modified_column, provenance_records,
-- subscription_addons may be missing in fresh CI Postgres bootstrap).

-- 1. Default-deny RLS policies for orphan tables (no rows, no usage in app)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "provenance_records deny_all" ON public.provenance_records';
  EXECUTE 'CREATE POLICY "provenance_records deny_all" ON public.provenance_records FOR ALL USING (false) WITH CHECK (false)';
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "subscription_addons deny_all" ON public.subscription_addons';
  EXECUTE 'CREATE POLICY "subscription_addons deny_all" ON public.subscription_addons FOR ALL USING (false) WITH CHECK (false)';
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN NULL;
END $$;

-- 2. Lock down mutable search_path on public functions
DO $$ BEGIN
  ALTER FUNCTION public.handle_updated_at() SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_modified_column() SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3. Lock down mutable search_path on agentos.* functions
DO $$ BEGIN
  ALTER FUNCTION agentos.current_role_level() SET search_path = '';
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION agentos.current_tenant_id() SET search_path = '';
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION agentos.set_updated_at() SET search_path = '';
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION agentos.detach_old_audit_partitions() SET search_path = '';
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION agentos.create_monthly_partitions() SET search_path = '';
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION agentos.drop_old_idempotency_partitions() SET search_path = '';
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN NULL;
END $$;
