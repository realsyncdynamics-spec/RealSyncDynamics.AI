import { useEffect, useState, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class DashboardCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
  private maxSize: number = 50 * 1024 * 1024; // 50MB

  get<T>(key: string, ttl: number = 300000): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number = 300000): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    };

    this.cache.set(key, entry);
    this.pruneIfNeeded();
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete = Array.from(this.cache.keys()).filter(key => regex.test(key));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private pruneIfNeeded(): void {
    // Simple size estimation (rough)
    let size = 0;
    this.cache.forEach(entry => {
      size += JSON.stringify(entry).length;
    });

    this.stats.size = size;

    if (size > this.maxSize) {
      // Remove oldest entries (LRU-like)
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = Math.ceil(entries.length * 0.2); // Remove 20%
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

const dashboardCache = new DashboardCache();

interface UseCachedMetricsOptions {
  tenantId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  cacheTtl?: number; // ms
  enabled?: boolean;
}

export function useCachedMetrics({
  tenantId,
  accessToken,
  startDate,
  endDate,
  cacheTtl = 300000, // 5 minutes default
  enabled = true,
}: UseCachedMetricsOptions) {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const cacheKeyRef = useRef<string>('');

  // Generate consistent cache key
  const getCacheKey = useCallback(() => {
    return `metrics:${tenantId}:${startDate}:${endDate}`;
  }, [tenantId, startDate, endDate]);

  // Fetch metrics with caching
  const fetchMetrics = useCallback(async () => {
    if (!enabled) return;

    const cacheKey = getCacheKey();
    cacheKeyRef.current = cacheKey;

    // Check cache first
    const cachedData = dashboardCache.get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      setMetrics(cachedData);
      setCacheHit(true);
      return;
    }

    setIsLoading(true);
    setCacheHit(false);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-seo-metrics`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            start_date: startDate,
            end_date: endDate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      dashboardCache.set(cacheKey, data, cacheTtl);
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, tenantId, startDate, endDate, cacheTtl, enabled, getCacheKey]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const invalidateCache = useCallback(() => {
    const cacheKey = getCacheKey();
    dashboardCache.invalidate(cacheKey);
  }, [getCacheKey]);

  const prefetchMetrics = useCallback(
    async (dates: { start: string; end: string }[]) => {
      if (!enabled) return;

      for (const date of dates) {
        const prefetchKey = `metrics:${tenantId}:${date.start}:${date.end}`;
        const cached = dashboardCache.get(prefetchKey);

        if (!cached) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-seo-metrics`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  tenant_id: tenantId,
                  start_date: date.start,
                  end_date: date.end,
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              dashboardCache.set(prefetchKey, data, cacheTtl);
            }
          } catch (err) {
            console.error('Prefetch error:', err);
          }
        }
      }
    },
    [tenantId, accessToken, cacheTtl, enabled]
  );

  return {
    metrics,
    isLoading,
    error,
    cacheHit,
    fetchMetrics,
    invalidateCache,
    prefetchMetrics,
    cacheStats: dashboardCache.getStats(),
  };
}

export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    networkTime: 0,
    ttfb: 0,
    fps: 60,
  });

  useEffect(() => {
    // Measure Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        setMetrics(prev => ({
          ...prev,
          renderTime: lastEntry.renderTime || lastEntry.startTime,
        }));
      });

      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      return () => lcpObserver.disconnect();
    }
  }, []);

  const measureComponentRender = useCallback((componentName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`${componentName} render time: ${duration.toFixed(2)}ms`);
    };
  }, []);

  return {
    metrics,
    measureComponentRender,
  };
}

interface PreloadConfig {
  urls: string[];
  priority?: 'high' | 'low' | 'auto';
}

export function useDataPreloading(config: PreloadConfig) {
  const preloadInProgress = useRef(false);

  const preloadData = useCallback(async (accessToken: string) => {
    if (preloadInProgress.current) return;

    preloadInProgress.current = true;

    try {
      const preloadPromises = config.urls.map(url =>
        fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          priority: config.priority === 'high' ? 'high' : 'low',
        })
      );

      await Promise.all(preloadPromises);
    } catch (error) {
      console.error('Preload error:', error);
    } finally {
      preloadInProgress.current = false;
    }
  }, [config]);

  return { preloadData };
}

export { dashboardCache };
