// governance-approvals — Freigeben/Ablehnen (Deno-frei, verhaltensgetestet).
//
// Befunde (Audit 2026-09-29), hier behoben:
//   - Race: Das Update filterte nur nach id; zwei gleichzeitige Entscheidungen
//     konnten sich überschreiben. Jetzt: Zeilensperre und Übergang nur aus
//     'pending' (decide_governance_approval).
//   - expires_at wurde nie geprüft. Jetzt: nach Datenbankuhr; abgelaufene
//     offene Freigaben werden 'expired' und nicht mehr entschieden.
//   - Die Entscheidung wurde als ungekettete Evidence ohne Fehlerprüfung und
//     NACH dem Status geschrieben. Jetzt: Status und gekettete Evidence in
//     EINER Transaktion — eine Freigabe ist nie 'approved' (und damit für
//     reserve_browser_execution reservierbar), solange ihr Nachweis fehlt.
//   - Browser-Freigaben: Ablehnung/Ablauf gibt die wartende Session frei.

import { isBrowserRuntimeError } from '../_shared/browser-runtime/errors.ts';
import { decideWithEvidence, type ApprovalDecisionRepo } from '../_shared/browser-runtime/approval-decision.ts';

export interface ResolvableApproval {
  id: string;
  tenant_id: string;
  event_id: string;
  asset_id: string | null;
  status: string;
  expires_at: string;
  browser_session_id: string | null;
  requested_by: string | null;
}

export interface ApprovalResolverRepo extends ApprovalDecisionRepo {
  getApproval(approvalId: string): Promise<ResolvableApproval | null>;
  roleOf(userId: string, tenantId: string): Promise<string | null>;
  releaseBrowserSession(tenantId: string, sessionId: string, nowIso: string): Promise<void>;
}

export interface ResolveInput {
  approvalId: string;
  userId: string;
  userEmail: string | null;
  target: 'approved' | 'rejected';
  reason: string | null;
  now: Date;
  evidenceId: string;
}

export type ResolveOutcome =
  | { ok: true; status: 'approved' | 'rejected'; resolved_at: string; evidence_id: string }
  | { ok: false; http: number; code: string; message: string };

const APPROVER_ROLES = new Set(['owner', 'admin']);

export async function resolveApproval(repo: ApprovalResolverRepo, input: ResolveInput): Promise<ResolveOutcome> {
  if (input.target === 'rejected' && !input.reason) {
    return { ok: false, http: 400, code: 'BAD_REQUEST', message: 'reason required when rejecting' };
  }
  const row = await repo.getApproval(input.approvalId);
  if (!row) return { ok: false, http: 404, code: 'NOT_FOUND', message: 'approval not found' };

  const role = await repo.roleOf(input.userId, row.tenant_id);
  if (!role || !APPROVER_ROLES.has(role)) {
    return { ok: false, http: 403, code: 'FORBIDDEN', message: 'must be owner or admin' };
  }
  if (row.status !== 'pending') {
    return { ok: false, http: 409, code: 'ALREADY_RESOLVED', message: `approval is ${row.status}` };
  }

  const resolvedAt = input.now.toISOString();
  let decision;
  try {
    decision = await decideWithEvidence(repo, {
      approvalId: row.id,
      tenantId: row.tenant_id,
      decidedBy: input.userId,
      target: input.target,
      reason: input.reason,
      decidedAt: resolvedAt,
      evidence: {
        id: input.evidenceId,
        eventId: row.event_id,
        evidenceType: 'approval',
        title: input.target === 'approved' ? 'Approval granted' : 'Approval denied',
        source: 'governance-approvals',
        snapshot: {
          kind: 'approval.decision',
          approval_id: row.id,
          decision: input.target,
          resolved_by_user_id: input.userId,
          resolved_by_email: input.userEmail,
          resolved_at: resolvedAt,
          reason: input.reason,
          requested_by: row.requested_by,
          self_approved: row.requested_by !== null && row.requested_by === input.userId,
          browser_session_id: row.browser_session_id,
        },
      },
    });
  } catch (error) {
    if (isBrowserRuntimeError(error)) {
      return { ok: false, http: 503, code: 'EVIDENCE_WRITE_FAILED', message: 'decision could not be evidenced; not applied' };
    }
    throw error;
  }

  switch (decision.outcome) {
    case 'not_found':
      return { ok: false, http: 404, code: 'NOT_FOUND', message: 'approval not found' };
    case 'already_resolved':
      return { ok: false, http: 409, code: 'ALREADY_RESOLVED', message: `approval is ${decision.approval_status ?? 'resolved'}` };
    case 'expired':
      if (row.browser_session_id) await repo.releaseBrowserSession(row.tenant_id, row.browser_session_id, resolvedAt);
      return { ok: false, http: 409, code: 'APPROVAL_EXPIRED', message: 'approval is expired' };
    case 'decided':
      break;
  }

  if (input.target === 'rejected' && row.browser_session_id) {
    await repo.releaseBrowserSession(row.tenant_id, row.browser_session_id, resolvedAt);
  }
  return { ok: true, status: input.target, resolved_at: resolvedAt, evidence_id: decision.evidence_id ?? input.evidenceId };
}
