import { getSupabase } from '../../lib/supabase';
import type { ActionName, RunActionArgs } from './api';

export interface AdviseResult {
  ok: boolean;
  run_id?: string;
  advice?: string;
  evidence?: Record<string, unknown>;
  tokens?: { input: number; output: number; cached: number };
  cost_usd?: number;
  duration_ms?: number;
  error?: { code: string; message: string };
}

export async function adviseAction(
  tenantId: string,
  connectionId: string,
  action: ActionName,
  args: RunActionArgs,
): Promise<AdviseResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('kodee-advise', {
    body: { tenant_id: tenantId, connection_id: connectionId, action, args },
  });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as AdviseResult;
}
