/**
 * Loads Admin Conversion billing data.
 *
 * Preferred live sources (per stub backend_mirror):
 *   - status: public.subscriptions (via admin_customers_list SECURITY DEFINER;
 *     direct SELECT is tenant-RLS gated for non-members)
 *   - open invoices: public.stripe_invoices (super_admin RLS)
 * Fallback: conversionFixture (Stripe stub shape / live verify cases)
 *
 * No payment capture — read + map only.
 */
import { getSupabase } from '../../../lib/supabase';
import { getConversionBillingFixture } from './conversionFixture';
import type {
  ConversionBillingSnapshot,
  ConversionOpenInvoiceRow,
  ConversionSubscriptionRow,
} from './conversionTypes';
import {
  isConversionStatusHighlight,
  resolveRecheckoutMode,
} from './conversionTypes';

interface AdminCustomerRow {
  tenant_id: string;
  tenant_name: string;
  owner_email: string | null;
  plan_key: string | null;
  status: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  member_count: number;
}

interface StripeInvoiceRow {
  stripe_invoice_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tenant_id: string | null;
  amount_due_cents: number;
  currency: string;
  status: string;
  attempt_count: number;
  raw: Record<string, unknown> | null;
}

interface SubscriptionMirrorRow {
  tenant_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_key: string | null;
  status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  unit_amount_cents: number | null;
  currency: string | null;
  past_due_since: string | null;
  canceled_at: string | null;
}

function inferCancelReason(
  status: string | null,
  openInvoiceForSub: boolean,
  pastDueSince: string | null,
): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'canceled' && openInvoiceForSub) return 'payment_failed';
  if (s === 'past_due' || pastDueSince) return 'payment_failed';
  return null;
}

function buildStatusRows(args: {
  customers: AdminCustomerRow[];
  subscriptions: SubscriptionMirrorRow[];
  openInvoices: StripeInvoiceRow[];
}): ConversionSubscriptionRow[] {
  const openSubIds = new Set(
    args.openInvoices
      .map((i) => i.stripe_subscription_id)
      .filter((id): id is string => !!id),
  );
  const openByCustomer = new Map(
    args.openInvoices
      .filter((i) => i.stripe_customer_id)
      .map((i) => [i.stripe_customer_id as string, i]),
  );

  const bySubId = new Map<string, ConversionSubscriptionRow>();

  // Prefer richer subscription mirror when RLS allows (member tenants).
  for (const s of args.subscriptions) {
    if (!s.stripe_subscription_id || !s.status) continue;
    const openInv =
      (s.stripe_subscription_id && openSubIds.has(s.stripe_subscription_id)
        ? args.openInvoices.find((i) => i.stripe_subscription_id === s.stripe_subscription_id)
        : null)
      ?? (s.stripe_customer_id ? openByCustomer.get(s.stripe_customer_id) ?? null : null);
    const cancel_reason = inferCancelReason(
      s.status,
      !!openInv || (s.stripe_subscription_id ? openSubIds.has(s.stripe_subscription_id) : false),
      s.past_due_since,
    );
    const row: ConversionSubscriptionRow = {
      subscription_id: s.stripe_subscription_id,
      status: s.status,
      plan_key: s.plan_key,
      cancel_reason,
      current_period_end: s.current_period_end,
      customer_id: s.stripe_customer_id,
      customer_email: null,
      tenant_id: s.tenant_id,
      unit_amount_cents: s.unit_amount_cents,
      currency: s.currency ?? 'eur',
      latest_invoice_id: openInv?.stripe_invoice_id ?? null,
      latest_invoice_status: openInv?.status ?? null,
      recheckout: resolveRecheckoutMode({
        status: s.status,
        customer_id: s.stripe_customer_id,
      }),
    };
    if (isConversionStatusHighlight(row)) {
      bySubId.set(row.subscription_id, row);
    }
  }

  // Fill / enrich from admin_customers_list (platform-wide via SECURITY DEFINER).
  for (const c of args.customers) {
    if (!c.stripe_subscription_id || !c.status) continue;
    const existing = bySubId.get(c.stripe_subscription_id);
    const openInv =
      args.openInvoices.find((i) => i.stripe_subscription_id === c.stripe_subscription_id)
      ?? (c.stripe_customer_id ? openByCustomer.get(c.stripe_customer_id) ?? null : null);
    const cancel_reason = existing?.cancel_reason
      ?? inferCancelReason(
        c.status,
        !!openInv || openSubIds.has(c.stripe_subscription_id),
        null,
      );
    const row: ConversionSubscriptionRow = {
      subscription_id: c.stripe_subscription_id,
      status: c.status,
      plan_key: existing?.plan_key ?? c.plan_key,
      cancel_reason,
      current_period_end: existing?.current_period_end ?? c.current_period_end,
      customer_id: existing?.customer_id ?? c.stripe_customer_id,
      customer_email: c.owner_email,
      tenant_id: existing?.tenant_id ?? c.tenant_id,
      unit_amount_cents: existing?.unit_amount_cents ?? null,
      currency: existing?.currency ?? 'eur',
      latest_invoice_id: existing?.latest_invoice_id ?? openInv?.stripe_invoice_id ?? null,
      latest_invoice_status: existing?.latest_invoice_status ?? openInv?.status ?? null,
      recheckout: resolveRecheckoutMode({
        status: c.status,
        customer_id: c.stripe_customer_id,
      }),
    };
    if (isConversionStatusHighlight(row)) {
      bySubId.set(row.subscription_id, row);
    }
  }

  return Array.from(bySubId.values());
}

