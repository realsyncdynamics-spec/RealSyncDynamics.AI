import { getSupabase } from '../../lib/supabase';

export interface WorkerStatus {
  worker_id: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  current_domain?: string;
  domains_processed: number;
  domains_failed: number;
  uptime_seconds: number;
  last_heartbeat: string;
}

export interface PoolMetrics {
  total_workers: number;
  active_workers: number;
  idle_workers: number;
  error_workers: number;
  avg_throughput_per_min: number;
  queue_depth: number;
  estimated_completion_minutes: number;
}

export interface ScanResult {
  domain: string;
  status: 'success' | 'timeout' | 'error' | 'not_found';
  compliance_score?: number;
  issues?: string[];
  scan_time_ms: number;
  timestamp: string;
}

/**
 * Get current worker pool status and metrics.
 */
export async function getWorkerPoolMetrics(
  batchId: string
): Promise<PoolMetrics> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('get_worker_pool_metrics', {
    p_batch_id: batchId,
  });

  if (error) throw error;
  return data as PoolMetrics;
}

/**
 * Get individual worker status within a pool.
 */
export async function getWorkerStatus(
  batchId: string
): Promise<WorkerStatus[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('worker_status')
    .select('*')
    .eq('batch_id', batchId)
    .order('last_heartbeat', { ascending: false });

  if (error) throw error;
  return data as WorkerStatus[];
}

/**
 * Dynamically adjust worker pool size (scale up/down).
 */
export async function adjustWorkerPool(
  batchId: string,
  targetWorkerCount: number
): Promise<{ actual_workers: number; adjustment_time_ms: number }> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('adjust_worker_pool', {
    p_batch_id: batchId,
    p_target_workers: targetWorkerCount,
  });

  if (error) throw error;
  return data as { actual_workers: number; adjustment_time_ms: number };
}

/**
 * Get scan results for a batch with optional filtering.
 */
export async function getBatchScanResults(
  batchId: string,
  filters?: {
    status?: 'success' | 'timeout' | 'error' | 'not_found';
    limit?: number;
    offset?: number;
  }
): Promise<ScanResult[]> {
  const sb = getSupabase();
  let query = sb
    .from('scan_results')
    .select('*')
    .eq('batch_id', batchId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query
    .order('timestamp', { ascending: false })
    .range(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 100) - 1);

  if (error) throw error;
  return data as ScanResult[];
}

/**
 * Retry failed domains in a batch.
 */
export async function retryFailedDomains(batchId: string): Promise<{ retried_count: number }> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('retry_failed_batch_items', {
    p_batch_id: batchId,
  });

  if (error) throw error;
  return data as { retried_count: number };
}

/**
 * Export batch results in specified format.
 */
export async function exportBatchResults(
  batchId: string,
  format: 'json' | 'csv' | 'pdf'
): Promise<Blob> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('export-bulk-results', {
    body: {
      batch_id: batchId,
      format,
    },
  });

  if (error) throw error;
  return new Blob([JSON.stringify(data)], { type: 'application/octet-stream' });
}

/**
 * Real-time subscription to batch progress updates via WebSocket.
 * Returns unsubscribe function.
 */
export function subscribeToBatchProgress(
  batchId: string,
  callback: (metrics: PoolMetrics) => void
): () => void {
  const sb = getSupabase();

  const channel = sb
    .channel(`batch:${batchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bulk_scan_batches',
        filter: `id=eq.${batchId}`,
      },
      async () => {
        try {
          const metrics = await getWorkerPoolMetrics(batchId);
          callback(metrics);
        } catch (err) {
          console.error('Error fetching metrics:', err);
        }
      }
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

/**
 * Get cost estimate for a scan configuration.
 */
export async function estimateScanCost(
  domainCount: number,
  config: {
    deep_scan: boolean;
    priority: 'normal' | 'high' | 'urgent';
  }
): Promise<{ cost_usd: number; breakdown: Record<string, number> }> {
  const baseCost = config.deep_scan ? 0.02 : 0.01;
  const multipliers = {
    normal: 1.0,
    high: 1.2,
    urgent: 1.5,
  };

  const finalCost = baseCost * multipliers[config.priority] * domainCount;

  return {
    cost_usd: finalCost,
    breakdown: {
      base_cost: baseCost * domainCount,
      priority_multiplier: (multipliers[config.priority] - 1) * baseCost * domainCount,
    },
  };
}
