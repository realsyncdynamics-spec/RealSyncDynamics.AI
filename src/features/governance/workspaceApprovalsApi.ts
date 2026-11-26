/**
 * Client für die Edge Function `workspace-approvals` (Workspace-Freigaben aus
 * `workspace_approvals`, Agenten RSD-01 … RSD-06).
 *
 * Die Funktion arbeitet nur mit dem JWT des Aufrufers. Sichtbarkeit regelt RLS
 * (Mitglieder), entscheiden dürfen nur Owner/Admin (`decide_workspace_approval`
 * prüft `is_tenant_admin` in der Datenbank). `tenant_id` ist bei `list` nur ein
 * Filter. Eine Entscheidung führt nichts aus, sie macht die Freigabe nur
 * einlösbar.
 *
 * Fehler bleiben unterscheidbar: `unavailable` (Funktion nicht deployt, 404 ohne
 * Fehlercode der Funktion) ist kein leerer Mandant und kein Rechtefehler.
 */
import { getSupabase } from '../../lib/supabase';

export const WORKSPACE_APPROVAL_STATUSES = [
  'PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED',
] as const;
export type WorkspaceApprovalStatus = (typeof WORKSPACE_APPROVAL_STATUSES)[number];

export interface WorkspaceApproval {
  id: string;
  tenant_id: string;
  agent_id: string;
  action_type: string;
  target_resource: string;
  payload_hash: string;
  status: WorkspaceApprovalStatus;
  requested_at: string;
  expires_at: string;
  decided_by: string | null;
  decided_at: string | null;
  execution_id: string | null;
  executed_at: string | null;
}

export type WorkspaceApiError =
  | { kind: 'unavailable' }
  | { kind: 'error'; code: string; message: string };

export type ListWorkspaceApprovalsResult =
  | { ok: true; approvals: WorkspaceApproval[] }
  | { ok: false; error: WorkspaceApiError };

export type DecideWorkspaceApprovalResult =
  | { ok: true; status: 'APPROVED' | 'REJECTED' }
  | { ok: false; error: WorkspaceApiError };

/** Deutsche Meldungen zu den Codes der Edge Function. */
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sitzung abgelaufen. Bitte neu anmelden.',
  APPROVAL_NOT_FOUND: 'Freigabe nicht gefunden oder keine Berechtigung. Entscheiden dürfen nur Owner und Admins.',
  APPROVAL_NOT_PENDING: 'Diese Freigabe ist nicht mehr offen.',
  APPROVAL_EXPIRED: 'Die Frist dieser Freigabe ist abgelaufen.',
  LIST_FAILED: 'Freigaben konnten nicht geladen werden.',
  DECISION_FAILED: 'Die Entscheidung konnte nicht gespeichert werden.',
  NOT_CONFIGURED: 'Workspace-Freigaben sind auf dem Server nicht konfiguriert.',
  VALIDATION: 'Ungültige Anfrage.',
};

export function workspaceErrorMessage(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] ?? fallback;
}

interface InvokeError {
  message?: string;
  context?: { status?: number; json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } };
}

type Invoke = (body: Record<string, unknown>) => Promise<{ data: unknown; error: InvokeError | null }>;

const defaultInvoke: Invoke = (body) =>
  getSupabase().functions.invoke('workspace-approvals', { body }) as Promise<{ data: unknown; error: InvokeError | null }>;

/** Liest `{ error: { code } }` bzw. `{ code }` aus der Fehlerantwort, falls vorhanden. */
async function readErrorCode(error: InvokeError): Promise<string | null> {
  try {
    const ctx = error.context;
    const reader = ctx?.clone ? ctx.clone() : ctx;
    if (!reader?.json) return null;
    const body = (await reader.json()) as { code?: unknown; error?: { code?: unknown } | unknown };
    const nested = body?.error && typeof body.error === 'object' ? (body.error as { code?: unknown }).code : undefined;
    const code = nested ?? body?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

async function toApiError(error: InvokeError): Promise<WorkspaceApiError> {
  const code = await readErrorCode(error);
  if (!code && error.context?.status === 404) return { kind: 'unavailable' };
  const finalCode = code ?? 'NETWORK';
  return {
    kind: 'error',
    code: finalCode,
    message: workspaceErrorMessage(finalCode, error.message || 'Anfrage fehlgeschlagen'),
  };
}

export async function listWorkspaceApprovals(
  tenantId: string,
  status: WorkspaceApprovalStatus = 'PENDING',
  invoke: Invoke = defaultInvoke,
): Promise<ListWorkspaceApprovalsResult> {
  try {
    const { data, error } = await invoke({ op: 'list', tenant_id: tenantId, status });
    if (error) return { ok: false, error: await toApiError(error) };
    const approvals = (data as { approvals?: unknown })?.approvals;
    if (!Array.isArray(approvals)) {
      return { ok: false, error: { kind: 'error', code: 'BAD_RESPONSE', message: 'Unerwartete Antwort des Servers.' } };
    }
    // Defensiv: nur Zeilen des aktiven Mandanten anzeigen (RLS lässt Mitglieder
    // mehrerer Mandanten mehr sehen; tenant_id ist serverseitig nur ein Filter).
    return { ok: true, approvals: (approvals as WorkspaceApproval[]).filter((a) => a.tenant_id === tenantId) };
  } catch (err) {
    return { ok: false, error: { kind: 'error', code: 'NETWORK', message: (err as Error)?.message ?? 'Netzwerkfehler' } };
  }
}

export async function decideWorkspaceApproval(
  approvalId: string,
  approve: boolean,
  invoke: Invoke = defaultInvoke,
): Promise<DecideWorkspaceApprovalResult> {
  try {
    const { data, error } = await invoke({ op: approve ? 'approve' : 'reject', approval_id: approvalId });
    if (error) return { ok: false, error: await toApiError(error) };
    const status = (data as { status?: unknown })?.status;
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return { ok: false, error: { kind: 'error', code: 'BAD_RESPONSE', message: 'Unerwartete Antwort des Servers.' } };
    }
    return { ok: true, status };
  } catch (err) {
    return { ok: false, error: { kind: 'error', code: 'NETWORK', message: (err as Error)?.message ?? 'Netzwerkfehler' } };
  }
}

/** Offen, aber Frist erreicht — der Server zählt das als abgelaufen. */
export function isWorkspaceApprovalExpired(approval: Pick<WorkspaceApproval, 'expires_at'>, now: number = Date.now()): boolean {
  const t = new Date(approval.expires_at).getTime();
  return Number.isFinite(t) && t <= now;
}
