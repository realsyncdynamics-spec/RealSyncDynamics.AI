// workspace-execute und workspace-approvals — Eingabeprüfung und Bewertung
// einer Freigabe. Rein, ohne Deno-/jsr-Importe, aus Vitest testbar.

import { decideWorkspaceAction, WORKSPACE_AGENTS, type WorkspaceAgentId } from './workspaceEvents.ts';

export const WORKSPACE_EXECUTE_MAX_BODY_BYTES = 4_096;
export const WORKSPACE_EXECUTE_SCHEMA_VERSION = '1.0';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const ALLOWED_KEYS = new Set(['schema_version', 'approval_id', 'payload_hash', 'mode']);

export interface ExecuteRequest {
  approval_id: string;
  payload_hash: string;
  mode: 'dry_run' | 'execute';
}

export type ExecuteValidation =
  | { ok: true; request: ExecuteRequest }
  | { ok: false; status: 400 | 403; code: string; errors: string[] };

export function validateExecuteRequest(payload: unknown): ExecuteValidation {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, status: 400, code: 'VALIDATION', errors: ['payload must be an object'] };
  }
  const p = payload as Record<string, unknown>;
  if ('tenant_id' in p) {
    return {
      ok: false, status: 403, code: 'TENANT_FROM_BODY',
      errors: ['tenant_id is derived from the ingest key and must not be sent'],
    };
  }
  const errors: string[] = [];
  for (const k of Object.keys(p)) if (!ALLOWED_KEYS.has(k)) errors.push(`unknown field ${k}`);
  if (p.schema_version !== WORKSPACE_EXECUTE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${WORKSPACE_EXECUTE_SCHEMA_VERSION}`);
  }
  if (typeof p.approval_id !== 'string' || !UUID.test(p.approval_id)) errors.push('approval_id must be a uuid');
  if (typeof p.payload_hash !== 'string' || !SHA256.test(p.payload_hash)) errors.push('payload_hash must be sha256 hex');
  const mode = p.mode ?? 'dry_run';
  if (mode !== 'dry_run' && mode !== 'execute') errors.push("mode must be 'dry_run' or 'execute'");
  if (errors.length) return { ok: false, status: 400, code: 'VALIDATION', errors };
  return {
    ok: true,
    request: {
      approval_id: p.approval_id as string,
      payload_hash: p.payload_hash as string,
      mode: mode as 'dry_run' | 'execute',
    },
  };
}

export interface ApprovalRow {
  id: string;
  tenant_id: string;
  agent_id: string;
  action_type: string;
  target_resource: string;
  payload_hash: string;
  status: string;
  expires_at: string;
}

export type ApprovalReadiness =
  | { ready: true; agent_id: string; action_type: string; target_resource: string; expires_at: string }
  | { ready: false; status: 403 | 404 | 409; code: string; message: string };

/**
 * Wäre diese Freigabe jetzt einlösbar? Gleiche Bedingungen wie
 * `consume_workspace_approval` (Mandant, APPROVED, nicht abgelaufen, Hash),
 * zusätzlich die aktuelle Einstufung der Aktion: Wird eine Aktion nach der
 * Freigabe verboten, ist die alte Freigabe nicht mehr einlösbar.
 * Unbekannt und fremder Mandant sind nicht unterscheidbar (beide 404).
 */
export function evaluateApproval(
  row: ApprovalRow | null,
  tenantId: string,
  payloadHash: string,
  nowMs: number = Date.now(),
): ApprovalReadiness {
  if (!row || row.tenant_id !== tenantId) {
    return { ready: false, status: 404, code: 'APPROVAL_NOT_FOUND', message: 'approval not found' };
  }
  const expires = new Date(row.expires_at).getTime();
  if (row.status === 'EXPIRED' || (row.status === 'APPROVED' && (Number.isNaN(expires) || expires <= nowMs))) {
    return { ready: false, status: 409, code: 'APPROVAL_EXPIRED', message: 'approval has expired' };
  }
  if (row.status !== 'APPROVED') {
    return { ready: false, status: 409, code: 'APPROVAL_NOT_APPROVED', message: `approval is ${row.status}` };
  }
  if (row.payload_hash !== payloadHash) {
    return { ready: false, status: 409, code: 'PAYLOAD_MISMATCH', message: 'payload_hash does not match the approved payload' };
  }
  const knownAgent = (WORKSPACE_AGENTS as readonly string[]).includes(row.agent_id);
  if (!knownAgent || decideWorkspaceAction(row.agent_id as WorkspaceAgentId, row.action_type) !== 'require_approval') {
    return { ready: false, status: 403, code: 'ACTION_FORBIDDEN', message: `${row.action_type} is no longer approvable for ${row.agent_id}` };
  }
  return {
    ready: true,
    agent_id: row.agent_id,
    action_type: row.action_type,
    target_resource: row.target_resource,
    expires_at: row.expires_at,
  };
}

// ─── workspace-approvals ─────────────────────────────────────────────────────

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED'] as const;

export type ApprovalsRequest =
  | { op: 'list'; status: (typeof APPROVAL_STATUSES)[number]; tenant_id: string | null }
  | { op: 'approve' | 'reject'; approval_id: string };

export type ApprovalsValidation =
  | { ok: true; request: ApprovalsRequest }
  | { ok: false; errors: string[] };

export function validateApprovalsRequest(payload: unknown): ApprovalsValidation {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload must be an object'] };
  }
  const p = payload as Record<string, unknown>;
  if (p.op === 'list') {
    const status = p.status ?? 'PENDING';
    if (typeof status !== 'string' || !(APPROVAL_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, errors: [`status must be one of ${APPROVAL_STATUSES.join(', ')}`] };
    }
    // tenant_id ist hier nur ein Filter. Was der Aufrufer sehen darf, bestimmt RLS.
    if (p.tenant_id !== undefined && (typeof p.tenant_id !== 'string' || !UUID.test(p.tenant_id))) {
      return { ok: false, errors: ['tenant_id must be a uuid'] };
    }
    return {
      ok: true,
      request: { op: 'list', status: status as (typeof APPROVAL_STATUSES)[number], tenant_id: (p.tenant_id as string | undefined) ?? null },
    };
  }
  if (p.op === 'approve' || p.op === 'reject') {
    if (typeof p.approval_id !== 'string' || !UUID.test(p.approval_id)) {
      return { ok: false, errors: ['approval_id must be a uuid'] };
    }
    return { ok: true, request: { op: p.op, approval_id: p.approval_id } };
  }
  return { ok: false, errors: ["op must be 'list', 'approve' or 'reject'"] };
}

/** Fehlertext von `decide_workspace_approval` auf HTTP abbilden (fail closed). */
export function mapDecideRpcError(message: string | undefined): { status: 401 | 404 | 409 | 503; code: string } {
  if (message?.includes('workspace_unauthenticated')) return { status: 401, code: 'UNAUTHORIZED' };
  if (message?.includes('workspace_approval_not_found')) return { status: 404, code: 'APPROVAL_NOT_FOUND' };
  if (message?.includes('workspace_approval_not_pending')) return { status: 409, code: 'APPROVAL_NOT_PENDING' };
  return { status: 503, code: 'DECISION_FAILED' };
}
