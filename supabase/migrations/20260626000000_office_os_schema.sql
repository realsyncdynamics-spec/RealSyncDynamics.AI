-- Office OS (Phase 6) — Persistenz-Schema fuer die governance-faehige
-- Dokumenten- und Arbeitsumgebung.
--
-- Vereinheitlichtes Artefakt-Modell statt sieben separater Tabellen: alle
-- Office-Bereiche (Dokumente, Tabellen, Praesentationen, Vorlagen, Meetings,
-- Vertraege, Policies) teilen sich gemeinsame Governance-Felder (Status,
-- Version, Klassifizierung, Eigentuemer) und legen bereichsspezifische Daten
-- in `data jsonb` ab. Das haelt RLS, Pruefpfad und Indizes konsistent.
--
-- Drei Tabellen, alle tenant-isoliert via is_tenant_member() (Konvention aus
-- 20260430180000_tenant_rls_and_webhook_events.sql):
--   office_artifacts          — aktueller Stand jedes Artefakts (CRUD)
--   office_artifact_versions  — Versionshistorie (append-only, Pruefpfad Inhalt)
--   office_audit_log          — Pruefpfad der Aktionen (append-only)
--
-- Append-only-Tabellen erhalten nur SELECT- und INSERT-Policies; UPDATE/DELETE
-- bleiben damit fuer authenticated gesperrt (nur service_role via Edge Function).
--
-- Additiv und idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. office_artifacts — aktueller Stand jedes Office-Artefakts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.office_artifacts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    kind           TEXT NOT NULL CHECK (kind IN (
                       'documents', 'sheets', 'presentations', 'templates',
                       'meetings', 'contracts', 'policies')),
    title          TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN (
                       'entwurf', 'pruefung', 'freigegeben', 'abgelaufen', 'archiviert')),
    classification TEXT NOT NULL DEFAULT 'intern' CHECK (classification IN (
                       'oeffentlich', 'intern', 'vertraulich')),
    version        TEXT NOT NULL DEFAULT 'v0.1',
    owner          TEXT,
    -- bereichsspezifische Felder (z. B. slides, renewal_date, review_cycle …)
    data           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_artifacts_tenant      ON public.office_artifacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_office_artifacts_tenant_kind ON public.office_artifacts (tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_office_artifacts_status      ON public.office_artifacts (tenant_id, status);

ALTER TABLE public.office_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members manage office artifacts" ON public.office_artifacts;
CREATE POLICY "tenant members manage office artifacts"
    ON public.office_artifacts FOR ALL
    USING ((SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.office_artifacts IS
    'Office OS: aktueller Stand jedes Artefakts (Dokument/Tabelle/Deck/Vorlage/Meeting/Vertrag/Policy). Tenant-isoliert via is_tenant_member().';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. office_artifact_versions — Versionshistorie (append-only)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.office_artifact_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    artifact_id   UUID NOT NULL REFERENCES public.office_artifacts(id) ON DELETE CASCADE,
    version       TEXT NOT NULL,
    snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Inhalts-Hash fuer den Herkunftsnachweis (z. B. sha256 ueber snapshot)
    content_hash  TEXT,
    changed_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_versions_artifact
    ON public.office_artifact_versions (artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_versions_tenant
    ON public.office_artifact_versions (tenant_id);

ALTER TABLE public.office_artifact_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read office versions" ON public.office_artifact_versions;
CREATE POLICY "tenant members read office versions"
    ON public.office_artifact_versions FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS "tenant members append office versions" ON public.office_artifact_versions;
CREATE POLICY "tenant members append office versions"
    ON public.office_artifact_versions FOR INSERT
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.office_artifact_versions IS
    'Office OS: append-only Versionshistorie je Artefakt mit Inhalts-Hash (Herkunftsnachweis). UPDATE/DELETE nur via service_role.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. office_audit_log — Pruefpfad der Aktionen (append-only)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.office_audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    artifact_id  UUID REFERENCES public.office_artifacts(id) ON DELETE SET NULL,
    action       TEXT NOT NULL CHECK (action IN (
                     'created', 'updated', 'status_changed', 'version_published',
                     'classified', 'exported', 'viewed', 'deleted')),
    actor        UUID,
    detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_audit_tenant
    ON public.office_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_audit_artifact
    ON public.office_audit_log (artifact_id, created_at DESC);

ALTER TABLE public.office_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read office audit" ON public.office_audit_log;
CREATE POLICY "tenant members read office audit"
    ON public.office_audit_log FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS "tenant members append office audit" ON public.office_audit_log;
CREATE POLICY "tenant members append office audit"
    ON public.office_audit_log FOR INSERT
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.office_audit_log IS
    'Office OS: append-only Pruefpfad aller Artefakt-Aktionen. UPDATE/DELETE nur via service_role.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. updated_at-Trigger fuer office_artifacts (eigenstaendig, idempotent)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.office_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_office_artifacts_updated_at ON public.office_artifacts;
CREATE TRIGGER trg_office_artifacts_updated_at
  BEFORE UPDATE ON public.office_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.office_set_updated_at();
