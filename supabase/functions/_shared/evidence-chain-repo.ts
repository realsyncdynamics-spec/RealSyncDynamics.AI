// Gemeinsamer Zugriff auf die governance_evidence-Kette (Deno-frei).
//
// latestEvidenceHash liest den Kettenkopf in derselben Reihenfolge wie
// public.append_governance_evidence (created_at DESC, id DESC); appendEvidence
// hängt per Compare-and-Swap an (NULL = Kopf hat sich bewegt → 'conflict').
// Nutzer: browser-execute, governance-approvals (über
// _shared/browser-runtime/evidence.ts: appendChainedEvidence).

import type { EvidenceRepo, EvidenceRow } from './browser-runtime/evidence.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

export function createEvidenceChainRepo(db: Db): EvidenceRepo {
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
  };
}
