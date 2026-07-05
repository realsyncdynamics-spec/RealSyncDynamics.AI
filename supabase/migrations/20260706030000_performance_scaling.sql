-- Performance & Scaling - Phase 6.3
-- Query performance monitoring and cache management

-- ─── 1. Query Performance Monitoring ───

-- Track slow queries and query patterns
CREATE TABLE IF NOT EXISTS public.query_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Query metadata
  query_pattern TEXT NOT NULL,
  query_type TEXT,
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

CREATE INDEX IF NOT EXISTS idx_query_performance_log_tenant_id
  ON public.query_performance_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_query_performance_log_hash
  ON public.query_performance_log(query_hash);

CREATE INDEX IF NOT EXISTS idx_query_performance_log_created
  ON public.query_performance_log(created_at DESC);

DROP POLICY IF EXISTS "query_performance_log tenant_read" ON public.query_performance_log;
CREATE POLICY "query_performance_log tenant_read"
  ON public.query_performance_log FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "query_performance_log service_insert" ON public.query_performance_log;
CREATE POLICY "query_performance_log service_insert"
  ON public.query_performance_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. Cache Metadata Table ───

CREATE TABLE IF NOT EXISTS public.cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Cache key and lifecycle
  cache_key TEXT NOT NULL,
  cache_type TEXT NOT NULL CHECK (cache_type IN ('dashboard', 'report', 'metrics', 'computed')),

  -- TTL and refresh
  ttl_seconds INT DEFAULT 3600,
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

CREATE INDEX IF NOT EXISTS idx_cache_metadata_tenant_id
  ON public.cache_metadata(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_next_refresh
  ON public.cache_metadata(next_refresh_at)
  WHERE next_refresh_at IS NOT NULL;

DROP POLICY IF EXISTS "cache_metadata tenant_read" ON public.cache_metadata;
CREATE POLICY "cache_metadata tenant_read"
  ON public.cache_metadata FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "cache_metadata service_manage" ON public.cache_metadata;
CREATE POLICY "cache_metadata service_manage"
  ON public.cache_metadata FOR ALL
  WITH CHECK (auth.role() = 'service_role');
