/**
 * Trichter-Kontext — was zwischen Scan, Empfehlung, Anmeldung und Checkout
 * erhalten bleiben muss.
 *
 * Der Fehler, den diese Tests verhindern, ist nicht theoretisch: Bis hierher
 * reisten `auditId` und `domain` ausschliesslich im Router-State und waren
 * nach jedem Reload, jeder Anmeldung und jeder Rückkehr von Stripe weg.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFunnelContext,
  readFunnelContext,
  resolveAuditContext,
  saveFunnelContext,
  withAuditContext,
} from '../../src/core/onboarding/funnelContext';

beforeEach(() => {
  clearFunnelContext();
});

describe('saveFunnelContext', () => {
  it('behält Audit und Domain über mehrere Schritte hinweg', () => {
    saveFunnelContext({ auditId: 'a-1', domain: 'beispiel.de' });
    saveFunnelContext({ auditId: 'a-1', recommendedPlan: 'growth' });
    const stored = readFunnelContext()!;
    expect(stored.domain).toBe('beispiel.de');
    expect(stored.recommendedPlan).toBe('growth');
  });

  it('setzt bei einem anderen Audit neu auf, statt Fremdes weiterzutragen', () => {
    saveFunnelContext({ auditId: 'a-1', domain: 'beispiel.de', recommendedPlan: 'growth' });
    saveFunnelContext({ auditId: 'a-2' });
    const stored = readFunnelContext()!;
    expect(stored.auditId).toBe('a-2');
    expect(stored.domain).toBe('');
    expect(stored.recommendedPlan).toBeNull();
  });

  it('normalisiert die Modulauswahl über die Pricing-SSoT', () => {
    saveFunnelContext({
      auditId: 'a-1',
      selectedModules: ['website_chat'],
    });
    // `governance_core` ist Pflicht und wird von `normalizeModuleSelection()`
    // ergänzt — hier wird nichts nachgebaut.
    expect(readFunnelContext()!.selectedModules).toContain('governance_core');
  });

  it('verwirft einen unbekannten Plan, statt ihn durchzureichen', () => {
    saveFunnelContext({ auditId: 'a-1' });
    window.sessionStorage.setItem(
      'rsd.funnel.context',
      JSON.stringify({ auditId: 'a-1', recommendedPlan: 'scale' }),
    );
    expect(readFunnelContext()!.recommendedPlan).toBeNull();
  });
});

describe('resolveAuditContext', () => {
  it('nimmt die URL vor der Sitzung, damit ein geteilter Link reproduzierbar bleibt', () => {
    saveFunnelContext({ auditId: 'a-1', domain: 'alt.de' });
    const ctx = resolveAuditContext('?audit_id=a-2&domain=neu.de');
    expect(ctx.auditId).toBe('a-2');
    expect(ctx.domain).toBe('neu.de');
  });

  it('greift auf die Sitzung zurück, wenn die URL nichts trägt', () => {
    saveFunnelContext({ auditId: 'a-1', domain: 'beispiel.de' });
    expect(resolveAuditContext('')).toEqual({ auditId: 'a-1', domain: 'beispiel.de' });
  });

  it('nimmt die Domain nicht aus einem fremden Audit', () => {
    saveFunnelContext({ auditId: 'a-1', domain: 'beispiel.de' });
    expect(resolveAuditContext('?audit_id=a-2').domain).toBe('');
  });

  it('nutzt den Routen-Parameter als Rückfallebene', () => {
    expect(resolveAuditContext('', 'a-3').auditId).toBe('a-3');
  });
});

describe('withAuditContext', () => {
  it('ergänzt den Audit-Kontext, ohne bestehende Parameter zu verlieren', () => {
    const href = withAuditContext('/checkout/starter?source=recommendation&pilot=true', {
      auditId: 'a-1',
      domain: 'beispiel.de',
    });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(href.startsWith('/checkout/starter?')).toBe(true);
    expect(params.get('source')).toBe('recommendation');
    expect(params.get('pilot')).toBe('true');
    expect(params.get('audit_id')).toBe('a-1');
    expect(params.get('domain')).toBe('beispiel.de');
  });

  it('lässt ein Ziel ohne Kontext unverändert', () => {
    expect(withAuditContext('/pricing', {})).toBe('/pricing');
  });
});
