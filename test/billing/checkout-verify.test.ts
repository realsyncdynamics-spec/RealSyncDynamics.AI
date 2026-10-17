import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isRetriableVerifyError,
  parseVerifyResponse,
  resolveVerifiedPlan,
  tenantCandidates,
  verifyErrorMessage,
} from '../../src/features/billing/checkoutVerify';

const SUCCESS = readFileSync(resolve('src/pages/CheckoutSuccess.tsx'), 'utf8');
const APP = readFileSync(resolve('src/App.tsx'), 'utf8');

describe('parseVerifyResponse', () => {
  it('liest eine verifizierte Antwort mit Abo-Zeile', () => {
    const out = parseVerifyResponse(true, {
      ok: true,
      pending: false,
      subscription: { id: 'row-1', plan_key: 'growth' },
    });
    expect(out).toEqual({ ok: true, pending: false, subscription: { id: 'row-1', plan_key: 'growth' } });
  });

  it('liest „Sync ausstehend“ als pending', () => {
    const out = parseVerifyResponse(true, { ok: true, pending: true, subscription: { id: 'sub_1' } });
    expect(out.ok && out.pending).toBe(true);
  });

  it('übernimmt den Code aus jsonError und ersetzt die Server-Meldung durch deutschen Text', () => {
    const out = parseVerifyResponse(false, {
      ok: false,
      error: { code: 'PAYMENT_INCOMPLETE', message: 'checkout payment_status=unpaid' },
    });
    expect(out).toEqual({ ok: false, code: 'PAYMENT_INCOMPLETE', message: verifyErrorMessage('PAYMENT_INCOMPLETE') });
    expect(out.ok === false && out.message).not.toContain('payment_status');
  });

  it('ok:true mit HTTP-Fehler gilt nicht als verifiziert', () => {
    expect(parseVerifyResponse(false, { ok: true, pending: false }).ok).toBe(false);
  });

  it('leere oder fremde Antwort (z. B. HTML vom Gateway) wird UNKNOWN', () => {
    const out = parseVerifyResponse(false, {});
    expect(out).toMatchObject({ ok: false, code: 'UNKNOWN' });
  });
});

describe('isRetriableVerifyError', () => {
  it('Zahlung in Bearbeitung, Stripe-, Netz- und Zeitfehler lassen „Erneut prüfen“ zu', () => {
    for (const code of ['PAYMENT_INCOMPLETE', 'SESSION_INCOMPLETE', 'STRIPE_ERROR', 'TIMEOUT', 'NETWORK', 'UNKNOWN']) {
      expect(isRetriableVerifyError(code)).toBe(true);
    }
  });

  it('falscher Workspace, fehlende Mitgliedschaft und Checkout ohne Abo sind endgültig', () => {
    for (const code of ['TENANT_MISMATCH', 'FORBIDDEN', 'NO_SUBSCRIPTION', 'BAD_REQUEST']) {
      expect(isRetriableVerifyError(code)).toBe(false);
    }
  });
});

describe('verifyErrorMessage', () => {
  it('jeder bekannte Code hat einen eigenen deutschen Text, unbekannte einen neutralen', () => {
    const fallback = verifyErrorMessage('SOMETHING_NEW');
    for (const code of ['SESSION_INCOMPLETE', 'PAYMENT_INCOMPLETE', 'NO_SUBSCRIPTION', 'TENANT_MISMATCH', 'STRIPE_ERROR', 'TIMEOUT', 'NETWORK']) {
      expect(verifyErrorMessage(code)).not.toBe(fallback);
    }
    expect(fallback).toBe('Der Checkout konnte nicht verifiziert werden.');
  });
});

describe('tenantCandidates', () => {
  const tenants = [
    { tenantId: 't-a', role: 'owner' },
    { tenantId: 't-b', role: 'member' },
    { tenantId: 't-c', role: 'admin' },
  ];

  it('aktiver Workspace zuerst, danach nur Owner/Admin, ohne Doppelte', () => {
    expect(tenantCandidates('t-c', tenants)).toEqual(['t-c', 't-a']);
  });

  it('ohne aktiven Workspace nur die Owner/Admin-Workspaces', () => {
    expect(tenantCandidates(null, tenants)).toEqual(['t-a', 't-c']);
  });
});

describe('resolveVerifiedPlan', () => {
  it('der Plan der Abo-Zeile schlägt plan_key aus der URL', () => {
    expect(resolveVerifiedPlan({ plan_key: 'growth' }, 'enterprise')).toBe('growth');
  });

  it('ohne Abo-Zeile (Sync ausstehend) bleibt nur der URL-Hinweis', () => {
    expect(resolveVerifiedPlan(null, 'starter')).toBe('starter');
    expect(resolveVerifiedPlan({ plan_key: null }, null)).toBeNull();
  });
});

describe('CheckoutSuccess — Verifikation und Wiederholung', () => {
  it('bricht hängende Prüfungen per Timeout ab', () => {
    expect(SUCCESS).toContain('AbortSignal.timeout(VERIFY_TIMEOUT_MS)');
  });

  it('bietet „Erneut prüfen“ im Fehlerzustand nur für wiederholbare Fehler an', () => {
    expect(SUCCESS).toContain('errorRetriable &&');
    expect(SUCCESS).toContain('Erneut prüfen');
    expect(SUCCESS).toContain('isRetriableVerifyError(last.code)');
  });

  it('zeigt den Plan der verifizierten Abo-Zeile, nicht nur plan_key aus der URL', () => {
    expect(SUCCESS).toContain('resolveVerifiedPlan(last.subscription, planKey)');
    expect(SUCCESS).not.toContain("planKey || 'unknown'");
  });

  it('schreibt keine erfundene Abo-ID in die Dashboard-URL', () => {
    expect(SUCCESS).not.toContain("'synced'");
  });

  it('probiert bei TENANT_MISMATCH die übrigen Owner/Admin-Workspaces', () => {
    expect(SUCCESS).toContain("last.code !== 'TENANT_MISMATCH'");
    expect(SUCCESS).toContain('tenantCandidates(');
    expect(SUCCESS).toContain('setActiveTenant(matchedTenantId)');
  });
});

describe('/unified-entry/success', () => {
  it('die tote Willkommensseite ist entfernt, alte Links landen im Dashboard', () => {
    expect(existsSync(resolve('src/unified-entry/pages/SuccessPage.tsx'))).toBe(false);
    expect(APP).toMatch(
      /path="\/unified-entry\/success" element=\{<Navigate to="\/app\/dashboard" replace \/>\}/,
    );
  });
});
