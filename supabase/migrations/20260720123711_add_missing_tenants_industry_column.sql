-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02).
-- Direkt auf Prod angewendet, nie ins Repo committet (Drift). Inhalt 1:1 aus
-- supabase_migrations.schema_migrations (Version 20260720123711).

-- Root cause fix for a live production bug: the frontend queries
-- `tenant:tenants(id,name,is_public_sector,industry)` on every page load
-- (confirmed via API logs — GET /rest/v1/memberships?select=...tenants(...industry)
-- returning 400 repeatedly, once per page view, for real logged-in users).
-- public.tenants has no `industry` column, so PostgREST rejects the embed
-- with 400 on every single request. `industry text` already exists as a
-- pattern on market_gaps/research_runs, so this brings tenants in line and
-- is purely additive/nullable — no risk to existing data or app logic.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS industry text;
