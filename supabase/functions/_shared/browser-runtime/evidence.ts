// Governed Browser Runtime — gekettete Evidence (rein bis auf das injizierte Repo).
//
// Jede Browser-Aktion schreibt über append_governance_evidence (Advisory-Lock
// pro Mandant, Compare-and-Swap auf den Kettenkopf) in dieselbe Kette wie
// tenant-audit und email-auth-rescan. Hash-Konvention: _shared/evidence-hash.ts
// (sha256 über RFC-8785-JCS von metadata.snapshot, previous_hash im Snapshot).
//
// Fail closed: Kann nicht geschrieben werden, wirft appendChainedEvidence
// EVIDENCE_WRITE_FAILED. Bei Mutationen läuft der Intent-Eintrag VOR der
// Ausführung — scheitert er, wird nicht ausgeführt.

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../evidence-hash.ts';
import { BrowserRuntimeError } from './errors.ts';

export interface EvidenceRow {
  id: string;
  tenant_id: string;
  event_id: string | null;
  asset_id: string | null;
  evidence_type: 'json' | 'screenshot' | 'approval' | 'log';
  title: string;
  storage_path: null;
  content_hash: string;
  previous_hash: string | null;
  metadata: Record<string, unknown>;
}

export interface EvidenceRepo {
  latestEvidenceHash(tenantId: string): Promise<string | null>;
  /** append_governance_evidence: { id } oder 'conflict', wenn der Kopf sich bewegt hat. */
  appendEvidence(row: EvidenceRow, expectedPreviousHash: string | null): Promise<{ id: string } | 'conflict'>;
}

export const EVIDENCE_APPEND_ATTEMPTS = 3;

export interface ChainedEvidenceInput {
  id: string;
  tenantId: string;
  eventId: string | null;
  evidenceType: EvidenceRow['evidence_type'];
  title: string;
  source: string;
  /** Alles, was der Hash abdecken soll — ohne previous_hash (kommt hier dazu). */
  snapshot: Record<string, unknown>;
}

export interface ChainedEvidence {
  id: string;
  content_hash: string;
  previous_hash: string | null;
}

export async function appendChainedEvidence(repo: EvidenceRepo, input: ChainedEvidenceInput): Promise<ChainedEvidence> {
  try {
    for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS; attempt++) {
      const previousHash = await repo.latestEvidenceHash(input.tenantId);
      const snapshot = { ...input.snapshot, evidence_id: input.id, previous_hash: previousHash };
      const contentHash = await evidenceContentHash(snapshot);
      const appended = await repo.appendEvidence({
        id: input.id,
        tenant_id: input.tenantId,
        event_id: input.eventId,
        asset_id: null,
        evidence_type: input.evidenceType,
        title: input.title.slice(0, 500),
        storage_path: null,
        content_hash: contentHash,
        previous_hash: previousHash,
        metadata: {
          source: input.source,
          hash_method: EVIDENCE_HASH_METHOD,
          snapshot,
        },
      }, previousHash);
      if (appended !== 'conflict') {
        return { id: appended.id, content_hash: contentHash, previous_hash: previousHash };
      }
    }
  } catch (error) {
    if (error instanceof BrowserRuntimeError) throw error;
    throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', 'evidence could not be persisted');
  }
  throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', `evidence chain head kept moving (${EVIDENCE_APPEND_ATTEMPTS} attempts)`);
}

/** Einheitlicher Snapshot für Browser-Aktions-Evidence (Pflichtfelder laut Spezifikation). */
export function browserActionSnapshot(input: {
  kind: 'browser.action.intent' | 'browser.action.result' | 'browser.action.denied' | 'browser.session.opened' | 'browser.session.closed';
  tenantId: string;
  actor: { user_id: string; role: string };
  browserSessionId: string;
  correlationId: string;
  timestamp: string;
  action: Record<string, unknown> | null;
  target: string | null;
  policy: {
    decision: string;
    policy_id: string;
    policy_version: string;
    reason: string;
    risk_level: string;
    conditions: string[];
  } | null;
  approvalId: string | null;
  result: Record<string, unknown> | null;
  verification: { status: string; checks: Record<string, unknown> } | null;
  artifacts: Array<{ kind: string; sha256: string; bytes?: number }>;
}): Record<string, unknown> {
  return {
    kind: input.kind,
    tenant_id: input.tenantId,
    actor: input.actor,
    browser_session_id: input.browserSessionId,
    correlation_id: input.correlationId,
    timestamp: input.timestamp,
    action: input.action,
    target: input.target,
    policy: input.policy,
    approval_id: input.approvalId,
    result: input.result,
    verification: input.verification,
    artifacts: input.artifacts,
  };
}
