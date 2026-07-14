-- Bulk-Jobs — Massen-Scan von vielen Domains in einem Batch.
--
-- Setzt auf die vorhandene Scan-Infrastruktur auf (websites/scan_runs), fügt
-- aber eine dedizierte, priorisierbare Queue mit Retry pro Domain hinzu:
--   bulk_scan_batches   1 Batch (Header, Status, Priorität, Gesamtzahl)
--   bulk_scan_items     append-claimbare Queue-Items (1 pro Domain)
--
-- Entitlements bulk.jobs / limit.bulk_jobs_monthly existieren bereits
-- (agency/scale/enterprise) — hier NUR das Datenmodell + Claim/Progress.
-- Schreibpfade laufen über die Edge-Function `bulk-scan` (service_role).

-- ─── 1. Batch-Header ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulk_scan_batches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    label         TEXT,
    status        TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'paused', 'completed', 'cancelled', 'failed')),
    -- Höhere Priorität wird zuerst geclaimt (0 = normal).
    priority      INT NOT NULL DEFAULT 0,
    total_count   INT NOT NULL DEFAULT 0,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_batches_tenant
    ON public.bulk_scan_batches(tenant_id, created_at DESC);

-- ─── 2. Queue-Items (1 pro Domain) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulk_scan_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id      UUID NOT NULL REFERENCES public.bulk_scan_batches(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL,
    domain        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    priority      INT NOT NULL DEFAULT 0,
    attempts      INT NOT NULL DEFAULT 0,
    max_attempts  INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    worker_id     TEXT,
    scan_run_id   UUID,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_bulk_items_batch  ON public.bulk_scan_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_claim  ON public.bulk_scan_items(status, priority DESC, created_at)
    WHERE status = 'queued';

-- ─── 3. Atomarer Claim des nächsten Items (Worker-Pool-fähig) ────────────────
-- FOR UPDATE SKIP LOCKED: mehrere Worker können parallel ziehen, ohne dasselbe
-- Item doppelt zu bekommen. Berücksichtigt Priorität, Retry-Zeit und pausierte/
-- abgebrochene Batches.
CREATE OR REPLACE FUNCTION public.bulk_scan_claim_next(p_worker_id TEXT)
RETURNS SETOF public.bulk_scan_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT i.id INTO v_id
      FROM public.bulk_scan_items i
      JOIN public.bulk_scan_batches b ON b.id = i.batch_id
     WHERE i.status = 'queued'
       AND (i.next_retry_at IS NULL OR i.next_retry_at <= now())
       AND b.status IN ('queued', 'running')
     ORDER BY i.priority DESC, i.created_at ASC
     FOR UPDATE OF i SKIP LOCKED
     LIMIT 1;

    IF v_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    UPDATE public.bulk_scan_items
       SET status     = 'running',
           attempts   = attempts + 1,
           worker_id  = p_worker_id,
           updated_at = now()
     WHERE id = v_id
    RETURNING *;
END;
$$;

-- ─── 4. Aggregierter Fortschritt eines Batches (RLS-sicher) ──────────────────
CREATE OR REPLACE FUNCTION public.bulk_scan_batch_progress(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant FROM public.bulk_scan_batches WHERE id = p_batch_id;
    IF v_tenant IS NULL OR NOT public.is_tenant_member(v_tenant) THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'total',     count(*),
        'queued',    count(*) FILTER (WHERE status = 'queued'),
        'running',   count(*) FILTER (WHERE status = 'running'),
        'succeeded', count(*) FILTER (WHERE status = 'succeeded'),
        'failed',    count(*) FILTER (WHERE status = 'failed'),
        'cancelled', count(*) FILTER (WHERE status = 'cancelled')
    ) INTO v_result
    FROM public.bulk_scan_items
    WHERE batch_id = p_batch_id;

    RETURN v_result;
END;
$$;

-- ─── 5. RLS: Tenant-Mitglieder dürfen lesen; Schreiben nur service_role ──────
ALTER TABLE public.bulk_scan_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_scan_items   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulk_batches tenant-select" ON public.bulk_scan_batches;
CREATE POLICY "bulk_batches tenant-select" ON public.bulk_scan_batches
    FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "bulk_items tenant-select" ON public.bulk_scan_items;
CREATE POLICY "bulk_items tenant-select" ON public.bulk_scan_items
    FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.bulk_scan_batches IS
    'Bulk-Scan-Batch (Header). Lesen per RLS für Tenant-Mitglieder; Schreiben nur über Edge-Function bulk-scan (service_role).';
COMMENT ON TABLE public.bulk_scan_items IS
    'Priorisierbare Queue-Items pro Domain mit Retry. Claim via bulk_scan_claim_next (FOR UPDATE SKIP LOCKED).';
