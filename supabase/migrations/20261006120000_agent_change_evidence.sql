-- Agent Change Evidence (First Cut)
--
-- Provider-neutrales Evidenz-Ledger für GitHub push / pull_request.
-- Nur Aufzeichnung — kein Blocking, kein Deploy-Gate.
--
-- Muster: wie security_signals / audit_evidence —
--   tenant_id NOT NULL, RLS via is_tenant_member, Schreiben nur service_role.
--
-- Repo→Tenant: github_repo_tenant_bindings (serverseitig).
-- Dominik muss Bindings einfügen (service_role / SQL). Kein Rateaus-URL/Body.

-- ─── 1. Repo → Tenant Binding ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_repo_tenant_bindings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Canonical: lowercase "owner/repo" (GitHub full_name).
  repo_full_name  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT github_repo_tenant_bindings_repo_nonempty
    CHECK (length(trim(repo_full_name)) > 0),
  CONSTRAINT github_repo_tenant_bindings_repo_unique
    UNIQUE (repo_full_name)
);

CREATE INDEX IF NOT EXISTS idx_github_repo_tenant_bindings_tenant
  ON public.github_repo_tenant_bindings (tenant_id);

COMMENT ON TABLE public.github_repo_tenant_bindings IS
  'Serverseitige Zuordnung GitHub-Repo (owner/repo) → tenant_id. '
  'Nur Operatoren (service_role) schreiben; Tenant-Mitglieder lesen eigene Zeilen. '
  'Kein Mapping aus URL, Query oder Payload allein.';

-- ─── 2. Evidence ledger ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_change_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'github'
                     CHECK (source = 'github'),
  event            TEXT NOT NULL
                     CHECK (event IN ('push', 'pull_request')),
  repo             TEXT NOT NULL,
  ref              TEXT,
  commit_sha       TEXT,
  -- sha256 of patch bytes, or of sorted path list when no patch is available.
  -- Never store raw diffs or file contents.
  diff_hash        TEXT NOT NULL,
  actor            TEXT,
  agent_identity   TEXT,
  policy_version   TEXT,
  risk_level       TEXT NOT NULL DEFAULT 'info'
                     CHECK (risk_level IN ('info', 'low', 'medium', 'high')),
  -- Always 'recorded' in this first cut — never block.
  decision         TEXT NOT NULL DEFAULT 'recorded'
                     CHECK (decision = 'recorded'),
  -- Paths, hit classes, delivery metadata only — no secret values / diffs.
  payload_ref      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- X-GitHub-Delivery — idempotency key (one row per delivery).
  delivery_id      TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_change_evidence_delivery_unique UNIQUE (delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_change_evidence_tenant_created
  ON public.agent_change_evidence (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_change_evidence_tenant_risk
  ON public.agent_change_evidence (tenant_id, risk_level);

COMMENT ON TABLE public.agent_change_evidence IS
  'Agent Change Evidence: ein Datensatz pro GitHub-Delivery (push/pull_request). '
  'Nur Aufzeichnung (decision=recorded). Keine Roh-Diffs, keine Secret-Werte.';

COMMENT ON COLUMN public.agent_change_evidence.payload_ref IS
  'Metadaten: changed_paths, hit_classes, github_delivery — niemals Patch-Inhalt.';

-- Append-only: no UPDATE / DELETE for clients (service_role also blocked by trigger).
CREATE OR REPLACE FUNCTION public.agent_change_evidence_block_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'agent_change_evidence is append-only. Insert a new row instead of modifying.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_change_evidence_no_update ON public.agent_change_evidence;
CREATE TRIGGER trg_agent_change_evidence_no_update
  BEFORE UPDATE ON public.agent_change_evidence
  FOR EACH ROW EXECUTE FUNCTION public.agent_change_evidence_block_modification();

DROP TRIGGER IF EXISTS trg_agent_change_evidence_no_delete ON public.agent_change_evidence;
CREATE TRIGGER trg_agent_change_evidence_no_delete
  BEFORE DELETE ON public.agent_change_evidence
  FOR EACH ROW EXECUTE FUNCTION public.agent_change_evidence_block_modification();

-- ─── 3. Read view (dashboard later) ────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_agent_change_evidence
  WITH (security_invoker = on)
AS
SELECT
  id,
  tenant_id,
  source,
  event,
  repo,
  ref,
  commit_sha,
  diff_hash,
  actor,
  agent_identity,
  policy_version,
  risk_level,
  decision,
  payload_ref,
  delivery_id,
  created_at
FROM public.agent_change_evidence;

COMMENT ON VIEW public.v_agent_change_evidence IS
  'Tenant-scoped Lesepfad für Agent Change Evidence (security_invoker → RLS der Basistabelle).';

-- ─── 4. RLS (same migration; no tenant_id IS NULL fallback) ─────────────────
ALTER TABLE public.github_repo_tenant_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_change_evidence       ENABLE ROW LEVEL SECURITY;

-- Bindings: members read own; only service_role writes (Dominik inserts).
DROP POLICY IF EXISTS github_repo_tenant_bindings_member_select
  ON public.github_repo_tenant_bindings;
CREATE POLICY github_repo_tenant_bindings_member_select
  ON public.github_repo_tenant_bindings
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS github_repo_tenant_bindings_service_all
  ON public.github_repo_tenant_bindings;
CREATE POLICY github_repo_tenant_bindings_service_all
  ON public.github_repo_tenant_bindings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Evidence: members read; service_role inserts (verified webhook only).
DROP POLICY IF EXISTS agent_change_evidence_member_select
  ON public.agent_change_evidence;
CREATE POLICY agent_change_evidence_member_select
  ON public.agent_change_evidence
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agent_change_evidence_service_insert
  ON public.agent_change_evidence;
CREATE POLICY agent_change_evidence_service_insert
  ON public.agent_change_evidence
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS agent_change_evidence_service_select
  ON public.agent_change_evidence;
CREATE POLICY agent_change_evidence_service_select
  ON public.agent_change_evidence
  FOR SELECT TO service_role
  USING (true);

-- Grants: authenticated may SELECT table + view; no client INSERT.
REVOKE ALL ON public.github_repo_tenant_bindings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.agent_change_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.github_repo_tenant_bindings TO authenticated;
GRANT SELECT ON public.agent_change_evidence TO authenticated;
GRANT SELECT ON public.v_agent_change_evidence TO authenticated;
GRANT ALL ON public.github_repo_tenant_bindings TO service_role;
GRANT SELECT, INSERT ON public.agent_change_evidence TO service_role;
GRANT SELECT ON public.v_agent_change_evidence TO service_role;
