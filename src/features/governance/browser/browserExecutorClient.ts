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

export async function executeBrowserActions(input: {
  tenantId: string;
  sessionId: string;
  actions: BrowserExecutorAction[];
  approvalId?: string;
}): Promise<BrowserExecutorResponse> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new BrowserExecutorError('Anmeldung erforderlich', 'UNAUTHORIZED', 401);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/browser-execute`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      session_id: input.sessionId,
      actions: input.actions,
      approval_id: input.approvalId,
    }),
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
  return data as BrowserExecutorResponse;
}
