-- Last-Owner RLS Hardening
-- ============================================================
-- Protect critical tenant records (tenants, subscriptions) from
-- accidental deletion or modification by non-owners. Implements a
-- "last-owner-cannot-lose-access" pattern to ensure data integrity.
--
-- Prevents:
--   1. Tenants from being deleted by non-owners
--   2. Subscriptions from being modified/deleted by non-owners
--   3. Last owner from being downgraded below owner role
--
-- Used by:
--   - governance dashboard (reads only)
--   - admin panel (when available, write-protected)
--   - API (service-role calls only for mutations)

-- ──────────────────────────────────────────────────────────────
-- Helper: ensure at least one owner remains when updating role
-- ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER avoids RLS recursion on public.memberships.

CREATE OR REPLACE FUNCTION public.can_set_membership_role(
  p_tenant_id uuid,
  p_user_id uuid,
  p_new_role text
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_new_role = 'owner'
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = p_tenant_id
        AND m.user_id <> p_user_id
        AND m.role = 'owner'
    );
$$;

COMMENT ON FUNCTION public.can_set_membership_role(uuid, uuid, text) IS
  'True when the target membership stays owner or at least one other owner exists in the tenant.';

REVOKE EXECUTE ON FUNCTION public.can_set_membership_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_set_membership_role(uuid, uuid, text) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────
-- 1. Tenants: no delete for non-owners
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenants owner-delete" ON public.tenants;
CREATE POLICY "tenants owner-delete"
ON public.tenants FOR DELETE TO authenticated
USING (public.is_tenant_owner(id));

-- ──────────────────────────────────────────────────────────────
-- 2. Subscriptions: no insert/update/delete for non-owners
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "subscriptions owner-write" ON public.subscriptions;
CREATE POLICY "subscriptions owner-write"
ON public.subscriptions FOR ALL TO authenticated
USING (public.is_tenant_owner(tenant_id))
WITH CHECK (public.is_tenant_owner(tenant_id));

-- ──────────────────────────────────────────────────────────────
-- 3. Memberships: prevent downgrading last owner
-- ──────────────────────────────────────────────────────────────
-- AS RESTRICTIVE so this combines with AND alongside memberships_update
-- (from 20260927120000_gate0_rls_hardening.sql) instead of OR-bypassing it.

DROP POLICY IF EXISTS "memberships prevent-last-owner-downgrade" ON public.memberships;
CREATE POLICY "memberships prevent-last-owner-downgrade"
ON public.memberships AS RESTRICTIVE FOR UPDATE TO authenticated
USING (true)
WITH CHECK (public.can_set_membership_role(tenant_id, user_id, role));

-- ──────────────────────────────────────────────────────────────
-- 4. Service-role overrides (for admin + cron jobs)
-- ──────────────────────────────────────────────────────────────
-- Service role has full access (no RLS) for mutations that need
-- cross-tenant or system-level control. All tenant-scoped mutations
-- should go through the SPA and respect RLS policies.

COMMENT ON POLICY "tenants owner-delete" ON public.tenants IS
  'Only tenant owners can delete tenants. Prevents accidental data loss.';

COMMENT ON POLICY "subscriptions owner-write" ON public.subscriptions IS
  'Only tenant owners can create, update, or delete subscriptions. Prevents unauthorized billing changes.';

COMMENT ON POLICY "memberships prevent-last-owner-downgrade" ON public.memberships IS
  'Prevent the last owner from being downgraded to a lower role. Ensures tenant ownership is never lost.';
