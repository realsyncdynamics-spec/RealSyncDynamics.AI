-- Performance & Scaling - Phase 6.3
-- Minimal core infrastructure for monitoring and caching

-- Query Performance Log Table
CREATE TABLE IF NOT EXISTS public.query_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  query_pattern TEXT NOT NULL,
  query_type TEXT,
  table_names TEXT[] DEFAULT '{}',
  execution_time_ms INT NOT NULL,
  rows_affected INT,
  rows_scanned INT,
  index_used TEXT,
  query_hash TEXT NOT NULL,
  endpoint TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cache Metadata Table
CREATE TABLE IF NOT EXISTS public.cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  cache_type TEXT NOT NULL CHECK (cache_type IN ('dashboard', 'report', 'metrics', 'computed')),
  ttl_seconds INT DEFAULT 3600,
  last_refreshed_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_interval_seconds INT DEFAULT 3600,
  data_size_bytes INT,
  hit_count INT DEFAULT 0,
  miss_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cache_key)
);
