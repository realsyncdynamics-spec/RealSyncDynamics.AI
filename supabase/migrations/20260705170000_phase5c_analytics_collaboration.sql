-- Phase 5C: Analytics, Bulk Operations, Collaboration

-- Table: bulk_import_jobs (async processing of large imports)
CREATE TABLE IF NOT EXISTS public.bulk_import_jobs (
  id TEXT PRIMARY KEY DEFAULT 'job-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'import_gaps', 'import_evidence', 'bulk_update', 'bulk_assign'
  filename TEXT NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'paused'
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Table: compliance_deadlines (regulatory & milestone tracking)
CREATE TABLE IF NOT EXISTS public.compliance_deadlines (
  id TEXT PRIMARY KEY DEFAULT 'deadline-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'regulatory', 'remediation', 'audit', 'certification'
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'in-progress', 'completed', 'overdue'
  framework TEXT, -- Related framework (ISO 27001, NIS2, etc.)
  assigned_to UUID REFERENCES auth.users(id),
  related_gap_id TEXT,
  tags TEXT[],
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: governance_assignments (team member task assignments)
CREATE TABLE IF NOT EXISTS public.governance_assignments (
  id TEXT PRIMARY KEY DEFAULT 'assign-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'gap', 'control', 'plan', 'framework'
  resource_id TEXT NOT NULL,
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT DEFAULT 'editor', -- 'viewer', 'editor', 'owner'
  due_date DATE,
  status TEXT DEFAULT 'open', -- 'open', 'in-progress', 'completed'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: governance_comments (discussion threads per resource)
CREATE TABLE IF NOT EXISTS public.governance_comments (
  id TEXT PRIMARY KEY DEFAULT 'comment-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'gap', 'control', 'plan', etc.
  resource_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  text TEXT NOT NULL,
  mentions TEXT[], -- @username mentions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: governance_audit_log (comprehensive audit trail)
CREATE TABLE IF NOT EXISTS public.governance_audit_log (
  id TEXT PRIMARY KEY DEFAULT 'audit-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', etc.
  resource_type TEXT NOT NULL, -- 'Control', 'Gap', 'Evidence', etc.
  resource_id TEXT NOT NULL,
  resource_name TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  status TEXT DEFAULT 'success', -- 'success', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance

CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_tenant ON public.bulk_import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_status ON public.bulk_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_created_at ON public.bulk_import_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_deadlines_tenant ON public.compliance_deadlines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_deadlines_due_date ON public.compliance_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_deadlines_status ON public.compliance_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_compliance_deadlines_framework ON public.compliance_deadlines(framework);

CREATE INDEX IF NOT EXISTS idx_governance_assignments_tenant ON public.governance_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_assignments_assigned_to ON public.governance_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_governance_assignments_resource ON public.governance_assignments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_governance_assignments_status ON public.governance_assignments(status);

CREATE INDEX IF NOT EXISTS idx_governance_comments_tenant ON public.governance_comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_comments_resource ON public.governance_comments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_governance_comments_user ON public.governance_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_governance_audit_log_tenant ON public.governance_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_log_resource ON public.governance_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_log_user ON public.governance_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_log_created_at ON public.governance_audit_log(created_at DESC);

-- Trigger: Update compliance_deadlines.updated_at
CREATE OR REPLACE FUNCTION update_compliance_deadlines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compliance_deadlines_updated_at_trigger ON public.compliance_deadlines;
CREATE TRIGGER compliance_deadlines_updated_at_trigger
BEFORE UPDATE ON public.compliance_deadlines
FOR EACH ROW
EXECUTE FUNCTION update_compliance_deadlines_updated_at();

-- Trigger: Update governance_assignments.updated_at
CREATE OR REPLACE FUNCTION update_governance_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_assignments_updated_at_trigger ON public.governance_assignments;
CREATE TRIGGER governance_assignments_updated_at_trigger
BEFORE UPDATE ON public.governance_assignments
FOR EACH ROW
EXECUTE FUNCTION update_governance_assignments_updated_at();

-- Trigger: Update governance_comments.updated_at
CREATE OR REPLACE FUNCTION update_governance_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_comments_updated_at_trigger ON public.governance_comments;
CREATE TRIGGER governance_comments_updated_at_trigger
BEFORE UPDATE ON public.governance_comments
FOR EACH ROW
EXECUTE FUNCTION update_governance_comments_updated_at();

-- RLS: Enable RLS on all tables (compliance_metrics_snapshots already enabled in Phase 5A)
ALTER TABLE public.bulk_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: bulk_import_jobs
CREATE POLICY "Users can read jobs in their tenant"
ON public.bulk_import_jobs FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can create jobs in their tenant"
ON public.bulk_import_jobs FOR INSERT
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can update jobs in their tenant"
ON public.bulk_import_jobs FOR UPDATE
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS: compliance_deadlines
CREATE POLICY "Users can read deadlines in their tenant"
ON public.compliance_deadlines FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can create deadlines in their tenant"
ON public.compliance_deadlines FOR INSERT
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can update deadlines in their tenant"
ON public.compliance_deadlines FOR UPDATE
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS: governance_assignments
CREATE POLICY "Users can read assignments in their tenant"
ON public.governance_assignments FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can create assignments in their tenant"
ON public.governance_assignments FOR INSERT
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can update assignments in their tenant"
ON public.governance_assignments FOR UPDATE
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS: governance_comments
CREATE POLICY "Users can read comments in their tenant"
ON public.governance_comments FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can create comments in their tenant"
ON public.governance_comments FOR INSERT
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Users can update own comments"
ON public.governance_comments FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS: governance_audit_log
CREATE POLICY "Users can read audit log in their tenant"
ON public.governance_audit_log FOR SELECT
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Service role can insert audit entries"
ON public.governance_audit_log FOR INSERT
WITH CHECK (true);
