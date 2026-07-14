// Client-Wrapper für Bulk-Scan-Jobs.
//
// Schreibpfade (submit/cancel) laufen über die Edge-Function `bulk-scan`.
// Lesepfade (Batches auflisten, Fortschritt) gehen RLS-sicher direkt über
// PostgREST bzw. die RPC bulk_scan_batch_progress.

import { getSupabase } from '../../lib/supabase';

export type BatchStatus = 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface BulkBatch {
  id: string;
  tenant_id: string;
  label: string | null;
  status: BatchStatus;
  priority: number;
  total_count: number;
  created_at: string;
}

export interface BatchProgress {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}

export interface SubmitResult {
  ok: true;
  batch_id: string;
  accepted: number;
  rejected: Array<{ raw: string; reason: string }>;
  duplicates: number;
}

export type BulkError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'quota_exceeded'; message: string }
  | { kind: 'bad_request'; message: string; rejected?: Array<{ raw: string; reason: string }> }
  | { kind: 'error'; message: string };

export type BulkResult<T> = { kind: 'ok'; data: T } | BulkError;

function mapError(error: unknown): BulkError {
  const status = (error as { context?: { status?: number } }).context?.status;
  const message = (error as { message?: string }).message ?? 'Netzwerkfehler';
  if (status === 403) return { kind: 'forbidden' };
  if (status === 402) return { kind: 'payment_required', message };
  if (status === 429) return { kind: 'quota_exceeded', message };
  if (status === 400) return { kind: 'bad_request', message };
  return { kind: 'error', message };
}

export async function submitBulkScan(args: {
  tenant_id: string;
  domains?: string[];
  csv?: string;
  label?: string;
  priority?: number;
}): Promise<BulkResult<SubmitResult>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('bulk-scan', { body: { op: 'submit', ...args } });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as SubmitResult };
}

export async function cancelBulkScan(args: { tenant_id: string; batch_id: string }): Promise<BulkResult<{ ok: true }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('bulk-scan', { body: { op: 'cancel', ...args } });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as { ok: true } };
}

export async function listBatches(tenantId: string): Promise<BulkBatch[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bulk_scan_batches')
    .select('id, tenant_id, label, status, priority, total_count, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as BulkBatch[];
}

export async function getBatchProgress(batchId: string): Promise<BatchProgress | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('bulk_scan_batch_progress', { p_batch_id: batchId });
  if (error) throw new Error(error.message);
  return (data ?? null) as BatchProgress | null;
}
