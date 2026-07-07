-- Performance Optimization & Caching Layer for SEO-Marketing-Dashboard
-- Tracks performance metrics and cache efficiency

-- Create table for performance monitoring
CREATE TABLE IF NOT EXISTS seo_dashboard_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- render_time, network_latency, ttfb, fcp, lcp, cls
  value_ms NUMERIC NOT NULL, -- milliseconds
  page_url VARCHAR(500),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  browser VARCHAR(100),
  device_type VARCHAR(50), -- mobile, tablet, desktop
  network_type VARCHAR(50), -- 4g, 5g, wifi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for cache performance analysis
CREATE TABLE IF NOT EXISTS seo_dashboard_cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cache_key VARCHAR(255) NOT NULL,
  hits INT DEFAULT 0,
  misses INT DEFAULT 0,
  total_requests INT DEFAULT 0,
  avg_response_time_ms NUMERIC,
  last_accessed TIMESTAMP WITH TIME ZONE,
  size_bytes INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for API endpoint performance
CREATE TABLE IF NOT EXISTS seo_dashboard_api_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT,
  response_time_ms NUMERIC NOT NULL,
  request_size_bytes INT,
  response_size_bytes INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for data prefetch hints
CREATE TABLE IF NOT EXISTS seo_dashboard_prefetch_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_page VARCHAR(255) NOT NULL,
  target_resource VARCHAR(255) NOT NULL,
  prefetch_frequency INT DEFAULT 0, -- how often this prefetch happens
  avg_time_to_request_ms NUMERIC, -- time between source view and target request
  success_rate NUMERIC, -- 0-1 accuracy of prefetch prediction
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE seo_dashboard_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_cache_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_api_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_prefetch_hints ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY seo_dashboard_performance_metrics_insert ON public.seo_dashboard_performance_metrics
  FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY seo_dashboard_performance_metrics_read ON public.seo_dashboard_performance_metrics
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = seo_dashboard_performance_metrics.tenant_id
      AND memberships.role IN ('admin', 'owner')
    )
  );

CREATE POLICY seo_dashboard_cache_stats_read ON public.seo_dashboard_cache_stats
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY seo_dashboard_cache_stats_write ON public.seo_dashboard_cache_stats
  FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY seo_dashboard_api_performance_read ON public.seo_dashboard_api_performance
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = seo_dashboard_api_performance.tenant_id
      AND memberships.role IN ('admin', 'owner')
    )
  );

CREATE POLICY seo_dashboard_prefetch_hints_read ON public.seo_dashboard_prefetch_hints
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- Indexes for performance
CREATE INDEX idx_performance_metrics_tenant_type ON public.seo_dashboard_performance_metrics(tenant_id, metric_type, created_at DESC);
CREATE INDEX idx_performance_metrics_user ON public.seo_dashboard_performance_metrics(user_id);
CREATE INDEX idx_performance_metrics_device ON public.seo_dashboard_performance_metrics(device_type);

CREATE INDEX idx_cache_stats_tenant_key ON public.seo_dashboard_cache_stats(tenant_id, cache_key);
CREATE INDEX idx_cache_stats_hit_rate ON public.seo_dashboard_cache_stats(tenant_id, (hits::numeric / NULLIF(hits + misses, 0))) DESC;

CREATE INDEX idx_api_performance_tenant_endpoint ON public.seo_dashboard_api_performance(tenant_id, endpoint);
CREATE INDEX idx_api_performance_created ON public.seo_dashboard_api_performance(created_at DESC);

CREATE INDEX idx_prefetch_hints_tenant_active ON public.seo_dashboard_prefetch_hints(tenant_id, is_active) WHERE is_active = TRUE;

-- Create view for performance summary
CREATE OR REPLACE VIEW seo_performance_summary AS
SELECT
  tenant_id,
  metric_type,
  COUNT(*) as measurement_count,
  AVG(value_ms) as avg_value_ms,
  MIN(value_ms) as min_value_ms,
  MAX(value_ms) as max_value_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value_ms) as p95_value_ms,
  STDDEV(value_ms) as stddev_value_ms
