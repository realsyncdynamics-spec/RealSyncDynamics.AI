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

export type ShadowRuntimeClass =
  | 'c0_local'
  | 'c1_standard'
  | 'c2_agent'
  | 'c3_page_builder'
  | 'c4_app_builder';

export type ShadowExecutionZone =
  | 'device_local'
  | 'eu_private'
  | 'governed_cloud';

export interface ShadowRuntimeSample {
  runId: string;
  runtimeClass: ShadowRuntimeClass;
  executionZone: ShadowExecutionZone;
  providerClass: string;
  modelRef: string | null;
  totalTokens: number;
  providerCostUsd: number | null;
  durationMs: number | null;
  retryCount: number;
  verifierRuns: number;
  status: AiRun['status'];
}

export interface ShadowRuntimeGroupStats {
  runtimeClass: ShadowRuntimeClass;
  executionZone: ShadowExecutionZone;
  providerClass: string;
  runs: number;
  successRuns: number;
  errorRuns: number;
  costUsd: { p50: number | null; p90: number | null; p99: number | null };
  tokens: { p50: number | null; p90: number | null; p99: number | null };
  durationMs: { p50: number | null; p90: number | null; p99: number | null };
  retryShare: number;
  verifierShare: number;
}

const RUNTIME_CLASSES: readonly ShadowRuntimeClass[] = [
  'c0_local',
  'c1_standard',
  'c2_agent',
  'c3_page_builder',
  'c4_app_builder',
];

const EXECUTION_ZONES: readonly ShadowExecutionZone[] = [
  'device_local',
  'eu_private',
  'governed_cloud',
];

const RUNTIME_CLASS_SET = new Set<string>(RUNTIME_CLASSES);
const EXECUTION_ZONE_SET = new Set<string>(EXECUTION_ZONES);

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number {
  const n = finiteNumber(value);
  if (n === null) return 0;
  return Math.max(0, Math.trunc(n));
}

/**
 * Reads only server-emitted shadow fields from ai_tool_runs.metadata.
 * Pre-#1508 rows intentionally return null instead of being backfilled or guessed.
 */
export function parseShadowRuntimeSample(run: AiRun): ShadowRuntimeSample | null {
  const metadata = run.metadata ?? {};
  const runtimeClass = metadata.runtime_class;
  const executionZone = metadata.execution_zone;
  const providerClass = metadata.provider_class;

  if (typeof runtimeClass !== 'string' || !RUNTIME_CLASS_SET.has(runtimeClass)) return null;
  if (typeof executionZone !== 'string' || !EXECUTION_ZONE_SET.has(executionZone)) return null;
  if (typeof providerClass !== 'string' || providerClass.length === 0) return null;

  const providerCostUsd = finiteNumber(metadata.actual_provider_cost_usd);
  const durationFromMetadata = finiteNumber(metadata.duration_ms);
  const durationMs = durationFromMetadata ?? finiteNumber(run.duration_ms);

  return {
    runId: run.id,
    runtimeClass: runtimeClass as ShadowRuntimeClass,
    executionZone: executionZone as ShadowExecutionZone,
    providerClass,
    modelRef: typeof metadata.model_ref === 'string' ? metadata.model_ref : null,
    totalTokens: Math.max(0, Number(run.input_tokens || 0) + Number(run.output_tokens || 0)),
    providerCostUsd: providerCostUsd !== null && providerCostUsd >= 0 ? providerCostUsd : null,
    durationMs: durationMs !== null && durationMs >= 0 ? durationMs : null,
    retryCount: nonNegativeInteger(metadata.retry_count),
    verifierRuns: nonNegativeInteger(metadata.verifier_runs),
    status: run.status,
  };
}

function percentileNearestRank(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[Math.min(rank - 1, sorted.length - 1)];
}

function percentileTriplet(values: number[]) {
  return {
    p50: percentileNearestRank(values, 0.50),
    p90: percentileNearestRank(values, 0.90),
    p99: percentileNearestRank(values, 0.99),
  };
}

/**
 * Groups real post-#1508 samples by the three dimensions needed for burn calibration.
 * No credit value is inferred here: this is measurement only.
 */
export function summarizeShadowRuntime(runs: AiRun[]): ShadowRuntimeGroupStats[] {
  const samples = runs
    .map(parseShadowRuntimeSample)
    .filter((sample): sample is ShadowRuntimeSample => sample !== null);

  const groups = new Map<string, ShadowRuntimeSample[]>();
  for (const sample of samples) {
    const key = `${sample.runtimeClass}|${sample.executionZone}|${sample.providerClass}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(sample);
    groups.set(key, bucket);
  }

  const rows = [...groups.values()].map((bucket): ShadowRuntimeGroupStats => {
    const first = bucket[0];
    const costs = bucket
      .map((sample) => sample.providerCostUsd)
      .filter((value): value is number => value !== null);
    const tokens = bucket.map((sample) => sample.totalTokens);
    const durations = bucket
      .map((sample) => sample.durationMs)
      .filter((value): value is number => value !== null);

    return {
      runtimeClass: first.runtimeClass,
      executionZone: first.executionZone,
      providerClass: first.providerClass,
      runs: bucket.length,
      successRuns: bucket.filter((sample) => sample.status === 'success').length,
      errorRuns: bucket.filter((sample) => sample.status !== 'success').length,
      costUsd: percentileTriplet(costs),
      tokens: percentileTriplet(tokens),
      durationMs: percentileTriplet(durations),
      retryShare: bucket.filter((sample) => sample.retryCount > 0).length / bucket.length,
      verifierShare: bucket.filter((sample) => sample.verifierRuns > 0).length / bucket.length,
    };
  });

  const classRank = new Map(RUNTIME_CLASSES.map((value, index) => [value, index]));
  const zoneRank = new Map(EXECUTION_ZONES.map((value, index) => [value, index]));

  return rows.sort((a, b) =>
    (classRank.get(a.runtimeClass) ?? 99) - (classRank.get(b.runtimeClass) ?? 99) ||
    (zoneRank.get(a.executionZone) ?? 99) - (zoneRank.get(b.executionZone) ?? 99) ||
    a.providerClass.localeCompare(b.providerClass)
  );
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
