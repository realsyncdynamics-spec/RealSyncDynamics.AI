/**
 * governance-approvals — Freigeben/Ablehnen (resolve.ts).
 * Entscheidung und gekettete Evidence atomar (decide_governance_approval):
 * Race, Ablauf nach Datenbankuhr, Kettenkopf-Konflikt, fail closed,
 * Freigabe der Browser-Session. Die echte SQL-Semantik prüft
 * test/runtime/db/browser-runtime-sessions.db.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { resolveApproval, type ApprovalResolverRepo, type ResolvableApproval } from '../../supabase/functions/governance-approvals/resolve';
import type { EvidenceRow } from '../../supabase/functions/_shared/browser-runtime/evidence';

const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-09-29T10:00:00.000Z');

function fakeRepo(
  approval: Partial<ResolvableApproval> = {},
  opts: { role?: string | null; failEvidence?: boolean; concurrentDecision?: boolean; headMovesTimes?: number } = {},
) {
  const row: ResolvableApproval & Record<string, unknown> = {
    id: 'ap1', tenant_id: T, event_id: 'ev1', asset_id: null, status: 'pending',
    expires_at: '2026-09-29T10:10:00.000Z', browser_session_id: null, requested_by: 'u-req',
    ...approval,
  };
  const evidence: EvidenceRow[] = [];
  const released: string[] = [];
  let headMoves = opts.headMovesTimes ?? 0;
  const repo: ApprovalResolverRepo = {
    async latestEvidenceHash() { return evidence.at(-1)?.content_hash ?? null; },
    async decideApproval(i) {
      if (opts.failEvidence) throw new Error('decide_governance_approval: 42501');
      if (i.approvalId !== row.id || i.tenantId !== row.tenant_id) return { outcome: 'not_found', evidence_id: null, approval_status: null };
      if (opts.concurrentDecision) row.status = 'rejected';
      if (row.status !== 'pending') return { outcome: 'already_resolved', evidence_id: null, approval_status: String(row.status) };
      if (Date.parse(row.expires_at) <= NOW.getTime()) {
        row.status = 'expired';
        return { outcome: 'expired', evidence_id: null, approval_status: 'expired' };
      }
      if (headMoves > 0) {
        headMoves -= 1;
        return 'conflict'; // Transaktion zurückgerollt: kein Status, keine Evidence
      }
      if (i.evidenceRow.previous_hash !== i.expectedPreviousHash) throw new Error('22023');
      row.status = i.target;
      row.resolved_by = i.decidedBy;
      row.resolution_reason = i.reason;
      evidence.push(i.evidenceRow);
      return { outcome: 'decided', evidence_id: i.evidenceRow.id, approval_status: i.target };
    },
    async getApproval(id) { return id === row.id ? { ...row } : null; },
    async roleOf() { return opts.role === undefined ? 'owner' : opts.role; },
    async releaseBrowserSession(_t, sessionId) { released.push(sessionId); },
  };
  return { repo, row, evidence, released };
}

const input = (patch: Record<string, unknown> = {}) => ({
  approvalId: 'ap1', userId: 'u-approver', userEmail: 'a@example.com', target: 'approved' as const,
  reason: null, now: NOW, evidenceId: 'evd1', ...patch,
});

describe('resolveApproval', () => {
  it('freigeben: Status + gekettete Evidence in einem Schritt, mit Anfragendem und Selbstfreigabe-Kennzeichen', async () => {
    const { repo, row, evidence } = fakeRepo();
    const out = await resolveApproval(repo, input());
    expect(out).toMatchObject({ ok: true, status: 'approved', evidence_id: 'evd1' });
    expect(row.status).toBe('approved');
    const snap = evidence[0].metadata.snapshot as Record<string, unknown>;
    expect(snap).toMatchObject({ kind: 'approval.decision', decision: 'approved', requested_by: 'u-req', self_approved: false, previous_hash: null });
    expect(evidence[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('Selbstfreigabe wird im Nachweis sichtbar', async () => {
    const { repo, evidence } = fakeRepo({ requested_by: 'u-approver' });
    await resolveApproval(repo, input());
    expect((evidence[0].metadata.snapshot as Record<string, unknown>).self_approved).toBe(true);
  });

  it('nur owner/admin; Rolle wird vor dem Status geprüft', async () => {
    expect(await resolveApproval(fakeRepo({}, { role: 'editor' }).repo, input())).toMatchObject({ ok: false, http: 403 });
    expect(await resolveApproval(fakeRepo({ status: 'approved' }, { role: null }).repo, input())).toMatchObject({ ok: false, http: 403 });
  });

  it('abgelaufen: nicht entscheidbar, Status expired, Browser-Session frei', async () => {
    const { repo, row, released } = fakeRepo({ expires_at: '2026-09-29T09:59:59.000Z', browser_session_id: 'bs1' });
    expect(await resolveApproval(repo, input())).toMatchObject({ ok: false, code: 'APPROVAL_EXPIRED' });
    expect(row.status).toBe('expired');
    expect(released).toEqual(['bs1']);
  });

  it('gleichzeitige Entscheidung: nur eine gewinnt', async () => {
    expect(await resolveApproval(fakeRepo({}, { concurrentDecision: true }).repo, input())).toMatchObject({ ok: false, code: 'ALREADY_RESOLVED' });
  });

  it('Kettenkopf bewegt sich: neu lesen, neu hashen, erneut — danach genau ein Nachweis', async () => {
    const { repo, row, evidence } = fakeRepo({}, { headMovesTimes: 2 });
    expect(await resolveApproval(repo, input())).toMatchObject({ ok: true, status: 'approved' });
    expect(row.status).toBe('approved');
    expect(evidence).toHaveLength(1);
  });

  it('Kettenkopf bewegt sich dauerhaft: nicht entschieden (fail closed)', async () => {
    const { repo, row, evidence } = fakeRepo({}, { headMovesTimes: 99 });
    expect(await resolveApproval(repo, input())).toMatchObject({ ok: false, http: 503, code: 'EVIDENCE_WRITE_FAILED' });
    expect(row.status).toBe('pending');
    expect(evidence).toHaveLength(0);
  });

  it('Nachweis nicht schreibbar: keine Entscheidung (fail closed)', async () => {
    const { repo, row } = fakeRepo({}, { failEvidence: true });
    expect(await resolveApproval(repo, input())).toMatchObject({ ok: false, http: 503, code: 'EVIDENCE_WRITE_FAILED' });
    expect(row.status).toBe('pending');
  });

  it('ablehnen braucht eine Begründung und gibt die Browser-Session frei', async () => {
    expect(await resolveApproval(fakeRepo().repo, input({ target: 'rejected' }))).toMatchObject({ ok: false, http: 400 });
    const { repo, row, released } = fakeRepo({ browser_session_id: 'bs2' });
    const out = await resolveApproval(repo, input({ target: 'rejected', reason: 'Falsches Formular' }));
    expect(out).toMatchObject({ ok: true, status: 'rejected' });
    expect(row.resolution_reason).toBe('Falsches Formular');
    expect(released).toEqual(['bs2']);
  });

  it('bereits entschieden: 409', async () => {
    expect(await resolveApproval(fakeRepo({ status: 'rejected' }).repo, input())).toMatchObject({ ok: false, http: 409, code: 'ALREADY_RESOLVED' });
  });
});
