-- Post-setup RLS policies for signing_keys table
-- This script is executed AFTER Supabase extensions are loaded
-- (because it depends on auth.jwt() which is not available in local PostgreSQL)

-- Note: RLS is already ENABLED on the table from the main migration.
-- These policies reference auth.jwt() which is only available in Supabase.

CREATE POLICY "Tenants can view their signing keys"
  ON signing_keys FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  );

CREATE POLICY "Tenants can create signing keys"
  ON signing_keys FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  );

CREATE POLICY "Tenants can update their signing keys"
  ON signing_keys FOR UPDATE
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  );
