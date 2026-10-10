// Caller-supplied evidence for governance_evidence (governance-ingest).
//
// content_hash / previous_hash on governance_evidence form the per-tenant
// hash chain (see _shared/evidence-hash.ts): the head is the tenant's latest
// row with a non-null content_hash. An ingest API key is held by an external
// system, so its own hash values never go into those columns — a forged
// content_hash would become the chain head, a forged previous_hash would
// claim a link that never existed. They are kept verbatim under
// metadata.client_content_hash / metadata.client_previous_hash (e.g. the hash
// of an artefact in the caller's own storage).
//
// Instead the server chains every caller evidence row itself, exactly like
// tenant-audit / email-auth-rescan: snapshot → content_hash per
// EVIDENCE_HASH_METHOD, appended by compare-and-swap on the chain head
// (append_governance_evidence, advisory lock per tenant). A head moved by a
// concurrent writer is re-read, the snapshot re-hashed and the append retried.
//
// No Deno / jsr imports: vitest-importable.

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

/** Caller evidence rows per request (each is one locked append). */
export const MAX_CALLER_EVIDENCE = 50;
export const EVIDENCE_APPEND_ATTEMPTS = 5;

export interface CallerEvidence {
  evidence_type: string;
  title: string;
  storage_path?: string;
  content_hash?: string;
  previous_hash?: string;
  metadata?: Record<string, unknown>;
}

export interface ChainStore {
  /** content_hash of the tenant's latest chained row (null for the first link). */
  latestHead(tenantId: string): Promise<string | null>;
  /** Insert only if `expectedPreviousHash` is still the head; 'conflict' otherwise. */
  append(row: Record<string, unknown>, expectedPreviousHash: string | null): Promise<{ id: string } | 'conflict'>;
}

export class EvidenceChainBusyError extends Error {
  constructor(attempts: number) {
    super(`evidence chain head kept moving (${attempts} attempts)`);
    this.name = 'EvidenceChainBusyError';
  }
}

/** Keys the server owns in metadata; a caller value for them is discarded. */
const RESERVED_METADATA = ['client_content_hash', 'client_previous_hash', 'source', 'hash_method', 'snapshot'];

function clientFields(e: CallerEvidence): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof e.content_hash === 'string' && e.content_hash) out.client_content_hash = e.content_hash;
  if (typeof e.previous_hash === 'string' && e.previous_hash) out.client_previous_hash = e.previous_hash;
  return out;
}

/** The row for one chain link; content_hash covers `snapshot`, which includes previous_hash. */
export async function chainedEvidenceRow(
  e: CallerEvidence,
  ctx: { tenantId: string; eventId: string; assetId: string | null; evidenceId: string; previousHash: string | null },
): Promise<Record<string, unknown>> {
  const callerMetadata: Record<string, unknown> = { ...(e.metadata ?? {}) };
  for (const k of RESERVED_METADATA) delete callerMetadata[k];
  const client = clientFields(e);
  const snapshot: Record<string, unknown> = {
    source: 'governance-ingest',
    tenant_id: ctx.tenantId,
    event_id: ctx.eventId,
    asset_id: ctx.assetId,
    evidence_id: ctx.evidenceId,
    evidence_type: e.evidence_type,
    title: e.title,
    storage_path: e.storage_path ?? null,
    client_metadata: callerMetadata,
    ...client,
    previous_hash: ctx.previousHash,
  };
  return {
    id: ctx.evidenceId,
    tenant_id: ctx.tenantId,
    event_id: ctx.eventId,
    asset_id: ctx.assetId,
    evidence_type: e.evidence_type,
    title: e.title,
    storage_path: e.storage_path ?? null,
    content_hash: await evidenceContentHash(snapshot),
    previous_hash: ctx.previousHash,
    metadata: {
      ...callerMetadata,
      ...client,
      source: 'governance-ingest',
      hash_method: EVIDENCE_HASH_METHOD,
      snapshot,
    },
  };
}

/** Appends one caller evidence row as the tenant's next chain link. */
export async function appendCallerEvidence(
  store: ChainStore,
  e: CallerEvidence,
  ctx: { tenantId: string; eventId: string; assetId: string | null; evidenceId: string },
): Promise<{ id: string }> {
  for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS; attempt++) {
    const previousHash = await store.latestHead(ctx.tenantId);
    const row = await chainedEvidenceRow(e, { ...ctx, previousHash });
    const appended = await store.append(row, previousHash);
    if (appended !== 'conflict') return appended;
  }
  throw new EvidenceChainBusyError(EVIDENCE_APPEND_ATTEMPTS);
}
