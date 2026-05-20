import { describe, expect, it } from 'vitest';
import { deriveVvtEntriesFromEvents } from '../../src/features/governance/vvt/runtimeVvtMapper';
import type { RuntimeEvent } from '../../src/features/governance/vvt/types';

function evt(partial: Partial<RuntimeEvent> & Pick<RuntimeEvent, 'type'>): RuntimeEvent {
  return {
    id: partial.id ?? 'evt',
    tenantId: partial.tenantId ?? 'tenant-a',
    sourceUrl: partial.sourceUrl ?? 'https://example.de',
    occurredAt: partial.occurredAt ?? '2026-05-19T10:00:00.000Z',
    type: partial.type,
    metadata: partial.metadata,
  };
}

describe('runtimeVvtMapper', () => {
  it('tracker.pre_consent.detected → website_tracking, consent-Hinweis, high', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e1', type: 'tracker.pre_consent.detected',
        metadata: { vendor_name: 'GTM', vendor_domain: 'googletagmanager.com', vendor_country: 'US' } }),
    ]);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.processingType).toBe('website_tracking');
    expect(e.legalBasisHint).toBe('consent');
    expect(e.riskLevel).toBe('high');
    expect(e.reviewStatus).toBe('review_required');
    expect(e.thirdCountryTransfer).toBe(true);
    expect(e.vendors[0].dpaRequired).toBe(true);
    expect(e.vendors[0].transferRiskHint).toBe('high');
  });

  it('ai.endpoint.found → ai_endpoint, aiActRelevance=possible, review_required', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e2', type: 'ai.endpoint.found',
        metadata: { vendor_name: 'Anthropic', vendor_domain: 'api.anthropic.com', vendor_country: 'US' } }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].processingType).toBe('ai_endpoint');
    expect(entries[0].aiActRelevance).toBe('possible');
    expect(entries[0].reviewStatus).toBe('review_required');
  });

  it('form.email.detected → contact_form, unknown legal basis, medium risk', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e3', type: 'form.email.detected' }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].processingType).toBe('contact_form');
    expect(entries[0].legalBasisHint).toBe('unknown');
    expect(entries[0].riskLevel).toBe('medium');
  });

  it('vendor.unknown.detected → third_party_script, vendor.dpaRequired=true', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e4', type: 'vendor.unknown.detected',
        metadata: { vendor_domain: 'cdn.foo.io', vendor_country: 'unbekannt' } }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].processingType).toBe('third_party_script');
    expect(entries[0].vendors[0].dpaRequired).toBe(true);
    expect(entries[0].vendors[0].transferRiskHint).toBe('unknown');
  });

  it('unbekannter Event-Typ → unknown / unknown / possible / review_required', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e5', type: 'mystery.event.fired' }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].processingType).toBe('unknown');
    expect(entries[0].legalBasisHint).toBe('unknown');
    expect(entries[0].aiActRelevance).toBe('possible');
    expect(entries[0].reviewStatus).toBe('review_required');
  });

  it('aggregiert mehrere Events mit gleicher (url, type, vendor) zu einem Entry', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e6', type: 'tracker.pre_consent.detected',
        metadata: { vendor_domain: 'googletagmanager.com' } }),
      evt({ id: 'e7', type: 'tracker.pre_consent.detected',
        metadata: { vendor_domain: 'googletagmanager.com' } }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].detectedFromEventIds).toEqual(['e6', 'e7']);
  });

  it('zwei verschiedene Vendor-Domains → zwei Entries', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e8', type: 'tracker.pre_consent.detected',
        metadata: { vendor_domain: 'googletagmanager.com' } }),
      evt({ id: 'e9', type: 'tracker.pre_consent.detected',
        metadata: { vendor_domain: 'connect.facebook.net' } }),
    ]);
    expect(entries).toHaveLength(2);
  });

  it('Risk eskaliert monoton (medium + high in derselben Aggregation → high)', () => {
    const entries = deriveVvtEntriesFromEvents([
      evt({ id: 'e10', sourceUrl: 'https://x.de', type: 'cookie.banner.detected',
        metadata: { vendor_domain: 'self' } }),
      evt({ id: 'e11', sourceUrl: 'https://x.de', type: 'tracker.pre_consent.detected',
        metadata: { vendor_domain: 'self' } }),
    ]);
    // Beide haben processingType=website_tracking, vendor=self → 1 Entry
    expect(entries).toHaveLength(1);
    expect(entries[0].riskLevel).toBe('high');
  });

  it('leeres Event-Array → leeres Ergebnis', () => {
    expect(deriveVvtEntriesFromEvents([])).toEqual([]);
  });

  it('niemals reviewStatus=approved von Mapper aus', () => {
    const types = [
      'tracker.pre_consent.detected',
      'form.email.detected',
      'ai.endpoint.found',
      'vendor.unknown.detected',
      'mystery.event.fired',
    ];
    const entries = deriveVvtEntriesFromEvents(types.map((t, i) => evt({ id: `e${i}`, type: t })));
    for (const entry of entries) {
      expect(entry.reviewStatus, entry.id).not.toBe('approved');
    }
  });
});
