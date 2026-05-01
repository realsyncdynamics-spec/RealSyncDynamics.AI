// Client SDK for the ai-invoke edge function.
//
// Reads the public ai_tools registry directly under RLS, hides tools the
// active tenant isn't entitled to, and wraps invocations with typed errors.

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../access/TenantProvider';

export type ProviderId = 'anthropic' | 'google' | 'openai';

export interface AiTool {
  id: string;
  key: string;
  name: string;
  description: string | null;
  model_provider: ProviderId;
  model_id: string;
  enabled: boolean;
  required_entitlement_key: string | null;
}

export interface AiInvokeResult {
  ok: boolean;
  run_id?: string;
  output?: string;
  tokens?: { input: number; output: number; cached: number };
  cost_usd?: number;
  duration_ms?: number;
  warning?: boolean;
  error?: { code: string; message: string; details?: unknown };
}

/** Returns all enabled tools — RLS already filters per-tenant entitlements? No,
 *  ai_tools is global. The hook below filters by entitlement client-side. */
export async function listAiTools(): Promise<AiTool[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_tools')
    .select('id,key,name,description,model_provider,model_id,enabled,required_entitlement_key')
    .eq('enabled', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiTool[];
}

export async function invokeAiTool(
  tenantId: string,
  toolKey: string,
  input: string,
  metadata: Record<string, unknown> = {},
): Promise<AiInvokeResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('ai-invoke', {
    body: { tenant_id: tenantId, tool_key: toolKey, input, metadata },
  });
  if (error) {
    return { ok: false, error: { code: 'NETWORK', message: error.message } };
  }
  return data as AiInvokeResult;
}

/**
 * Hook: list of tools the active tenant is allowed to call, plus a runner
 * that invokes a tool against the active tenant.
 */
export function useAiTools(): {
  loading: boolean;
  tools: AiTool[];
  run: (toolKey: string, input: string, metadata?: Record<string, unknown>) => Promise<AiInvokeResult>;
} {
  const { activeTenantId, hasFeature } = useTenant();
  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAiTools()
      .then((all) => {
        if (cancelled) return;
        const filtered = all.filter((t) => {
          const key = t.required_entitlement_key ?? `ai.tool.${t.key}`;
          return hasFeature(key);
        });
        setTools(filtered);
      })
      .catch(() => { /* keep tools empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // hasFeature is derived from entitlements; re-run when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, hasFeature]);

  const run = useCallback(
    (toolKey: string, input: string, metadata?: Record<string, unknown>) => {
      if (!activeTenantId) {
        return Promise.resolve<AiInvokeResult>({
          ok: false, error: { code: 'NO_TENANT', message: 'no active tenant' },
        });
      }
      return invokeAiTool(activeTenantId, toolKey, input, metadata);
    },
    [activeTenantId],
  );

  return { loading, tools, run };
}
