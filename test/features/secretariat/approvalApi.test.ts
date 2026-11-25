import { describe, it, expect } from 'vitest';
import { approveSecretariatBot, fetchApprovalStatus } from '../../../src/features/secretariat/approvalApi';

function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    sb: { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return result; } },
  };
}

describe('approvalApi', () => {
  it('fetchApprovalStatus bildet die RPC-Zeile ab', async () => {
    const { sb, calls } = client({ data: [{ has_active_approval: true, valid: true, ever_approved: true, approved_at: 'a', approved_by: 'u' }], error: null });
    await expect(fetchApprovalStatus('b1', sb)).resolves.toEqual({ hasActiveApproval: true, valid: true, everApproved: true, approvedAt: 'a', approvedBy: 'u' });
    expect(calls).toEqual([{ fn: 'secretariat_bot_approval_status', args: { p_bot_id: 'b1' } }]);
  });

  it('fetchApprovalStatus: nur echtes true zählt; Fehler und leere Antwort werfen', async () => {
    const { sb } = client({ data: [{ has_active_approval: 'true', valid: 1, ever_approved: null, approved_at: null, approved_by: null }], error: null });
    await expect(fetchApprovalStatus('b1', sb)).resolves.toMatchObject({ hasActiveApproval: false, valid: false, everApproved: false });
    await expect(fetchApprovalStatus('b1', client({ data: null, error: { message: 'x' } }).sb)).rejects.toThrow(/Freigabestand/);
    await expect(fetchApprovalStatus('b1', client({ data: [], error: null }).sb)).rejects.toThrow(/keine Antwort/);
  });

  it('approveSecretariatBot übergibt nur Bot-ID, geprüften Stand und Aktivierungswunsch', async () => {
    const { sb, calls } = client({ data: [], error: null });
    await approveSecretariatBot({ botId: 'b1', expectedUpdatedAt: '2026-11-25T10:00:00.123456+00:00', activate: false }, sb);
    expect(calls).toEqual([{ fn: 'approve_secretariat_bot', args: { p_bot_id: 'b1', p_expected_updated_at: '2026-11-25T10:00:00.123456+00:00', p_activate: false } }]);
  });

  it('approveSecretariatBot übersetzt die Ablehnungen der Datenbank', async () => {
    const req = { botId: 'b1', expectedUpdatedAt: 'x', activate: false };
    await expect(approveSecretariatBot(req, client({ data: null, error: { message: 'bot changed since review, please review again' } }).sb)).rejects.toThrow(/erneut prüfen/);
    await expect(approveSecretariatBot(req, client({ data: null, error: { message: 'bot not found or not permitted' } }).sb)).rejects.toThrow(/Inhaber und Administratoren/);
    await expect(approveSecretariatBot(req, client({ data: null, error: { message: 'approval blocked' } }).sb)).rejects.toThrow(/Freigabe: approval blocked/);
  });
});
