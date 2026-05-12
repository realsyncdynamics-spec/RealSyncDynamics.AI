import { getSupabase } from '../../lib/supabase';

export type IngestKeySource =
  | 'website_scanner'
  | 'browser_extension'
  | 'sdk'
  | 'api'
  | 'github'
  | 'ci_cd'
  | 'manual'
  | 'agent_runtime';

export interface IngestKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  allowed_sources: IngestKeySource[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateKeyResult {
  ok: boolean;
  key?: IngestKey;
  /** Raw `rsd_gov_…` token. Returned EXACTLY ONCE — server never reveals it again. */
  token?: string;
  error?: { code: string; message: string };
}
export interface ListKeysResult {
  ok: boolean;
  keys?: IngestKey[];
  error?: { code: string; message: string };
}
export interface RevokeResult {
  ok: boolean;
  already_revoked?: boolean;
  error?: { code: string; message: string };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-keys', { body });
  if (error) {
    return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  }
  return data as T;
}

export const createIngestKey = (
  tenant_id: string,
  name: string,
  allowed_sources: IngestKeySource[] = [],
  rate_limit_per_minute = 60,
) => call<CreateKeyResult>({ op: 'create', tenant_id, name, allowed_sources, rate_limit_per_minute });

export const listIngestKeys = (tenant_id: string) =>
  call<ListKeysResult>({ op: 'list', tenant_id });

export const revokeIngestKey = (key_id: string) =>
  call<RevokeResult>({ op: 'revoke', key_id });
