-- RLS for tenant-scoped tables + webhook_events for Stripe idempotency.
-- Built on top of the renamed schema (tenants/memberships).

-- 1. Webhook idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id           TEXT PRIMARY KEY,            -- Stripe event id
    type         TEXT NOT NULL,
    payload      JSONB,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Default-deny: only the service role (no JWT) sees / writes this table.
CREATE POLICY "webhook_events service-role only"
    ON public.webhook_events
    FOR ALL
    USING (false)
    WITH CHECK (false);

COMMENT ON TABLE public.webhook_events IS
    'Idempotency-store for Stripe (and future) webhooks. Deny-by-default RLS; only the edge function with the service-role key may read/write.';

-- 2. Helper: is the calling user a member of <tenant_id>?
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE tenant_id = p_tenant_id
          AND user_id   = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.is_tenant_member(UUID) IS
    'Returns true iff auth.uid() has a membership row in the given tenant. SECURITY DEFINER so RLS-checked policies can call it without recursion.';

-- 3. Enable RLS on the multi-tenant tables (idempotent)
ALTER TABLE public.tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets        ENABLE ROW LEVEL SECURITY;

-- 4. Policies — drop-then-create for replayability
DROP POLICY IF EXISTS "tenants member-read"          ON public.tenants;
DROP POLICY IF EXISTS "tenants owner-update"         ON public.tenants;
DROP POLICY IF EXISTS "memberships self-or-tenant"   ON public.memberships;
DROP POLICY IF EXISTS "memberships owner-write"      ON public.memberships;
DROP POLICY IF EXISTS "subscriptions tenant-read"    ON public.subscriptions;
DROP POLICY IF EXISTS "usage_counters tenant-read"   ON public.usage_counters;
DROP POLICY IF EXISTS "audit_events tenant-read"     ON public.audit_events;
DROP POLICY IF EXISTS "assets tenant-rw"             ON public.assets;

CREATE POLICY "tenants member-read"
    ON public.tenants FOR SELECT
    USING (public.is_tenant_member(id));

CREATE POLICY "tenants owner-update"
    ON public.tenants FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenants.id
          AND m.user_id   = auth.uid()
          AND m.role      = 'owner'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenants.id
          AND m.user_id   = auth.uid()
          AND m.role      = 'owner'
    ));

-- Membership: a user always sees their own row, plus all members of tenants they belong to.
CREATE POLICY "memberships self-or-tenant"
    ON public.memberships FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.is_tenant_member(tenant_id)
    );

-- Owners and admins manage memberships of their tenants.
CREATE POLICY "memberships owner-write"
    ON public.memberships FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = memberships.tenant_id
          AND m.user_id   = auth.uid()
          AND m.role      IN ('owner', 'admin')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = memberships.tenant_id
          AND m.user_id   = auth.uid()
          AND m.role      IN ('owner', 'admin')
    ));

-- Subscriptions: read for any tenant member; writes happen only via service role.
CREATE POLICY "subscriptions tenant-read"
    ON public.subscriptions FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Usage counters: read for any tenant member; writes happen only via service role.
CREATE POLICY "usage_counters tenant-read"
    ON public.usage_counters FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Audit events: read for any tenant member; inserts only via service role.
CREATE POLICY "audit_events tenant-read"
    ON public.audit_events FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Assets: full RW for tenant members (basic policy; tighten per-role later if needed).
CREATE POLICY "assets tenant-rw"
    ON public.assets FOR ALL
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));
