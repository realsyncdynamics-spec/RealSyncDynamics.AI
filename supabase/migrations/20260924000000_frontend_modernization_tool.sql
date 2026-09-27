-- Frontend Modernization Tool (Enterprise+) — data model + RLS.
--
-- Product track: shared/pricing.ts ProductTrack = 'modernize_frontend'
-- (complement to keep_frontend; does NOT replace SiteOS tables).
--
-- Distinct from:
--   siteos_blueprints / siteos_runtime_scans  — SiteOS Puck builder
--   app_builder_projects                      — code workbench file trees
--
-- Namespace: fmt_* (Frontend Modernization). Wizard steps 1–6 live on
-- fmt_projects.wizard_step and drive which child rows are expected.
--
-- Wizard map:
--   1 source   → fmt_source_sites
--   2 scan     → fmt_site_scans
--   3 content  → fmt_content_blocks
--   4 blueprint→ fmt_frontend_blueprints
--   5 bots     → fmt_bot_configs
--   6 publish  → fmt_publish_jobs + fmt_governance_events
--
-- RLS: members SELECT; owner/admin INSERT/UPDATE; service_role ALL
-- (Edge Functions write heavy payloads). Pattern: governance_activations.
--
-- Entitlement: frontend.modernization (boolean) on enterprise + partner.
-- Enforcement for product gates stays in app/Edge via tenant_entitlements;
-- RLS stays membership-based (same as SiteOS / bots).

BEGIN;

-- ─── Entitlement catalog ───────────────────────────────────────────────────

INSERT INTO public.entitlements (key, description, kind)
SELECT v.key, v.beschreibung, v.kind
FROM (VALUES
  (
    'frontend.modernization',
    'Frontend Modernization Tool: Wizard + persistierte Modernisierungsprojekte (Enterprise+)',
    'boolean'
  )
) AS v(key, beschreibung, kind)
WHERE NOT EXISTS (
  SELECT 1 FROM public.entitlements e WHERE e.key = v.key
);

INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, z.value
FROM (VALUES
  ('frontend.modernization', 'free_audit', 0),
  ('frontend.modernization', 'starter', 0),
  ('frontend.modernization', 'growth', 0),
  ('frontend.modernization', 'agency', 0),
  ('frontend.modernization', 'enterprise', 1),
  ('frontend.modernization', 'partner', 1),
  ('frontend.modernization', 'governance_launch', 0)
) AS z(key, plan_key, value)
JOIN public.entitlements e ON e.key = z.key
JOIN public.products p
  ON p.default_for_plan_key = z.plan_key
  OR p.default_for_plan_key = z.plan_key || '_yearly'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements pe
  WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
);

-- ─── 1. Projects (wizard root) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN (
                    'draft', 'in_progress', 'ready_to_publish',
                    'publishing', 'published', 'failed', 'archived'
                  )),
  wizard_step     SMALLINT NOT NULL DEFAULT 1
                  CHECK (wizard_step BETWEEN 1 AND 6),
  product_track   TEXT NOT NULL DEFAULT 'modernize_frontend'
                  CHECK (product_track = 'modernize_frontend'),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fmt_projects IS
  'Frontend Modernization Tool root. Wizard steps 1–6; Enterprise+ via frontend.modernization.';

