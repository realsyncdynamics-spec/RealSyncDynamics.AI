-- Performance & Scaling - Phase 6.3
-- Core monitoring and caching infrastructure

CREATE TABLE IF NOT EXISTS public.query_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  query_pattern TEXT NOT NULL,
  query_type TEXT,
  table_names TEXT[],
  execution_time_ms INT NOT NULL,
  rows_affected INT,
  rows_scanned INT,
  index_used TEXT,
  query_hash TEXT NOT NULL,
  endpoint TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  cache_type TEXT NOT NULL,
  ttl_seconds INT DEFAULT 3600,
  last_refreshed_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_interval_seconds INT DEFAULT 3600,
  data_size_bytes INT,
  hit_count INT DEFAULT 0,
  miss_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
