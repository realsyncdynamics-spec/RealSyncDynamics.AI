import { useEffect, useState, useRef, useCallback } from 'react';

interface Metrics {
  cac: number;
  ltv: number;
  ltv_cac_ratio: number;
  conversion_rate: number;
  churn_rate: number;
  cmrr: number;
  period_metrics: {
    web_visitors: number;
    leads_generated: number;
    trials_started: number;
    customers_acquired: number;
    revenue: number;
  };
}

interface UseRealtimeMetricsOptions {
  tenantId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useRealtimeMetrics({
  tenantId,
  accessToken,
  startDate,
  endDate,
  pollIntervalMs = 30000, // Default 30 seconds
  enabled = true,
}: UseRealtimeMetricsOptions) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousMetricsRef = useRef<Metrics | null>(null);

  const fetchMetrics = useCallback(async () => {
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
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data);
      previousMetricsRef.current = data;
      setLastUpdateTime(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, accessToken, startDate, endDate]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;

    void fetchMetrics();
  }, [fetchMetrics, enabled]);

  // Poll for updates
  useEffect(() => {
    if (!enabled) return;

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      void fetchMetrics();
    }, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchMetrics, pollIntervalMs, enabled]);

  // Calculate metric deltas
  const getMetricDelta = (currentValue: number, fieldName: keyof Metrics): number | null => {
    if (!previousMetricsRef.current) return null;
    const prevValue = previousMetricsRef.current[fieldName] as number;
    if (typeof prevValue !== 'number' || typeof currentValue !== 'number') return null;
    return currentValue - prevValue;
  };

  const manualRefresh = useCallback(async () => {
    setIsLoading(true);
    await fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    isLoading,
    error,
    lastUpdateTime,
    getMetricDelta,
    manualRefresh,
  };
}

// Hook for monitoring sync job status
export function useSyncJobStatus(jobId: string, accessToken: string) {
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/data_sync_jobs?id=eq.${jobId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          },
        );

        if (!response.ok) throw new Error('Failed to fetch sync status');
        const [data] = await response.json();

        if (data) {
          setStatus(data.status);
          setProgress(data.progress_percent || 0);
          setError(data.error_message || null);

          // Stop polling if job is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    void fetchStatus();

    // Poll every 5 seconds
    pollIntervalRef.current = setInterval(fetchStatus, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, accessToken]);

  return { status, progress, error };
}