CREATE INDEX IF NOT EXISTS idx_fmt_projects_tenant
  ON public.fmt_projects (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fmt_projects_status
  ON public.fmt_projects (tenant_id, status);

CREATE OR REPLACE FUNCTION public.fmt_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fmt_projects_update_modtime ON public.fmt_projects;
CREATE TRIGGER fmt_projects_update_modtime
  BEFORE INSERT OR UPDATE ON public.fmt_projects
  FOR EACH ROW EXECUTE FUNCTION public.fmt_set_updated_at();

ALTER TABLE public.fmt_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_projects_tenant_read" ON public.fmt_projects;
CREATE POLICY "fmt_projects_tenant_read" ON public.fmt_projects
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_projects_tenant_insert" ON public.fmt_projects;
CREATE POLICY "fmt_projects_tenant_insert" ON public.fmt_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_projects_tenant_update" ON public.fmt_projects;
CREATE POLICY "fmt_projects_tenant_update" ON public.fmt_projects
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_projects_service" ON public.fmt_projects;
CREATE POLICY "fmt_projects_service" ON public.fmt_projects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.fmt_projects TO authenticated;
GRANT ALL ON public.fmt_projects TO service_role;

-- ─── 2. Source sites (wizard step 1) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_source_sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  normalized_host TEXT,
  fetch_status    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (fetch_status IN ('pending', 'ok', 'failed', 'blocked')),
  raw_meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fmt_source_sites_project_url UNIQUE (project_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_fmt_source_sites_project
  ON public.fmt_source_sites (project_id);
CREATE INDEX IF NOT EXISTS idx_fmt_source_sites_tenant
  ON public.fmt_source_sites (tenant_id);

DROP TRIGGER IF EXISTS fmt_source_sites_update_modtime ON public.fmt_source_sites;
CREATE TRIGGER fmt_source_sites_update_modtime
  BEFORE INSERT OR UPDATE ON public.fmt_source_sites
  FOR EACH ROW EXECUTE FUNCTION public.fmt_set_updated_at();

ALTER TABLE public.fmt_source_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_source_sites_tenant_read" ON public.fmt_source_sites;
CREATE POLICY "fmt_source_sites_tenant_read" ON public.fmt_source_sites
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_source_sites_tenant_write" ON public.fmt_source_sites;
CREATE POLICY "fmt_source_sites_tenant_write" ON public.fmt_source_sites
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_source_sites_service" ON public.fmt_source_sites;
CREATE POLICY "fmt_source_sites_service" ON public.fmt_source_sites
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fmt_source_sites TO authenticated;
GRANT ALL ON public.fmt_source_sites TO service_role;

-- ─── 3. Site scans (wizard step 2) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_site_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  source_site_id  UUID REFERENCES public.fmt_source_sites(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'success', 'failed', 'cancelled')),
  score_summary   JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings        JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmt_site_scans_project
  ON public.fmt_site_scans (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fmt_site_scans_tenant
  ON public.fmt_site_scans (tenant_id);

ALTER TABLE public.fmt_site_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_site_scans_tenant_read" ON public.fmt_site_scans;
CREATE POLICY "fmt_site_scans_tenant_read" ON public.fmt_site_scans
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_site_scans_tenant_write" ON public.fmt_site_scans;
CREATE POLICY "fmt_site_scans_tenant_write" ON public.fmt_site_scans
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_site_scans_service" ON public.fmt_site_scans;
CREATE POLICY "fmt_site_scans_service" ON public.fmt_site_scans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fmt_site_scans TO authenticated;
GRANT ALL ON public.fmt_site_scans TO service_role;

-- ─── 4. Content blocks (wizard step 3) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_content_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  scan_id         UUID REFERENCES public.fmt_site_scans(id) ON DELETE SET NULL,
  block_key       TEXT NOT NULL,
  block_type      TEXT NOT NULL DEFAULT 'generic',
  locale          TEXT NOT NULL DEFAULT 'de',
  title           TEXT,
  body            JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fmt_content_blocks_project_key UNIQUE (project_id, block_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_fmt_content_blocks_project
  ON public.fmt_content_blocks (project_id, sort_order);

DROP TRIGGER IF EXISTS fmt_content_blocks_update_modtime ON public.fmt_content_blocks;
CREATE TRIGGER fmt_content_blocks_update_modtime
  BEFORE INSERT OR UPDATE ON public.fmt_content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.fmt_set_updated_at();

ALTER TABLE public.fmt_content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_content_blocks_tenant_read" ON public.fmt_content_blocks;
CREATE POLICY "fmt_content_blocks_tenant_read" ON public.fmt_content_blocks
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_content_blocks_tenant_write" ON public.fmt_content_blocks;
CREATE POLICY "fmt_content_blocks_tenant_write" ON public.fmt_content_blocks
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_content_blocks_service" ON public.fmt_content_blocks;
CREATE POLICY "fmt_content_blocks_service" ON public.fmt_content_blocks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fmt_content_blocks TO authenticated;
GRANT ALL ON public.fmt_content_blocks TO service_role;

-- ─── 5. Frontend blueprints (wizard step 4) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_frontend_blueprints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'validated', 'approved', 'superseded')),
  blueprint       JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fmt_frontend_blueprints_project_version UNIQUE (project_id, version)
);

COMMENT ON TABLE public.fmt_frontend_blueprints IS
  'FMT blueprint JSON (modernize path). Not siteos_blueprints (Puck SiteOS).';

CREATE INDEX IF NOT EXISTS idx_fmt_frontend_blueprints_project
  ON public.fmt_frontend_blueprints (project_id, version DESC);

DROP TRIGGER IF EXISTS fmt_frontend_blueprints_update_modtime ON public.fmt_frontend_blueprints;
CREATE TRIGGER fmt_frontend_blueprints_update_modtime
  BEFORE INSERT OR UPDATE ON public.fmt_frontend_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.fmt_set_updated_at();

