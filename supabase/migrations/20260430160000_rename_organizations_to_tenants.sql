-- Rename organizations → tenants and organization_members → memberships,
-- keeping all FKs and data intact. Idempotent: safe to run on a fresh DB
-- (where organizations doesn't exist) and on one where the rename already happened.

-- 1. Tables
ALTER TABLE IF EXISTS public.organizations RENAME TO tenants;
ALTER TABLE IF EXISTS public.organization_members RENAME TO memberships;

-- 2. Columns: organization_id → tenant_id, on every table that references the renamed table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'organization_id'
    LOOP
        EXECUTE format('ALTER TABLE public.%I RENAME COLUMN organization_id TO tenant_id', r.table_name);
    END LOOP;
END $$;

-- 3. Drop the old auto-renamed unique constraint and recreate with the new name (cosmetic)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organization_members_organization_id_user_id_key'
    ) THEN
        ALTER TABLE public.memberships
            RENAME CONSTRAINT organization_members_organization_id_user_id_key
            TO memberships_tenant_id_user_id_key;
    END IF;
END $$;

-- 4. Rename trigger that referenced organizations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_modtime') THEN
        ALTER TRIGGER update_organizations_modtime ON public.tenants
            RENAME TO update_tenants_modtime;
    END IF;
END $$;

-- 5. Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_memberships_user   ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);

COMMENT ON TABLE public.tenants IS
    'Mandant (vormals organizations). Multi-Tenant-Wurzel; Memberships, Subscriptions und alle Domain-Tabellen referenzieren tenant_id.';
COMMENT ON TABLE public.memberships IS
    'Mitgliedschaft (vormals organization_members). Verknüpft auth.users mit tenants über eine Rolle.';
