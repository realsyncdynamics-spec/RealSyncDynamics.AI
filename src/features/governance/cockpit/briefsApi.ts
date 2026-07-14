// Liest den jüngsten Hermes-Governance-Brief (hermes_daily_briefs) eines
// Tenants — RLS-gescopt (Member-Read-Policy vorhanden). Der Brief wird vom
// autonomen Hermes-Agenten (agent-os-runner, daily) via ai-gateway erzeugt.
import { getSupabase } from '../../../lib/supabase';

export interface DailyBriefRisk {
  title: string;
  severity?: string;
}

export interface DailyBrief {
  id: string;
  brief_date: string;
  narrative_de: string | null;
  top_3_risks: DailyBriefRisk[];
  recommended_actions_today: string[];
  generated_by: string | null;
  created_at: string;
}

export async function fetchLatestBrief(tenantId: string): Promise<DailyBrief | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('hermes_daily_briefs')
    .select('id,brief_date,narrative_de,top_3_risks,recommended_actions_today,generated_by,created_at')
    .eq('tenant_id', tenantId)
    .not('narrative_de', 'is', null)
    .order('brief_date', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data && data.length > 0 ? (data[0] as DailyBrief) : null);
}
