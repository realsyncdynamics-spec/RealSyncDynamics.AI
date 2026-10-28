// O1 (Masterplan Phase 0 / P0-4): Hash-verkettete Freigabe-Evidence für
// `governance-approvals`.
//
// Befund (Masterplan I-6): `governance-approvals/index.ts` schrieb in
// `handleResolve` bisher direkt in `governance_evidence` mit
// `content_hash: null, previous_hash: null` außerhalb der Mandanten-Hash-Kette
// und erzeugte (anders als `handleGateResolve`) keinen Eintrag in
// `ai_evidence_events`.
//
// Lösung (analog zu `governance-ingest/evidence.ts` und `tenant-audit/pipeline.ts`):
//   1. `chainedApprovalEvidenceRow()` baut den Snapshot inkl. `previous_hash`
//      und berechnet `content_hash = sha256_hex(utf8(RFC8785_JCS(snapshot)))`
//      gemäß `_shared/evidence-hash.ts`.
//   2. `appendApprovalEvidence()` hängt den Eintrag über die RPC
//      `append_governance_evidence` (Transaktions-Advisory-Lock pro Mandant,
//      Compare-and-Swap auf den Kettenkopf) konfliktfrei an.
//   3. `buildApprovalAiEvidenceEvent()` erzeugt zusätzlich den korrespondierenden
//      Eintrag für `ai_evidence_events` (Hash-Kette per DB-Trigger
//      `tg_evidence_event_chain`, EU AI Act Art. 12 + 14).
//
// Reine Logik ohne Deno-/jsr-Importe, damit Vitest das Modul direkt prüft.

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

export const EVIDENCE_APPEND_ATTEMPTS = 5;

export interface ApprovalEvidenceInput {
  evidenceId: string;
  tenantId: string;
  approvalId: string;
  eventId: string;
  assetId: string | null;
  policyId?: string | null;
  status: 'approved' | 'rejected';
  resolvedByUserId: string;
  resolvedByEmail: string | null;
  resolvedAt: string;
  reason: string | null;
}

export interface ApprovalChainStore {
  /** content_hash der jüngsten verketteten Zeile des Mandanten (null beim ersten Glied). */
  latestHead(tenantId: string): Promise<string | null>;
  /** Hängt nur an, solange `expectedPreviousHash` noch der Kettenkopf ist; sonst 'conflict'. */
  append(
    row: Record<string, unknown>,
    expectedPreviousHash: string | null,
  ): Promise<{ id: string } | 'conflict'>;
}

export interface AppendedApprovalEvidence {
  id: string;
  contentHash: string;
  previousHash: string | null;
}

export class EvidenceChainBusyError extends Error {
  constructor(attempts: number) {
    super(`evidence chain head kept moving (${attempts} attempts)`);
    this.name = 'EvidenceChainBusyError';
  }
}

/** Baut eine verkettete `governance_evidence`-Zeile; `content_hash` deckt `snapshot` inkl. `previous_hash` ab. */
export async function chainedApprovalEvidenceRow(
  input: ApprovalEvidenceInput,
  previousHash: string | null,
): Promise<Record<string, unknown> & { content_hash: string; previous_hash: string | null }> {
  const snapshot: Record<string, unknown> = {
    source: 'governance-approvals',
    tenant_id: input.tenantId,
    event_id: input.eventId,
    asset_id: input.assetId,
    evidence_id: input.evidenceId,
    evidence_type: 'approval',
    approval_id: input.approvalId,
    status: input.status,
    resolved_by_user_id: input.resolvedByUserId,
    resolved_by_email: input.resolvedByEmail,
    resolved_at: input.resolvedAt,
    reason: input.reason,
    previous_hash: previousHash,
  };
  const contentHash = await evidenceContentHash(snapshot);
  return {
    id: input.evidenceId,
    tenant_id: input.tenantId,
    event_id: input.eventId,
    asset_id: input.assetId,
    evidence_type: 'approval',
    title: input.status === 'approved' ? 'Approval granted' : 'Approval denied',
    storage_path: null,
    content_hash: contentHash,
    previous_hash: previousHash,
    metadata: {
      approval_id: input.approvalId,
      status: input.status,
      resolved_by_user_id: input.resolvedByUserId,
      resolved_by_email: input.resolvedByEmail,
      resolved_at: input.resolvedAt,
      reason: input.reason,
      source: 'governance-approvals',
      hash_method: EVIDENCE_HASH_METHOD,
      snapshot,
    },
  };
}

/**
 * Hängt die Freigabe-Evidence per Compare-and-Swap (`append_governance_evidence`)
 * an die Mandanten-Hash-Kette an. Bewegt ein paralleler Schreiber den Kopf,
 * wird neu gelesen, neu gehasht und erneut versucht.
 */
export async function appendApprovalEvidence(
  store: ApprovalChainStore,
  input: ApprovalEvidenceInput,
): Promise<AppendedApprovalEvidence> {
  for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS; attempt++) {
    const previousHash = await store.latestHead(input.tenantId);
    const row = await chainedApprovalEvidenceRow(input, previousHash);
    const appended = await store.append(row, previousHash);
    if (appended !== 'conflict') {
      return {
        id: appended.id,
        contentHash: row.content_hash,
        previousHash,
      };
    }
  }
  throw new EvidenceChainBusyError(EVIDENCE_APPEND_ATTEMPTS);
}

/**
 * Baut den korrespondierenden `ai_evidence_events`-Eintrag für eine
 * `governance_approvals`-Entscheidung (analog zu `pdp:approval` in `handleGateResolve`).
 * Hinweis: `governance_approvals.policy_id` referenziert `governance_policies`,
 * während `ai_evidence_events.policy_id` auf `ai_policies` zeigt — deshalb wird
 * die Policy-Referenz als `governance_policy_id` im `evidence`-JSON geführt.
 */
export function buildApprovalAiEvidenceEvent(
  input: ApprovalEvidenceInput,
  chainLink: AppendedApprovalEvidence,
): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    policy_id: null,
    event_type: 'governance:approval',
    event_summary: input.status === 'approved'
      ? `Freigabe erteilt (Approval ${input.approvalId})`
      : `Freigabe abgelehnt (Approval ${input.approvalId}): ${input.reason ?? ''}`.trim(),
    risk_level: input.status === 'rejected' ? 'high' : 'medium',
    evidence: {
      approval_id: input.approvalId,
      event_id: input.eventId,
      asset_id: input.assetId,
      governance_policy_id: input.policyId ?? null,
      governance_evidence_id: chainLink.id,
      content_hash: chainLink.contentHash,
      previous_hash: chainLink.previousHash,
      status: input.status,
      resolved_by_user_id: input.resolvedByUserId,
      resolved_by_email: input.resolvedByEmail,
      resolved_at: input.resolvedAt,
      reason: input.reason,
    },
  };
}
