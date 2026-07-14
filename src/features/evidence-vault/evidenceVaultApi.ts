// Client-Wrapper für Evidence Vault Advanced.
//
// Schreibpfade (snapshot/hold) über die Edge-Function `evidence-vault`.
// Timeline liest RLS-sicher direkt über die RPC evidence_vault_timeline.

import { getSupabase } from '../../lib/supabase';
import type { RetentionClass } from '../../lib/evidence/retention';
import type { SnapshotRecord } from '../../lib/evidence/verifyChain';

export interface TimelineEntry {
  id: string;
  subject_ref: string;
  label: string | null;
  version: number;
  content_sha256: string;
  event_hash: string;
  retention_class: RetentionClass;
  retained_until: string | null;
  created_at: string;
  on_hold: boolean;
}

export interface SnapshotResult {
  ok: true;
  id: string;
  subject_ref: string;
  version: number;
  event_hash: string;
  retained_until: string | null;
  signed: boolean;
  /** Phase 2b: Snapshot wurde automatisch in der Herkunftskette erfasst. */
  provenance_linked?: boolean;
}

export type VaultError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'bad_request'; message: string }
  | { kind: 'error'; message: string };

export type VaultResult<T> = { kind: 'ok'; data: T } | VaultError;

function mapError(error: unknown): VaultError {
  const status = (error as { context?: { status?: number } }).context?.status;
  const message = (error as { message?: string }).message ?? 'Netzwerkfehler';
  if (status === 403) return { kind: 'forbidden' };
  if (status === 402) return { kind: 'payment_required', message };
  if (status === 400) return { kind: 'bad_request', message };
  return { kind: 'error', message };
}

export async function createSnapshot(args: {
  tenant_id: string; subject_ref: string; content_sha256: string; label?: string; retention_class?: RetentionClass;
}): Promise<VaultResult<SnapshotResult>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('evidence-vault', { body: { op: 'snapshot', ...args } });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as SnapshotResult };
}

export async function setLegalHold(args: {
  tenant_id: string; subject_ref: string; active: boolean; reason?: string;
}): Promise<VaultResult<{ ok: true; legal_hold: boolean }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('evidence-vault', { body: { op: 'hold', ...args } });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as { ok: true; legal_hold: boolean } };
}

export async function listTimeline(tenantId: string): Promise<TimelineEntry[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('evidence_vault_timeline', { p_tenant_id: tenantId, p_limit: 100 });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimelineEntry[];
}

/**
 * Liest die Rohdaten der Snapshots (RLS-sicher direkt), inkl. prev_hash und
 * event_timestamp, für die unabhängige Hash-Chain-Verifizierung im Browser.
 */
export async function listSnapshotsForVerification(tenantId: string): Promise<SnapshotRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('evidence_snapshots')
    .select('subject_ref, version, content_sha256, retention_class, prev_hash, event_hash, event_timestamp')
    .eq('tenant_id', tenantId)
    .order('subject_ref', { ascending: true })
    .order('version', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SnapshotRecord[];
}
