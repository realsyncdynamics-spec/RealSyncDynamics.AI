/**
 * governance-approvals — Freigeben/Ablehnen (resolve.ts).
 * Race, Ablauf, fail-closed Evidence, Freigabe der Browser-Session.
 */
import { describe, expect, it } from 'vitest';
import { resolveApproval, type ApprovalResolverRepo, type ResolvableApproval } from '../../supabase/functions/governance-approvals/resolve';
import type { EvidenceRow } from '../../supabase/functions/_shared/browser-runtime/evidence';

const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-09-29T10:00:00.000Z');

function fakeRepo(approval: Partial<ResolvableApproval> = {}, opts: { role?: string | null; failEvidence?: boolean; decideWins?: boolean } = {}) {
  const row: ResolvableApproval & Record<string, unknown> = {
    id: 'ap1', tenant_id: T, event_id: 'ev1', asset_id: null, status: 'pending',
    expires_at: '2026-09-29T10:10:00.000Z', browser_session_id: null, requested_by: 'u-req',
    ...approval,
  };
  const evidence: EvidenceRow[] = [];
  const released: string[] = [];
  const repo: ApprovalResolverRepo = {
    async latestEvidenceHash() { return evidence.at(-1)?.content_hash ?? null; },
    async appendEvidence(r) {
      if (opts.failEvidence) throw new Error('append failed');
      evidence.push(r);
      return { id: r.id };
    },
    async getApproval(id) { return id === row.id ? { ...row } : null; },
    async roleOf() { return opts.role === undefined ? 'owner' : opts.role; },
    async markExpired() { row.status = 'expired'; },
    async decide(_id, patch) {
      if (opts.decideWins === false || row.status !== 'pending') return false;
      Object.assign(row, patch);
      return true;
    },
    async revertToPending() { row.status = 'pending'; row.resolved_by = null; },
    async releaseBrowserSession(_t, sessionId) { released.push(sessionId); },
  };
  return { repo, row, evidence, released };
}

const input = (patch: Record<string, unknown> = {}) => ({
  approvalId: 'ap1', userId: 'u-approver', userEmail: 'a@example.com', target: 'approved' as const,
  reason: null, now: NOW, evidenceId: 'evd1', ...patch,
});

describe('resolveApproval', () => {
  it('freigeben: Status + gekettete Evidence mit Anfragendem und Selbstfreigabe-Kennzeichen', async () => {
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
    expect(await resolveApproval(fakeRepo({}, { decideWins: false }).repo, input())).toMatchObject({ ok: false, code: 'ALREADY_RESOLVED' });
  });

  it('Nachweis nicht schreibbar: Entscheidung wird zurückgenommen (fail closed)', async () => {
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
