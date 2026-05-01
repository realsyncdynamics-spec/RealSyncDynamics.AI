// Client wrapper for the kodee-diagnose edge function.

import { getSupabase } from '../../lib/supabase';

export interface DiagnoseResult {
  ok: boolean;
  run_id?: string;
  diagnosis?: string;
  evidence?: Record<string, unknown>;
  tokens?: { input: number; output: number; cached: number };
  cost_usd?: number;
  duration_ms?: number;
  error?: { code: string; message: string; details?: unknown };
}

export async function runDiagnose(
  tenantId: string,
  connectionId: string,
  domain?: string,
): Promise<DiagnoseResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('kodee-diagnose', {
    body: { tenant_id: tenantId, connection_id: connectionId, domain },
  });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as DiagnoseResult;
}
