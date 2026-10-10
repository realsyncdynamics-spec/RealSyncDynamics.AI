// Caller-supplied evidence for governance_evidence (governance-ingest).
//
// content_hash / previous_hash on governance_evidence form the per-tenant
// hash chain (see _shared/evidence-hash.ts): the head is the tenant's latest
// row with a non-null content_hash, and tenant-audit / email-auth-rescan
// append to it under a lock (append_governance_evidence). An ingest API key
// is held by an external system, so its values must not land in those
// columns: a forged content_hash would become the chain head and the next
// server-written link would chain onto it; a forged previous_hash would claim
// a link that never existed.
//
// The caller's values are kept verbatim under metadata.client_content_hash /
// metadata.client_previous_hash (e.g. the hash of an artefact in the
// caller's own storage) and the chain columns stay null.
//
// No Deno / jsr imports: vitest-importable.

export interface CallerEvidence {
  evidence_type: string;
  title: string;
  storage_path?: string;
  content_hash?: string;
  previous_hash?: string;
  metadata?: Record<string, unknown>;
}

export function callerEvidenceRow(
  e: CallerEvidence,
  ctx: { tenantId: string; eventId: string; assetId: string | null },
): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...(e.metadata ?? {}) };
  delete metadata.client_content_hash;
  delete metadata.client_previous_hash;
  if (typeof e.content_hash === 'string' && e.content_hash) metadata.client_content_hash = e.content_hash;
  if (typeof e.previous_hash === 'string' && e.previous_hash) metadata.client_previous_hash = e.previous_hash;
  return {
    tenant_id: ctx.tenantId,
    event_id: ctx.eventId,
    asset_id: ctx.assetId,
    evidence_type: e.evidence_type,
    title: e.title,
    storage_path: e.storage_path ?? null,
    content_hash: null,
    previous_hash: null,
    metadata,
  };
}
