import crypto from 'crypto';
import { supabase } from '../services/supabase.js';
import { EvidenceSnapshot } from '../types/index.js';
import type { Database } from '../types/database.js';
import { verifyChain, type ChainIssue } from '../../../../packages/evidence-chain/src/index.js';

export async function listEvidence(
  tenantId: string,
  subjectRef?: string,
  limit: number = 50,
): Promise<EvidenceSnapshot[]> {
  let query = supabase
    .from('evidence_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (subjectRef) {
    query = query.eq('subject_ref', subjectRef);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to list evidence:', error);
    throw new Error(`Evidence list failed: ${error.message}`);
  }

  return (data || []).map(mapEvidenceRow);
}

export async function getEvidence(
  tenantId: string,
  evidenceId: string,
): Promise<EvidenceSnapshot | null> {
  const { data, error } = await supabase
    .from('evidence_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', evidenceId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Evidence get failed: ${error.message}`);
  }

  return data ? mapEvidenceRow(data) : null;
}

/** SHA-256 als Hex — injiziert in verifyChain, damit der Kern laufzeitfrei bleibt. */
async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface ChainVerification {
  subjectRef: string;
  /** Alle Prüfungen bestanden. */
  valid: boolean;
  /** Anzahl Snapshots in der Kette. */
  chainLength: number;
  /** Snapshots, deren event_hash erfolgreich nachgerechnet wurde. */
  cryptoVerified: number;
  /** Snapshots ohne event_timestamp — nur strukturell prüfbar, keine Manipulation. */
  legacy: number;
  issues: ChainIssue[];
}

/**
 * Verifiziert die Hash-Kette des Subjects, zu dem der Snapshot gehört.
 *
 * Geprüft wird die gesamte Kette, nicht nur der angefragte Snapshot: Ein
 * einzelner Snapshot für sich sagt nichts aus, seine Unversehrtheit ergibt
 * sich erst aus der lückenlosen Verkettung ab Version 1.
 *
 * Die Prüflogik stammt aus `@realsync/evidence-chain` — demselben Modul, das
 * die SPA verwendet, mit derselben Kanonisierung wie die Edge Function, die
 * die Hashes erzeugt. Eine eigene Kopie hier würde irgendwann abweichen und
 * die Verifizierung still falsch beantworten.
 */
export async function verifyHashChain(
  tenantId: string,
  evidenceId: string,
): Promise<ChainVerification> {
  const anchor = await getEvidence(tenantId, evidenceId);
  if (!anchor) {
    throw new Error('Evidence not found');
  }

  const { data, error } = await supabase
    .from('evidence_snapshots')
    .select('subject_ref, version, content_sha256, retention_class, prev_hash, event_hash, event_timestamp')
    .eq('tenant_id', tenantId)
    .eq('subject_ref', anchor.subjectRef)
    .order('version', { ascending: true });

  if (error) {
    throw new Error(`Chain load failed: ${error.message}`);
  }

  const report = await verifyChain(data ?? [], sha256Hex);

  return {
    subjectRef: report.subjectRef,
    valid: report.ok,
    chainLength: report.count,
    cryptoVerified: report.cryptoVerified,
    legacy: report.legacy,
    issues: report.issues,
  };
}

export async function searchEvidenceByControl(
  tenantId: string,
  controlId: string,
): Promise<EvidenceSnapshot[]> {
  // Phase 2: Semantic search via pgvector
  // For now: search by subject_ref pattern
  const { data, error } = await supabase
    .from('evidence_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('subject_ref', `%${controlId}%`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Evidence search failed: ${error.message}`);
  }

  return (data || []).map(mapEvidenceRow);
}

type EvidenceRow = Database['public']['Tables']['evidence_snapshots']['Row'];

function mapEvidenceRow(row: EvidenceRow): EvidenceSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subjectRef: row.subject_ref,
    label: row.label ?? undefined,
    version: row.version,
    contentSha256: row.content_sha256,
    prevHash: row.prev_hash ?? undefined,
    eventHash: row.event_hash,
    signature: row.signature ?? undefined,
    retentionClass: row.retention_class,
    retainedUntil: row.retained_until ? new Date(row.retained_until) : undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: new Date(row.created_at),
  };
}
