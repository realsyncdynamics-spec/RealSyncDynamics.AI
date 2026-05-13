-- Enterprise AI OS — Founding Access + AI Inventory + Policies + Audit + Feedback.
--
-- Additive to the existing AI Governance Core (#136/#137/#139). No FK back into
-- those tables for now — Enterprise AI OS is a public-facing top-of-funnel
-- product surface (Founding Access form, dashboard preview) that will hook
-- into the governance core via a follow-up migration once a tenant is paired.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================
-- 1. Founding Access — 14-day free access, capped at 100 companies
--    or 2026-08-02, whichever comes first.
-- =================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_founders_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  website_url TEXT,
  access_status TEXT NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('active', 'expired', 'revoked', 'converted')),
  access_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  feedback_required BOOLEAN NOT NULL DEFAULT true,
  max_free_until DATE NOT NULL DEFAULT DATE '2026-08-02',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_founders_access_status_idx
  ON public.enterprise_founders_access(access_status);
CREATE INDEX IF NOT EXISTS enterprise_founders_access_tenant_idx
  ON public.enterprise_founders_access(tenant_id);

-- =================================================================
-- 2. Connectors (Microsoft 365, Slack, SAP, Salesforce, …).
-- =================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'microsoft365', 'slack', 'salesforce', 'hubspot',
      'sap', 'jira', 'custom_api'
    )
  ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('connected', 'pending', 'error', 'disabled')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_connectors_tenant_idx
  ON public.enterprise_connectors(tenant_id);

-- =================================================================
-- 3. AI System Registry — inventory of AI tools used in the tenant.
-- =================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_ai_system_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  usage_context TEXT,
  risk_level TEXT NOT NULL DEFAULT 'unknown'
    CHECK (risk_level IN ('minimal', 'limited', 'high', 'prohibited', 'unknown')),
  contains_personal_data BOOLEAN NOT NULL DEFAULT false,
  contains_sensitive_data BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_ai_system_registry_tenant_idx
  ON public.enterprise_ai_system_registry(tenant_id);

-- =================================================================
-- 4. Agent Policies — gating rules for AI agent actions.
-- =================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  allowed_models TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  forbidden_data_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  requires_human_approval BOOLEAN NOT NULL DEFAULT true,
  external_actions_allowed BOOLEAN NOT NULL DEFAULT false,
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_agent_policies_tenant_idx
  ON public.enterprise_agent_policies(tenant_id);

-- =================================================================
-- 5. AI Audit Events — append-only audit trail of policy evaluations
--    and AI system interactions surfaced via the Enterprise AI OS.
-- =================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_ai_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  system_name TEXT,
  risk_level TEXT CHECK (
    risk_level IN ('minimal', 'limited', 'high', 'prohibited', 'unknown')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_ai_audit_events_tenant_idx
  ON public.enterprise_ai_audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS enterprise_ai_audit_events_created_idx
  ON public.enterprise_ai_audit_events(created_at DESC);

-- =================================================================
-- 6. Feedback Reports — Founders return bugs, improvements, screenshots.
-- =================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  founder_access_id UUID REFERENCES public.enterprise_founders_access(id) ON DELETE SET NULL,
  company_name TEXT,
  contact_email TEXT,
  type TEXT NOT NULL CHECK (
    type IN ('bug', 'improvement', 'feature_request', 'security_issue', 'ux_feedback')
  ),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  module TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'planned', 'fixed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_feedback_reports_status_idx
  ON public.enterprise_feedback_reports(status);
CREATE INDEX IF NOT EXISTS enterprise_feedback_reports_founder_idx
  ON public.enterprise_feedback_reports(founder_access_id);

-- =================================================================
-- RLS
-- =================================================================
ALTER TABLE public.enterprise_founders_access      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_connectors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_ai_system_registry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_agent_policies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_ai_audit_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_feedback_reports     ENABLE ROW LEVEL SECURITY;

-- Public-form inserts for Founding Access + Feedback go through the Edge
-- Functions which use the service-role key, so we do NOT grant anon insert
-- on these tables. Anon clients have no direct access. The service-role
-- bypass-RLS pattern matches the rest of the contact-form / waitlist
-- surfaces in this repo.

-- Authenticated tenant reads — minimal scaffolding; full tenant_users RLS
-- comes in a follow-up migration once Enterprise AI OS is paired with a
-- tenant. For now no policy = no rows visible to non-service-role clients.
