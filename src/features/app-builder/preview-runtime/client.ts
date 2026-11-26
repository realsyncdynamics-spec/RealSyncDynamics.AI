/**
 * Browser-Client für `siteos/code-preview` (Spike Laufzeit-Vorschau, 22.11.2026).
 *
 * Ruft nie einen Sandbox-Anbieter direkt auf und hält keine Anbieter-Keys.
 * Der Mandant im Body ist nur ein Claim; die Edge Function prüft ihn gegen
 * die Membership. Nur gegen einen Fake getestet.
 */
import { getSupabase } from '../../../lib/supabase';
import { edgeFunctionUrl, fnFetchInit } from '../../../lib/fn-proxy';

export type SandboxSessionState = 'reserved' | 'running' | 'stopped' | 'failed';

export interface SandboxSessionView {
  sessionId: string;
  state: SandboxSessionState;
  previewUrl: string | null;
  hardDeadline: number;
  stopReason: string | null;
}

export type SandboxResult =
  | { kind: 'ok'; session: SandboxSessionView }
  | { kind: 'error'; status?: number; code?: string; message: string };

export interface SandboxPreviewClient {
  start(tenantId: string, projectId: string): Promise<SandboxResult>;
  heartbeat(tenantId: string, sessionId: string): Promise<SandboxResult>;
  /** Muss auch beim Schließen des Tabs ankommen → keepalive. */
  stop(tenantId: string, sessionId: string, reason: 'user' | 'closed'): Promise<SandboxResult>;
}

async function call(tenantId: string, body: Record<string, unknown>, keepalive = false): Promise<SandboxResult> {
  if (!tenantId) return { kind: 'error', status: 403, code: 'FORBIDDEN', message: 'no verified tenant' };
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: 'error', status: 401, code: 'UNAUTHORIZED', message: 'not signed in' };
  const url = edgeFunctionUrl('siteos/code-preview');
  let resp: Response;
  try {
    resp = await fetch(
      url,
      fnFetchInit(url, {
        method: 'POST',
        keepalive,
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, tenant_id: tenantId }),
      }),
    );
  } catch {
    return { kind: 'error', message: 'Vorschau-Dienst nicht erreichbar' };
  }
  let parsed: { ok?: boolean; session?: SandboxSessionView; error?: { code?: string; message?: string } } | null = null;
  try {
    parsed = await resp.json();
  } catch {
    return { kind: 'error', status: resp.status, message: 'Ungültige Server-Antwort' };
  }
  if (!resp.ok || !parsed?.ok || !parsed.session) {
    return {
      kind: 'error',
      status: resp.status,
      code: parsed?.error?.code,
      message: parsed?.error?.message ?? 'Laufzeit-Vorschau fehlgeschlagen',
    };
  }
  return { kind: 'ok', session: parsed.session };
}

export const sandboxPreviewClient: SandboxPreviewClient = {
  start: (tenantId, projectId) => call(tenantId, { op: 'start', project_id: projectId }),
  heartbeat: (tenantId, sessionId) => call(tenantId, { op: 'heartbeat', session_id: sessionId }),
  stop: (tenantId, sessionId, reason) => call(tenantId, { op: 'stop', session_id: sessionId, reason }, true),
};