function mapOpenInvoices(
  invoices: StripeInvoiceRow[],
  customers: AdminCustomerRow[],
  statusRows: ConversionSubscriptionRow[],
): ConversionOpenInvoiceRow[] {
  const customerByTenant = new Map(customers.map((c) => [c.tenant_id, c]));
  const customerByCus = new Map(
    customers.filter((c) => c.stripe_customer_id).map((c) => [c.stripe_customer_id as string, c]),
  );
  const subById = new Map(statusRows.map((s) => [s.subscription_id, s]));

  return invoices.map((inv) => {
    const cust =
      (inv.tenant_id ? customerByTenant.get(inv.tenant_id) : undefined)
      ?? (inv.stripe_customer_id ? customerByCus.get(inv.stripe_customer_id) : undefined);
    const sub = inv.stripe_subscription_id
      ? subById.get(inv.stripe_subscription_id)
      : undefined;
    const cents = inv.amount_due_cents ?? 0;
    return {
      invoice_id: inv.stripe_invoice_id,
      status: inv.status,
      amount_due_cents: cents,
      amount_due_eur: cents / 100,
      attempt_count: inv.attempt_count ?? 0,
      currency: inv.currency || 'eur',
      customer_id: inv.stripe_customer_id,
      customer_email: sub?.customer_email ?? cust?.owner_email ?? null,
      plan_key: sub?.plan_key ?? cust?.plan_key ?? null,
      subscription_id: inv.stripe_subscription_id,
      tenant_id: inv.tenant_id ?? cust?.tenant_id ?? sub?.tenant_id ?? null,
    };
  });
}

function countByStatus(rows: ConversionSubscriptionRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.status] = (out[r.status] ?? 0) + 1;
  }
  return out;
}

/**
 * Merge live rows with fixture rows keyed by subscription_id / invoice_id.
 * Live wins; fixture fills missing verify cases (Growth 249 €).
 */
