import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('first-customer revenue contract', () => {
  it('keeps Governance Launch as a one-time purchase', () => {
    const pricing = read('shared/pricing.ts');
    const checkout = read('supabase/functions/checkout-website-rebuild/index.ts');

    expect(pricing).toContain("'governance_launch'");
    expect(pricing).toContain("purchaseMode: 'one_time'");
    expect(checkout).toContain("tier === 'governance_launch'");
    expect(checkout).toContain("mode !== 'payment'");
    expect(checkout).toContain('realPrice');
  });

  it('does not allow browser-supplied Stripe Price IDs', () => {
    const checkout = read('supabase/functions/checkout-website-rebuild/index.ts');
    const siteCheckout = read('supabase/functions/checkout-siteos-project/index.ts');

    expect(checkout).toContain(".eq('default_for_plan_key', planKey)");
    expect(siteCheckout).toContain(".eq('default_for_plan_key', PLAN_KEY)");
    expect(checkout).not.toMatch(/body\.stripe_price_id/);
    expect(siteCheckout).not.toMatch(/body\.stripe_price_id/);
  });

  it('requires tenant membership before Governance Launch checkout', () => {
    const checkout = read('supabase/functions/checkout-website-rebuild/index.ts');
    const siteCheckout = read('supabase/functions/checkout-siteos-project/index.ts');

    expect(checkout).toContain('requireTenantMember(req, tenantId)');
    expect(siteCheckout).toContain("eq('tenant_id', tenantId)");
    expect(siteCheckout).toContain("eq('user_id', userResp.user.id)");
  });

  it('keeps one-time purchases on the grant axis', () => {
    const webhook = read('supabase/functions/stripe-webhook/index.ts');
    const grants = read('supabase/migrations/20260808100000_entitlement_grants.sql');

    expect(webhook).toContain("session.mode === 'payment'");
    expect(webhook).toContain('recordOneTimePurchase');
    expect(webhook).toContain("source: 'one_time_purchase'");
    expect(webhook).toContain('purchase_reference: session.id');
    expect(grants).toContain('UNIQUE (source, purchase_reference)');
  });

  it('has a server-side placeholder-price safety gate', () => {
    const checkout = read('supabase/functions/checkout-website-rebuild/index.ts');
    const siteCheckout = read('supabase/functions/checkout-siteos-project/index.ts');

    expect(checkout).toContain("!p.stripe_price_id.startsWith('internal_default_')");
    expect(siteCheckout).toContain(".not('stripe_price_id', 'like', 'internal_default_%')");
  });
});
