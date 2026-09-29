// governance-approvals — Freigeben/Ablehnen (Deno-frei, verhaltensgetestet).
//
// Befunde (Audit 2026-09-29), hier behoben:
//   - Race: Das Update filterte nur nach id; zwei gleichzeitige Entscheidungen
//     konnten sich überschreiben. Jetzt: Übergang nur aus 'pending' (bedingtes
//     Update, genau eine Zeile).
//   - expires_at wurde nie geprüft. Jetzt: abgelaufene offene Freigaben werden
//     auf 'expired' gesetzt und nicht mehr entschieden.
//   - Die Entscheidung wurde als ungekettete Evidence ohne Fehlerprüfung
//     geschrieben. Jetzt: gekettet (append_governance_evidence); scheitert der
//     Nachweis, wird die Entscheidung zurückgenommen (fail closed).
//   - Browser-Freigaben: Ablehnung gibt die wartende Browser-Session frei.

import { appendChainedEvidence, type EvidenceRepo } from '../_shared/browser-runtime/evidence.ts';

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

export interface ApprovalResolverRepo extends EvidenceRepo {
  getApproval(approvalId: string): Promise<ResolvableApproval | null>;
  roleOf(userId: string, tenantId: string): Promise<string | null>;
  markExpired(approvalId: string): Promise<void>;
  /** Übergang pending → target; true = genau diese Anfrage hat entschieden. */
  decide(approvalId: string, patch: Record<string, unknown>): Promise<boolean>;
  /** Kompensation, wenn der Nachweis nicht geschrieben werden konnte. */
  revertToPending(approvalId: string): Promise<void>;
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
  if (Date.parse(row.expires_at) <= input.now.getTime()) {
    await repo.markExpired(row.id);
    if (row.browser_session_id) await repo.releaseBrowserSession(row.tenant_id, row.browser_session_id, input.now.toISOString());
    return { ok: false, http: 409, code: 'APPROVAL_EXPIRED', message: 'approval is expired' };
  }

  const resolvedAt = input.now.toISOString();
  const decided = await repo.decide(row.id, {
    status: input.target,
    resolved_by: input.userId,
    resolved_at: resolvedAt,
    resolution_reason: input.reason,
  });
  if (!decided) return { ok: false, http: 409, code: 'ALREADY_RESOLVED', message: 'approval was resolved concurrently' };

  let evidenceId: string;
  try {
    const evidence = await appendChainedEvidence(repo, {
      id: input.evidenceId,
      tenantId: row.tenant_id,
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
    });
    evidenceId = evidence.id;
  } catch {
    await repo.revertToPending(row.id);
    return { ok: false, http: 503, code: 'EVIDENCE_WRITE_FAILED', message: 'decision could not be evidenced; not applied' };
  }

  if (input.target === 'rejected' && row.browser_session_id) {
    await repo.releaseBrowserSession(row.tenant_id, row.browser_session_id, resolvedAt);
  }
  return { ok: true, status: input.target, resolved_at: resolvedAt, evidence_id: evidenceId };
}