export function mergeWithFixture(
  live: ConversionBillingSnapshot,
  fixture = getConversionBillingFixture(),
): ConversionBillingSnapshot {
  const subMap = new Map(fixture.status_rows.map((r) => [r.subscription_id, r]));
  for (const r of live.status_rows) subMap.set(r.subscription_id, r);

  const invMap = new Map(fixture.open_invoices.map((r) => [r.invoice_id, r]));
  for (const r of live.open_invoices) invMap.set(r.invoice_id, r);

  const status_rows = Array.from(subMap.values()).filter(isConversionStatusHighlight);
  const open_invoices = Array.from(invMap.values()).filter(
    (i) => i.status === 'open' || i.attempt_count > 0,
  );

  const hasLive = live.status_rows.length > 0 || live.open_invoices.length > 0;
  const usedFixtureOnly = !hasLive;

  return {
    source: usedFixtureOnly ? 'fixture' : (live.source === 'live' ? 'hybrid' : live.source),
    generated_at: live.generated_at || fixture.generated_at,
    mrr_eur: live.mrr_eur,
    active_subscriptions: live.active_subscriptions,
    open_invoices_count: open_invoices.length,
    open_invoices_amount_eur: open_invoices.reduce((s, i) => s + i.amount_due_eur, 0),
    subscriptions_by_status: countByStatus(status_rows),
    status_rows,
    open_invoices,
  };
}

export async function loadConversionBilling(opts?: {
  /** When true, always include fixture rows for missing IDs (default true for ops verify). */
  includeFixtureFallback?: boolean;
}): Promise<ConversionBillingSnapshot> {
  const includeFixtureFallback = opts?.includeFixtureFallback !== false;
  const sb = getSupabase();
  const generated_at = new Date().toISOString();

  const [customersRes, invoicesRes, subsRes] = await Promise.all([
    sb.rpc('admin_customers_list'),
    sb
      .from('stripe_invoices')
      .select(
        'stripe_invoice_id, stripe_customer_id, stripe_subscription_id, tenant_id, amount_due_cents, currency, status, attempt_count, raw',
      )
      .eq('status', 'open')
      .order('attempt_count', { ascending: false })
      .limit(100),
    // Best-effort: tenant RLS — returns rows only for tenants the viewer belongs to.
    sb
      .from('subscriptions')
      .select(
        'tenant_id, stripe_customer_id, stripe_subscription_id, plan_key, status, cancel_at_period_end, current_period_end, unit_amount_cents, currency, past_due_since, canceled_at',
      )
      .in('status', ['canceled', 'incomplete', 'incomplete_expired', 'past_due'])
      .limit(200),
  ]);

  if (customersRes.error) {
    // Without platform customer list we still try invoices; hard-fail only if both empty later.
    console.warn('[conversion-billing] admin_customers_list:', customersRes.error.message);
  }
  if (invoicesRes.error) {
    console.warn('[conversion-billing] stripe_invoices:', invoicesRes.error.message);
  }
  // subscriptions may fail under RLS for non-member — ignore quietly
  if (subsRes.error) {
    console.warn('[conversion-billing] subscriptions (tenant RLS):', subsRes.error.message);
  }

  const customers = (customersRes.data ?? []) as AdminCustomerRow[];
  const invoices = (invoicesRes.data ?? []) as StripeInvoiceRow[];
  const subscriptions = (subsRes.data ?? []) as SubscriptionMirrorRow[];

  const status_rows = buildStatusRows({ customers, subscriptions, openInvoices: invoices });
  const open_invoices = mapOpenInvoices(invoices, customers, status_rows);

  // Also surface canceled+payment_failed inferred from open invoices even if
  // customer list status is already covered — ensure invoice panel has plan_key.
  const activeCount = customers.filter((c) => c.status === 'active' || c.status === 'trialing' || c.status === 'past_due').length;

  const live: ConversionBillingSnapshot = {
    source: 'live',
    generated_at,
    mrr_eur: 0,
    active_subscriptions: activeCount,
    open_invoices_count: open_invoices.length,
    open_invoices_amount_eur: open_invoices.reduce((s, i) => s + i.amount_due_eur, 0),
    subscriptions_by_status: countByStatus(status_rows),
    status_rows,
    open_invoices,
  };

  if (!includeFixtureFallback) return live;

  // If live sources returned nothing (empty env / no mirror yet), show fixture
  // so the Conversion panel remains verifiable with the Growth 249 € case.
  // Do NOT merge fixture into non-empty live data — production must not show
  // synthetic Stripe stub rows alongside real subscriptions/invoices.
  if (live.status_rows.length === 0 && live.open_invoices.length === 0) {
    return { ...getConversionBillingFixture(), generated_at };
  }

  return live;
}
