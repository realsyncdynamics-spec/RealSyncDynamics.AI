import { getSupabase } from '../../lib/supabase';
import type { GovernanceRiskLevel } from './types';

export interface IngestWebhook {
  id: string;
  tenant_id: string;
  name: string;
  target_url: string;
  secret_prefix: string;
  min_risk_level: GovernanceRiskLevel;
  enabled: boolean;
  last_called_at: string | null;
  last_status: number | null;
  last_error: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateWebhookResult {
  ok: boolean;
  webhook?: IngestWebhook;
  /** Raw HMAC secret. Returned EXACTLY ONCE. */
  secret?: string;
  error?: { code: string; message: string };
}
export interface ListWebhooksResult {
  ok: boolean;
  webhooks?: IngestWebhook[];
  error?: { code: string; message: string };
}
export interface BareResult {
  ok: boolean;
  enabled?: boolean;
  already_revoked?: boolean;
  error?: { code: string; message: string };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-webhooks', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const createWebhook = (
  tenant_id: string,
  name: string,
  target_url: string,
  min_risk_level: GovernanceRiskLevel = 'high',
) => call<CreateWebhookResult>({ op: 'create', tenant_id, name, target_url, min_risk_level });

export const listWebhooks = (tenant_id: string) =>
  call<ListWebhooksResult>({ op: 'list', tenant_id });

export const toggleWebhook = (webhook_id: string, enabled: boolean) =>
  call<BareResult>({ op: 'toggle', webhook_id, enabled });

export const revokeWebhook = (webhook_id: string) =>
  call<BareResult>({ op: 'revoke', webhook_id });
