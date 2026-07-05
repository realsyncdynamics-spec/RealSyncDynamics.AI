-- Evidence Vault Extended: Multi-framework evidence tracking
-- Enhanced evidence management with framework mapping and lifecycle

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Evidence Items (extended) ───

CREATE TABLE IF NOT EXISTS public.evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Basic Info
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT CHECK (evidence_type IN ('document', 'certificate', 'audit_report', 'screenshot', 'log', 'policy', 'training_record', 'assessment', 'other')) DEFAULT 'document',

  -- Storage
  file_path TEXT, -- S3 path (optional, for attachments)
  file_hash TEXT UNIQUE, -- SHA-256 hash for integrity verification
  file_size_bytes INT,
  mime_type TEXT,

  -- Framework Mapping (can map to multiple frameworks)
  framework_codes TEXT[] DEFAULT '{}', -- ['gdpr', 'ai_act', 'iso27001']
  control_ids TEXT[] DEFAULT '{}', -- UUIDs of framework_controls

  -- Linking to gaps and improvements
  gap_ids TEXT[] DEFAULT '{}', -- UUIDs of compliance_gaps this evidence addresses
  ai_system_ids TEXT[] DEFAULT '{}', -- UUIDs of ai_systems this relates to
  dpia_ids TEXT[] DEFAULT '{}', -- UUIDs of dpias

  -- Lifecycle
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- optional retention end date
  archived_at TIMESTAMPTZ,

  -- Metadata
  tags TEXT[] DEFAULT '{}', -- for searching: ['incident', 'breach', 'training', 'incident-response']
  metadata JSONB DEFAULT '{}', -- flexible storage for additional info

  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_items tenant_read"
  ON public.evidence_items FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "evidence_items tenant_write"
  ON public.evidence_items FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "evidence_items tenant_update"
  ON public.evidence_items FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_evidence_items_tenant_id
  ON public.evidence_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_evidence_items_file_hash
  ON public.evidence_items(file_hash);

CREATE INDEX IF NOT EXISTS idx_evidence_items_created_at
  ON public.evidence_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_items_expires_at
  ON public.evidence_items(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_items_framework_codes
  ON public.evidence_items USING GIN(framework_codes);

-- ─── 2. Evidence Links (many-to-many for flexibility) ───

CREATE TABLE IF NOT EXISTS public.evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES public.evidence_items(id) ON DELETE CASCADE,

  -- Can link to various entities
  link_type TEXT NOT NULL, -- 'gap', 'dpia', 'ai_system', 'incident', 'policy'
  link_entity_id UUID NOT NULL, -- ID of the linked entity

  reason TEXT, -- Why this evidence is linked
  linked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(evidence_id, link_type, link_entity_id)
);

ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_links tenant_read"
  ON public.evidence_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.evidence_items ei
    WHERE ei.id = evidence_id AND public.is_tenant_member(ei.tenant_id)
  ));

CREATE INDEX IF NOT EXISTS idx_evidence_links_evidence_id
  ON public.evidence_links(evidence_id);

CREATE INDEX IF NOT EXISTS idx_evidence_links_entity
  ON public.evidence_links(link_type, link_entity_id);

-- ─── 3. Evidence Version History ───

CREATE TABLE IF NOT EXISTS public.evidence_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES public.evidence_items(id) ON DELETE CASCADE,

  version_number INT DEFAULT 1,
  file_hash_previous TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.evidence_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_versions tenant_read"
  ON public.evidence_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.evidence_items ei
    WHERE ei.id = evidence_id AND public.is_tenant_member(ei.tenant_id)
  ));

CREATE INDEX IF NOT EXISTS idx_evidence_versions_evidence_id
  ON public.evidence_versions(evidence_id);

-- ─── 4. RPC: Find evidence by framework ───

CREATE OR REPLACE FUNCTION public.find_evidence_by_framework(
  p_tenant_id UUID,
  p_framework_code TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  evidence_type TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ei.id,
    ei.title,
    ei.evidence_type,
    ei.created_at,
    ei.expires_at
  FROM public.evidence_items ei
  WHERE ei.tenant_id = p_tenant_id
    AND p_framework_code = ANY(ei.framework_codes)
    AND ei.archived_at IS NULL
  ORDER BY ei.created_at DESC;
$$;

-- ─── 5. RPC: List expiring evidence ───

CREATE OR REPLACE FUNCTION public.list_expiring_evidence(
  p_tenant_id UUID,
  p_days_until INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  expires_at TIMESTAMPTZ,
  days_remaining INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ei.id,
    ei.title,
    ei.expires_at,
    (EXTRACT(DAY FROM ei.expires_at - now()))::INT AS days_remaining
  FROM public.evidence_items ei
  WHERE ei.tenant_id = p_tenant_id
    AND ei.expires_at IS NOT NULL
    AND ei.expires_at <= now() + make_interval(days => p_days_until)
    AND ei.archived_at IS NULL
  ORDER BY ei.expires_at ASC;
$$;
