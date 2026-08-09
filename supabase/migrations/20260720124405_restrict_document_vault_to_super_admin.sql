-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02).
-- Direkt auf Prod angewendet, nie ins Repo committet (Drift). Inhalt 1:1 aus
-- supabase_migrations.schema_migrations (Version 20260720124405).
-- Korrigiert die offene Policy aus 20260715105402.

-- document_vault had RLS policy "owner full access" with USING(true)/WITH
-- CHECK(true) for ALL operations — full bypass of RLS for any authenticated
-- user. Table has no owner_id/tenant_id column, confirmed with the account
-- owner it's a single-user (super-admin) vault, so scope access to
-- super-admins and the service role instead of leaving it fully open.

ALTER POLICY "owner full access" ON public.document_vault
  USING (
    (select auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.is_super_admin = true
    )
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.is_super_admin = true
    )
  );
