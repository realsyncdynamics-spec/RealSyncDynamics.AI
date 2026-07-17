-- Migration: 20260717_website_operations_core.sql
-- Description: Website Operations Layer — Core data model for AI-generated website management
--
-- Adds tables:
-- - website_projects: Master table for each customer website project
-- - website_domains: Domain management with Cloudflare integration
-- - deployment_logs: Audit trail of all deployment events
-- - website_compliance_reports: DSGVO + EU AI Act compliance scores
--
-- All tables follow multi-tenant RLS pattern (tenant_id).

-- ============================================================================
-- 1. WEBSITE_PROJECTS — Master table for website projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Core metadata
  name VARCHAR NOT NULL,
  industry VARCHAR NOT NULL, -- tattoo-studio, handwerker, dienstleister, einzelunternehmer, etc.
  description TEXT,

  -- Status workflow: draft → preview → live → archived
  status VARCHAR NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'preview', 'live', 'archived')),

  -- Template selection (optional, can be AI-generated without template)
  template VARCHAR,

  -- Deployment targets
  cloudflare_project_id VARCHAR, -- Pages project ID
  cloudflare_r2_bucket VARCHAR, -- R2 bucket for assets
  deployment_url TEXT, -- Current live URL
  preview_url TEXT, -- Preview deployment URL

  -- Content & assets (JSONB for flexibility)
  company_info JSONB NOT NULL DEFAULT '{}'::jsonb, -- { name, description, contact, logo_url, images[] }
  services JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { name, description, icon }
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb, -- { theme, colors, fonts, seo_settings, etc }

  -- Compliance & metadata
  compliance_score DECIMAL(5,2), -- 0-100, calculated by compliance-check
  compliance_last_checked_at TIMESTAMP WITH TIME ZONE,
  compliance_findings JSONB DEFAULT '[]'::jsonb,

  -- Tracking & timestamps
  last_deployed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT website_projects_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE INDEX idx_website_projects_tenant_id ON public.website_projects(tenant_id);
CREATE INDEX idx_website_projects_status ON public.website_projects(status);
CREATE INDEX idx_website_projects_industry ON public.website_projects(industry);
CREATE INDEX idx_website_projects_created_at ON public.website_projects(created_at DESC);

ALTER TABLE public.website_projects ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant members can view/edit their projects
CREATE POLICY "Users can view their tenant's website projects"
  ON public.website_projects FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can insert website projects for their tenant"
  ON public.website_projects FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update their tenant's website projects"
  ON public.website_projects FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can delete their tenant's website projects"
  ON public.website_projects FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

COMMENT ON TABLE public.website_projects IS
  'Master table for AI-generated website projects. Each project represents one customer website lifecycle (draft → preview → live).';

COMMENT ON COLUMN public.website_projects.industry IS
  'Industry classification for template selection and compliance rules (tattoo-studio, handwerker, dienstleister, einzelunternehmer, etc).';

COMMENT ON COLUMN public.website_projects.compliance_score IS
  'Aggregate DSGVO + EU AI Act compliance score (0-100). Updated by website-compliance-check function.';

