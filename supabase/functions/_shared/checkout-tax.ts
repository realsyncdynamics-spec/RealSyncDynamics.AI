// Steuer im Stripe Checkout — eine Stelle für alle Checkout-Wege.
//
// Reine Funktionen ohne Deno-/npm-Imports, damit vitest sie direkt prüft.
//
// Ob Stripe Umsatzsteuer berechnet, entscheidet ausschließlich PRICING_TAX_MODE
// aus der Pricing-SSoT (shared/pricing.ts → pricing.generated.ts). Kein
// Checkout setzt `automatic_tax` selbst.
//
//   EXEMPT       Kleinunternehmer (§ 19 UStG). Stripe berechnet keine Steuer;
//                jede Rechnung trägt den § 19-Hinweis (§ 34a Nr. 5 UStDV). Die
//                Steuernummer (Nr. 2) kommt als Standard-Steuer-ID aus den
//                Stripe-Rechnungseinstellungen.
//   EU_STANDARD  Regelbesteuerung. Stripe Tax berechnet die USt aus
//                Kundenadresse und Tax-Registrierungen.
//
// Warum das zählt: Weist eine Rechnung Umsatzsteuer aus, wird der Betrag nach
// § 14c UStG geschuldet — auch von Kleinunternehmern. Ein fest verdrahtetes
// `automatic_tax: true` bei aktiver Stripe-Tax-Registrierung erzeugt genau
// solche Rechnungen.
//
// Märkte: Self-Service verkauft nur in Länder, deren steuerliche Behandlung
// geprüft ist (TAX_CHECKED_MARKETS). Stripe Checkout kann das Land der
// Rechnungsadresse nicht einschränken; deshalb steht der Hinweis über dem
// Bezahlknopf, und `stripe-webhook` markiert abweichende Käufe zur manuellen
// Prüfung (reviewCheckoutTax). Die Liste wird erst nach steuerlicher Klärung
// erweitert — unabhängig vom Steuermodus.

import {
  PRICING_TAX_MODE,
  PRICING_TAX_NOTE_EXEMPT,
  type PricingTaxMode,
} from './pricing.generated.ts';

/** Länder (ISO 3166-1 alpha-2), in die Self-Service-Checkout verkaufen darf. */
export const TAX_CHECKED_MARKETS: readonly string[] = ['DE'];

const MARKET_NAMES: Record<string, string> = { DE: 'Deutschland' };

export function isTaxCheckedMarket(country: string | null | undefined): boolean {
  if (!country) return false;
  return TAX_CHECKED_MARKETS.includes(country.trim().toUpperCase());
}

/** Rechnungsfußzeile: im EXEMPT-Modus der § 19-Hinweis, sonst leer (= keine eigene). */
export function invoiceFooter(taxMode: PricingTaxMode = PRICING_TAX_MODE): string {
  return taxMode === 'EXEMPT' ? PRICING_TAX_NOTE_EXEMPT : '';
}

/** Hinweis über dem Bezahlknopf in Stripe Checkout (`custom_text.submit`). */
export function checkoutSubmitNotice(taxMode: PricingTaxMode = PRICING_TAX_MODE): string {
  const maerkte = TAX_CHECKED_MARKETS.map((code) => MARKET_NAMES[code] ?? code);
  const markt = maerkte.length === 1
    ? `Self-Service-Kauf derzeit nur mit Rechnungsadresse in ${maerkte[0]}.`
    : `Self-Service-Kauf derzeit nur mit Rechnungsadresse in: ${maerkte.join(', ')}.`;
  return taxMode === 'EXEMPT' ? `${markt} ${PRICING_TAX_NOTE_EXEMPT}` : markt;
}

export interface CheckoutTaxParams {
  automatic_tax: { enabled: boolean };
  billing_address_collection: 'required';
  tax_id_collection: { enabled: boolean };
  customer_update?: { address: 'auto'; name: 'auto' };
  invoice_creation?: { enabled: boolean; invoice_data?: { footer: string } };
  custom_text: { submit: { message: string } };
}

/**
 * Steuer-, Adress- und Rechnungsparameter für `stripe.checkout.sessions.create`.
 *
 * - `customer_update` nur mit bestehendem Customer: Stripe lehnt den Parameter
 *   ohne `customer` ab; mit Customer sorgt er dafür, dass Name und
 *   Rechnungsadresse aus dem Checkout auf der Rechnung landen.
 * - `invoice_creation` nur im Modus `payment`: Abo-Rechnungen erzeugt Stripe
 *   selbst, ihre Fußzeile kommt aus `customer.invoice_settings.footer`.
 */
export function checkoutTaxParams(opts: {
  sessionMode: 'payment' | 'subscription';
  existingCustomer: boolean;
  taxMode?: PricingTaxMode;
  submitPrefix?: string;
}): CheckoutTaxParams {
  const taxMode = opts.taxMode ?? PRICING_TAX_MODE;
  const notice = checkoutSubmitNotice(taxMode);
  const prefix = opts.submitPrefix?.trim();

  const params: CheckoutTaxParams = {
    automatic_tax: { enabled: taxMode === 'EU_STANDARD' },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    custom_text: { submit: { message: prefix ? `${prefix} ${notice}` : notice } },
  };

  if (opts.existingCustomer) {
    params.customer_update = { address: 'auto', name: 'auto' };
  }

  if (opts.sessionMode === 'payment') {
    const footer = invoiceFooter(taxMode);
    params.invoice_creation = footer
      ? { enabled: true, invoice_data: { footer } }
      : { enabled: true };
  }

  return params;
}

export type CheckoutTaxFinding =
  | 'BILLING_COUNTRY_MISSING'
  | 'MARKET_NOT_TAX_CHECKED'
  | 'TAX_CHARGED_IN_EXEMPT_MODE';

/** Prüfung eines abgeschlossenen Checkouts. Leeres Ergebnis = nichts zu tun. */
export function reviewCheckoutTax(input: {
  taxMode?: PricingTaxMode;
  billingCountry: string | null | undefined;
  taxAmountCents: number | null | undefined;
}): CheckoutTaxFinding[] {
  const taxMode = input.taxMode ?? PRICING_TAX_MODE;
  const findings: CheckoutTaxFinding[] = [];
  if (!input.billingCountry?.trim()) findings.push('BILLING_COUNTRY_MISSING');
  else if (!isTaxCheckedMarket(input.billingCountry)) findings.push('MARKET_NOT_TAX_CHECKED');
  if (taxMode === 'EXEMPT' && (input.taxAmountCents ?? 0) > 0) findings.push('TAX_CHARGED_IN_EXEMPT_MODE');
  return findings;
}

export type InvoiceTaxFinding = 'TAX_CHARGED_IN_EXEMPT_MODE' | 'EXEMPT_NOTE_MISSING';

/** Prüfung einer finalisierten Rechnung. Leeres Ergebnis = in Ordnung. */
export function reviewInvoiceTax(input: {
  taxMode?: PricingTaxMode;
  taxAmountCents: number | null | undefined;
  footer: string | null | undefined;
}): InvoiceTaxFinding[] {
  const taxMode = input.taxMode ?? PRICING_TAX_MODE;
  if (taxMode !== 'EXEMPT') return [];
  const findings: InvoiceTaxFinding[] = [];
  if ((input.taxAmountCents ?? 0) > 0) findings.push('TAX_CHARGED_IN_EXEMPT_MODE');
  if (!input.footer?.includes(PRICING_TAX_NOTE_EXEMPT)) findings.push('EXEMPT_NOTE_MISSING');
  return findings;
}
