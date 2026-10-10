// Freigabe entscheiden — Status und gekettete Evidence in EINER Transaktion
// (RPC decide_governance_approval, Migration 20261010143814). Deno-frei.
//
// Ohne geschriebene Evidence gibt es keine Entscheidung: Bewegt sich der
// Kettenkopf zwischen Lesen und Schreiben, rollt die Datenbank Status UND
// Evidence zurück; hier wird der Kopf neu gelesen, neu gehasht und erneut
// versucht. Damit ist eine Freigabe nie 'approved' (und damit für
// reserve_browser_execution reservierbar), solange ihr Nachweis fehlt.

import { BrowserRuntimeError } from './errors.ts';
import {
  EVIDENCE_APPEND_ATTEMPTS,
  buildChainedEvidenceRow,
  type ChainedEvidenceInput,
  type EvidenceRow,
} from './evidence.ts';

export type DecisionTarget = 'approved' | 'rejected' | 'cancelled';
export type DecisionOutcome = 'decided' | 'not_found' | 'already_resolved' | 'expired';

export interface DecisionRpcInput {
  approvalId: string;
  tenantId: string;
  decidedBy: string;
  target: DecisionTarget;
  reason: string | null;
  decidedAt: string;
  evidenceRow: EvidenceRow;
  expectedPreviousHash: string | null;
}

export interface DecisionRpcResult {
  outcome: DecisionOutcome;
  evidence_id: string | null;
  approval_status: string | null;
}

export interface ApprovalDecisionRepo {
  latestEvidenceHash(tenantId: string): Promise<string | null>;
  /** decide_governance_approval; 'conflict' = Kettenkopf bewegt (SQLSTATE 40001), alles zurückgerollt. */
  decideApproval(input: DecisionRpcInput): Promise<DecisionRpcResult | 'conflict'>;
}

export interface DecisionInput {
  approvalId: string;
  tenantId: string;
  decidedBy: string;
  target: DecisionTarget;
  reason: string | null;
  decidedAt: string;
  evidence: Omit<ChainedEvidenceInput, 'tenantId'>;
}

export interface DecisionResult extends DecisionRpcResult {
  content_hash: string | null;
  previous_hash: string | null;
}

export async function decideWithEvidence(repo: ApprovalDecisionRepo, input: DecisionInput): Promise<DecisionResult> {
  try {
    for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS; attempt++) {
      const previousHash = await repo.latestEvidenceHash(input.tenantId);
      const row = await buildChainedEvidenceRow({ ...input.evidence, tenantId: input.tenantId }, previousHash);
      const result = await repo.decideApproval({
        approvalId: input.approvalId,
        tenantId: input.tenantId,
        decidedBy: input.decidedBy,
        target: input.target,
        reason: input.reason,
        decidedAt: input.decidedAt,
        evidenceRow: row,
        expectedPreviousHash: previousHash,
      });
      if (result === 'conflict') continue;
      return {
        ...result,
        content_hash: result.outcome === 'decided' ? row.content_hash : null,
        previous_hash: result.outcome === 'decided' ? previousHash : null,
      };
    }
  } catch (error) {
    if (error instanceof BrowserRuntimeError) throw error;
    throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', 'decision could not be evidenced; not applied');
  }
  throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', `evidence chain head kept moving (${EVIDENCE_APPEND_ATTEMPTS} attempts); not applied`);
}
