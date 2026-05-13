import { describe, expect, it } from 'vitest';
import {
  normalizeShopDomain,
  validateScopes,
  calculateShopifyScore,
  detectVendors,
  compareShopifyScans,
  type DriftScanShape,
} from '../src/features/shopify/utils';

describe('normalizeShopDomain', () => {
  it('accepts a valid myshopify domain', () => {
    expect(normalizeShopDomain('mein-shop.myshopify.com')).toBe('mein-shop.myshopify.com');
  });
  it('strips https + path', () => {
    expect(normalizeShopDomain('https://mein-shop.myshopify.com/admin')).toBe('mein-shop.myshopify.com');
  });
  it('lowercases', () => {
    expect(normalizeShopDomain('Mein-Shop.MYSHOPIFY.com')).toBe('mein-shop.myshopify.com');
  });
  it('rejects non-myshopify', () => {
    expect(normalizeShopDomain('example.com')).toBeNull();
  });
  it('rejects empty', () => {
    expect(normalizeShopDomain('')).toBeNull();
  });
  it('rejects malformed', () => {
    expect(normalizeShopDomain('.myshopify.com')).toBeNull();
  });
});

describe('validateScopes', () => {
  it('accepts allow-listed scopes', () => {
    expect(validateScopes('read_themes,read_content')).toEqual(['read_themes', 'read_content']);
  });
  it('rejects write scope', () => {
    expect(() => validateScopes('read_themes,write_products')).toThrow(/not allowed/);
  });
  it('rejects unknown scope', () => {
    expect(() => validateScopes('read_orders')).toThrow(/not allowed/);
  });
});

describe('calculateShopifyScore', () => {
  it('returns 100 with no findings', () => {
    expect(calculateShopifyScore([])).toBe(100);
  });
  it('deducts 25 for one critical', () => {
    expect(calculateShopifyScore([{ severity: 'critical' }])).toBe(75);
  });
  it('deducts 15 for one high, 8 for medium, 3 for low', () => {
    expect(calculateShopifyScore([{ severity: 'high' }, { severity: 'medium' }, { severity: 'low' }])).toBe(100 - 15 - 8 - 3);
  });
  it('does not go below 0', () => {
    const many = Array(10).fill({ severity: 'critical' as const });
    expect(calculateShopifyScore(many)).toBe(0);
  });
});

describe('detectVendors', () => {
  it('detects GTM', () => {
    expect(detectVendors('<script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXX"></script>')).toContain('Google Tag Manager');
  });
  it('detects Meta Pixel via fbq()', () => {
    expect(detectVendors('<script>fbq("track","PageView");</script>')).toContain('Meta (Facebook) Pixel');
  });
  it('detects Klaviyo', () => {
    expect(detectVendors('<script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>')).toContain('Klaviyo');
  });
  it('returns empty array for clean HTML', () => {
    expect(detectVendors('<html><body>nothing</body></html>')).toEqual([]);
  });
});

describe('compareShopifyScans', () => {
  const emptyEvidence = { scannedUrls: ['https://x.myshopify.com/'], headers: {}, detectedVendors: [], consentSignals: [] };
  const baseShape: DriftScanShape = { score: 90, findings: [], evidence: emptyEvidence };

  it('returns empty when previous is null', () => {
    expect(compareShopifyScans(null, baseShape)).toEqual([]);
  });

  it('emits new_tracker when vendor appears', () => {
    const prev = { ...baseShape, evidence: { ...emptyEvidence, detectedVendors: [] } };
    const cur  = { ...baseShape, evidence: { ...emptyEvidence, detectedVendors: ['Klaviyo'] } };
    const out = compareShopifyScans(prev, cur);
    expect(out.some((d) => d.type === 'new_tracker')).toBe(true);
  });

  it('emits lost_consent_signal when consent vanishes', () => {
    const prev = { ...baseShape, evidence: { ...emptyEvidence, consentSignals: ['Cookiebot'] } };
    const cur  = { ...baseShape, evidence: { ...emptyEvidence, consentSignals: [] } };
    const out = compareShopifyScans(prev, cur);
    expect(out.some((d) => d.type === 'lost_consent_signal')).toBe(true);
  });

  it('emits lost_security_header when CSP disappears', () => {
    const url = 'https://x.myshopify.com/';
    const prev: DriftScanShape = { ...baseShape, evidence: { ...emptyEvidence, headers: { [url]: { 'content-security-policy': "default-src 'self'" } } } };
    const cur: DriftScanShape  = { ...baseShape, evidence: { ...emptyEvidence, headers: { [url]: {} } } };
    const out = compareShopifyScans(prev, cur);
    expect(out.some((d) => d.type === 'lost_security_header')).toBe(true);
  });

  it('emits score_drop when score drops by more than 10', () => {
    const prev = { ...baseShape, score: 90 };
    const cur  = { ...baseShape, score: 75 };
    expect(compareShopifyScans(prev, cur).some((d) => d.type === 'score_drop')).toBe(true);
  });

  it('does not emit score_drop for small drops', () => {
    const prev = { ...baseShape, score: 90 };
    const cur  = { ...baseShape, score: 85 };
    expect(compareShopifyScans(prev, cur).some((d) => d.type === 'score_drop')).toBe(false);
  });

  it('emits new_high_finding for new high-severity finding', () => {
    const prev: DriftScanShape = { ...baseShape, findings: [] };
    const cur:  DriftScanShape = { ...baseShape, findings: [{ id: 'csp-missing', severity: 'high' }] };
    expect(compareShopifyScans(prev, cur).some((d) => d.type === 'new_high_finding')).toBe(true);
  });

  it('does not emit new_high_finding for previously-known finding', () => {
    const f = { id: 'csp-missing', severity: 'high' as const };
    const prev: DriftScanShape = { ...baseShape, findings: [f] };
    const cur:  DriftScanShape = { ...baseShape, findings: [f] };
    expect(compareShopifyScans(prev, cur).some((d) => d.type === 'new_high_finding')).toBe(false);
  });
});
