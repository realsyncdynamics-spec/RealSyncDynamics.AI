// Liest die Beobachtungen der autonomen Runtime (agent_observations) — das
// Substrat, in das z. B. der Deadline-Sentinel (cron via agent-os-runner)
// schreibt. RLS-gescopt: Tenant-Mitglieder lesen ihre eigenen Zeilen.
import { getSupabase } from '../../../lib/supabase';

export interface AgentObservationRow {
  id: string;
  agent: string;
  category: string;
  severity: string;
  title: string;
  detail: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchRecentObservations(tenantId: string, limit = 20): Promise<AgentObservationRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('agent_observations')
    .select('id,agent,category,severity,title,detail,data,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentObservationRow[];
}
