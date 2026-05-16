import { describe, it, expect } from 'vitest';
import {
  aggregateBusinessMetrics,
  computeARRCents,
  computeMRRCents,
  countActiveCustomers,
  countActiveSubscriptions,
  countChurned30d,
  countFailedPayments30d,
  countTrialUsers,
  monthlyAmountCents,
  netNewMRRCents30d,
  planDistribution,
  recentFailedPayments,
  recentPayments,
  type InvoiceRecord,
  type PaymentEventRecord,
  type SubscriptionRecord,
} from '../../src/lib/business/metrics';

const NOW = Date.UTC(2026, 4, 16, 12, 0, 0); // 2026-05-16T12:00:00Z
const DAY = 24 * 60 * 60 * 1000;

function sub(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  return {
    tenant_id: 't1',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    plan_key: 'starter',
    status: 'active',
    quantity: 1,
    unit_amount_cents: 7900,
    currency: 'eur',
    billing_interval: 'month',
    trial_start: null,
    trial_end: null,
    canceled_at: null,
    current_period_end: new Date(NOW + 20 * DAY).toISOString(),
    cancel_at_period_end: false,
    ...overrides,
  };
}

describe('monthlyAmountCents', () => {
  it('passes monthly prices through', () => {
    expect(monthlyAmountCents(7900, 'month', 1)).toBe(7900);
  });
  it('divides yearly prices by 12', () => {
    expect(monthlyAmountCents(120_000, 'year', 1)).toBe(10_000);
  });
  it('weeklies into ~4.33×', () => {
    expect(monthlyAmountCents(1000, 'week', 1)).toBe(Math.round(1000 * (52 / 12)));
  });
  it('applies quantity', () => {
    expect(monthlyAmountCents(7900, 'month', 3)).toBe(23_700);
  });
  it('treats null / 0 / unknown interval as zero', () => {
    expect(monthlyAmountCents(null, 'month', 1)).toBe(0);
    expect(monthlyAmountCents(0, 'month', 1)).toBe(0);
    expect(monthlyAmountCents(7900, 'lifetime', 1)).toBe(0);
  });
  it('defaults missing quantity to 1', () => {
    expect(monthlyAmountCents(7900, 'month', null)).toBe(7900);
  });
});

describe('computeMRRCents', () => {
  it('sums only active + past_due', () => {
    const subs = [
      sub({ status: 'active', unit_amount_cents: 7900 }),
      sub({ stripe_subscription_id: 'sub_2', status: 'past_due', unit_amount_cents: 24_900 }),
      sub({ stripe_subscription_id: 'sub_3', status: 'trialing', unit_amount_cents: 9900 }),
      sub({ stripe_subscription_id: 'sub_4', status: 'canceled', unit_amount_cents: 9900 }),
    ];
    expect(computeMRRCents(subs, NOW)).toBe(7900 + 24_900);
  });
  it('excludes subs canceled in the past', () => {
    const subs = [
      sub({ status: 'active', canceled_at: new Date(NOW - DAY).toISOString() }),
    ];
    expect(computeMRRCents(subs, NOW)).toBe(0);
  });
  it('returns 0 on empty input', () => {
    expect(computeMRRCents([], NOW)).toBe(0);
  });
  it('mixes monthly and yearly into normalized monthly cents', () => {
    const subs = [
      sub({ status: 'active', unit_amount_cents: 7900, billing_interval: 'month' }),
      sub({
        stripe_subscription_id: 'sub_2',
        status: 'active',
        unit_amount_cents: 120_000,
        billing_interval: 'year',
      }),
    ];
    expect(computeMRRCents(subs, NOW)).toBe(7900 + 10_000);
  });
});

describe('computeARRCents', () => {
  it('= mrr × 12', () => {
    expect(computeARRCents(7900)).toBe(94_800);
    expect(computeARRCents(0)).toBe(0);
  });
});

describe('counters', () => {
  const subs: SubscriptionRecord[] = [
    sub({ status: 'active', stripe_customer_id: 'cus_a' }),
    sub({ stripe_subscription_id: 's2', status: 'active', stripe_customer_id: 'cus_a' }),
    sub({ stripe_subscription_id: 's3', status: 'trialing', stripe_customer_id: 'cus_b', trial_end: new Date(NOW + 5 * DAY).toISOString() }),
    sub({ stripe_subscription_id: 's4', status: 'canceled', stripe_customer_id: 'cus_c', canceled_at: new Date(NOW - 5 * DAY).toISOString() }),
    sub({ stripe_subscription_id: 's5', status: 'canceled', stripe_customer_id: 'cus_d', canceled_at: new Date(NOW - 40 * DAY).toISOString() }),
  ];

  it('active subscriptions count active+trialing+past_due', () => {
    expect(countActiveSubscriptions(subs)).toBe(3);
  });
  it('active customers de-duplicate by stripe_customer_id', () => {
    expect(countActiveCustomers(subs)).toBe(2); // cus_a (twice) + cus_b
  });
  it('trial users only count trialing within the window', () => {
    expect(countTrialUsers(subs, NOW)).toBe(1);
  });
  it('trial expired in the past does not count', () => {
    const expired = [sub({ status: 'trialing', trial_end: new Date(NOW - DAY).toISOString() })];
    expect(countTrialUsers(expired, NOW)).toBe(0);
  });
  it('churned 30d counts only cancels in the last 30 days', () => {
    expect(countChurned30d(subs, NOW)).toBe(1); // only s4 is within 30 days
  });
});

