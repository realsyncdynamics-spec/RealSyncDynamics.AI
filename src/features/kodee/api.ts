// Client SDK for the Kodee server-actions edge function.
// Mirrors the contract in supabase/functions/kodee/types.ts.

import { getSupabase } from '../../lib/supabase';

export type ActionName =
  | 'vps.status'
  | 'vps.logs.tail'
  | 'vps.disk'
  | 'vps.dns_check'
  | 'vps.tls_check'
  // v2 — write actions, require confirmation token from caller
  | 'vps.service.restart'
  | 'vps.compose.up'
  | 'vps.compose.restart';

export interface RunActionArgs {
  // status
  units?: string[];
  // logs.tail
  unit?: string;
  container?: string;
  lines?: number;
  grep?: string;
  // disk
  top_dirs?: number;
  // dns
  domain?: string;
  types?: ('A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT')[];
  // tls
  port?: number;
  // write actions
  service?: string;
  compose_dir?: string;
  confirm?: string;
}

export interface RunActionResult<T = unknown> {
  ok: boolean;
  action: ActionName;
  data?: T;
  error?: { code: string; message: string };
  duration_ms: number;
}

export async function runAction<T = unknown>(
  connectionId: string,
  action: ActionName,
  args?: RunActionArgs,
): Promise<RunActionResult<T>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('kodee', {
    body: { v: 1, connection_id: connectionId, action, args },
  });
  if (error) {
    return {
      ok: false, action,
      error: { code: 'NETWORK', message: error.message },
      duration_ms: 0,
    };
  }
  return data as RunActionResult<T>;
}
