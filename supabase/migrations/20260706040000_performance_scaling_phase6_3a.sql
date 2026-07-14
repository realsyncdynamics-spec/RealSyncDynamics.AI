-- Phase 6.3a: Performance & Scaling — Core Foundation Tables
-- Minimal schema for query logging and cache metadata instrumentation
-- Performance indexes will be added in follow-up once dependency chain stabilizes

-- ─── 1. Query Logging Table ───
CREATE TABLE IF NOT EXISTS public.query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  duration_ms INT NOT NULL,
  rows_affected INT,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_logs_tenant_id ON public.query_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON public.query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_duration ON public.query_logs(duration_ms DESC);

ALTER TABLE public.query_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "query_logs tenant_read" ON public.query_logs;
CREATE POLICY "query_logs tenant_read" ON public.query_logs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "query_logs service_insert" ON public.query_logs;
CREATE POLICY "query_logs service_insert" ON public.query_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. Cache Metadata Table ───
CREATE TABLE IF NOT EXISTS public.cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  ttl_seconds INT NOT NULL DEFAULT 3600,
  hit_count INT DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_tenant_id ON public.cache_metadata(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_last_accessed ON public.cache_metadata(last_accessed DESC);

ALTER TABLE public.cache_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cache_metadata tenant_read" ON public.cache_metadata;
CREATE POLICY "cache_metadata tenant_read" ON public.cache_metadata FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "cache_metadata service_write" ON public.cache_metadata;
CREATE POLICY "cache_metadata service_write" ON public.cache_metadata FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "cache_metadata service_update" ON public.cache_metadata;
CREATE POLICY "cache_metadata service_update" ON public.cache_metadata FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 4. RPC: Log Query Execution ───
CREATE OR REPLACE FUNCTION public.log_query(
  p_tenant_id UUID,
  p_query_text TEXT,
  p_duration_ms INT,
  p_rows_affected INT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.query_logs (tenant_id, query_text, duration_ms, rows_affected, executed_by)
  VALUES (p_tenant_id, p_query_text, p_duration_ms, p_rows_affected, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 5. RPC: Get Cache Hit Rate ───
CREATE OR REPLACE FUNCTION public.get_cache_hit_rate(p_tenant_id UUID)
RETURNS TABLE (
  cache_key TEXT,
  hit_count INT,
  ttl_seconds INT,
  last_accessed TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cache_key,
    hit_count,
    ttl_seconds,
    last_accessed
  FROM public.cache_metadata
  WHERE tenant_id = p_tenant_id
  ORDER BY hit_count DESC;
$$;

-- ─── 6. RPC: Get Slow Queries ───
CREATE OR REPLACE FUNCTION public.get_slow_queries(
  p_tenant_id UUID,
  p_threshold_ms INT DEFAULT 1000,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  query_text TEXT,
  duration_ms INT,
  executed_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    query_text,
    duration_ms,
    executed_by,
    created_at
  FROM public.query_logs
  WHERE tenant_id = p_tenant_id
    AND duration_ms > p_threshold_ms
  ORDER BY duration_ms DESC
  LIMIT p_limit;
$$;