describe('countFailedPayments30d', () => {
  it('counts only failed events inside the 30d window', () => {
    const events: PaymentEventRecord[] = [
      {
        stripe_event_id: 'e1',
        event_type: 'invoice.payment_failed',
        stripe_customer_id: 'cus_a',
        stripe_invoice_id: 'inv_1',
        status: 'failed',
        amount_cents: 7900,
        currency: 'eur',
        failure_code: 'card_declined',
        failure_message: 'Your card was declined',
        occurred_at: new Date(NOW - 10 * DAY).toISOString(),
      },
      {
        stripe_event_id: 'e2',
        event_type: 'invoice.paid',
        stripe_customer_id: 'cus_b',
        stripe_invoice_id: 'inv_2',
        status: 'succeeded',
        amount_cents: 7900,
        currency: 'eur',
        failure_code: null,
        failure_message: null,
        occurred_at: new Date(NOW - 1 * DAY).toISOString(),
      },
      {
        stripe_event_id: 'e3',
        event_type: 'invoice.payment_failed',
        stripe_customer_id: 'cus_c',
        stripe_invoice_id: 'inv_3',
        status: 'failed',
        amount_cents: 7900,
        currency: 'eur',
        failure_code: null,
        failure_message: null,
        occurred_at: new Date(NOW - 45 * DAY).toISOString(), // outside window
      },
    ];
    expect(countFailedPayments30d(events, NOW)).toBe(1);
  });
});

describe('planDistribution', () => {
  it('groups by plan_key, returns customers + mrr per plan, sorted desc by MRR', () => {
    const subs = [
      sub({ status: 'active', plan_key: 'starter', stripe_customer_id: 'cus_a', unit_amount_cents: 7900 }),
      sub({ stripe_subscription_id: 's2', status: 'active', plan_key: 'starter', stripe_customer_id: 'cus_b', unit_amount_cents: 7900 }),
      sub({ stripe_subscription_id: 's3', status: 'active', plan_key: 'growth', stripe_customer_id: 'cus_c', unit_amount_cents: 24_900 }),
      sub({ stripe_subscription_id: 's4', status: 'canceled', plan_key: 'growth', stripe_customer_id: 'cus_d', unit_amount_cents: 24_900 }),
    ];
    const dist = planDistribution(subs);
    expect(dist).toHaveLength(2);
    // Sort is descending by MRR — growth (24_900) > starter (15_800).
    expect(dist[0].plan_key).toBe('growth');
    expect(dist[0].customers).toBe(1);
    expect(dist[0].mrr_cents).toBe(24_900);
    expect(dist[1].plan_key).toBe('starter');
    expect(dist[1].customers).toBe(2);
    expect(dist[1].mrr_cents).toBe(15_800);
  });
  it('returns [] when no active subs', () => {
    expect(planDistribution([])).toEqual([]);
  });
});

describe('netNewMRRCents30d', () => {
  it('subtracts lost MRR from gained', () => {
    const subs = [
      // converted from trial 10 days ago — counts as added
      sub({
        status: 'active',
        unit_amount_cents: 7900,
        trial_end: new Date(NOW - 10 * DAY).toISOString(),
      }),
      // canceled 5 days ago — counts as lost
      sub({
        stripe_subscription_id: 's2',
        status: 'canceled',
        unit_amount_cents: 12_400,
        canceled_at: new Date(NOW - 5 * DAY).toISOString(),
      }),
    ];
    expect(netNewMRRCents30d(subs, NOW)).toBe(7900 - 12_400);
  });
});

