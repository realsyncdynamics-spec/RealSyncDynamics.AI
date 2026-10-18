/**
 * Beta-Checkout: Beta-Berechtigung und reguläre Abos getrennt behandeln.
 *
 * Owner-Entscheidung 18.10.2026 (#1931): Die Startseite zeigt reguläre Preise
 * mit 14 Tagen Test. Damit Preisversprechen, Checkout und Dashboard
 * übereinstimmen, gilt hier:
 *  - Bestehende Beta-Kunden behalten ihre gewährten Konditionen — auch beim Kauf.
 *  - Neue Kunden bekommen den regulären Checkout, sobald `VITE_BETA_CHECKOUT=off`.
 *  - „Keine Zahlungsdaten nötig“ steht nur bei Beta-Mandanten.
 *  - Ein abgebrochener Checkout ändert nichts am Vertragsverhältnis.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyBillingAccount } from '../../src/core/billing/billingAccount';
import { resolveEntitlements } from '../../src/core/billing/entitlements';
import { MIN_CHECKOUT_TRIAL_END_LEAD_MS, previewCheckoutTrial } from '../../src/core/billing/trial';
import type { CurrentUsage, EntitlementDecision, SubscriptionSnapshot, TenantContext } from '../../src/core/billing/types';
import { BETA, BETA_CHECKOUT_REDIRECT, redirectsCheckoutToBeta } from '../../src/config/beta';
import { computeAccountNotice } from '../../src/features/governance/dashboard/startPanelModel';
import { betaBannerText, enrollmentNotice } from '../../src/features/billing/betaNotice';
import {
  MIN_TRIAL_END_LEAD_MS,
  checkoutTrialFor,
  type ExistingSubRow,
} from '../../supabase/functions/stripe-checkout/customer';
import { BETA_ENDS_AT, BETA_SOURCE } from '../../supabase/functions/beta-enroll/logic';

const root = (p: string) => resolve(__dirname, '../..', p);
const STRIPE_CHECKOUT = readFileSync(root('supabase/functions/stripe-checkout/index.ts'), 'utf8');
const CHECKOUT_PAGE = readFileSync(root('src/features/billing/CheckoutPage.tsx'), 'utf8');
const CANCELLED_PAGE = readFileSync(root('src/features/billing/CheckoutCancelledPage.tsx'), 'utf8');

const NOW = new Date('2026-10-18T12:00:00Z');
const TRIAL_DAYS = 14;
const BETA_END_UNIX = Math.floor(Date.parse(BETA_ENDS_AT) / 1000);

const USAGE: CurrentUsage = {
  activeAssets: 0,
  monthlyRegistrations: 0,
  apiCallsMonthly: 0,
  bulkJobsMonthly: 0,
  complianceExportsMonthly: 0,
};
const TENANT: TenantContext = { tenantId: 't-1', planKey: 'growth', roles: ['owner'], memberCount: 1, isPublicSector: false };

function snapshot(over: Partial<SubscriptionSnapshot>): SubscriptionSnapshot {
  return {
    customerId: '',
    subscriptionId: null,
    productId: null,
    priceId: null,
    planKey: 'free_audit',
    interval: 'month',
    status: 'inactive',
    quantity: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    trialEnd: null,
    addOns: [],
    ...over,
  };
}

const decide = (over: Partial<SubscriptionSnapshot>): EntitlementDecision =>
  resolveEntitlements(snapshot(over), TENANT, USAGE, NOW);

/**
 * Dieselben Mandanten zweimal: als Abo-Zeile (Server, stripe-checkout) und als
 * Snapshot (Frontend). Beide Seiten müssen dieselbe Testphase ergeben.
 */
