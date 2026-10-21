/**
 * Umsatzsteuer im Checkout — abgeleitet aus PRICING_TAX_MODE, nicht je
 * Checkout-Weg fest verdrahtet.
 *
 * Stand 20.10.2026 (Entscheidung Dominik): umsatzsteuerpflichtig, Preise
 * netto zzgl. USt, Angebot nur für Unternehmer (§ 14 BGB). Die Live-Preise
 * sind dafür `tax_behavior: exclusive`; Stripe Tax schlägt die USt auf.
 *
 * Vorher berechnete nur `stripe-checkout` (Abos) Steuer. Die Einmalkäufe
 * (Governance Launch über `checkout-website-rebuild` / `checkout-siteos-project`)
 * liefen ohne `automatic_tax` und ohne Rechnung: Mit Netto-Preisen hieße das
 * 349 € ohne USt — die Steuer wäre trotzdem geschuldet. Diese Tests halten fest:
 *
 *   1. Der Steuermodus der Pricing-SSoT entscheidet über `automatic_tax`,
 *      für jeden Checkout-Weg gleich.
 *   2. Jeder Einmalkauf erzeugt eine Rechnung; im EXEMPT-Modus mit § 19-Hinweis.
 *   3. Self-Service verkauft nur in steuerlich geprüfte Märkte (derzeit DE,
 *      bis eine USt-IdNr. für Reverse-Charge-Rechnungen vorliegt);
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
  invoiceTaxFacts,
  isTaxCheckedMarket,
  reviewCheckoutTax,
  reviewInvoiceTax,
} from '../../supabase/functions/_shared/checkout-tax';
import { PRICING_TAX_NOTE_EXEMPT, PRICING_TAX_NOTE_STANDARD } from '../../shared/pricing';

describe('checkoutTaxParams: Steuerberechnung folgt dem Steuermodus', () => {
  it('EU_STANDARD: Stripe Tax berechnet die Umsatzsteuer', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'subscription', existingCustomer: true });
    expect(p.automatic_tax).toEqual({ enabled: true });
  });

  it('EU_STANDARD gilt auch für Einmalkäufe (Governance Launch)', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'payment', existingCustomer: false });
    expect(p.automatic_tax).toEqual({ enabled: true });
  });

  it('EXEMPT: Stripe berechnet keine Umsatzsteuer', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'subscription', existingCustomer: true });
    expect(p.automatic_tax).toEqual({ enabled: false });
  });

  it('verlangt in beiden Modi die vollständige Rechnungsadresse und erfasst die USt-IdNr. des Kunden', () => {
    for (const taxMode of ['EXEMPT', 'EU_STANDARD'] as const) {
      const p = checkoutTaxParams({ taxMode, sessionMode: 'payment', existingCustomer: false });
      expect(p.billing_address_collection).toBe('required');
      expect(p.tax_id_collection).toEqual({ enabled: true });
    }
  });

  it('übernimmt Adresse und Name nur bei bestehendem Customer (Stripe lehnt customer_update sonst ab)', () => {
    const bestehend = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'subscription', existingCustomer: true });
    expect(bestehend.customer_update).toEqual({ address: 'auto', name: 'auto' });

    const neu = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'payment', existingCustomer: false });
    expect(neu).not.toHaveProperty('customer_update');
  });

  it('Einmalkauf erzeugt immer eine Rechnung', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'payment', existingCustomer: false });
    expect(p.invoice_creation).toEqual({ enabled: true });
  });

  it('Einmalkauf im EXEMPT-Modus: Rechnung mit § 19-Hinweis in der Fußzeile', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'payment', existingCustomer: false });
    expect(p.invoice_creation?.invoice_data?.footer).toBe(PRICING_TAX_NOTE_EXEMPT);
  });

  it('Abo: keine invoice_creation (im Modus subscription von Stripe nicht erlaubt)', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'subscription', existingCustomer: true });
    expect(p).not.toHaveProperty('invoice_creation');
  });

  it('zeigt den Markt-, B2B- und Steuerhinweis direkt über dem Bezahlknopf', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'subscription', existingCustomer: false });
    expect(p.custom_text.submit.message).toBe(checkoutSubmitNotice('EU_STANDARD'));
  });

  it('stellt einen eigenen Hinweis des Aufrufers voran', () => {
    const p = checkoutTaxParams({
      taxMode: 'EU_STANDARD', sessionMode: 'payment', existingCustomer: false,
      submitPrefix: 'DSGVO-konformer Rebuild für example.de.',
    });
    expect(p.custom_text.submit.message.startsWith('DSGVO-konformer Rebuild für example.de. ')).toBe(true);
    expect(p.custom_text.submit.message).toContain(checkoutSubmitNotice('EU_STANDARD'));
  });

  it('EU_STANDARD: Pflichtfeld Firmenname — aktive Bestätigung des B2B-Kaufs', () => {
    const p = checkoutTaxParams({ taxMode: 'EU_STANDARD', sessionMode: 'subscription', existingCustomer: true });
    expect(p.custom_fields).toHaveLength(1);
    const [feld] = p.custom_fields!;
    expect(feld.type).toBe('text');
    expect(feld.optional).toBe(false);
    expect(feld.label.custom).toMatch(/Firmenname/);
    expect(feld.label.custom.length).toBeLessThanOrEqual(50);
  });

  it('EXEMPT: kein Firmen-Pflichtfeld', () => {
    const p = checkoutTaxParams({ taxMode: 'EXEMPT', sessionMode: 'subscription', existingCustomer: true });
    expect(p).not.toHaveProperty('custom_fields');
  });

  it('der Preis-Hinweis der SSoT nennt den B2B-Kundenkreis direkt bei den Preisen', () => {
    expect(PRICING_TAX_NOTE_STANDARD).toMatch(/Unternehmer/);
    expect(PRICING_TAX_NOTE_STANDARD).toMatch(/zzgl\. gesetzlicher Umsatzsteuer/);
  });
});

describe('invoiceFooter', () => {
  it('EXEMPT: genau der § 19-Hinweis der SSoT (§ 34a Nr. 5 UStDV)', () => {
    expect(invoiceFooter('EXEMPT')).toBe(PRICING_TAX_NOTE_EXEMPT);
  });

  it('EU_STANDARD: keine eigene Fußzeile — ein alter § 19-Hinweis wird damit entfernt', () => {
    expect(invoiceFooter('EU_STANDARD')).toBe('');
  });
});

describe('checkoutSubmitNotice', () => {
  it('EU_STANDARD: nur Unternehmer, Preise zzgl. USt, Rechnungsadresse in Deutschland', () => {
    const text = checkoutSubmitNotice('EU_STANDARD');
    expect(text).toContain('Rechnungsadresse in Deutschland');
    expect(text).toContain('ausschließlich für Unternehmer i. S. d. § 14 BGB');
    expect(text).toContain('zzgl. gesetzlicher Umsatzsteuer');
    expect(text).not.toContain('§ 19');
  });

  it('EXEMPT: § 19-Hinweis statt „zzgl. USt“', () => {
    const text = checkoutSubmitNotice('EXEMPT');
    expect(text).toContain(PRICING_TAX_NOTE_EXEMPT);
    expect(text).not.toContain('zzgl.');
  });

  it('bleibt unter Stripes Grenze von 1200 Zeichen', () => {
    for (const taxMode of ['EXEMPT', 'EU_STANDARD'] as const) {
      expect(checkoutSubmitNotice(taxMode).length).toBeLessThanOrEqual(1200);
    }
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
  const de = { billingCountry: 'DE', amountTotalCents: 29631 };

  it('EU_STANDARD, DE mit USt: nichts zu prüfen', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', ...de, taxAmountCents: 4731 })).toEqual([]);
  });

  it('EU_STANDARD, DE ohne USt → Fehler (Steuer geschuldet, aber nicht berechnet)', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', ...de, taxAmountCents: 0 }))
      .toEqual(['TAX_MISSING_IN_STANDARD_MODE']);
  });

  it('kostenlose Testphase (0 €) ist kein Steuerfehler', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: 'DE', amountTotalCents: 0, taxAmountCents: 0 }))
      .toEqual([]);
  });

  it('Rechnungsland außerhalb der geprüften Märkte → manuelle Prüfung', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: 'AT', amountTotalCents: 24900, taxAmountCents: 0 }))
      .toEqual(['MARKET_NOT_TAX_CHECKED']);
  });

  it('fehlendes Rechnungsland → manuelle Prüfung', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: null, amountTotalCents: 0, taxAmountCents: 0 }))
      .toEqual(['BILLING_COUNTRY_MISSING']);
  });

  it('EXEMPT: berechnete Steuer ist ein Fehler (§ 14c UStG)', () => {
    expect(reviewCheckoutTax({ taxMode: 'EXEMPT', ...de, taxAmountCents: 3976 }))
      .toEqual(['TAX_CHARGED_IN_EXEMPT_MODE']);
  });
});

describe('reviewInvoiceTax: Prüfung jeder finalisierten Rechnung', () => {
  it('EU_STANDARD, DE mit USt: in Ordnung', () => {
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', customerCountry: 'DE', totalCents: 29631, taxAmountCents: 4731, footer: null }))
      .toEqual([]);
  });

  it('EU_STANDARD, DE ohne USt → Fehler', () => {
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', customerCountry: 'DE', totalCents: 24900, taxAmountCents: 0, footer: null }))
      .toEqual(['TAX_MISSING_IN_STANDARD_MODE']);
  });

  it('EU_STANDARD: Rechnung über 0 € (Testphase) ist in Ordnung', () => {
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', customerCountry: 'DE', totalCents: 0, taxAmountCents: 0, footer: null }))
      .toEqual([]);
  });

  it('EU_STANDARD: alter § 19-Hinweis auf einer Rechnung → Fehler', () => {
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', customerCountry: 'DE', totalCents: 29631, taxAmountCents: 4731, footer: PRICING_TAX_NOTE_EXEMPT }))
      .toEqual(['EXEMPT_NOTE_IN_STANDARD_MODE']);
  });

  it('EXEMPT, keine Steuer, § 19-Hinweis vorhanden: in Ordnung', () => {
    expect(reviewInvoiceTax({ taxMode: 'EXEMPT', customerCountry: 'DE', totalCents: 24900, taxAmountCents: 0, footer: invoiceFooter('EXEMPT') }))
      .toEqual([]);
  });

  it('EU_STANDARD: Rechnung ohne Kundenland → manuelle Prüfung (Stripe Tax hatte keinen Standort)', () => {
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', customerCountry: null, totalCents: 24900, taxAmountCents: 0, footer: null }))
      .toEqual(['CUSTOMER_COUNTRY_MISSING']);
  });

  it('EXEMPT ohne § 19-Hinweis und mit Steuer → beide Befunde', () => {
    expect(reviewInvoiceTax({ taxMode: 'EXEMPT', customerCountry: 'DE', totalCents: 24900, taxAmountCents: 100, footer: null }))
      .toEqual(['TAX_CHARGED_IN_EXEMPT_MODE', 'EXEMPT_NOTE_MISSING']);
  });
});

describe('invoiceTaxFacts: Rechnungsdaten aus beiden Stripe-API-Versionen', () => {
  // Der Produktions-Webhook hat keine feste API-Version und bekommt
  // Payloads in der Konto-Standardversion (2026-04-22.dahlia). Dort fehlen
  // `tax`, `subscription` und `subscription_details`; der Mandant steht
  // unter `parent.subscription_details.metadata`.
  const dahlia = {
    total: 29631,
    total_excluding_tax: 24900,
    total_taxes: [{ amount: 4731 }],
    customer_address: { country: 'DE' },
    footer: null,
    metadata: {},
    parent: { type: 'subscription_details', subscription_details: { metadata: { tenant_id: 'T-1' }, subscription: 'sub_1' } },
  };

  it('dahlia: Steuer = total − total_excluding_tax, Mandant aus parent', () => {
    expect(invoiceTaxFacts(dahlia)).toEqual({
      taxCents: 4731, totalCents: 29631, customerCountry: 'DE', footer: null, tenantId: 'T-1',
    });
  });

  it('2024-06-20: `tax` und `subscription_details` am Objekt', () => {
    const alt = {
      total: 29631, total_excluding_tax: 24900, tax: 4731,
      customer_address: { country: 'DE' }, footer: null,
      subscription_details: { metadata: { tenant_id: 'T-2' } },
    };
    expect(invoiceTaxFacts(alt)).toMatchObject({ taxCents: 4731, tenantId: 'T-2' });
  });

  it('ohne total_excluding_tax: Rückfall auf `tax`, sonst 0', () => {
    expect(invoiceTaxFacts({ total: 24900, total_excluding_tax: null, tax: 100 }).taxCents).toBe(100);
    expect(invoiceTaxFacts({ total: 24900 }).taxCents).toBe(0);
  });

  it('ein korrekt besteuerter dahlia-Beleg erzeugt keinen Befund', () => {
    const f = invoiceTaxFacts(dahlia);
    expect(reviewInvoiceTax({ taxMode: 'EU_STANDARD', customerCountry: f.customerCountry, totalCents: f.totalCents, taxAmountCents: f.taxCents, footer: f.footer }))
      .toEqual([]);
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

  it('stripe-checkout gleicht die Rechnungsfußzeile des Customers an (Abo-Rechnungen)', () => {
    expect(read('stripe-checkout')).toMatch(/invoice_settings:\s*\{\s*footer/);
  });

  it('stripe-webhook prüft Käufe und Rechnungen auf Steuerabweichungen', () => {
    const src = read('stripe-webhook');
    expect(src).toContain('reviewCheckoutTax(');
    expect(src).toContain('reviewInvoiceTax(');
    // Rechnungsfelder versionsfest lesen, nie direkt `inv.tax`.
    expect(src).toContain('invoiceTaxFacts(');
    expect(src).not.toMatch(/taxAmountCents:\s*inv\.tax/);
  });
});
