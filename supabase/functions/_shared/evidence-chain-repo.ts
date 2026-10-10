// Gemeinsamer Zugriff auf die governance_evidence-Kette (Deno-frei).
//
// latestEvidenceHash liest den Kettenkopf in derselben Reihenfolge wie
// public.append_governance_evidence (created_at DESC, id DESC); appendEvidence
// hängt per Compare-and-Swap an (NULL = Kopf hat sich bewegt → 'conflict').
// decideApproval ruft decide_governance_approval: Entscheidung + Evidence in
// einer Transaktion (SQLSTATE 40001 = Kopf bewegt → 'conflict').
// Nutzer: browser-execute, governance-approvals.

import type { EvidenceRepo, EvidenceRow } from './browser-runtime/evidence.ts';
import type { ApprovalDecisionRepo, DecisionRpcInput, DecisionRpcResult } from './browser-runtime/approval-decision.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

const DECISION_OUTCOMES = new Set(['decided', 'not_found', 'already_resolved', 'expired']);

export function createEvidenceChainRepo(db: Db): EvidenceRepo & ApprovalDecisionRepo {
  return {
    async latestEvidenceHash(tenantId: string) {
      const r = await db.from('governance_evidence')
        .select('content_hash')
        .eq('tenant_id', tenantId)
        .not('content_hash', 'is', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);
      if (r.error) throw new Error(`governance_evidence: ${r.error.code ?? 'error'}`);
      return (r.data as Array<{ content_hash: string | null }> | null)?.[0]?.content_hash ?? null;
    },

    async appendEvidence(row: EvidenceRow, expectedPreviousHash: string | null) {
      const r = await db.rpc('append_governance_evidence', {
        p_row: row,
        p_expected_previous_hash: expectedPreviousHash,
      });
      if (r.error) throw new Error(`append_governance_evidence: ${r.error.code ?? 'error'}`);
      return r.data ? { id: r.data as string } : 'conflict';
    },

    async decideApproval(input: DecisionRpcInput): Promise<DecisionRpcResult | 'conflict'> {
      const r = await db.rpc('decide_governance_approval', {
        p_approval_id: input.approvalId,
        p_tenant_id: input.tenantId,
        p_decided_by: input.decidedBy,
        p_target: input.target,
        p_reason: input.reason,
        p_decided_at: input.decidedAt,
        p_evidence: input.evidenceRow,
        p_expected_previous_hash: input.expectedPreviousHash,
      });
      if (r.error) {
        if (r.error.code === '40001') return 'conflict';
        throw new Error(`decide_governance_approval: ${r.error.code ?? 'error'}`);
      }
      const row = (Array.isArray(r.data) ? r.data[0] : r.data) as Record<string, unknown> | null;
      if (!row || typeof row.outcome !== 'string' || !DECISION_OUTCOMES.has(row.outcome)) {
        throw new Error('decide_governance_approval: unexpected result');
      }
      return {
        outcome: row.outcome as DecisionRpcResult['outcome'],
        evidence_id: typeof row.evidence_id === 'string' ? row.evidence_id : null,
        approval_status: typeof row.approval_status === 'string' ? row.approval_status : null,
      };
    },
  };
}
