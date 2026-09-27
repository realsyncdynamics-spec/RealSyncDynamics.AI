-- Web App Builder projects (code workbench). REVIEW ONLY — do not apply
-- until production release is explicitly approved.
--
-- NOT siteos_blueprints (that table stays Puck JSON).
-- NOT Cloudflare KV.
-- Append-only versions; writes only via Edge Function siteos/code-persist
-- (service_role). Members may SELECT through RLS.
--
-- Pattern copied from 20260728000000_siteos_core.sql.

CREATE TABLE IF NOT EXISTS public.app_builder_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,

  slug VARCHAR NOT NULL,
  title TEXT NOT NULL DEFAULT '',

  -- File tree: { "index.html": "<!doctype html>...", "styles.css": "..." }
  files JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Merkle / content hash of the file tree (FileStore.snapshot).
  merkle VARCHAR NOT NULL DEFAULT '',
  prev_hash VARCHAR,

  audit JSONB NOT NULL DEFAULT '[]'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,

  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'archived')),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT app_builder_projects_merkle_format
    CHECK (merkle = '' OR merkle ~ '^[0-9a-f]{64}$'),
  CONSTRAINT app_builder_projects_prev_format
    CHECK (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT app_builder_projects_version_unique
    UNIQUE (tenant_id, slug, version)
);

CREATE INDEX IF NOT EXISTS idx_app_builder_projects_tenant
  ON public.app_builder_projects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_builder_projects_slug
  ON public.app_builder_projects (tenant_id, slug, version DESC);
CREATE INDEX IF NOT EXISTS idx_app_builder_projects_status
  ON public.app_builder_projects (tenant_id, status, updated_at DESC);

ALTER TABLE public.app_builder_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_builder_projects tenant-select" ON public.app_builder_projects;
CREATE POLICY "app_builder_projects tenant-select" ON public.app_builder_projects
  FOR SELECT USING (public.is_tenant_member(tenant_id));

-- No INSERT/UPDATE/DELETE policies for authenticated/anon.
-- Edge Function siteos/code-persist writes with service_role, which bypasses RLS.

COMMENT ON TABLE public.app_builder_projects IS
  'Append-only Web App Builder file trees. Distinct from siteos_blueprints (Puck). Writes only via siteos/code-persist (service_role).';
COMMENT ON COLUMN public.app_builder_projects.files IS
  'JSON object of path → UTF-8 source. Not a Puck blueprint.';
COMMENT ON COLUMN public.app_builder_projects.merkle IS
  'SHA-256 merkle of the file tree from the bolt FileStore snapshot.';
