/**
 * Supabase-Anbindung des REA. Nur lesend, nur mit Nutzer-Session:
 * RLS (`is_tenant_member`) und `ai_evidence_verify_chain` (SECURITY DEFINER
 * mit Mitgliedschaftsprüfung) setzen die Mandantengrenze serverseitig durch.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReaChainRow, ReaDataSource, ReaEvidenceRow } from './runtimeEvidenceAgent';

export function createSupabaseReaSource(sb: SupabaseClient): ReaDataSource {
  return {
    async findEvidenceByTrace(tenantId, traceId) {
      const { data, error } = await sb
        .from('ai_evidence_events')
        .select('id, event_type, created_at, chain_index, event_hash, evidence')
        .eq('tenant_id', tenantId)
        .eq('evidence->>request_id', traceId)
        .limit(2);
      return { data: (data ?? null) as ReaEvidenceRow[] | null, error: error ? { message: error.message } : null };
    },
    async verifyChain(tenantId, from, to) {
      const { data, error } = await sb.rpc('ai_evidence_verify_chain', {
        p_tenant_id: tenantId,
        p_from: from,
        p_to: to,
      });
      return { data: (data ?? null) as ReaChainRow[] | null, error: error ? { message: error.message } : null };
    },
  };
}
