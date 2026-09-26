import { getSupabase } from '../../../lib/supabase';

export type BrowserExecutorAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'extract'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' };

export interface BrowserExecutorResponse {
  ok: true;
  session_id: string;
  risk: 'info' | 'low' | 'medium' | 'high';
  approval_id: string | null;
  result: unknown;
}

export interface BrowserExecutorHealth {
  ok: true;
  connected: true;
  capabilities: BrowserExecutorAction['type'][];
  executor?: unknown;
}

export class BrowserExecutorError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BrowserExecutorError';
  }
}

async function invokeBrowserExecutor(body: Record<string, unknown>): Promise<unknown> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new BrowserExecutorError('Anmeldung erforderlich', 'UNAUTHORIZED', 401);
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/browser-execute`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error ?? {};
    throw new BrowserExecutorError(
      error.message ?? 'Browser-Aktion fehlgeschlagen',
      error.code ?? 'EXECUTOR_FAILED',
      response.status,
      error.details,
    );
  }
  return data;
}

export async function getBrowserExecutorHealth(input: {
  tenantId: string;
}): Promise<BrowserExecutorHealth> {
  return invokeBrowserExecutor({
    op: 'health',
    tenant_id: input.tenantId,
  }) as Promise<BrowserExecutorHealth>;
}

export async function executeBrowserActions(input: {
  tenantId: string;
  sessionId: string;
  actions: BrowserExecutorAction[];
  approvalId?: string;
}): Promise<BrowserExecutorResponse> {
  return invokeBrowserExecutor({
    op: 'execute',
    tenant_id: input.tenantId,
    session_id: input.sessionId,
    actions: input.actions,
    approval_id: input.approvalId,
  }) as Promise<BrowserExecutorResponse>;
}
