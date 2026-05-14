-- Fix infinite recursion (Postgres 42P17) in the "memberships owner-write" policy.
--
-- The previous policy on public.memberships used a subquery that selected from
-- public.memberships itself. Because RLS is re-evaluated on that inner SELECT,
-- Postgres recursed infinitely and every /rest/v1/memberships call returned 500.
--
-- The fix mirrors the pattern already used by public.is_tenant_member: a
-- SECURITY DEFINER helper that bypasses RLS when checking owner/admin status,
-- so the policy no longer references the table it protects.

CREATE OR REPLACE FUNCTION public.is_tenant_owner_or_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id   = auth.uid()
          AND m.role      IN ('owner', 'admin')
    );
$$;

COMMENT ON FUNCTION public.is_tenant_owner_or_admin(UUID) IS
    'Returns true iff auth.uid() is owner or admin of the given tenant. SECURITY DEFINER so policies on memberships can call it without triggering RLS recursion.';

DROP POLICY IF EXISTS "memberships owner-write" ON public.memberships;

CREATE POLICY "memberships owner-write"
    ON public.memberships
    FOR ALL
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));
