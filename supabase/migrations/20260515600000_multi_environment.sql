-- Multi-Environment support (PR #159).
-- Trennt production / staging / development / testing pro Tenant
-- ohne separates Supabase-Projekt.

ALTER TABLE public.governance_assets   ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));
ALTER TABLE public.governance_policies ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));
ALTER TABLE public.governance_events   ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));
ALTER TABLE public.governance_evidence ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));
ALTER TABLE public.dpias               ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));
ALTER TABLE public.incidents           ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));
ALTER TABLE public.governance_ingest_keys ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','testing'));

CREATE INDEX IF NOT EXISTS idx_governance_assets_env ON public.governance_assets(tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_governance_events_env ON public.governance_events(tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_governance_policies_env ON public.governance_policies(tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_governance_ingest_keys_env ON public.governance_ingest_keys(tenant_id, environment);
