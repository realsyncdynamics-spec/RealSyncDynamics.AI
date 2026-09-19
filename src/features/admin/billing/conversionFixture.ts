/**
 * Live Stripe billing stub (GET /admin/dashboard/billing) — UI contract + verify fixture.
 * Includes Growth payment_failed / open invoice 249 € (attempt_count 9) and
 * Starter incomplete_expired cases from 2026-09-18 ops snapshot.
 */
import type {
  ConversionBillingSnapshot,
  ConversionOpenInvoiceRow,
  ConversionSubscriptionRow,
} from './conversionTypes';
import { resolveRecheckoutMode } from './conversionTypes';

const FIXTURE_SUBSCRIPTIONS: ConversionSubscriptionRow[] = [
  {
    subscription_id: 'sub_1U3LOTREjTWueUcGrNHicChk',
    status: 'canceled',
    plan_key: 'growth',
    cancel_reason: 'payment_failed',
    current_period_end: '2026-09-25T19:31:25+00:00',
    customer_id: 'cus_V3SHNuAwzBoamd',
    customer_email: 'steinerdominik1982@gmail.com',
    tenant_id: 'be672b50-c4fa-430c-b3f4-a3600bdbd655',
    unit_amount_cents: 24900,
    currency: 'eur',
    latest_invoice_id: 'in_1U8Q4jREjTWueUcGKOrcIq2n',
    latest_invoice_status: 'open',
    recheckout: 'portal',
  },
  {
    subscription_id: 'sub_1U3LAvREjTWueUcGkDHIAWpx',
    status: 'incomplete_expired',
    plan_key: 'starter',
    cancel_reason: null,
    current_period_end: '2026-09-11T19:17:25+00:00',
    customer_id: 'cus_V3S4b9TurNBHmJ',
    customer_email: 'steinerdominik1982@gmail.com',
    tenant_id: 'be672b50-c4fa-430c-b3f4-a3600bdbd655',
    unit_amount_cents: 7900,
    currency: 'eur',
    latest_invoice_id: 'in_1U3LAvREjTWueUcGtKV8ZwyL',
    latest_invoice_status: 'void',
    recheckout: 'new_checkout',
  },
];

const FIXTURE_OPEN_INVOICES: ConversionOpenInvoiceRow[] = [
  {
    invoice_id: 'in_1U8Q4jREjTWueUcGKOrcIq2n',
    status: 'open',
    amount_due_cents: 24900,
    amount_due_eur: 249.0,
    attempt_count: 9,
    currency: 'eur',
    customer_id: 'cus_V3SHNuAwzBoamd',
    customer_email: 'steinerdominik1982@gmail.com',
    plan_key: 'growth',
    subscription_id: 'sub_1U3LOTREjTWueUcGrNHicChk',
    tenant_id: 'be672b50-c4fa-430c-b3f4-a3600bdbd655',
  },
];

/** Canonical live fixture for UI verify (Growth 249 € payment_failed). */
export function getConversionBillingFixture(): ConversionBillingSnapshot {
  const status_rows = FIXTURE_SUBSCRIPTIONS.map((row) => ({
    ...row,
    recheckout: resolveRecheckoutMode(row),
  }));

  return {
    source: 'fixture',
    generated_at: '2026-09-18T12:10:20.881808+00:00',
    mrr_eur: 0,
    active_subscriptions: 0,
    open_invoices_count: FIXTURE_OPEN_INVOICES.length,
    open_invoices_amount_eur: FIXTURE_OPEN_INVOICES.reduce((s, i) => s + i.amount_due_eur, 0),
    subscriptions_by_status: {
      canceled: 1,
      incomplete_expired: 1,
    },
    status_rows,
    open_invoices: FIXTURE_OPEN_INVOICES,
  };
}
