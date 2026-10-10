import { beforeEach, describe, expect, it } from 'vitest';
import { saveFunnelContext, clearFunnelContext } from '../../src/core/onboarding/funnelContext';
import {
  PENDING_AUDIT_KEY,
  clearPendingAudit,
  readPendingAudit,
} from '../../src/core/onboarding/claimAudit';

beforeEach(() => {
  clearFunnelContext();
  clearPendingAudit();
  window.history.replaceState(null, '', '/');
});

describe('readPendingAudit', () => {
  it('liest rsd_pending_audit aus der Sitzung', () => {
    sessionStorage.setItem(PENDING_AUDIT_KEY, JSON.stringify({
      audit_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      domain: 'beispiel.de',
    }));
    const pending = readPendingAudit();
    expect(pending?.audit_id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(pending?.domain).toBe('beispiel.de');
  });

  it('fällt auf den Trichter-Kontext zurück, wenn der alte Schlüssel fehlt', () => {
    saveFunnelContext({ auditId: 'funnel-audit', domain: 'firma.de' });
    const pending = readPendingAudit();
    expect(pending?.audit_id).toBe('funnel-audit');
    expect(pending?.domain).toBe('firma.de');
  });

  it('bevorzugt rsd_pending_audit vor dem Trichter-Kontext', () => {
    saveFunnelContext({ auditId: 'funnel-audit', domain: 'firma.de' });
    sessionStorage.setItem(PENDING_AUDIT_KEY, JSON.stringify({ audit_id: 'pending-audit' }));
    expect(readPendingAudit()?.audit_id).toBe('pending-audit');
  });

  it('liest audit_id aus der URL, wenn kein Storage-Eintrag existiert', () => {
    window.history.replaceState(
      null,
      '',
      '/welcome?next=%2Fapp%2Factivation&audit_id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&domain=firma.de',
    );
    const pending = readPendingAudit();
    expect(pending?.audit_id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(pending?.domain).toBe('firma.de');
  });

  it('ignoriert eine URL-audit_id, die keine UUID ist', () => {
    window.history.replaceState(null, '', '/welcome?audit_id=kein-uuid');
    expect(readPendingAudit()).toBeNull();
  });

  it('bevorzugt den Trichter-Kontext vor der URL', () => {
    saveFunnelContext({ auditId: 'funnel-audit', domain: 'firma.de' });
    window.history.replaceState(null, '', '/welcome?audit_id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(readPendingAudit()?.audit_id).toBe('funnel-audit');
  });
});
