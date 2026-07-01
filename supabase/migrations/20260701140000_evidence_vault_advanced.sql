-- Evidence Vault Advanced — versionierte, unveränderliche Snapshots mit
-- Retention + Legal-Hold + Audit-Timeline.
--
-- Setzt auf die vorhandene Hash-Chain-/Prüfpfad-Infrastruktur auf
-- (runtime_events, audit_evidence, provenance_custody_events) und ergänzt:
--   evidence_snapshots     append-only, pro (tenant, subject) versioniert,
--                          über prev_hash verkettet, mit Retention.
--   evidence_legal_holds   mutabler Hold, der die Löschung sperrt (Legal-Hold).
--
-- Snapshots sind unveränderlich (Trigger). Legal-Hold ist bewusst separat und
-- mutabel — ein Hold ändert NICHT den Snapshot, sondern verhindert dessen
-- Ablauf (isExpired in src/lib/evidence/retention berücksichtigt das).

-- ─── 1. Versionierte, unveränderliche Snapshots ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    -- Logischer Gruppierungsschlüssel (Asset-/Dokument-Referenz).
    subject_ref     TEXT NOT NULL,
    label           TEXT,
    -- Lückenlos aufsteigend pro (tenant, subject): 1, 2, 3, …
    version         INT NOT NULL,
    content_sha256  TEXT NOT NULL,
    prev_hash       TEXT,
    event_hash      TEXT NOT NULL,
    signature       TEXT,
    retention_class TEXT NOT NULL DEFAULT 'forever'
                        CHECK (retention_class IN ('forever','7y','3y','1y','90d','30d','7d','ephemeral')),
    -- NULL = unbegrenzt ('forever'); sonst berechneter Ablauf.
    retained_until  TIMESTAMPTZ,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, subject_ref, version)
);

CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_tenant  ON public.evidence_snapshots(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_subject ON public.evidence_snapshots(tenant_id, subject_ref, version);

CREATE OR REPLACE FUNCTION public.evidence_snapshots_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    RAISE EXCEPTION 'evidence_snapshots sind unveränderlich (append-only)';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_evidence_snapshots_immutable ON public.evidence_snapshots;
CREATE TRIGGER trg_evidence_snapshots_immutable
    BEFORE UPDATE OR DELETE ON public.evidence_snapshots
    FOR EACH ROW EXECUTE FUNCTION public.evidence_snapshots_immutable();

-- ─── 2. Legal-Hold (mutabel, sperrt Löschung) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_legal_holds (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    subject_ref  TEXT NOT NULL,
    reason       TEXT,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_evidence_holds_active
    ON public.evidence_legal_holds(tenant_id, subject_ref)
    WHERE active = TRUE;

-- ─── 3. RLS: Tenant-Mitglieder lesen; Schreiben nur service_role ─────────────
ALTER TABLE public.evidence_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_legal_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence_snapshots tenant-select" ON public.evidence_snapshots;
CREATE POLICY "evidence_snapshots tenant-select" ON public.evidence_snapshots
    FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "evidence_holds tenant-select" ON public.evidence_legal_holds;
CREATE POLICY "evidence_holds tenant-select" ON public.evidence_legal_holds
    FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.evidence_snapshots IS
    'Versionierte, unveränderliche Evidence-Snapshots (append-only, prev_hash-verkettet) mit Retention. Schreiben nur über Edge-Function evidence-vault (service_role).';
COMMENT ON TABLE public.evidence_legal_holds IS
    'Legal-Hold pro subject_ref — sperrt den Ablauf/die Löschung zugehöriger Snapshots, solange active.';

-- ─── 4. Audit-Timeline (RLS-sicher) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.evidence_vault_timeline(p_tenant_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE (
    id UUID, subject_ref TEXT, label TEXT, version INT,
    content_sha256 TEXT, event_hash TEXT, retention_class TEXT,
    retained_until TIMESTAMPTZ, created_at TIMESTAMPTZ, on_hold BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.subject_ref, s.label, s.version, s.content_sha256, s.event_hash,
           s.retention_class, s.retained_until, s.created_at,
           EXISTS (
             SELECT 1 FROM public.evidence_legal_holds h
              WHERE h.tenant_id = s.tenant_id AND h.subject_ref = s.subject_ref AND h.active = TRUE
           ) AS on_hold
      FROM public.evidence_snapshots s
     WHERE s.tenant_id = p_tenant_id
       AND public.is_tenant_member(p_tenant_id)
     ORDER BY s.created_at DESC
     LIMIT GREATEST(1, p_limit);
$$;

-- Löschbare Snapshots: Retention abgelaufen UND kein aktiver Legal-Hold.
CREATE OR REPLACE FUNCTION public.evidence_purgeable(p_tenant_id UUID)
RETURNS SETOF public.evidence_snapshots
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.*
      FROM public.evidence_snapshots s
     WHERE s.tenant_id = p_tenant_id
       AND public.is_tenant_member(p_tenant_id)
       AND s.retained_until IS NOT NULL
       AND s.retained_until < now()
       AND NOT EXISTS (
         SELECT 1 FROM public.evidence_legal_holds h
          WHERE h.tenant_id = s.tenant_id AND h.subject_ref = s.subject_ref AND h.active = TRUE
       );
$$;

-- ─── 5. Entitlement: evidence.advanced ab Agency ─────────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('evidence.advanced', 'Evidence Vault Advanced: Versionierung, Immutable Snapshots, Retention, Legal-Hold', 'boolean')
ON CONFLICT (key) DO NOTHING;

WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('agency',     'evidence.advanced', 1),
    ('scale',      'evidence.advanced', 1),
    ('enterprise', 'evidence.advanced', 1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
