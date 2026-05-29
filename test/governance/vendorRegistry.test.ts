import { describe, it, expect } from 'vitest';
import {
  knownVendors,
  knownAiWidgets,
  lookupVendor,
  isKnownVendor,
  lookupAiWidgetByScriptHost,
  vendorsByCategory,
  isNonEuVendor,
  normalizeHost,
} from '../../src/lib/governance/vendor-registry';

describe('knownVendors data', () => {
  it('enthält mindestens 50 Einträge', () => {
    expect(knownVendors.length).toBeGreaterThanOrEqual(50);
  });
  it('jeder Eintrag hat domain, vendor, category, country', () => {
    for (const v of knownVendors) {
      expect(v.domain.length).toBeGreaterThan(0);
      expect(v.vendor.length).toBeGreaterThan(0);
      expect(v.category.length).toBeGreaterThan(0);
      expect(v.country.length).toBe(2);
    }
  });
  it('keine Duplikate auf domain', () => {
    const seen = new Set<string>();
    for (const v of knownVendors) {
      expect(seen.has(v.domain)).toBe(false);
      seen.add(v.domain);
    }
  });
});

describe('knownAiWidgets data', () => {
  it('enthält mindestens 10 Einträge', () => {
    expect(knownAiWidgets.length).toBeGreaterThanOrEqual(10);
  });
  it('jeder Eintrag hat id, vendor, type, scriptHosts ≥ 1', () => {
    for (const w of knownAiWidgets) {
      expect(w.id.length).toBeGreaterThan(0);
      expect(w.vendor.length).toBeGreaterThan(0);
      expect(['chat', 'ai_bot']).toContain(w.type);
      expect(w.scriptHosts.length).toBeGreaterThan(0);
    }
  });
  it('keine Duplikate auf id', () => {
    const seen = new Set<string>();
    for (const w of knownAiWidgets) {
      expect(seen.has(w.id)).toBe(false);
      seen.add(w.id);
    }
  });
});

describe('normalizeHost', () => {
  it('strippt Protokoll', () => {
    expect(normalizeHost('https://Foo.com/bar')).toBe('foo.com/bar');
    expect(normalizeHost('http://foo.com')).toBe('foo.com');
  });
  it('lowercased', () => {
    expect(normalizeHost('GOOGLE-ANALYTICS.com')).toBe('google-analytics.com');
  });
  it('strippt führende Punkte', () => {
    expect(normalizeHost('.foo.com')).toBe('foo.com');
  });
});

describe('lookupVendor', () => {
  it('exakter Host matcht', () => {
    const v = lookupVendor('google-analytics.com');
    expect(v?.vendor).toBe('Google');
    expect(v?.category).toBe('analytics');
  });
  it('Subdomain matcht über Suffix-Regel', () => {
    expect(lookupVendor('www.google-analytics.com')?.vendor).toBe('Google');
    expect(lookupVendor('static.hotjar.com')?.vendor).toBe('Hotjar');
  });
  it('Volle URL matcht', () => {
    expect(lookupVendor('https://js.stripe.com/v3/').vendor).toBe('Stripe');
  });
  it('Pfad-Pattern matcht (recaptcha)', () => {
    expect(lookupVendor('https://www.google.com/recaptcha/api.js')?.vendor)
      .toBe('Google');
  });
  it('unbekannter Host → undefined', () => {
    expect(lookupVendor('beispiel-mandant.example.org')).toBeUndefined();
  });
  it('leerer Input → undefined', () => {
    expect(lookupVendor('')).toBeUndefined();
  });
  it('strict suffix — "notgoogle-analytics.com" matcht NICHT', () => {
    expect(lookupVendor('notgoogle-analytics.com')).toBeUndefined();
  });
});

describe('isKnownVendor', () => {
  it('boolean wrapper um lookupVendor', () => {
    expect(isKnownVendor('googletagmanager.com')).toBe(true);
    expect(isKnownVendor('völlig-unbekannt.de')).toBe(false);
  });
});

describe('lookupAiWidgetByScriptHost', () => {
  it('Intercom CDN matcht', () => {
    expect(lookupAiWidgetByScriptHost('widget.intercom.io')?.id).toBe('intercom');
    expect(lookupAiWidgetByScriptHost('js.intercomcdn.com')?.id).toBe('intercom');
  });
  it('Crisp matcht', () => {
    expect(lookupAiWidgetByScriptHost('client.crisp.chat')?.id).toBe('crisp');
  });
  it('Tidio Subdomain matcht', () => {
    expect(lookupAiWidgetByScriptHost('foo.code.tidio.co')?.id).toBe('tidio');
  });
  it('unbekannter Host → undefined', () => {
    expect(lookupAiWidgetByScriptHost('example.org')).toBeUndefined();
  });
});

describe('vendorsByCategory', () => {
  it('liefert alle CMPs', () => {
    const cmps = vendorsByCategory('cmp');
    const names = cmps.map((c) => c.vendor);
    expect(names).toContain('Cookiebot');
    expect(names).toContain('Usercentrics');
    expect(names).toContain('OneTrust');
  });
  it('jedes Element hat die abgefragte Kategorie', () => {
    for (const v of vendorsByCategory('analytics')) {
      expect(v.category).toBe('analytics');
    }
  });
});

describe('isNonEuVendor', () => {
  it('US-Vendor → true', () => {
    const v = lookupVendor('google-analytics.com')!;
    expect(isNonEuVendor(v)).toBe(true);
  });
  it('DE-Vendor → false', () => {
    const v = lookupVendor('matomo.cloud')!;
    expect(isNonEuVendor(v)).toBe(false);
  });
  it('CN-Vendor → true', () => {
    const v = lookupVendor('tiktok.com')!;
    expect(isNonEuVendor(v)).toBe(true);
  });
});
