/**
 * Admin Conversion panel — field contract locked with RSD Stripe Checkout stub.
 * Display + redirect only; no payment capture.
 */

export type ConversionRecheckoutMode = 'portal' | 'new_checkout';

/** Subscription row as shown in the Admin Status table. */
export interface ConversionSubscriptionRow {
  subscription_id: string;
  status: string;
  plan_key: string | null;
  cancel_reason: string | null;
  current_period_end: string | null;
  customer_id: string | null;
  customer_email: string | null;
  tenant_id: string | null;
  unit_amount_cents: number | null;
  currency: string | null;
  latest_invoice_id: string | null;
  latest_invoice_status: string | null;
  /** Derived CTA: portal when customer_id exists & not incomplete_expired; else new_checkout. */
  recheckout: ConversionRecheckoutMode;
}

/** Open / failed-payment invoice row. */
export interface ConversionOpenInvoiceRow {
  invoice_id: string;
  status: string;
  amount_due_cents: number;
  amount_due_eur: number;
  attempt_count: number;
  currency: string;
  customer_id: string | null;
  customer_email: string | null;
  plan_key: string | null;
  subscription_id: string | null;
  tenant_id: string | null;
}

export interface ConversionBillingSnapshot {
  source: 'live' | 'fixture' | 'hybrid';
  generated_at: string;
  mrr_eur: number;
  active_subscriptions: number;
  open_invoices_count: number;
  open_invoices_amount_eur: number;
  subscriptions_by_status: Record<string, number>;
  /** Highlighted conversion statuses only. */
  status_rows: ConversionSubscriptionRow[];
  open_invoices: ConversionOpenInvoiceRow[];
}

/** Statuses / reasons that belong on the Conversion Status table. */
export function isConversionStatusHighlight(row: {
  status: string;
  cancel_reason?: string | null;
}): boolean {
  const status = row.status.toLowerCase();
  if (status === 'incomplete' || status === 'incomplete_expired' || status === 'past_due') {
    return true;
  }
  if (status === 'canceled' && row.cancel_reason === 'payment_failed') {
    return true;
  }
  return false;
}

export function resolveRecheckoutMode(row: {
  status: string;
  customer_id?: string | null;
}): ConversionRecheckoutMode {
  const status = row.status.toLowerCase();
  if (status === 'incomplete' || status === 'incomplete_expired') {
    return 'new_checkout';
  }
  if (row.customer_id) return 'portal';
  return 'new_checkout';
}

export function formatEurFromCents(cents: number | null | undefined, currency = 'eur'): string {
  if (cents == null || Number.isNaN(cents)) return '—';
  const amount = cents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase() === 'EUR' ? 'EUR' : currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

export function shortId(id: string | null | undefined, prefixLen = 12): string {
  if (!id) return '—';
  if (id.length <= prefixLen) return id;
  return `${id.slice(0, prefixLen)}…`;
}
