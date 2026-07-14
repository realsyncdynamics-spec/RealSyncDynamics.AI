-- Migration: 20260714000002_bulk_scan_operations.sql
-- Description: Bulk scanning operations with worker pool management and progress tracking

-- Bulk Scan Batches: Represent a batch of domains to scan
CREATE TABLE IF NOT EXISTS public.bulk_scan_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
  priority VARCHAR NOT NULL CHECK (priority IN ('normal', 'high', 'urgent')) DEFAULT 'normal',
  domain_count INTEGER NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT bulk_scan_batches_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for bulk_scan_batches
ALTER TABLE public.bulk_scan_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's batches"
  ON public.bulk_scan_batches
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create batches"
  ON public.bulk_scan_batches
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update batches"
  ON public.bulk_scan_batches
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_bulk_scan_batches_tenant_id ON public.bulk_scan_batches(tenant_id);
CREATE INDEX idx_bulk_scan_batches_status ON public.bulk_scan_batches(status);
CREATE INDEX idx_bulk_scan_batches_priority ON public.bulk_scan_batches(priority);
CREATE INDEX idx_bulk_scan_batches_created_at ON public.bulk_scan_batches(created_at DESC);

-- Scan Results: Individual domain scan results
CREATE TABLE IF NOT EXISTS public.scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.bulk_scan_batches(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('success', 'timeout', 'error', 'not_found')) DEFAULT 'pending',
  compliance_score DECIMAL(5,2),
  issues TEXT[] DEFAULT '{}',
  scan_time_ms INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_message TEXT,
  CONSTRAINT scan_results_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT scan_results_batch_domain UNIQUE(batch_id, domain)
);

-- RLS for scan_results
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's scan results"
  ON public.scan_results
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_scan_results_batch_id ON public.scan_results(batch_id);
CREATE INDEX idx_scan_results_domain ON public.scan_results(domain);
CREATE INDEX idx_scan_results_status ON public.scan_results(status);
CREATE INDEX idx_scan_results_tenant_id ON public.scan_results(tenant_id);
CREATE INDEX idx_scan_results_timestamp ON public.scan_results(timestamp DESC);

-- Worker Status: Track health and throughput of worker pool
CREATE TABLE IF NOT EXISTS public.worker_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.bulk_scan_batches(id) ON DELETE CASCADE,
  worker_id VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('idle', 'busy', 'error', 'offline')) DEFAULT 'idle',
  current_domain VARCHAR,
  domains_processed INTEGER DEFAULT 0,
  domains_failed INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT worker_status_batch_worker UNIQUE(batch_id, worker_id)
);

-- RLS for worker_status
ALTER TABLE public.worker_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's worker status"
  ON public.worker_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_scan_batches
      WHERE id = worker_status.batch_id
      AND tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE INDEX idx_worker_status_batch_id ON public.worker_status(batch_id);
CREATE INDEX idx_worker_status_status ON public.worker_status(status);
CREATE INDEX idx_worker_status_last_heartbeat ON public.worker_status(last_heartbeat DESC);

-- Batch Progress: Denormalized view for performance
CREATE TABLE IF NOT EXISTS public.batch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL UNIQUE REFERENCES public.bulk_scan_batches(id) ON DELETE CASCADE,
  total INTEGER NOT NULL DEFAULT 0,
  queued INTEGER DEFAULT 0,
  running INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  cancelled INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT batch_progress_sum CHECK (queued + running + succeeded + failed + cancelled <= total)
);

-- RLS for batch_progress
ALTER TABLE public.batch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's batch progress"
  ON public.batch_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_scan_batches
      WHERE id = batch_progress.batch_id
      AND tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE INDEX idx_batch_progress_batch_id ON public.batch_progress(batch_id);

COMMENT ON TABLE public.bulk_scan_batches IS 'Batch scanning jobs with configuration, priority, and status tracking.';
COMMENT ON TABLE public.scan_results IS 'Individual domain scan results with compliance scores, issues, and timing.';
COMMENT ON TABLE public.worker_status IS 'Real-time health status of worker pool nodes, including throughput and error counts.';
COMMENT ON TABLE public.batch_progress IS 'Denormalized progress counters for real-time dashboard updates and WebSocket notifications.';
