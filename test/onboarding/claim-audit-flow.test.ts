/**
 * Übernahme im Browser: Mandantenauswahl nur auf Verlangen der RPC,
 * nachvollziehbare Fehler, Notiz nur bei endgültigen Ausgängen entfernen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const A1 = '33333333-3333-4333-8333-333333333333';
const T1 = '11111111-1111-4111-8111-111111111111';

type RpcAnswer = { data: unknown; error: { message: string; code?: string } | null };
const rpc = vi.fn<(name: string, args: Record<string, string>) => Promise<RpcAnswer>>();
const insert = vi.fn(async () => ({ error: null }));

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc,
    from: () => ({ insert }),
  }),
  isSupabaseConfigured: () => true,
}));

import {
  AuditClaimError,
  PENDING_AUDIT_ID_KEY,
  PENDING_AUDIT_KEY,
  claimPendingAudit,
} from '../../src/core/onboarding/claimAudit';
import { claimPendingAuditWithStatus } from '../../src/features/audit/pendingAudit';
import { clearFunnelContext } from '../../src/core/onboarding/funnelContext';

const ok = (over: Record<string, unknown> = {}): RpcAnswer => ({
  data: { ok: true, already_claimed: false, audit_id: A1, tenant_id: T1, domain: 'firma.de', ...over },
  error: null,
});
const fail = (message: string, code?: string): RpcAnswer => ({ data: null, error: { message, code } });

beforeEach(() => {
  rpc.mockReset();
  insert.mockClear();
  sessionStorage.clear();
  localStorage.clear();
  clearFunnelContext();
  localStorage.setItem(PENDING_AUDIT_ID_KEY, A1);
});

describe('claimPendingAudit', () => {
  it('übernimmt ohne Mandantenauswahl, wenn die RPC keine verlangt', async () => {
    rpc.mockResolvedValueOnce(ok());
    const r = await claimPendingAudit(T1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('claim_gdpr_audit', { p_audit_id: A1 });
    expect(r).toMatchObject({ ok: true, audit_id: A1, tenant_id: T1, domain: 'firma.de' });
    expect(localStorage.getItem(PENDING_AUDIT_ID_KEY)).toBeNull();
  });

  it('wählt den aktiven Arbeitsbereich nur, wenn die RPC eine Auswahl verlangt', async () => {
    rpc.mockResolvedValueOnce(fail('explicit tenant selection required')).mockResolvedValueOnce(ok());
    await claimPendingAudit(T1);
    expect(rpc).toHaveBeenNthCalledWith(2, 'claim_gdpr_audit', { p_audit_id: A1, p_tenant_id: T1 });
  });

  it('rät keinen Arbeitsbereich: ohne Auswahl bleibt es beim Fehler und die Notiz liegen', async () => {
    rpc.mockResolvedValueOnce(fail('explicit tenant selection required'));
    const err = await claimPendingAudit(null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuditClaimError);
    expect((err as AuditClaimError).code).toBe('TENANT_SELECTION_REQUIRED');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_AUDIT_ID_KEY)).toBe(A1);
  });

  it('entfernt die Notiz bei endgültigen Ausgängen', async () => {
    rpc.mockResolvedValueOnce(fail('audit ownership not verified'));
    const err = await claimPendingAudit().catch((e: unknown) => e);
    expect((err as AuditClaimError).code).toBe('OWNERSHIP_NOT_VERIFIED');
    expect((err as AuditClaimError).retryable).toBe(false);
    expect(localStorage.getItem(PENDING_AUDIT_ID_KEY)).toBeNull();
  });

  it('behält die Notiz, bis die E-Mail bestätigt ist', async () => {
    rpc.mockResolvedValueOnce(fail('verified account email required'));
    await claimPendingAudit().catch(() => null);
    expect(localStorage.getItem(PENDING_AUDIT_ID_KEY)).toBe(A1);
  });

  it('meldet keinen Erfolg bei einer unvollständigen Antwort', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const err = await claimPendingAudit().catch((e: unknown) => e);
    expect((err as AuditClaimError).code).toBe('INTERNAL');
    expect(localStorage.getItem(PENDING_AUDIT_ID_KEY)).toBe(A1);
  });

  it('hält die Einwilligung erst nach der ersten erfolgreichen Übernahme fest', async () => {
    localStorage.clear();
    sessionStorage.setItem(PENDING_AUDIT_KEY, JSON.stringify({ audit_id: A1, analytics_consent: true }));
    rpc.mockResolvedValueOnce(fail('email mismatch'));
    await claimPendingAudit().catch(() => null);
    expect(insert).not.toHaveBeenCalled();

    sessionStorage.setItem(PENDING_AUDIT_KEY, JSON.stringify({ audit_id: A1, analytics_consent: true }));
    rpc.mockResolvedValueOnce(ok());
    await claimPendingAudit();
    expect(insert).toHaveBeenCalledTimes(1);

    sessionStorage.setItem(PENDING_AUDIT_KEY, JSON.stringify({ audit_id: A1, analytics_consent: true }));
    rpc.mockResolvedValueOnce(ok({ already_claimed: true }));
    await claimPendingAudit();
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('ruft ohne gemerkte Kennung nichts auf', async () => {
    localStorage.clear();
    expect(await claimPendingAudit()).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('claimPendingAuditWithStatus', () => {
  it('gibt den Ausgang für die Oberfläche zurück, statt zu werfen', async () => {
    rpc.mockResolvedValueOnce(fail('already claimed'));
    const r = await claimPendingAuditWithStatus(T1);
    expect(r).toMatchObject({ status: 'failed', code: 'ALREADY_CLAIMED', retryable: false });
    if (r.status === 'failed') expect(r.message).toMatch(/anderen Arbeitsbereich/);
  });

  it('meldet Erfolg mit Domain', async () => {
    rpc.mockResolvedValueOnce(ok());
    const r = await claimPendingAuditWithStatus(T1);
    expect(r).toMatchObject({ status: 'claimed', result: { audit_id: A1, domain: 'firma.de' } });
  });

  it('nichts gemerkt → nichts anzuzeigen', async () => {
    localStorage.clear();
    expect(await claimPendingAuditWithStatus(T1)).toEqual({ status: 'none' });
  });
});