FROM seo_dashboard_performance_metrics
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY tenant_id, metric_type;

-- Create view for cache efficiency
CREATE OR REPLACE VIEW seo_cache_efficiency AS
SELECT
  tenant_id,
  COUNT(*) as cached_endpoints,
  SUM(hits) as total_hits,
  SUM(misses) as total_misses,
  SUM(hits + misses) as total_requests,
  (SUM(hits)::numeric / NULLIF(SUM(hits + misses), 0) * 100)::numeric(5,2) as cache_hit_rate,
  AVG(avg_response_time_ms) as avg_response_time_ms,
  SUM(size_bytes) / 1024.0 / 1024.0 as total_cache_size_mb
FROM seo_dashboard_cache_stats
WHERE updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY tenant_id;

-- Create view for API performance analysis
CREATE OR REPLACE VIEW seo_api_performance_analysis AS
SELECT
  tenant_id,
  endpoint,
  COUNT(*) as request_count,
  AVG(response_time_ms) as avg_response_time_ms,
  MAX(response_time_ms) as max_response_time_ms,
  MIN(response_time_ms) as min_response_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time_ms,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END)::numeric / COUNT(*) * 100 as error_rate_percent,
  (AVG(response_size_bytes) / 1024.0)::numeric(10,2) as avg_response_size_kb
FROM seo_dashboard_api_performance
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY tenant_id, endpoint;

-- Create function to record performance metric
CREATE OR REPLACE FUNCTION record_performance_metric(
  p_tenant_id UUID,
  p_metric_type VARCHAR,
  p_value_ms NUMERIC,
  p_page_url VARCHAR DEFAULT NULL,
  p_device_type VARCHAR DEFAULT NULL,
  p_network_type VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO seo_dashboard_performance_metrics (
    tenant_id, metric_type, value_ms, page_url, user_id, device_type, network_type
  )
  VALUES (
    p_tenant_id, p_metric_type, p_value_ms, p_page_url, auth.uid(), p_device_type, p_network_type
  )
  RETURNING id INTO v_metric_id;

  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update cache stats
CREATE OR REPLACE FUNCTION update_cache_stats(
  p_tenant_id UUID,
  p_cache_key VARCHAR,
  p_is_hit BOOLEAN,
  p_response_time_ms NUMERIC DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO seo_dashboard_cache_stats (tenant_id, cache_key, hits, misses, avg_response_time_ms, last_accessed)
  VALUES (
    p_tenant_id,
    p_cache_key,
    CASE WHEN p_is_hit THEN 1 ELSE 0 END,
    CASE WHEN p_is_hit THEN 0 ELSE 1 END,
    p_response_time_ms,
    NOW()
  )
  ON CONFLICT (tenant_id, cache_key) DO UPDATE SET
    hits = CASE WHEN p_is_hit THEN seo_dashboard_cache_stats.hits + 1 ELSE seo_dashboard_cache_stats.hits END,
    misses = CASE WHEN p_is_hit THEN seo_dashboard_cache_stats.misses ELSE seo_dashboard_cache_stats.misses + 1 END,
    avg_response_time_ms = COALESCE(p_response_time_ms, seo_dashboard_cache_stats.avg_response_time_ms),
    last_accessed = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate prefetch accuracy
CREATE OR REPLACE FUNCTION calculate_prefetch_accuracy()
RETURNS TABLE (
  source_page VARCHAR,
  target_resource VARCHAR,
  accuracy NUMERIC,
  recommendation VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ph.source_page,
    ph.target_resource,
    ph.success_rate,
    CASE
      WHEN ph.success_rate >= 0.8 THEN 'Keep prefetching'::VARCHAR
      WHEN ph.success_rate >= 0.5 THEN 'Monitor prefetch effectiveness'::VARCHAR
      ELSE 'Consider disabling prefetch'::VARCHAR
    END
  FROM seo_dashboard_prefetch_hints ph
  WHERE ph.is_active = TRUE
  ORDER BY ph.success_rate DESC;
END;
$$ LANGUAGE plpgsql STABLE;
