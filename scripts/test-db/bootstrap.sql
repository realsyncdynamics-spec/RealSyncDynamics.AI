-- scripts/test-db/bootstrap.sql
--
-- Bootstraps a clean Postgres database to run the SPEC-001 + RFC-002/003/004
-- migrations against, without requiring the full Supabase stack.
--
-- Mocks the bare minimum surface that the migration depends on:
--   • extensions schema with pgcrypto
--   • auth schema with: users, uid(), role(), and a JWT-claim-driven impersonation
--   • public.tenants, public.memberships
--   • service_role + authenticated roles
--
-- Run via: psql -v ON_ERROR_STOP=1 -d <db> -f scripts/test-db/bootstrap.sql
--
-- Designed to be idempotent so repeated runs on a fresh DB are safe.

\set ON_ERROR_STOP on

-- Extensions schema (Supabase puts pgcrypto here).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOINHERIT;
    END IF;
END;
$$;

-- auth schema (Supabase-compatible minimal stub)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- auth.uid() reads the current JWT's sub claim. Tests SET LOCAL
-- "request.jwt.claims" to impersonate users.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(
        current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
        ''
    )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
        'authenticated'
    )
$$;

-- public.tenants — minimal shape needed by SPEC-001 FKs.
CREATE TABLE IF NOT EXISTS public.tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- public.memberships — referenced by the existing is_tenant_member() helper.
CREATE TABLE IF NOT EXISTS public.memberships (
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner','admin','member','viewer')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

-- The is_tenant_member helper already exists in production via
-- 20260430180000_tenant_rls_and_webhook_events.sql — recreate it here so
-- the bootstrap is self-contained and we don't depend on every upstream
-- migration being applied first.
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
    );
$$;

-- gen_random_uuid in default search_path (some migrations call it unqualified)
CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS UUID
LANGUAGE sql
AS $$ SELECT extensions.gen_random_uuid() $$;

-- Mirror Supabase's default grants — RLS still gates row visibility, but
-- the table-level GRANT is required before the policy is even evaluated.
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- These defaults apply to tables/sequences created LATER (i.e. by the
-- SPEC-001 migration applied after this bootstrap).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT
    ON SEQUENCES TO authenticated, service_role;

-- And to anything that already exists (tenants, memberships, auth.users)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
    TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth
    TO authenticated, service_role;