describe('recentPayments / recentFailedPayments', () => {
  const invoices: InvoiceRecord[] = [
    {
      stripe_invoice_id: 'inv_old',
      stripe_customer_id: 'cus_a',
      stripe_subscription_id: 'sub_a',
      amount_paid_cents: 7900,
      amount_due_cents: 7900,
      currency: 'eur',
      status: 'paid',
      paid_at: new Date(NOW - 5 * DAY).toISOString(),
      created_at: new Date(NOW - 5 * DAY).toISOString(),
    },
    {
      stripe_invoice_id: 'inv_new',
      stripe_customer_id: 'cus_b',
      stripe_subscription_id: 'sub_b',
      amount_paid_cents: 24_900,
      amount_due_cents: 24_900,
      currency: 'eur',
      status: 'paid',
      paid_at: new Date(NOW - 1 * DAY).toISOString(),
      created_at: new Date(NOW - 1 * DAY).toISOString(),
    },
    {
      stripe_invoice_id: 'inv_open',
      stripe_customer_id: 'cus_c',
      stripe_subscription_id: 'sub_c',
      amount_paid_cents: 0,
      amount_due_cents: 7900,
      currency: 'eur',
      status: 'open',
      paid_at: null,
      created_at: new Date(NOW - 1 * DAY).toISOString(),
    },
  ];

  it('returns paid invoices newest first, drops unpaid', () => {
    const out = recentPayments(invoices, 5);
    expect(out).toHaveLength(2);
    expect(out[0].stripe_invoice_id).toBe('inv_new');
    expect(out[1].stripe_invoice_id).toBe('inv_old');
  });

  it('respects the limit', () => {
    expect(recentPayments(invoices, 1)).toHaveLength(1);
  });

  it('failed events newest first', () => {
    const events: PaymentEventRecord[] = [
      {
        stripe_event_id: 'e_old',
        event_type: 'invoice.payment_failed',
        stripe_customer_id: 'cus_a',
        stripe_invoice_id: 'inv_1',
        status: 'failed',
        amount_cents: 7900,
        currency: 'eur',
        failure_code: 'card_declined',
        failure_message: null,
        occurred_at: new Date(NOW - 3 * DAY).toISOString(),
      },
      {
        stripe_event_id: 'e_new',
        event_type: 'charge.failed',
        stripe_customer_id: 'cus_b',
        stripe_invoice_id: null,
        status: 'failed',
        amount_cents: 24_900,
        currency: 'eur',
        failure_code: 'insufficient_funds',
        failure_message: null,
        occurred_at: new Date(NOW - 1 * DAY).toISOString(),
      },
    ];
    const out = recentFailedPayments(events);
    expect(out[0].stripe_event_id).toBe('e_new');
    expect(out[1].stripe_event_id).toBe('e_old');
  });
});

describe('aggregateBusinessMetrics (integration)', () => {
  it('empty input produces a zero-shape snapshot', () => {
    const snap = aggregateBusinessMetrics({ subscriptions: [], paymentEvents: [], invoices: [] });
    expect(snap).toEqual({
      mrr_cents: 0,
      arr_cents: 0,
      active_customers: 0,
      active_subscriptions: 0,
      churned_subscriptions_30d: 0,
      trial_users: 0,
      failed_payments_30d: 0,
      net_new_mrr_cents_30d: 0,
      plan_distribution: [],
      recent_payments: [],
      recent_failed_payments: [],
    });
  });

  it('combines subscriptions, events and invoices', () => {
    const snap = aggregateBusinessMetrics({
      subscriptions: [
        sub({ status: 'active', unit_amount_cents: 7900, plan_key: 'starter' }),
        sub({
          stripe_subscription_id: 's2',
          status: 'trialing',
          stripe_customer_id: 'cus_z',
          plan_key: 'growth',
          unit_amount_cents: 24_900,
          trial_end: new Date(NOW + 5 * DAY).toISOString(),
        }),
      ],
      paymentEvents: [
        {
          stripe_event_id: 'e1',
          event_type: 'invoice.payment_failed',
          stripe_customer_id: 'cus_a',
          stripe_invoice_id: 'inv_1',
          status: 'failed',
          amount_cents: 7900,
          currency: 'eur',
          failure_code: 'card_declined',
          failure_message: null,
          occurred_at: new Date(NOW - DAY).toISOString(),
        },
      ],
      invoices: [
        {
          stripe_invoice_id: 'inv_paid',
          stripe_customer_id: 'cus_a',
          stripe_subscription_id: 'sub_a',
          amount_paid_cents: 7900,
          amount_due_cents: 7900,
          currency: 'eur',
          status: 'paid',
          paid_at: new Date(NOW - DAY).toISOString(),
          created_at: new Date(NOW - DAY).toISOString(),
        },
      ],
      nowMs: NOW,
    });
    expect(snap.mrr_cents).toBe(7900);
    expect(snap.arr_cents).toBe(94_800);
    expect(snap.active_subscriptions).toBe(2);
    expect(snap.active_customers).toBe(2);
    expect(snap.trial_users).toBe(1);
    expect(snap.failed_payments_30d).toBe(1);
    expect(snap.plan_distribution).toHaveLength(2);
    expect(snap.recent_payments).toHaveLength(1);
    expect(snap.recent_failed_payments).toHaveLength(1);
  });
});
