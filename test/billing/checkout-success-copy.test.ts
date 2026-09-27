import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUCCESS = readFileSync(resolve('src/pages/CheckoutSuccess.tsx'), 'utf8');
const DASHBOARD = readFileSync(
  resolve('src/features/governance/dashboard/ComplianceStatusDashboard.tsx'),
  'utf8',
);

describe('CheckoutSuccess — German product copy', () => {
  it('uses German success/error chrome (no English primary CTAs)', () => {
    expect(SUCCESS).toContain('Zahlung erfolgreich');
    expect(SUCCESS).toContain('Jetzt zum Dashboard');
    expect(SUCCESS).toContain('Checkout unvollständig');
    expect(SUCCESS).not.toContain('Payment Successful');
    expect(SUCCESS).not.toContain('Go to Dashboard');
    expect(SUCCESS).not.toContain('Checkout Incomplete');
  });

  it('does not claim Abo aktiv while webhook sync is still pending', () => {
    expect(SUCCESS).toContain('syncPending');
    expect(SUCCESS).toContain('Zahlung bestätigt — Sync ausstehend');
    expect(SUCCESS).toContain('checkout-sync-pending');
    expect(SUCCESS).toContain("params.set('sync', 'pending')");
    expect(SUCCESS).toContain('Sync erneut prüfen');
    // Soft-continue must mark sync=pending — never redirect as unlocked.
    expect(SUCCESS).toMatch(/if \(last\?\.pending\)/);
  });

  it('shows verifying chrome while loading — never green success before verify', () => {
    expect(SUCCESS).toContain('checkout-verifying');
    expect(SUCCESS).toContain('Zahlung wird bestätigt');
    expect(SUCCESS).toContain('checkout-synced');
    expect(SUCCESS).toContain('ist freigeschaltet');
  });
});

describe('ComplianceStatusDashboard — post-checkout honesty', () => {
  it('shows sync-pending banner instead of Abo aktiv when sync=pending', () => {
    expect(DASHBOARD).toContain('post-checkout-sync-pending');
    expect(DASHBOARD).toContain('Zahlung eingegangen · Abo-Sync ausstehend');
    expect(DASHBOARD).toContain('urlSaysPending');
    expect(DASHBOARD).toContain('livePlanUnlocked');
    expect(DASHBOARD).toContain('postCheckoutUnlocked');
    // Active CTA remains for the synced + live paid plan path only.
    expect(DASHBOARD).toContain('Abo aktiv');
  });
});

describe('stripe-checkout-verify — reconcile on webhook lag', () => {
  const VERIFY = readFileSync(
    resolve('supabase/functions/stripe-checkout-verify/index.ts'),
    'utf8',
  );
  const SYNC = readFileSync(
    resolve('supabase/functions/_shared/stripe-subscription-sync.ts'),
    'utf8',
  );

  it('reconciles via shared syncSubscriptionFromStripe when DB row missing', () => {
    expect(VERIFY).toContain('syncSubscriptionFromStripe');
    expect(VERIFY).toContain('loadAddonPriceIds');
    expect(VERIFY).toContain('SESSION_INCOMPLETE');
    expect(VERIFY).toContain('PAYMENT_INCOMPLETE');
    expect(VERIFY).toContain('pending: false');
    expect(SYNC).toContain("onConflict: 'tenant_id'");
    expect(SYNC).toContain('default_for_plan_key');
  });
});
