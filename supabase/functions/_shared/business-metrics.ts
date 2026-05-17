// Pure business-metrics aggregation functions (Deno copy).
//
// MUST stay logically identical to src/lib/business/metrics.ts. A contract
// test (test/business/metricsSync.test.ts) enforces this. Only the header
// comment differs between the two files.
//
// Inputs are plain data shapes (no Supabase client, no Stripe SDK). Both the
// scheduled Edge Function (`business-metrics-cron`) and the test suite call
// these — keeping the math deterministic and replayable.
//
// All monetary values are integer cents to avoid floating-point drift.

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface SubscriptionRecord {
  tenant_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  plan_key: string | null;
  status: SubscriptionStatus | string;
  quantity: number | null;
  unit_amount_cents: number | null;
  currency: string | null;
  billing_interval: BillingInterval | string | null;
  trial_start: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export interface PaymentEventRecord {
  stripe_event_id: string;
  event_type: string;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  status: 'succeeded' | 'failed' | 'pending' | string;
  amount_cents: number;
  currency: string;
  failure_code: string | null;
  failure_message: string | null;
  occurred_at: string;
}

export interface InvoiceRecord {
  stripe_invoice_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  amount_paid_cents: number;
  amount_due_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface PlanDistributionEntry {
  plan_key: string;
  customers: number;
  mrr_cents: number;
}

export interface RecentPaymentEntry {
  stripe_invoice_id: string;
  stripe_customer_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
}

export interface RecentFailedPaymentEntry {
  stripe_event_id: string;
  stripe_customer_id: string | null;
  amount_cents: number;
  currency: string;
  failure_code: string | null;
  failure_message: string | null;
  occurred_at: string;
}

export interface BusinessMetricsSnapshot {
  mrr_cents: number;
  arr_cents: number;
  active_customers: number;
  active_subscriptions: number;
  churned_subscriptions_30d: number;
  trial_users: number;
  failed_payments_30d: number;
  net_new_mrr_cents_30d: number;
  plan_distribution: PlanDistributionEntry[];
  recent_payments: RecentPaymentEntry[];
  recent_failed_payments: RecentFailedPaymentEntry[];
}

const ACTIVE_STATES = new Set(['active', 'trialing', 'past_due']);

// Normalize any recurring-interval price into monthly cents.
// year → /12, week → *(52/12), day → *(365/12). Anything else → 0.
export function monthlyAmountCents(
  unitAmountCents: number | null,
  interval: string | null,
  quantity: number | null,
): number {
  if (!unitAmountCents || unitAmountCents <= 0) return 0;
  const qty = Math.max(1, quantity ?? 1);
  const gross = unitAmountCents * qty;
  switch ((interval ?? 'month').toLowerCase()) {
    case 'month': return gross;
    case 'year':  return Math.round(gross / 12);
    case 'week':  return Math.round(gross * (52 / 12));
    case 'day':   return Math.round(gross * (365 / 12));
    default:      return 0;
  }
}

// MRR counts only subs that are actively billing today. Trials are excluded
// because no money is moving yet; `trialing` shows up in `trial_users`.
export function computeMRRCents(subs: readonly SubscriptionRecord[], nowMs = Date.now()): number {
  let total = 0;
  for (const s of subs) {
    if (s.status !== 'active' && s.status !== 'past_due') continue;
    if (s.canceled_at && Date.parse(s.canceled_at) <= nowMs) continue;
    total += monthlyAmountCents(s.unit_amount_cents, s.billing_interval, s.quantity);
  }
  return total;
}

export function computeARRCents(mrrCents: number): number {
  return mrrCents * 12;
}

export function countActiveSubscriptions(subs: readonly SubscriptionRecord[]): number {
  return subs.filter((s) => ACTIVE_STATES.has(s.status)).length;
}

export function countActiveCustomers(subs: readonly SubscriptionRecord[]): number {
  const seen = new Set<string>();
  for (const s of subs) {
    if (!ACTIVE_STATES.has(s.status)) continue;
    const key = s.stripe_customer_id ?? s.tenant_id;
    if (key) seen.add(key);
  }
  return seen.size;
}

export function countTrialUsers(subs: readonly SubscriptionRecord[], nowMs = Date.now()): number {
  return subs.filter((s) => {
    if (s.status !== 'trialing') return false;
    if (!s.trial_end) return true;
    return Date.parse(s.trial_end) > nowMs;
  }).length;
}

export function countChurned30d(subs: readonly SubscriptionRecord[], nowMs = Date.now()): number {
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
  return subs.filter((s) => {
    if (!s.canceled_at) return false;
    const t = Date.parse(s.canceled_at);
    return Number.isFinite(t) && t >= cutoff && t <= nowMs;
  }).length;
}

export function countFailedPayments30d(events: readonly PaymentEventRecord[], nowMs = Date.now()): number {
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    if (e.status !== 'failed') return false;
    const t = Date.parse(e.occurred_at);
    return Number.isFinite(t) && t >= cutoff && t <= nowMs;
  }).length;
}

