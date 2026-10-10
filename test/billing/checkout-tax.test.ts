/**
 * Steuer im Checkout — abgeleitet aus PRICING_TAX_MODE, nicht fest verdrahtet.
 *
 * Hintergrund: `stripe-checkout` setzte `automatic_tax: { enabled: true }` fest.
 * Bei aktiver Stripe-Tax-Registrierung (DE + OSS) weist Stripe dann 19 % USt
 * auf der Rechnung aus — obwohl Website, AGB und Impressum § 19 UStG
 * (Kleinunternehmer) erklären. Ausgewiesene Steuer ist nach § 14c UStG
 * geschuldet, auch von Kleinunternehmern. Diese Tests halten fest:
 *
 *   1. Der Steuermodus der Pricing-SSoT entscheidet über `automatic_tax`.
 *   2. Jede Rechnung im EXEMPT-Modus trägt den § 19-Hinweis (§ 34a Nr. 5
 *      UStDV). Die Steuernummer (Nr. 2) kommt als Standard-Steuer-ID aus den
 *      Stripe-Rechnungseinstellungen, nicht aus dem Code.
 *   3. Self-Service verkauft nur in steuerlich geprüfte Märkte (derzeit DE);
 *      Abweichungen nach dem Kauf werden zur manuellen Prüfung markiert.
 *   4. Kein Checkout-Weg setzt `automatic_tax` am Helper vorbei.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  TAX_CHECKED_MARKETS,
  checkoutSubmitNotice,
  checkoutTaxParams,
  invoiceFooter,
  isTaxCheckedMarket,
  reviewCheckoutTax,
  reviewInvoiceTax,
} from '../../supabase/functions/_shared/checkout-tax';
import { PRICING_TAX_NOTE_EXEMPT } from '../../shared/pricing';

describe('checkoutTaxParams: Steuerberechnung folgt dem Steuermodus', () => {
  it('EXEMPT: Stripe berechnet keine Umsatzsteuer', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'subscription', existingCustomer: true });
    expect(p.automatic_tax).toEqual({ enabled: false });
  });

  it('EU_STANDARD: Stripe Tax berechnet die Umsatzsteuer', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'subscription', existingCustomer: true });
    expect(p.automatic_tax).toEqual({ enabled: true });
  });

  it('verlangt in beiden Modi die vollständige Rechnungsadresse (§ 34a Nr. 1 UStDV)', () => {
    for (const taxMode of ['EXEMPT', 'EU_STANDARD'] as const) {
      const p = checkoutTaxParams({ taxMode, sessionMode: 'payment', existingCustomer: false });
      expect(p.billing_address_collection).toBe('required');
      expect(p.tax_id_collection).toEqual({ enabled: true });
    }
  });

  it('übernimmt Adresse und Name nur bei bestehendem Customer (Stripe lehnt customer_update sonst ab)', () => {
    const bestehend = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'subscription', existingCustomer: true });
    expect(bestehend.customer_update).toEqual({ address: 'auto', name: 'auto' });

    const neu = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'payment', existingCustomer: false });
    expect(neu).not.toHaveProperty('customer_update');
  });

  it('Einmalkauf: Rechnung mit § 19-Hinweis in der Fußzeile', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'payment', existingCustomer: false });
    expect(p.invoice_creation?.enabled).toBe(true);
    expect(p.invoice_creation?.invoice_data?.footer).toContain(PRICING_TAX_NOTE_EXEMPT);
  });

  it('Abo: keine invoice_creation (im Modus subscription von Stripe nicht erlaubt)', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'subscription', existingCustomer: true });
    expect(p).not.toHaveProperty('invoice_creation');
  });

  it('EU_STANDARD: Rechnung ohne eigene Fußzeile', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'payment', existingCustomer: false });
    expect(p.invoice_creation).toEqual({ enabled: true });
  });

  it('zeigt den Markt- und Steuerhinweis direkt über dem Bezahlknopf', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'subscription', existingCustomer: false });
    expect(p.custom_text.submit.message).toBe(checkoutSubmitNotice('EXEMPT'));
  });

  it('stellt einen eigenen Hinweis des Aufrufers voran', () => {
    const p = checkoutTaxParams({
      taxMode: 'EXEMPT', sessionMode: 'payment', existingCustomer: false,
      submitPrefix: 'DSGVO-konformer Rebuild für example.de.',
    });
    expect(p.custom_text.submit.message.startsWith('DSGVO-konformer Rebuild für example.de. ')).toBe(true);
    expect(p.custom_text.submit.message).toContain(checkoutSubmitNotice('EXEMPT'));
  });
});

describe('invoiceFooter: § 19-Hinweis auf der Rechnung (§ 34a Nr. 5 UStDV)', () => {
  // Die Steuernummer (§ 34a Nr. 2 UStDV) steht nicht in der Fußzeile, sondern
  // als Standard-Steuer-ID des Stripe-Kontos auf jeder Rechnung.
  it('EXEMPT: genau der § 19-Hinweis der SSoT', () => {
    expect(invoiceFooter('EXEMPT')).toBe(PRICING_TAX_NOTE_EXEMPT);
  });

  it('EU_STANDARD: keine eigene Fußzeile', () => {
    expect(invoiceFooter('EU_STANDARD')).toBe('');
  });
});

describe('checkoutSubmitNotice', () => {
  it('EXEMPT: nennt Deutschland als einzigen Self-Service-Markt und § 19 UStG', () => {
    const text = checkoutSubmitNotice('EXEMPT');
    expect(text).toContain('Rechnungsadresse in Deutschland');
    expect(text).toContain(PRICING_TAX_NOTE_EXEMPT);
  });

  it('EU_STANDARD: Markthinweis bleibt, § 19-Hinweis entfällt', () => {
    const text = checkoutSubmitNotice('EU_STANDARD');
    expect(text).toContain('Rechnungsadresse in Deutschland');
    expect(text).not.toContain('§ 19');
  });

  it('bleibt unter Stripes Grenze von 1200 Zeichen', () => {
    expect(checkoutSubmitNotice('EXEMPT').length).toBeLessThanOrEqual(1200);
  });
});

describe('Märkte: Self-Service nur in steuerlich geprüfte Länder', () => {
  it('derzeit ausschließlich Deutschland', () => {
    expect([...TAX_CHECKED_MARKETS]).toEqual(['DE']);
  });

  it('prüft den ISO-Ländercode unabhängig von Groß-/Kleinschreibung', () => {
    expect(isTaxCheckedMarket('DE')).toBe(true);
    expect(isTaxCheckedMarket('de')).toBe(true);
    expect(isTaxCheckedMarket('AT')).toBe(false);
    expect(isTaxCheckedMarket('')).toBe(false);
    expect(isTaxCheckedMarket(null)).toBe(false);
    expect(isTaxCheckedMarket(undefined)).toBe(false);
  });
});

describe('reviewCheckoutTax: Prüfung nach dem Kauf', () => {
  it('DE ohne Steuer im EXEMPT-Modus: nichts zu prüfen', () => {
    expect(reviewCheckoutTax({ taxMode: 'EXEMPT', billingCountry: 'DE', taxAmountCents: 0 })).toEqual([]);
  });

  it('Rechnungsland außerhalb der geprüften Märkte → manuelle Prüfung', () => {
    expect(reviewCheckoutTax({ taxMode: 'EXEMPT', billingCountry: 'AT', taxAmountCents: 0 }))
      .toEqual(['MARKET_NOT_TAX_CHECKED']);
  });

  it('fehlendes Rechnungsland → manuelle Prüfung', () => {
    expect(reviewCheckoutTax({ taxMode: 'EXEMPT', billingCountry: null, taxAmountCents: 0 }))
      .toEqual(['BILLING_COUNTRY_MISSING']);
  });

  it('berechnete Steuer im EXEMPT-Modus ist ein Fehler (§ 14c UStG)', () => {
    expect(reviewCheckoutTax({ taxMode: 'EXEMPT', billingCountry: 'DE', taxAmountCents: 3976 }))
      .toEqual(['TAX_CHARGED_IN_EXEMPT_MODE']);
  });

  it('EU_STANDARD: Steuer ist erwartet, die Marktgrenze gilt weiter', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: 'DE', taxAmountCents: 3976 })).toEqual([]);
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: 'AT', taxAmountCents: 0 }))
      .toEqual(['MARKET_NOT_TAX_CHECKED']);
  });
});

describe('reviewInvoiceTax: Prüfung jeder finalisierten Rechnung', () => {
  it('EXEMPT, keine Steuer, § 19-Hinweis vorhanden: in Ordnung', () => {
    expect(reviewInvoiceTax({ taxMode: 'EXEMPT', taxAmountCents: 0, footer: invoiceFooter('EXEMPT') })).toEqual([]);
  });

  it('EXEMPT ohne § 19-Hinweis → Rechnung unvollständig (§ 34a Nr. 5 UStDV)', () => {
    expect(reviewInvoiceTax({ taxMode: 'EXEMPT', taxAmountCents: 0, footer: null })).toEqual(['EXEMPT_NOTE_MISSING']);
  });

  it('EXEMPT mit ausgewiesener Steuer → Fehler', () => {
    expect(reviewInvoiceTax({ taxMode: 'EXEMPT', taxAmountCents: 100, footer: invoiceFooter('EXEMPT') }))
      .toEqual(['TAX_CHARGED_IN_EXEMPT_MODE']);
  });

  it('EU_STANDARD: Steuer und fehlender § 19-Hinweis sind korrekt', () => {
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', taxAmountCents: 100, footer: null })).toEqual([]);
  });
});

describe('Verdrahtung: kein Checkout setzt automatic_tax am Helper vorbei', () => {
  const FUNCTIONS_DIR = resolve(__dirname, '../../supabase/functions');
  const read = (slug: string) => readFileSync(join(FUNCTIONS_DIR, slug, 'index.ts'), 'utf-8');

  for (const slug of ['stripe-checkout', 'checkout-website-rebuild', 'checkout-siteos-project']) {
    it(`${slug} nutzt checkoutTaxParams und kein eigenes automatic_tax`, () => {
      const src = read(slug);
      expect(src).toContain('checkoutTaxParams(');
      expect(src).not.toMatch(/automatic_tax\s*:/);
    });
  }

  it('stripe-checkout hält die Rechnungsfußzeile des Customers aktuell (Abo-Rechnungen)', () => {
    expect(read('stripe-checkout')).toMatch(/invoice_settings:\s*\{\s*footer/);
  });

  it('stripe-webhook prüft Käufe und Rechnungen auf Steuerabweichungen', () => {
    const src = read('stripe-webhook');
    expect(src).toContain('reviewCheckoutTax(');
    expect(src).toContain('reviewInvoiceTax(');
  });
});

describe('billingCountryGate (serverseitige Markt-Sperre vor der Session)', () => {
  it('erlaubt DE und unbekanntes Land', async () => {
    const { billingCountryGate } = await import('../../supabase/functions/_shared/checkout-tax');
    expect(billingCountryGate({ declared: 'DE' })).toEqual({ ok: true });
    expect(billingCountryGate({ declared: ' de ' })).toEqual({ ok: true });
    expect(billingCountryGate({})).toEqual({ ok: true });
    expect(billingCountryGate({ declared: '', customerCountry: null })).toEqual({ ok: true });
  });
  it('sperrt bekanntes Nicht-DE-Land (Angabe oder Customer-Adresse)', async () => {
    const { billingCountryGate } = await import('../../supabase/functions/_shared/checkout-tax');
    expect(billingCountryGate({ declared: 'AT' })).toEqual({ ok: false, code: 'MARKET_NOT_SUPPORTED', country: 'AT' });
    expect(billingCountryGate({ declared: 'DE', customerCountry: 'ch' })).toEqual({ ok: false, code: 'MARKET_NOT_SUPPORTED', country: 'CH' });
  });
  it('alle drei Checkout-Handler prüfen das Land vor dem Stripe-Aufruf', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['stripe-checkout', 'checkout-siteos-project', 'checkout-website-rebuild']) {
      const src = readFileSync(`supabase/functions/${f}/index.ts`, 'utf8');
      const gate = src.indexOf('billingCountryGate({ declared: body.billing_country })');
      expect(gate, f).toBeGreaterThan(-1);
      expect(gate, f).toBeLessThan(src.indexOf('checkout.sessions.create'));
    }
    const sc = readFileSync('supabase/functions/stripe-checkout/index.ts', 'utf8');
    expect(sc).toContain('billingCountryGate({ customerCountry })');
  });
});

describe('stripe-checkout: Footer-Update', () => {
  it('Einmalkauf: Fehler wird geloggt, blockiert nicht; Abo: bleibt blockierend', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('supabase/functions/stripe-checkout/index.ts', 'utf8');
    const block = src.slice(src.indexOf('if (isOneTime) {\n      try {'), src.indexOf('const session = await stripe.checkout.sessions.create'));
    expect(block).toContain('console.error(\'[stripe-checkout] customer footer update failed (one-time, continuing)\'');
    expect(block).toMatch(/\} else \{\n\s+await stripe\.customers\.update/);
  });
});
