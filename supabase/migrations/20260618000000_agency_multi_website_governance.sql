-- Agency Multi-Website Governance — Pilot-MVP-Schema
-- (P1.1 in docs/pilot/technical-tasks.md)
--
-- Erlaubt einer Tenant-Agentur, mehrere Mandanten (clients) zu verwalten,
-- pro Mandant beliebig viele Websites zu überwachen, Scans periodisch
-- laufen zu lassen, Findings zu sammeln und signierte SPEC-001
-- Evidence-Bundles pro Reporting-Zyklus zu persistieren.
--
-- Tenancy: tenant_id-spaltenbasiert auf JEDER Tabelle. RLS via
-- public.is_tenant_member(tenant_id). Cross-Tenant-Reads/-Writes sind
-- damit unmöglich. Auf Foreign-Key-Ebene sind agency_sites/-scans/
-- -findings/-evidence_bundles zusätzlich an ihre Parent-Row gebunden.
--
-- Idempotent (IF NOT EXISTS + DROP POLICY IF EXISTS).
-- Additive Migration — bricht keine bestehenden Tabellen/Policies.

-- ─── 1. agency_clients (Mandanten der Agentur) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  contact_email   TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_clients_tenant
  ON public.agency_clients(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_clients_tenant_status
  ON public.agency_clients(tenant_id, status)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_agency_clients_updated_at ON public.agency_clients;
CREATE TRIGGER trg_agency_clients_updated_at BEFORE UPDATE ON public.agency_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.agency_clients IS
  'Mandanten einer Tenant-Agentur. Jeder client gehört zu genau einem tenant.';

-- ─── 2. agency_sites (Websites pro Mandant) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  label           TEXT,
  scan_enabled    BOOLEAN NOT NULL DEFAULT true,
  scan_schedule   TEXT NOT NULL DEFAULT 'weekly'
                    CHECK (scan_schedule IN ('weekly','manual')),
  last_scan_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_sites_tenant
  ON public.agency_sites(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_sites_client
  ON public.agency_sites(client_id);

CREATE INDEX IF NOT EXISTS idx_agency_sites_schedule_active
  ON public.agency_sites(tenant_id, scan_schedule)
  WHERE scan_enabled = true;

DROP TRIGGER IF EXISTS trg_agency_sites_updated_at ON public.agency_sites;
CREATE TRIGGER trg_agency_sites_updated_at BEFORE UPDATE ON public.agency_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.agency_sites IS
  'Überwachte Websites. Jede Site gehört zu genau einem client + tenant.';

-- ─── 3. agency_scans (Scan-Läufe) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES public.agency_sites(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL
                    CHECK (kind IN ('initial','recurring','manual')),
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','done','failed')),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  error           TEXT,
  findings_count  INTEGER NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
  risk_score      INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_scans_tenant
  ON public.agency_scans(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_scans_site_created
  ON public.agency_scans(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_scans_status
  ON public.agency_scans(status)
  WHERE status IN ('queued','running');

COMMENT ON TABLE public.agency_scans IS
  'Einzelne Scan-Läufe pro Site. Append-only Lifecycle queued → running → done|failed.';

-- ─── 4. agency_findings ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scan_id         UUID NOT NULL REFERENCES public.agency_scans(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES public.agency_sites(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
                    'pre_consent_tracking',
                    'unknown_vendor',
                    'missing_required',
                    'ai_widget',
                    'uncategorized_cookie'
                  )),
  severity        TEXT NOT NULL
                    CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT NOT NULL,
  detail          JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation  TEXT,
  review_state    TEXT NOT NULL DEFAULT 'open'
                    CHECK (review_state IN ('open','acknowledged','false_positive','resolved')),
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_findings_tenant
  ON public.agency_findings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_findings_scan
  ON public.agency_findings(scan_id);

CREATE INDEX IF NOT EXISTS idx_agency_findings_site_severity
  ON public.agency_findings(site_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_findings_open
  ON public.agency_findings(tenant_id, severity)
  WHERE review_state = 'open';

COMMENT ON TABLE public.agency_findings IS
  'Einzelne Befunde aus Scans. Pro Finding: Severity, Evidence (JSONB), Recommendation.';

-- ─── 5. agency_evidence_bundles (SPEC-001 signiert) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_evidence_bundles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES public.agency_sites(id) ON DELETE CASCADE,
  scan_id         UUID REFERENCES public.agency_scans(id) ON DELETE SET NULL,
  bundle_id       TEXT NOT NULL UNIQUE,
  key_id          TEXT NOT NULL,
  chain_tip       TEXT NOT NULL,
  signature       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  event_count     INTEGER NOT NULL CHECK (event_count >= 0),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_agency_evidence_bundles_tenant
  ON public.agency_evidence_bundles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_evidence_bundles_site_period
  ON public.agency_evidence_bundles(site_id, period_end DESC);

COMMENT ON TABLE public.agency_evidence_bundles IS
  'Signierte SPEC-001 Evidence-Bundles pro Reporting-Zyklus. Storage-Path zeigt auf Supabase Storage. Bundle ist lokal mit realsync-cli verifizierbar.';

-- ─── 6. RLS aktivieren ──────────────────────────────────────────────────────

ALTER TABLE public.agency_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_sites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_scans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_findings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_evidence_bundles ENABLE ROW LEVEL SECURITY;

-- ─── 7. RLS-Policies — Tenant-Member Read/Write, service_role Full ──────────
-- Muster gleich wie ai_systems / ai_policies in 20260601100000.

-- agency_clients ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS agency_clients_select ON public.agency_clients;
CREATE POLICY agency_clients_select ON public.agency_clients
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_clients_insert ON public.agency_clients;
CREATE POLICY agency_clients_insert ON public.agency_clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_clients_update ON public.agency_clients;
CREATE POLICY agency_clients_update ON public.agency_clients
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_clients_delete ON public.agency_clients;
CREATE POLICY agency_clients_delete ON public.agency_clients
  FOR DELETE TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_clients_service_role ON public.agency_clients;
CREATE POLICY agency_clients_service_role ON public.agency_clients
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- agency_sites ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS agency_sites_select ON public.agency_sites;
CREATE POLICY agency_sites_select ON public.agency_sites
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_sites_insert ON public.agency_sites;
CREATE POLICY agency_sites_insert ON public.agency_sites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_sites_update ON public.agency_sites;
CREATE POLICY agency_sites_update ON public.agency_sites
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_sites_delete ON public.agency_sites;
CREATE POLICY agency_sites_delete ON public.agency_sites
  FOR DELETE TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_sites_service_role ON public.agency_sites;
CREATE POLICY agency_sites_service_role ON public.agency_sites
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- agency_scans ───────────────────────────────────────────────────────────────
-- Scans werden i.d.R. von Edge Functions (service_role) erzeugt + fortge-
-- schrieben. Authenticated Member dürfen lesen + manuelle Scans triggern
-- (INSERT). UPDATE/DELETE bleibt service_role-only — Member sollen den
-- Lifecycle nicht manipulieren.

DROP POLICY IF EXISTS agency_scans_select ON public.agency_scans;
CREATE POLICY agency_scans_select ON public.agency_scans
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_scans_insert ON public.agency_scans;
CREATE POLICY agency_scans_insert ON public.agency_scans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id) AND kind = 'manual');

DROP POLICY IF EXISTS agency_scans_service_role ON public.agency_scans;
CREATE POLICY agency_scans_service_role ON public.agency_scans
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- agency_findings ────────────────────────────────────────────────────────────
-- Findings werden vom Scanner (service_role) erzeugt. Member dürfen lesen
-- und review_state/reviewed_by/reviewed_at aktualisieren (False-Positive-
-- Markierung). DELETE bleibt service_role-only.

DROP POLICY IF EXISTS agency_findings_select ON public.agency_findings;
CREATE POLICY agency_findings_select ON public.agency_findings
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_findings_update ON public.agency_findings;
CREATE POLICY agency_findings_update ON public.agency_findings
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_findings_service_role ON public.agency_findings;
CREATE POLICY agency_findings_service_role ON public.agency_findings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- agency_evidence_bundles ────────────────────────────────────────────────────
-- Bundles werden vom Signing-Pfad (service_role) erzeugt. Member dürfen
-- lesen — alles andere bleibt service_role.

DROP POLICY IF EXISTS agency_evidence_bundles_select ON public.agency_evidence_bundles;
CREATE POLICY agency_evidence_bundles_select ON public.agency_evidence_bundles
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agency_evidence_bundles_service_role ON public.agency_evidence_bundles;
CREATE POLICY agency_evidence_bundles_service_role ON public.agency_evidence_bundles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