-- ============================================================================
-- 2. WEBSITE_DOMAINS — Domain management with Cloudflare integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.website_projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Domain information
  domain VARCHAR NOT NULL UNIQUE, -- e.g., "tattoo-studio.de" or "subdomain.realsyncdynamics.ai"
  domain_type VARCHAR NOT NULL DEFAULT 'subdomain' CHECK (domain_type IN ('subdomain', 'custom')),

  -- Cloudflare integration
  cloudflare_zone_id VARCHAR, -- Zone ID for custom domains
  cloudflare_record_id VARCHAR, -- CNAME record ID
  cloudflare_status VARCHAR DEFAULT 'pending' -- pending, validating, active, failed
    CHECK (cloudflare_status IN ('pending', 'validating', 'active', 'failed')),

  -- SSL/TLS
  ssl_status VARCHAR DEFAULT 'pending'
    CHECK (ssl_status IN ('pending', 'pending_validation', 'active', 'expired', 'failed')),
  ssl_certificate_id VARCHAR,
  ssl_expires_at TIMESTAMP WITH TIME ZONE,

  -- DNS validation (for custom domains)
  dns_validation_token VARCHAR,
  dns_validation_record VARCHAR,
  dns_validated_at TIMESTAMP WITH TIME ZONE,

  -- Routing
  is_primary BOOLEAN DEFAULT false, -- Only one primary domain per project
  is_active BOOLEAN DEFAULT true,

  -- Tracking
  connected_at TIMESTAMP WITH TIME ZONE,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT website_domains_project_fk FOREIGN KEY (project_id) REFERENCES public.website_projects(id),
  CONSTRAINT website_domains_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Enforce "only one primary domain per project" via a partial unique index.
-- (A table-level UNIQUE constraint cannot carry a WHERE clause; a partial
--  unique index is the correct construct.)
CREATE UNIQUE INDEX IF NOT EXISTS website_domains_primary_unique
  ON public.website_domains(project_id) WHERE is_primary = true;

CREATE INDEX idx_website_domains_project_id ON public.website_domains(project_id);
CREATE INDEX idx_website_domains_tenant_id ON public.website_domains(tenant_id);
CREATE INDEX idx_website_domains_domain ON public.website_domains(domain);
CREATE INDEX idx_website_domains_status ON public.website_domains(cloudflare_status);
CREATE INDEX idx_website_domains_ssl_status ON public.website_domains(ssl_status);

ALTER TABLE public.website_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's domains"
  ON public.website_domains FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can insert domains for their projects"
  ON public.website_domains FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update their tenant's domains"
  ON public.website_domains FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can delete their tenant's domains"
  ON public.website_domains FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

COMMENT ON TABLE public.website_domains IS
  'Domain management for website projects. Supports both realsyncdynamics.ai subdomains and custom customer domains with Cloudflare integration.';

COMMENT ON COLUMN public.website_domains.domain_type IS
  'subdomain: managed realsyncdynamics.ai subdomain (instant). custom: customer brings their own domain (requires DNS validation).';

-- ============================================================================
-- 3. DEPLOYMENT_LOGS — Audit trail for all deployment events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.website_projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Event classification
  event_type VARCHAR NOT NULL -- build, deploy, validation, dns, ssl, domain_connect, maintenance
    CHECK (event_type IN ('build', 'deploy', 'validation', 'dns', 'ssl', 'domain_connect', 'maintenance')),

  status VARCHAR NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'warning', 'failed', 'skipped')),

  -- Event details
  title VARCHAR NOT NULL,
  message TEXT,
  details JSONB DEFAULT '{}', -- { duration_ms, error_code, cloudflare_response, etc }

  -- Triggered by (automation or user)
  triggered_by VARCHAR DEFAULT 'automation', -- automation, user
  triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT deployment_logs_project_fk FOREIGN KEY (project_id) REFERENCES public.website_projects(id),
  CONSTRAINT deployment_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE INDEX idx_deployment_logs_project_id ON public.deployment_logs(project_id);
CREATE INDEX idx_deployment_logs_tenant_id ON public.deployment_logs(tenant_id);
CREATE INDEX idx_deployment_logs_event_type ON public.deployment_logs(event_type);
CREATE INDEX idx_deployment_logs_status ON public.deployment_logs(status);
CREATE INDEX idx_deployment_logs_created_at ON public.deployment_logs(created_at DESC);

ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's deployment logs"
  ON public.deployment_logs FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Service role can insert logs"
  ON public.deployment_logs FOR INSERT
  WITH CHECK (true); -- Service role (Edge Functions) always allowed

COMMENT ON TABLE public.deployment_logs IS
  'Immutable audit trail of all deployment events. Used for status tracking, troubleshooting, and compliance audits.';

