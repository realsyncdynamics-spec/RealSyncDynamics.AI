-- Phase 5B: Custom Frameworks & Integrations

-- Table: custom_frameworks
CREATE TABLE IF NOT EXISTS public.custom_frameworks (
  id TEXT PRIMARY KEY DEFAULT 'cf-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  based_on TEXT, -- 'iso27001', 'iso42001', 'nist', 'cis', 'blank', or another framework ID
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_published BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Table: custom_controls
CREATE TABLE IF NOT EXISTS public.custom_controls (
  id TEXT PRIMARY KEY DEFAULT 'cc-' || gen_random_uuid()::text,
  framework_id TEXT NOT NULL REFERENCES public.custom_frameworks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB, -- Array of assessment criteria
  maturity_levels JSONB, -- Array of {level: 0-5, description: string}
  evidence_requirements JSONB, -- Array of evidence types required
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: custom_framework_mappings
CREATE TABLE IF NOT EXISTS public.custom_framework_mappings (
  id TEXT PRIMARY KEY DEFAULT 'cfm-' || gen_random_uuid()::text,
  framework_id TEXT NOT NULL REFERENCES public.custom_frameworks(id) ON DELETE CASCADE,
  standard_framework TEXT NOT NULL, -- 'ai_act', 'dsgvo', 'nis2', 'hipaa'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_frameworks_tenant_id ON public.custom_frameworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_frameworks_created_at ON public.custom_frameworks(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_frameworks_based_on ON public.custom_frameworks(based_on);

CREATE INDEX IF NOT EXISTS idx_custom_controls_framework_id ON public.custom_controls(framework_id);

CREATE INDEX IF NOT EXISTS idx_custom_framework_mappings_framework_id ON public.custom_framework_mappings(framework_id);
CREATE INDEX IF NOT EXISTS idx_custom_framework_mappings_standard ON public.custom_framework_mappings(standard_framework);

-- Trigger: Update custom_frameworks.updated_at
CREATE OR REPLACE FUNCTION update_custom_frameworks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_frameworks_updated_at_trigger ON public.custom_frameworks;
CREATE TRIGGER custom_frameworks_updated_at_trigger
BEFORE UPDATE ON public.custom_frameworks
FOR EACH ROW
EXECUTE FUNCTION update_custom_frameworks_updated_at();

-- RLS: Enable RLS on all tables
ALTER TABLE public.custom_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_framework_mappings ENABLE ROW LEVEL SECURITY;

-- RLS: custom_frameworks
CREATE POLICY "Users can read frameworks in their tenant"
ON public.custom_frameworks FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can create frameworks in their tenant"
ON public.custom_frameworks FOR INSERT
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can update frameworks in their tenant"
ON public.custom_frameworks FOR UPDATE
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can delete frameworks in their tenant"
ON public.custom_frameworks FOR DELETE
USING (public.is_tenant_member(tenant_id));

-- RLS: custom_controls (inherited via framework_id)
CREATE POLICY "Users can read controls in their frameworks"
ON public.custom_controls FOR SELECT
USING (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can create controls in their frameworks"
ON public.custom_controls FOR INSERT
WITH CHECK (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can update controls in their frameworks"
ON public.custom_controls FOR UPDATE
USING (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete controls in their frameworks"
ON public.custom_controls FOR DELETE
USING (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));

-- RLS: custom_framework_mappings (inherited via framework_id)
CREATE POLICY "Users can read mappings in their frameworks"
ON public.custom_framework_mappings FOR SELECT
USING (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can create mappings in their frameworks"
ON public.custom_framework_mappings FOR INSERT
WITH CHECK (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete mappings in their frameworks"
ON public.custom_framework_mappings FOR DELETE
USING (framework_id IN (
  SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  )
));
