// Scheduled business-metrics aggregator.
//
// Cron triggers this every 15 min (see migration 20260525000010). It reads
// subscriptions + stripe_invoices + stripe_payment_events from Supabase and
// writes one row into business_metric_snapshots.
//
// Auth: requires Bearer secret matching `business_metrics_shared_secret` from
// the Vault, OR (for local dev) BUSINESS_METRICS_SHARED_SECRET env var.
// Stripe is NOT called here — the webhook does the ingestion.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  aggregateBusinessMetrics,
  monthlyAmountCents,
  type InvoiceRecord,
  type PaymentEventRecord,
  type SubscriptionRecord,
} from '../_shared/business-metrics.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getSharedSecret(admin: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await admin.rpc('get_app_secret', { secret_name: 'business_metrics_shared_secret' });
    if (typeof data === 'string' && data.length > 0) return data;
  } catch { /* vault missing */ }
  return Deno.env.get('BUSINESS_METRICS_SHARED_SECRET') ?? null;
}

Deno.serve(async (req) => {
  const t0 = Date.now();

  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const shared = await getSharedSecret(admin);
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!shared || !provided || provided !== shared) {
    return new Response('unauthorized', { status: 401 });
  }

  try {
    const [subs, invoices, events] = await Promise.all([
      fetchSubscriptions(admin),
      fetchRecentInvoices(admin),
      fetchRecentPaymentEvents(admin),
    ]);

    const snapshot = aggregateBusinessMetrics({
      subscriptions: subs,
      paymentEvents: events,
      invoices,
    });

    const { error: insertErr } = await admin
      .from('business_metric_snapshots')
      .insert({
        captured_at: new Date().toISOString(),
        mrr_cents: snapshot.mrr_cents,
        arr_cents: snapshot.arr_cents,
        active_customers: snapshot.active_customers,
        active_subscriptions: snapshot.active_subscriptions,
        churned_subscriptions_30d: snapshot.churned_subscriptions_30d,
        trial_users: snapshot.trial_users,
        failed_payments_30d: snapshot.failed_payments_30d,
        net_new_mrr_cents_30d: snapshot.net_new_mrr_cents_30d,
        plan_distribution: snapshot.plan_distribution,
        recent_payments: snapshot.recent_payments,
        recent_failed_payments: snapshot.recent_failed_payments,
        metadata: {
          subs_total: subs.length,
          invoices_total: invoices.length,
          events_total: events.length,
        },
        duration_ms: Date.now() - t0,
      });

    if (insertErr) throw insertErr;

    await rollupDailyRevenue(admin, subs, invoices, events);

    // Best-effort retention. Don't fail the run if it errors.
    await admin.rpc('prune_business_metric_snapshots').catch((e: unknown) => {
      console.warn('[business-metrics-cron] prune failed:', (e as Error).message);
    });

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot: {
          mrr_cents: snapshot.mrr_cents,
          arr_cents: snapshot.arr_cents,
          active_customers: snapshot.active_customers,
          duration_ms: Date.now() - t0,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    console.error('[business-metrics-cron] failed:', err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
});

async function fetchSubscriptions(admin: SupabaseClient): Promise<SubscriptionRecord[]> {
  const { data, error } = await admin
    .from('subscriptions')
    .select(
      'tenant_id, stripe_customer_id, stripe_subscription_id, plan_key, status, quantity, ' +
      'unit_amount_cents, currency, billing_interval, trial_start, trial_end, canceled_at, ' +
      'current_period_end, cancel_at_period_end',
    );
  if (error) throw new Error(`subscriptions fetch: ${error.message}`);
  return (data ?? []) as SubscriptionRecord[];
}

async function fetchRecentInvoices(admin: SupabaseClient): Promise<InvoiceRecord[]> {
  // 90-day window is enough for "recent payments" + monthly trends.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('stripe_invoices')
    .select('stripe_invoice_id, stripe_customer_id, stripe_subscription_id, amount_paid_cents, amount_due_cents, currency, status, paid_at, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(`invoices fetch: ${error.message}`);
  return (data ?? []) as InvoiceRecord[];
}

async function fetchRecentPaymentEvents(admin: SupabaseClient): Promise<PaymentEventRecord[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('stripe_payment_events')
    .select('stripe_event_id, event_type, stripe_customer_id, stripe_invoice_id, status, amount_cents, currency, failure_code, failure_message, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(`payment events fetch: ${error.message}`);
  return (data ?? []) as PaymentEventRecord[];
}

// Idempotent upsert per (day, currency). MRR snapshot uses today's value (so
// the latest row each day is "today's MRR at close"); invoice/event sums are
// computed from records dated within the day.
async function rollupDailyRevenue(
  admin: SupabaseClient,
  subs: SubscriptionRecord[],
  invoices: InvoiceRecord[],
  events: PaymentEventRecord[],
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const startMs = Date.parse(`${day}T00:00:00Z`);
  const endMs = startMs + 24 * 60 * 60 * 1000;

  // Group by currency to handle non-EUR future expansion cleanly.
  const currencies = new Set<string>(['eur']);
  for (const i of invoices) if (i.currency) currencies.add(i.currency.toLowerCase());
  for (const s of subs) if (s.currency) currencies.add(s.currency.toLowerCase());

  for (const currency of currencies) {
    let mrr = 0;
    for (const s of subs) {
      const sc = (s.currency ?? 'eur').toLowerCase();
      if (sc !== currency) continue;
      if (s.status !== 'active' && s.status !== 'past_due') continue;
      mrr += monthlyAmountCents(s.unit_amount_cents, s.billing_interval, s.quantity);
    }

    const paid = invoices
      .filter((i) => (i.currency ?? 'eur').toLowerCase() === currency
        && i.paid_at && Date.parse(i.paid_at) >= startMs && Date.parse(i.paid_at) < endMs)
      .reduce((sum, i) => sum + i.amount_paid_cents, 0);

    const failed = events
      .filter((e) => (e.currency ?? 'eur').toLowerCase() === currency
        && e.status === 'failed'
        && Date.parse(e.occurred_at) >= startMs && Date.parse(e.occurred_at) < endMs)
      .reduce((sum, e) => sum + e.amount_cents, 0);

    const newSubs = subs.filter((s) => {
      if (!s.trial_end) return false;
      const t = Date.parse(s.trial_end);
      return Number.isFinite(t) && t >= startMs && t < endMs && (s.status === 'active' || s.status === 'past_due');
    }).length;

    const churned = subs.filter((s) => {
      if (!s.canceled_at) return false;
      const t = Date.parse(s.canceled_at);
      return Number.isFinite(t) && t >= startMs && t < endMs;
    }).length;

    const { error } = await admin
      .from('business_revenue_timeseries')
      .upsert({
        day,
        currency,
        mrr_cents: mrr,
        paid_invoice_cents: paid,
        failed_invoice_cents: failed,
        new_subscriptions: newSubs,
        churned_subscriptions: churned,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'day,currency' });

    if (error) {
      console.error('[business-metrics-cron] daily rollup failed:', error.message);
    }
  }
}