export function planDistribution(subs: readonly SubscriptionRecord[]): PlanDistributionEntry[] {
  const buckets = new Map<string, { customers: Set<string>; mrr: number }>();
  for (const s of subs) {
    if (!ACTIVE_STATES.has(s.status)) continue;
    const key = s.plan_key ?? 'unknown';
    const bucket = buckets.get(key) ?? { customers: new Set<string>(), mrr: 0 };
    const cid = s.stripe_customer_id ?? s.tenant_id;
    if (cid) bucket.customers.add(cid);
    bucket.mrr += monthlyAmountCents(s.unit_amount_cents, s.billing_interval, s.quantity);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([plan_key, v]) => ({ plan_key, customers: v.customers.size, mrr_cents: v.mrr }))
    .sort((a, b) => b.mrr_cents - a.mrr_cents);
}

// Net new MRR = (MRR added in last 30 days) − (MRR lost via cancels in last 30 days)
// "Added" = subs whose started_at or trial_end (conversion proxy) is within 30 days.
// Computed off the subscription records we have now — for retroactive accuracy
// we'd need a billing_event ledger; this is the operational approximation.
export function netNewMRRCents30d(subs: readonly SubscriptionRecord[], nowMs = Date.now()): number {
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
  let added = 0;
  let lost = 0;
  for (const s of subs) {
    const mrr = monthlyAmountCents(s.unit_amount_cents, s.billing_interval, s.quantity);
    if (s.canceled_at) {
      const t = Date.parse(s.canceled_at);
      if (Number.isFinite(t) && t >= cutoff && t <= nowMs) lost += mrr;
    }
    if (ACTIVE_STATES.has(s.status) && s.current_period_end) {
      // Best-effort "added" detection: a sub is treated as newly added if its
      // trial_end is within 30 days (the trial-→-paid transition) or, when no
      // trial info exists, fall through silently.
      const ref = s.trial_end ? Date.parse(s.trial_end) : NaN;
      if (Number.isFinite(ref) && ref >= cutoff && ref <= nowMs) added += mrr;
    }
  }
  return added - lost;
}

export function recentPayments(
  invoices: readonly InvoiceRecord[],
  limit = 10,
): RecentPaymentEntry[] {
  return [...invoices]
    .filter((i) => i.status === 'paid' && i.paid_at)
    .sort((a, b) => Date.parse(b.paid_at!) - Date.parse(a.paid_at!))
    .slice(0, limit)
    .map((i) => ({
      stripe_invoice_id: i.stripe_invoice_id,
      stripe_customer_id: i.stripe_customer_id,
      amount_cents: i.amount_paid_cents,
      currency: i.currency,
      status: i.status,
      paid_at: i.paid_at,
    }));
}

export function recentFailedPayments(
  events: readonly PaymentEventRecord[],
  limit = 10,
): RecentFailedPaymentEntry[] {
  return [...events]
    .filter((e) => e.status === 'failed')
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, limit)
    .map((e) => ({
      stripe_event_id: e.stripe_event_id,
      stripe_customer_id: e.stripe_customer_id,
      amount_cents: e.amount_cents,
      currency: e.currency,
      failure_code: e.failure_code,
      failure_message: e.failure_message,
      occurred_at: e.occurred_at,
    }));
}

export interface AggregateInput {
  subscriptions: readonly SubscriptionRecord[];
  paymentEvents: readonly PaymentEventRecord[];
  invoices: readonly InvoiceRecord[];
  nowMs?: number;
}

export function aggregateBusinessMetrics(input: AggregateInput): BusinessMetricsSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const mrr = computeMRRCents(input.subscriptions, nowMs);
  return {
    mrr_cents: mrr,
    arr_cents: computeARRCents(mrr),
    active_customers: countActiveCustomers(input.subscriptions),
    active_subscriptions: countActiveSubscriptions(input.subscriptions),
    churned_subscriptions_30d: countChurned30d(input.subscriptions, nowMs),
    trial_users: countTrialUsers(input.subscriptions, nowMs),
    failed_payments_30d: countFailedPayments30d(input.paymentEvents, nowMs),
    net_new_mrr_cents_30d: netNewMRRCents30d(input.subscriptions, nowMs),
    plan_distribution: planDistribution(input.subscriptions),
    recent_payments: recentPayments(input.invoices),
    recent_failed_payments: recentFailedPayments(input.paymentEvents),
  };
}

export function centsToEurString(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