-- ============================================================================
-- 4. WEBSITE_COMPLIANCE_REPORTS — DSGVO + EU AI Act compliance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.website_projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Scope
  report_type VARCHAR NOT NULL DEFAULT 'full' -- full, dsgvo, eu_ai_act
    CHECK (report_type IN ('full', 'dsgvo', 'eu_ai_act')),

  -- Scoring
  overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  dsgvo_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  eu_ai_act_score DECIMAL(5,2) NOT NULL DEFAULT 0,

  -- Findings (detailed compliance issues)
  findings JSONB NOT NULL DEFAULT '[]', -- Array of { category, severity, title, description, remediation_steps }
  critical_findings INTEGER DEFAULT 0,
  warning_findings INTEGER DEFAULT 0,
  info_findings INTEGER DEFAULT 0,

  -- Evidence & documentation
  evidence_collected JSONB DEFAULT '{}', -- { html_snapshot, headers, external_resources, etc }
  manual_review_required BOOLEAN DEFAULT false,

  -- Compliance status
  status VARCHAR NOT NULL DEFAULT 'pending' -- pending, in_review, compliant, non_compliant, remediation_in_progress
    CHECK (status IN ('pending', 'in_review', 'compliant', 'non_compliant', 'remediation_in_progress')),

  -- Tracking
  checked_by VARCHAR DEFAULT 'ai-compliance-agent',
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Compliance reports have TTL
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT website_compliance_reports_project_fk FOREIGN KEY (project_id) REFERENCES public.website_projects(id),
  CONSTRAINT website_compliance_reports_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE INDEX idx_website_compliance_reports_project_id ON public.website_compliance_reports(project_id);
CREATE INDEX idx_website_compliance_reports_tenant_id ON public.website_compliance_reports(tenant_id);
CREATE INDEX idx_website_compliance_reports_status ON public.website_compliance_reports(status);
CREATE INDEX idx_website_compliance_reports_checked_at ON public.website_compliance_reports(checked_at DESC);
CREATE INDEX idx_website_compliance_reports_expires_at ON public.website_compliance_reports(expires_at);

ALTER TABLE public.website_compliance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's compliance reports"
  ON public.website_compliance_reports FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Service role can insert/update reports"
  ON public.website_compliance_reports FOR INSERT
  WITH CHECK (true); -- Service role allowed

CREATE POLICY "Service role can update reports"
  ON public.website_compliance_reports FOR UPDATE
  USING (true)
  WITH CHECK (true); -- Service role allowed

COMMENT ON TABLE public.website_compliance_reports IS
  'Compliance audit reports for generated websites. Tracks DSGVO + EU AI Act conformity with remediation tracking.';

COMMENT ON COLUMN public.website_compliance_reports.findings IS
  'Structured findings array. Each finding includes category (cookies, tracking, legal_pages, ai_disclosure, etc), severity (critical, warning, info), and remediation steps.';

COMMENT ON COLUMN public.website_compliance_reports.evidence_collected IS
  'Snapshot of evidence used during audit (HTML, headers, detected third-party resources, AI model disclosures).';

-- ============================================================================
-- TRIGGERS: Maintain updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_website_projects_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_projects_updated ON public.website_projects;
CREATE TRIGGER website_projects_updated
  BEFORE UPDATE ON public.website_projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_website_projects_updated();

CREATE OR REPLACE FUNCTION public.tg_website_domains_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_domains_updated ON public.website_domains;
CREATE TRIGGER website_domains_updated
  BEFORE UPDATE ON public.website_domains
  FOR EACH ROW EXECUTE FUNCTION public.tg_website_domains_updated();

CREATE OR REPLACE FUNCTION public.tg_website_compliance_reports_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_compliance_reports_updated ON public.website_compliance_reports;
CREATE TRIGGER website_compliance_reports_updated
  BEFORE UPDATE ON public.website_compliance_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_website_compliance_reports_updated();
