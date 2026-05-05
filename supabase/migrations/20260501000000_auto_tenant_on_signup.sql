-- Auto-bootstrap a tenant + owner membership when a user signs up.
--
-- Until now, after Supabase magic-link signup, the user landed on the app
-- with zero memberships → empty tenant list → broken UX. This trigger fills
-- that gap: every new auth.users row gets a fresh tenant named from the
-- email local-part, plus an owner-role membership pointing at it.
--
-- The trigger is SECURITY DEFINER so it can write into public.tenants /
-- public.memberships even though auth-trigger context has no app role.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_local_part TEXT;
    v_tenant_name TEXT;
    v_tenant_id UUID;
BEGIN
    -- Skip if this user already has any membership (defensive — re-runs
    -- of seed scripts shouldn't double-create).
    IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_local_part := COALESCE(split_part(NEW.email, '@', 1), 'mein-team');
    v_tenant_name := initcap(replace(v_local_part, '.', ' ')) || '''s Workspace';

    INSERT INTO public.tenants (name)
    VALUES (v_tenant_name)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS
    'Bootstraps a tenant + owner membership for every new auth.users row. SECURITY DEFINER required because the auth-trigger context has no app role to satisfy RLS.';
