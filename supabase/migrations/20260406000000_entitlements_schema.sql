-- Migration: 20260406000000_entitlements_schema.sql
-- Description: Core tables for RealSyncDynamics Entitlement & Billing structure

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_public_sector BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users in Supabase
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer_auditor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 3. Subscriptions (Stripe mapping)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    stripe_product_id TEXT,
    stripe_price_id TEXT,
    plan_key TEXT NOT NULL,
    billing_interval TEXT NOT NULL DEFAULT 'month',
    status TEXT NOT NULL,
    quantity INTEGER,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Subscription Items / Add-ons
CREATE TABLE IF NOT EXISTS subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    addon_key TEXT NOT NULL,
    stripe_item_id TEXT UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Usage Counters (Monthly Buckets)
CREATE TABLE IF NOT EXISTS usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    month_bucket DATE NOT NULL, -- e.g., '2026-04-01'
    active_assets INTEGER NOT NULL DEFAULT 0,
    monthly_registrations INTEGER NOT NULL DEFAULT 0,
    api_calls_monthly INTEGER NOT NULL DEFAULT 0,
    bulk_jobs_monthly INTEGER NOT NULL DEFAULT 0,
    compliance_exports_monthly INTEGER NOT NULL DEFAULT 0,
    UNIQUE (organization_id, month_bucket)
);

-- 6. Assets (Basic structure for CreatorSeal)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL,
    title TEXT NOT NULL,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'registered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Provenance Records (C2PA / eIDAS tie-in)
CREATE TABLE IF NOT EXISTS provenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    c2pa_manifest_uri TEXT,
    hash_digest TEXT NOT NULL,
    signature TEXT,
    timestamp_authority_token TEXT, -- eIDAS timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    resource_id TEXT,
    evidence_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_modtime
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_subscriptions_modtime
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_assets_modtime
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