ALTER TABLE public.fmt_frontend_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_frontend_blueprints_tenant_read" ON public.fmt_frontend_blueprints;
CREATE POLICY "fmt_frontend_blueprints_tenant_read" ON public.fmt_frontend_blueprints
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_frontend_blueprints_tenant_write" ON public.fmt_frontend_blueprints;
CREATE POLICY "fmt_frontend_blueprints_tenant_write" ON public.fmt_frontend_blueprints
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_frontend_blueprints_service" ON public.fmt_frontend_blueprints;
CREATE POLICY "fmt_frontend_blueprints_service" ON public.fmt_frontend_blueprints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fmt_frontend_blueprints TO authenticated;
GRANT ALL ON public.fmt_frontend_blueprints TO service_role;

-- ─── 6. Bot configs (wizard step 5) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_bot_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  bot_kind        TEXT NOT NULL DEFAULT 'website_chat'
                  CHECK (bot_kind IN (
                    'website_chat', 'voice_bot', 'whatsapp_bot', 'custom'
                  )),
  -- Optional link to public.bots when a live bot row exists
  bot_id          UUID,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fmt_bot_configs_project_kind UNIQUE (project_id, bot_kind)
);

CREATE INDEX IF NOT EXISTS idx_fmt_bot_configs_project
  ON public.fmt_bot_configs (project_id);

DROP TRIGGER IF EXISTS fmt_bot_configs_update_modtime ON public.fmt_bot_configs;
CREATE TRIGGER fmt_bot_configs_update_modtime
  BEFORE INSERT OR UPDATE ON public.fmt_bot_configs
  FOR EACH ROW EXECUTE FUNCTION public.fmt_set_updated_at();

ALTER TABLE public.fmt_bot_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_bot_configs_tenant_read" ON public.fmt_bot_configs;
CREATE POLICY "fmt_bot_configs_tenant_read" ON public.fmt_bot_configs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_bot_configs_tenant_write" ON public.fmt_bot_configs;
CREATE POLICY "fmt_bot_configs_tenant_write" ON public.fmt_bot_configs
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_bot_configs_service" ON public.fmt_bot_configs;
CREATE POLICY "fmt_bot_configs_service" ON public.fmt_bot_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fmt_bot_configs TO authenticated;
GRANT ALL ON public.fmt_bot_configs TO service_role;

-- ─── 7. Publish jobs (wizard step 6) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fmt_publish_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  blueprint_id    UUID REFERENCES public.fmt_frontend_blueprints(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN (
                    'queued', 'running', 'success', 'failed', 'cancelled', 'rolled_back'
                  )),
  target          TEXT NOT NULL DEFAULT 'preview'
                  CHECK (target IN ('preview', 'staging', 'production')),
  result          JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmt_publish_jobs_project
  ON public.fmt_publish_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fmt_publish_jobs_status
  ON public.fmt_publish_jobs (tenant_id, status);

ALTER TABLE public.fmt_publish_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmt_publish_jobs_tenant_read" ON public.fmt_publish_jobs;
CREATE POLICY "fmt_publish_jobs_tenant_read" ON public.fmt_publish_jobs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_publish_jobs_tenant_write" ON public.fmt_publish_jobs;
CREATE POLICY "fmt_publish_jobs_tenant_write" ON public.fmt_publish_jobs
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_publish_jobs_service" ON public.fmt_publish_jobs;
CREATE POLICY "fmt_publish_jobs_service" ON public.fmt_publish_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fmt_publish_jobs TO authenticated;
GRANT ALL ON public.fmt_publish_jobs TO service_role;

-- ─── 8. Governance events (audit trail for wizard / publish) ───────────────

CREATE TABLE IF NOT EXISTS public.fmt_governance_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.fmt_projects(id) ON DELETE CASCADE,
  publish_job_id  UUID REFERENCES public.fmt_publish_jobs(id) ON DELETE SET NULL,
  actor_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmt_governance_events_project
  ON public.fmt_governance_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fmt_governance_events_tenant
  ON public.fmt_governance_events (tenant_id, created_at DESC);

ALTER TABLE public.fmt_governance_events ENABLE ROW LEVEL SECURITY;

-- Append-oriented: members read; owner/admin insert; no update/delete for auth
DROP POLICY IF EXISTS "fmt_governance_events_tenant_read" ON public.fmt_governance_events;
CREATE POLICY "fmt_governance_events_tenant_read" ON public.fmt_governance_events
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "fmt_governance_events_tenant_insert" ON public.fmt_governance_events;
CREATE POLICY "fmt_governance_events_tenant_insert" ON public.fmt_governance_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fmt_governance_events_service" ON public.fmt_governance_events;
CREATE POLICY "fmt_governance_events_service" ON public.fmt_governance_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON public.fmt_governance_events TO authenticated;
GRANT ALL ON public.fmt_governance_events TO service_role;

COMMIT;
