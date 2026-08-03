import { supabase } from '../services/supabase.js';
import { logAuditEvent } from '../services/audit.js';
import { EvidenceSnapshot } from '../types/index.js';
import crypto from 'crypto';

export async function listEvidence(
  tenantId: string,
  subjectRef?: string,
  limit: number = 50,
): Promise<EvidenceSnapshot[]> {
  await logAuditEvent({
    tenantId,
    action: 'evidence.list',
    subject: subjectRef || '*',
    actor: 'mcp-server',
  });

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
  await logAuditEvent({
    tenantId,
    action: 'evidence.get',
    subject: evidenceId,
    actor: 'mcp-server',
  });

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

export async function verifyHashChain(
  tenantId: string,
  evidenceId: string,
): Promise<{ valid: boolean; chainLength: number }> {
  await logAuditEvent({
    tenantId,
    action: 'evidence.verify_hash',
    subject: evidenceId,
    actor: 'mcp-server',
  });

  const evidence = await getEvidence(tenantId, evidenceId);
  if (!evidence) {
    throw new Error('Evidence not found');
  }

  // Phase 1: Basic validation. Phase 2: Full hash chain verification
  const isValid = !!(evidence.contentSha256 && evidence.eventHash);

  return {
    valid: isValid,
    chainLength: evidence.version,
  };
}

export async function searchEvidenceByControl(
  tenantId: string,
  controlId: string,
): Promise<EvidenceSnapshot[]> {
  await logAuditEvent({
    tenantId,
    action: 'evidence.search',
    subject: controlId,
    actor: 'mcp-server',
    details: { type: 'control_search' },
  });

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

function mapEvidenceRow(row: any): EvidenceSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subjectRef: row.subject_ref,
    label: row.label,
    version: row.version,
    contentSha256: row.content_sha256,
    prevHash: row.prev_hash,
    eventHash: row.event_hash,
    signature: row.signature,
    retentionClass: row.retention_class,
    retainedUntil: row.retained_until ? new Date(row.retained_until) : undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  };
}
