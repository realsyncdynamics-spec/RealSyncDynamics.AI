-- Performance & Scaling - Phase 6.3
-- Query optimization indexes, query performance monitoring, cache management

-- ─── 1. Query Performance Indexes ───

-- Composite index for common gap queries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gaps' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_gaps_tenant_status_risk
      ON public.gaps(tenant_id, status, risk_score DESC)
      WHERE status != 'closed';
  END IF;
END $$;

-- Composite index for framework compliance queries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gaps' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_gaps_framework_maturity
      ON public.gaps(tenant_id, framework, maturity_level)
      INCLUDE (risk_score, status);
  END IF;
END $$;

-- Task performance indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_priority
      ON public.tasks(tenant_id, status, priority DESC)
      WHERE status IN ('open', 'in_progress');

    CREATE INDEX IF NOT EXISTS idx_tasks_due_date
      ON public.tasks(tenant_id, due_date)
      WHERE status IN ('open', 'in_progress');
  END IF;
END $$;

-- Evidence query indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence_items' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_evidence_gap_control
      ON public.evidence_items(gap_id, iso_control_code);
  END IF;
END $$;

-- ─── 2. Query Performance Monitoring ───

-- Track slow queries and query patterns
CREATE TABLE IF NOT EXISTS public.query_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Query metadata
  query_pattern TEXT NOT NULL,
  query_type TEXT, -- 'gap_query', 'task_query', 'compliance_query', 'dashboard_query'
  table_names TEXT[] DEFAULT '{}',

  -- Performance metrics
  execution_time_ms INT NOT NULL,
  rows_affected INT,
  rows_scanned INT,
  index_used TEXT,

  -- Query fingerprint for grouping
  query_hash TEXT NOT NULL,

  -- Context
  endpoint TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.query_performance_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'query_performance_log' AND table_schema = 'public' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_query_performance_log_tenant_id
      ON public.query_performance_log(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'query_performance_log' AND table_schema = 'public' AND column_name = 'query_hash') THEN
    CREATE INDEX IF NOT EXISTS idx_query_performance_log_hash
      ON public.query_performance_log(query_hash);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'query_performance_log' AND table_schema = 'public' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_query_performance_log_created
      ON public.query_performance_log(created_at DESC);
  END IF;
END $$;

-- RLS for query performance log
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'query_performance_log' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "query_performance_log tenant_read" ON public.query_performance_log;
    CREATE POLICY "query_performance_log tenant_read"
      ON public.query_performance_log FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "query_performance_log service_insert" ON public.query_performance_log;
    CREATE POLICY "query_performance_log service_insert"
      ON public.query_performance_log FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ─── 3. Cache Metadata Table ───

CREATE TABLE IF NOT EXISTS public.cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Cache key and lifecycle
  cache_key TEXT NOT NULL,
  cache_type TEXT NOT NULL CHECK (cache_type IN ('dashboard', 'report', 'metrics', 'computed')),

  -- TTL and refresh
  ttl_seconds INT DEFAULT 3600, -- default 1 hour
  last_refreshed_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_interval_seconds INT DEFAULT 3600,

  -- Metadata
  data_size_bytes INT,
  hit_count INT DEFAULT 0,
  miss_count INT DEFAULT 0,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, cache_key)
);

ALTER TABLE public.cache_metadata ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cache_metadata' AND table_schema = 'public' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_cache_metadata_tenant_id
      ON public.cache_metadata(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cache_metadata' AND table_schema = 'public' AND column_name = 'next_refresh_at') THEN
    CREATE INDEX IF NOT EXISTS idx_cache_metadata_next_refresh
      ON public.cache_metadata(next_refresh_at)
      WHERE next_refresh_at IS NOT NULL;
  END IF;
END $$;

-- RLS for cache metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cache_metadata' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "cache_metadata tenant_read" ON public.cache_metadata;
    CREATE POLICY "cache_metadata tenant_read"
      ON public.cache_metadata FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "cache_metadata service_manage" ON public.cache_metadata;
    CREATE POLICY "cache_metadata service_manage"
      ON public.cache_metadata FOR ALL
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