const CASES: Array<{
  name: string;
  row: ExistingSubRow | null;
  snap: Partial<SubscriptionSnapshot>;
  expected: 'days' | 'until' | 'none';
}> = [
  { name: 'neuer Kunde ohne Abo-Zeile', row: null, snap: {}, expected: 'days' },
  {
    name: 'neuer Kunde auf der freien Stufe (Platzhalter-Customer)',
    row: { stripe_customer_id: 'free_tier_no_stripe_t-1', plan_key: 'free_audit', status: 'active' },
    snap: { customerId: 'free_tier_no_stripe_t-1', planKey: 'free_audit', status: 'active' },
    expected: 'days',
  },
  {
    name: 'Beta-Bestandskunde mit laufendem Zugang',
    row: { stripe_customer_id: 'free_tier_no_stripe_t-1', plan_key: 'growth', status: 'trialing', trial_end: BETA_ENDS_AT, source: BETA_SOURCE },
    snap: { customerId: 'free_tier_no_stripe_t-1', planKey: 'growth', status: 'trialing', trialEnd: BETA_ENDS_AT, source: 'beta' },
    expected: 'until',
  },
  {
    name: 'Beta-Kunde, dessen Zugang in unter 48 h endet',
    row: { plan_key: 'growth', status: 'trialing', trial_end: '2026-10-19T12:00:00Z', source: BETA_SOURCE },
    snap: { planKey: 'growth', status: 'trialing', trialEnd: '2026-10-19T12:00:00Z', source: 'beta' },
    expected: 'none',
  },
  {
    name: 'Beta-Kunde nach Ablauf der Beta (Testphase verbraucht)',
    row: { plan_key: 'growth', status: 'trialing', trial_end: '2026-10-01T00:00:00Z', source: BETA_SOURCE },
    snap: { planKey: 'growth', status: 'trialing', trialEnd: '2026-10-01T00:00:00Z', source: 'beta' },
    expected: 'none',
  },
  {
    name: 'ehemaliger Beta-Kunde, der schon gekauft hat (Stripe-Abo, source bleibt stehen)',
    row: { stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', plan_key: 'growth', status: 'trialing', trial_end: BETA_ENDS_AT, source: BETA_SOURCE },
    snap: { customerId: 'cus_1', subscriptionId: 'sub_1', planKey: 'growth', status: 'trialing', trialEnd: BETA_ENDS_AT, source: 'beta' },
    expected: 'none',
  },
  {
    name: 'Stripe-Kunde in der 14-Tage-Testphase (Upgrade)',
    row: { stripe_customer_id: 'cus_2', stripe_subscription_id: 'sub_2', plan_key: 'starter', status: 'trialing', trial_end: '2026-10-25T00:00:00Z' },
    snap: { customerId: 'cus_2', subscriptionId: 'sub_2', planKey: 'starter', status: 'trialing', trialEnd: '2026-10-25T00:00:00Z' },
    expected: 'none',
  },
  {
    name: 'Stripe-Kunde nach gekündigtem Abo mit früherer Testphase',
    row: { stripe_customer_id: 'cus_3', plan_key: 'starter', status: 'canceled', trial_end: '2026-01-01T00:00:00Z' },
    snap: { customerId: 'cus_3', planKey: 'starter', status: 'canceled', trialEnd: '2026-01-01T00:00:00Z' },
    expected: 'none',
  },
];

describe('classifyBillingAccount', () => {
  it('Stripe-Abo hat Vorrang vor source=beta (Webhook lässt source stehen)', () => {
    expect(classifyBillingAccount({ subscriptionId: 'sub_1', status: 'trialing', source: 'beta' })).toBe('stripe');
  });

  it('unterscheidet Beta, kartenlose Testphase und den Rest', () => {
    expect(classifyBillingAccount({ subscriptionId: null, status: 'trialing', source: 'beta' })).toBe('beta');
    expect(classifyBillingAccount({ subscriptionId: null, status: 'trialing', source: null })).toBe('trial');
    expect(classifyBillingAccount({ subscriptionId: null, status: 'active', source: null })).toBe('other');
    expect(classifyBillingAccount(null)).toBe('other');
  });

  it('kommt über resolveEntitlements in die Entscheidung', () => {
    expect(decide({ planKey: 'growth', status: 'trialing', trialEnd: BETA_ENDS_AT, source: 'beta' }).accountKind).toBe('beta');
    expect(decide({ subscriptionId: 'sub_1', planKey: 'starter', status: 'active' }).accountKind).toBe('stripe');
    expect(decide({}).accountKind).toBe('other');
  });

  it('liest source aus der Abo-Zeile', () => {
    const service = readFileSync(root('src/core/usage/usage-service.ts'), 'utf8');
    expect(service).toMatch(/\.select\('[^']*trial_end,source'\)/);
    expect(service).toContain('source: subRow.data.source ?? null');
  });
});

describe('Checkout-Umleitung in die Beta', () => {
  it('Default wie bisher: an, solange die Beta aktiv ist', () => {
    expect(BETA_CHECKOUT_REDIRECT).toBe(BETA.active);
  });

  it('leitet nur Beta-Pläne ohne bewussten Kauf um', () => {
    expect(redirectsCheckoutToBeta('starter_monthly', { redirect: true })).toBe(BETA.active);
    expect(redirectsCheckoutToBeta('growth', { redirect: true, purchase: true })).toBe(false);
    expect(redirectsCheckoutToBeta('enterprise', { redirect: true })).toBe(false);
  });

  it('VITE_BETA_CHECKOUT=off: neue Kunden kommen in den regulären Checkout', () => {
    for (const plan of ['starter', 'starter_monthly', 'growth', 'agency']) {
      expect(redirectsCheckoutToBeta(plan, { redirect: false })).toBe(false);
    }
  });

  it('CheckoutPage nutzt die Weiche statt isBetaPlan direkt', () => {
    expect(CHECKOUT_PAGE).toContain("redirectsCheckoutToBeta(plan.id, { purchase: searchParams.get('purchase') === '1' })");
    expect(CHECKOUT_PAGE).not.toMatch(/isBetaPlan\(plan\.id\)/);
  });
});

describe('Testphase im Checkout — Server und Anzeige stimmen überein', () => {
  it.each(CASES)('$name → $expected', ({ row, snap, expected }) => {
    const server = checkoutTrialFor(row, TRIAL_DAYS, NOW);
    const shown = previewCheckoutTrial(decide(snap), TRIAL_DAYS, NOW);
    expect(server.kind).toBe(expected);
    expect(shown.kind).toBe(expected);
  });

  it('Beta-Bestandskunde: Abrechnung erst ab dem gewährten Beta-Ende, nicht 14 Tage ab heute', () => {
    const row = CASES.find((c) => c.expected === 'until')!.row;
    expect(checkoutTrialFor(row, TRIAL_DAYS, NOW)).toEqual({ kind: 'until', trialEndUnix: BETA_END_UNIX });
  });

  it('Tarif ohne Testphase (Agency): auch ein neuer Kunde zahlt sofort', () => {
    expect(checkoutTrialFor(null, 0, NOW)).toEqual({ kind: 'none' });
    expect(previewCheckoutTrial(decide({}), 0, NOW)).toEqual({ kind: 'none' });
  });

  it('Mindestvorlauf für trial_end ist auf beiden Seiten gleich (Stripe: 48 h)', () => {
    expect(MIN_TRIAL_END_LEAD_MS).toBe(48 * 60 * 60 * 1000);
    expect(MIN_CHECKOUT_TRIAL_END_LEAD_MS).toBe(MIN_TRIAL_END_LEAD_MS);
  });

  it('stripe-checkout liest source/stripe_subscription_id und setzt trial_end für Beta-Kunden', () => {
    expect(STRIPE_CHECKOUT).toMatch(/select\('[^']*stripe_subscription_id[^']*source'\)/);
    expect(STRIPE_CHECKOUT).toContain('checkoutTrialFor(existingSub, plan.trialDays, new Date())');
    expect(STRIPE_CHECKOUT).toContain('subscriptionData.trial_end = trial.trialEndUnix');
    expect(STRIPE_CHECKOUT).toContain('subscriptionData.trial_period_days = trial.days');
  });

  it('Checkout-Seite zeigt Beta-Kunden das Datum, ab dem abgerechnet wird', () => {
    expect(CHECKOUT_PAGE).toContain('data-testid="checkout-beta-carryover"');
    expect(CHECKOUT_PAGE).toContain('previewCheckoutTrial(decision');
  });
});

describe('Abgebrochener Checkout', () => {
  // Ohne abgeschlossene Session gibt es kein Abo-Event — die Abo-Zeile
  // bleibt, wie sie war. Der nächste Versuch bekommt dieselben Konditionen.
  it('Session-Erstellung schreibt nichts in subscriptions; erst der Webhook tut es', () => {
    expect(STRIPE_CHECKOUT).not.toMatch(/from\('subscriptions'\)[\s\S]{0,200}?\.(upsert|update|insert)\(/);
    const webhook = readFileSync(root('supabase/functions/stripe-webhook/index.ts'), 'utf8');
    expect(webhook).not.toContain("'checkout.session.expired'");
  });

  it('Beta-Bestandskunde: nach dem Abbruch weiter Abrechnung erst ab Beta-Ende', () => {
    const row = CASES.find((c) => c.expected === 'until')!.row;
    const later = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(checkoutTrialFor(row, TRIAL_DAYS, later)).toEqual({ kind: 'until', trialEndUnix: BETA_END_UNIX });
  });

  it('neuer Kunde: Abbruch verbraucht die 14 Tage nicht', () => {
    const freeRow = CASES[1].row;
    expect(checkoutTrialFor(freeRow, TRIAL_DAYS, NOW)).toEqual({ kind: 'days', days: TRIAL_DAYS });
  });

  it('Beta-Kunde bleibt nach dem Abbruch Beta-Kunde, Hinweis unverändert', () => {
    const decision = decide({ planKey: 'growth', status: 'trialing', trialEnd: BETA_ENDS_AT, source: 'beta' });
    expect(decision.accountKind).toBe('beta');
    const notice = computeAccountNotice({ daysRemaining: 106, endingSoon: false }, BETA, decision.accountKind ?? null);
    expect(notice?.text).toContain('keine Zahlungsdaten nötig');
  });

  it('Abbruchseite verspricht nichts über Zahlungsdaten', () => {
    expect(CANCELLED_PAGE).toContain('Es wurde keine Zahlung ausgelöst');
    expect(CANCELLED_PAGE).not.toMatch(/keine Zahlungsdaten|keine Kreditkarte/);
  });
});

describe('Hinweise nur, wenn sie für den Mandanten zutreffen', () => {
  const trial = { daysRemaining: 10, endingSoon: false };

  it('„keine Zahlungsdaten nötig“ nur für Beta-Mandanten', () => {
    expect(computeAccountNotice(trial, BETA, 'beta')?.text).toContain('keine Zahlungsdaten nötig');
    for (const kind of ['stripe', 'trial', 'other', null] as const) {
      expect(computeAccountNotice(trial, BETA, kind)?.text ?? '').not.toContain('keine Zahlungsdaten');
    }
  });

  it('Stripe-Testphase: Abo verwalten statt Zahlungsdaten hinterlegen', () => {
    const n = computeAccountNotice(trial, BETA, 'stripe');
    expect(n?.text).toContain('danach monatliche Abrechnung');
    expect(n?.link?.href).toBe('/app/billing');
  });

  it('allgemeiner Beta-Banner nur für Beta-Mandanten', () => {
    expect(betaBannerText({ kind: 'beta', notice: null, endsLabel: BETA.endsLabel })).toContain(BETA.endsLabel);
    for (const kind of ['stripe', 'trial', 'other', null] as const) {
      expect(betaBannerText({ kind, notice: null, endsLabel: BETA.endsLabel })).toBeNull();
    }
  });

  it('Neuaufnahme geschlossen: ehrliche Meldung statt „Abo bleibt unverändert“', () => {
    const text = enrollmentNotice({ status: 'skipped', reason: 'NEW_ENROLLMENT_CLOSED' }, BETA.endsLabel);
    expect(text).toContain('keine neuen Arbeitsbereiche');
    expect(text).not.toContain('Abo bleibt unverändert');
  });
});
