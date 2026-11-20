/**
 * Supabase-Anbindung des REA. Nur lesend, nur mit Nutzer-Session:
 * RLS (`is_tenant_member`) und `ai_evidence_verify_chain` (SECURITY DEFINER
 * mit Mitgliedschaftsprüfung) setzen die Mandantengrenze serverseitig durch.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ReaAgentRunRow,
  ReaAgentRunSource,
  ReaChainRow,
  ReaDataSource,
  ReaEvidenceRow,
} from './runtimeEvidenceAgent';

export function createSupabaseReaSource(sb: SupabaseClient): ReaDataSource {
  return {
    async findEvidenceByTrace(tenantId, traceId) {
      const { data, error } = await sb
        .from('ai_evidence_events')
        .select('id, event_type, created_at, chain_index, event_hash, evidence')
        .eq('tenant_id', tenantId)
        // Seit MP-0 gibt es je Aufruf `ai:call_started` + Abschluss. Belegt
        // wird nur der Abschluss; ohne ihn bleibt der Status `ausstehend`.
        .eq('event_type', 'ai:call')
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

export function createSupabaseAgentRunSource(sb: SupabaseClient): ReaAgentRunSource {
  return {
    async findAgentRuns(tenantId, sessionId, sinceIso) {
      const { data, error } = await sb
        .from('agent_runs')
        .select('id, created_at, user_message, llm_provider, llm_model, input_tokens, output_tokens, outcome')
        .eq('tenant_id', tenantId)
        .eq('session_id', sessionId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(5);
      return { data: (data ?? null) as ReaAgentRunRow[] | null, error: error ? { message: error.message } : null };
    },
  };
}
