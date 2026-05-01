// Read-side helpers for the ai_tool_runs audit log.

import { getSupabase } from '../../lib/supabase';

export interface AiRun {
  id: string;
  tenant_id: string;
  tool_key: string;
  user_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  status: 'success' | 'error' | 'timeout' | 'quota_exceeded';
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AiRunStats {
  totalRuns: number;
  totalTokens: number;
  totalCostUsd: number;
  successRuns: number;
  errorRuns: number;
}

export async function listRecentRuns(tenantId: string, limit = 50): Promise<AiRun[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_tool_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AiRun[];
}

/** Aggregates from the runs returned by listRecentRuns — computed client-side. */
export function summarizeRuns(runs: AiRun[]): AiRunStats {
  let totalTokens = 0;
  let totalCostUsd = 0;
  let success = 0;
  let error = 0;
  for (const r of runs) {
    totalTokens += r.input_tokens + r.output_tokens;
    totalCostUsd += Number(r.cost_usd);
    if (r.status === 'success') success += 1;
    else error += 1;
  }
  return {
    totalRuns: runs.length,
    totalTokens,
    totalCostUsd,
    successRuns: success,
    errorRuns: error,
  };
}
