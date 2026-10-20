// Umsatzsteuer im Stripe Checkout — eine Stelle für alle Checkout-Wege.
//
// Reine Funktionen ohne Deno-/npm-Imports, damit vitest sie direkt prüft.
//
// Ob Stripe Umsatzsteuer berechnet, entscheidet ausschließlich PRICING_TAX_MODE
// aus der Pricing-SSoT (shared/pricing.ts → pricing.generated.ts). Kein
// Checkout setzt `automatic_tax` selbst — vorher rechnete nur `stripe-checkout`
// Steuer, die Einmalkäufe (Governance Launch) liefen ohne.
//
//   EU_STANDARD  Regelbesteuerung (Stand 20.10.2026). Live-Preise sind netto
//                (`tax_behavior: exclusive`); Stripe Tax schlägt die USt nach
//                Kundenadresse und Registrierung auf. Angebot nur für
//                Unternehmer (AGB § 1 Abs. 2).
//   EXEMPT       Kleinunternehmer (§ 19 UStG). Keine Steuerberechnung; jede
//                Rechnung trägt den § 19-Hinweis (§ 34a Nr. 5 UStDV).
//
// Märkte: Self-Service verkauft nur in Länder, deren steuerliche Behandlung
// geprüft ist (TAX_CHECKED_MARKETS). Reverse-Charge-Rechnungen an Unternehmen
// im EU-Ausland brauchen die eigene USt-IdNr. (§ 14a Abs. 1 UStG) — solange sie
// fehlt, bleibt es bei Deutschland. Stripe Checkout kann das Land der
// Rechnungsadresse nicht sperren; deshalb steht der Hinweis über dem
// Bezahlknopf, und `stripe-webhook` markiert abweichende Käufe zur manuellen
// Prüfung (reviewCheckoutTax). Nichts wird automatisch storniert oder erstattet.

import {
  PRICING_TAX_MODE,
  PRICING_TAX_NOTE_EXEMPT,
  PRICING_TAX_NOTE_STANDARD,
  type PricingTaxMode,
} from './pricing.generated.ts';

/** Länder (ISO 3166-1 alpha-2), in die Self-Service-Checkout verkaufen darf. */
export const TAX_CHECKED_MARKETS: readonly string[] = ['DE'];

const MARKET_NAMES: Record<string, string> = { DE: 'Deutschland' };

/** Kundenkreis bei Regelbesteuerung — Wortlaut wie AGB § 1 Abs. 2. */
const B2B_NOTICE = 'Angebot ausschließlich für Unternehmer i. S. d. § 14 BGB.';

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
  return taxMode === 'EXEMPT'
    ? `${markt} ${PRICING_TAX_NOTE_EXEMPT}`
    : `${B2B_NOTICE} ${PRICING_TAX_NOTE_STANDARD} ${markt}`;
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
 *   ohne `customer` ab; mit Customer landen Name und Rechnungsadresse aus dem
 *   Checkout auf der Rechnung (Pflichtangabe, § 14 Abs. 4 Nr. 1 UStG).
 * - `invoice_creation` nur im Modus `payment`: Ohne sie gibt es bei
 *   Einmalkäufen nur eine Quittung, keine Rechnung. Abo-Rechnungen erzeugt
 *   Stripe selbst.
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
  | 'TAX_MISSING_IN_STANDARD_MODE'
  | 'TAX_CHARGED_IN_EXEMPT_MODE';

/** Bei Regelbesteuerung muss auf jeden bezahlten DE-Umsatz USt entfallen. */
function taxMissing(
  taxMode: PricingTaxMode,
  country: string | null | undefined,
  totalCents: number | null | undefined,
  taxCents: number | null | undefined,
): boolean {
  return taxMode === 'EU_STANDARD'
    && country?.trim().toUpperCase() === 'DE'
    && (totalCents ?? 0) > 0
    && (taxCents ?? 0) <= 0;
}

/** Prüfung eines abgeschlossenen Checkouts. Leeres Ergebnis = nichts zu tun. */
export function reviewCheckoutTax(input: {
  taxMode?: PricingTaxMode;
  billingCountry: string | null | undefined;
  amountTotalCents: number | null | undefined;
  taxAmountCents: number | null | undefined;
}): CheckoutTaxFinding[] {
  const taxMode = input.taxMode ?? PRICING_TAX_MODE;
  const findings: CheckoutTaxFinding[] = [];
  if (!input.billingCountry?.trim()) findings.push('BILLING_COUNTRY_MISSING');
  else if (!isTaxCheckedMarket(input.billingCountry)) findings.push('MARKET_NOT_TAX_CHECKED');
  if (taxMissing(taxMode, input.billingCountry, input.amountTotalCents, input.taxAmountCents)) {
    findings.push('TAX_MISSING_IN_STANDARD_MODE');
  }
  if (taxMode === 'EXEMPT' && (input.taxAmountCents ?? 0) > 0) findings.push('TAX_CHARGED_IN_EXEMPT_MODE');
  return findings;
}

export type InvoiceTaxFinding =
  | 'TAX_MISSING_IN_STANDARD_MODE'
  | 'EXEMPT_NOTE_IN_STANDARD_MODE'
  | 'TAX_CHARGED_IN_EXEMPT_MODE'
  | 'EXEMPT_NOTE_MISSING';

/** Prüfung einer finalisierten Rechnung. Leeres Ergebnis = in Ordnung. */
export function reviewInvoiceTax(input: {
  taxMode?: PricingTaxMode;
  customerCountry: string | null | undefined;
  totalCents: number | null | undefined;
  taxAmountCents: number | null | undefined;
  footer: string | null | undefined;
}): InvoiceTaxFinding[] {
  const taxMode = input.taxMode ?? PRICING_TAX_MODE;
  const findings: InvoiceTaxFinding[] = [];
  const hasExemptNote = Boolean(input.footer?.includes(PRICING_TAX_NOTE_EXEMPT));
  if (taxMode === 'EU_STANDARD') {
    if (taxMissing(taxMode, input.customerCountry, input.totalCents, input.taxAmountCents)) {
      findings.push('TAX_MISSING_IN_STANDARD_MODE');
    }
    if (hasExemptNote) findings.push('EXEMPT_NOTE_IN_STANDARD_MODE');
    return findings;
  }
  if ((input.taxAmountCents ?? 0) > 0) findings.push('TAX_CHARGED_IN_EXEMPT_MODE');
  if (!hasExemptNote) findings.push('EXEMPT_NOTE_MISSING');
  return findings;
}
