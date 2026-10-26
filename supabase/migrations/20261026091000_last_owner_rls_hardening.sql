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
-- 1. Tenants: no delete for non-owners
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenants owner-delete" ON public.tenants;
CREATE POLICY "tenants owner-delete"
ON public.tenants FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.tenant_id = tenants.id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
));

-- ──────────────────────────────────────────────────────────────
-- 2. Subscriptions: no insert/update/delete for non-owners
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "subscriptions owner-write" ON public.subscriptions;
CREATE POLICY "subscriptions owner-write"
ON public.subscriptions FOR INSERT, UPDATE, DELETE
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.tenant_id = subscriptions.tenant_id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.tenant_id = subscriptions.tenant_id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
));

-- ──────────────────────────────────────────────────────────────
-- 3. Memberships: prevent downgrading last owner
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "memberships prevent-last-owner-downgrade" ON public.memberships;
CREATE POLICY "memberships prevent-last-owner-downgrade"
ON public.memberships FOR UPDATE
WITH CHECK (
  -- Allow changes if:
  --   a) The target user is not the last owner, OR
  --   b) The target role is still 'owner', OR
  --   c) There are multiple owners in the tenant
  (
    -- Count owners in this tenant
    (SELECT COUNT(*) FROM public.memberships
     WHERE tenant_id = NEW.tenant_id AND role = 'owner') > 1
  )
  OR (NEW.role = 'owner')
  OR (OLD.user_id != (
    -- Check if target is the only owner
    SELECT user_id FROM public.memberships
    WHERE tenant_id = NEW.tenant_id AND role = 'owner'
    LIMIT 1
  ))
);

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
