import { describe, expect, it } from 'vitest';
import {
  MOON_PRICE_ID, MOON_PRODUCT_ID, routeCheckoutProductLine,
} from '../../supabase/functions/_shared/stripe-product-line-routing';

const hardware = { price: { id: MOON_PRICE_ID, product: MOON_PRODUCT_ID } };
const saas = { price: { id: 'price_saas_known', product: 'prod_saas' } };
const addon = { price: { id: 'price_saas_addon', product: 'prod_addon' } };
const allow = new Set(['price_saas_known', 'price_saas_addon']);
const legacy = { mode: 'payment', metadata: { tenant_id: 'tenant_123' } };

describe('Checkout product-line boundary', () => {
  it('ignores hardware even when legacy metadata is missing', () => {
    expect(routeCheckoutProductLine({ mode: 'payment' }, [hardware], false, allow)).toBe('hardware_ignore');
  });
  it('ignores tagged hardware without SaaS provisioning', () => {
    expect(routeCheckoutProductLine({ mode: 'payment', metadata: { product_line: 'hardware_mobility' } }, [hardware], false, allow)).toBe('hardware_ignore');
  });
  it('quarantines conflicting hardware with SaaS metadata', () => {
    expect(routeCheckoutProductLine({ ...legacy, metadata: { ...legacy.metadata, product_line: 'saas_governance' } }, [hardware], false, allow)).toBe('quarantine');
  });
  it('quarantines mixed hardware / SaaS', () => {
    expect(routeCheckoutProductLine(legacy, [hardware, saas], false, allow)).toBe('quarantine');
  });
  it('quarantines a MOON price paired with an unrelated product', () => {
    expect(routeCheckoutProductLine(legacy, [{ price: { id: MOON_PRICE_ID, product: 'prod_not_moon' } }], false, allow)).toBe('quarantine');
  });
  it('quarantines a MOON product paired with an unrelated price', () => {
    expect(routeCheckoutProductLine(legacy, [{ price: { id: 'price_fake', product: MOON_PRODUCT_ID } }], false, allow)).toBe('quarantine');
  });
  it('allows only catalog-approved legacy SaaS checkout', () => {
    expect(routeCheckoutProductLine(legacy, [saas], false, allow)).toBe('saas');
  });
  it('allows new SaaS checkout with correct metadata and prices', () => {
    expect(routeCheckoutProductLine({ mode: 'subscription', metadata: { tenant_id: 't', product_line: 'saas_governance' } }, [saas, addon], false, allow)).toBe('saas');
  });
  it('does not trust product_line alone', () => {
    expect(routeCheckoutProductLine({ mode: 'payment', metadata: { tenant_id: 't', product_line: 'saas_governance' } }, [{ price: { id: 'price_unknown', product: 'prod_unknown' } }], false, allow)).toBe('quarantine');
  });
  it('quarantines missing tenant', () => {
    expect(routeCheckoutProductLine({ mode: 'payment', metadata: { product_line: 'saas_governance' } }, [saas], false, allow)).toBe('quarantine');
  });
  it('quarantines a hardware tag on any other product', () => {
    expect(routeCheckoutProductLine({ ...legacy, metadata: { ...legacy.metadata, product_line: 'hardware_mobility' } }, [saas], false, allow)).toBe('quarantine');
  });
  it('quarantines truncated or missing line items', () => {
    expect(routeCheckoutProductLine(legacy, [saas], true, allow)).toBe('quarantine');
    expect(routeCheckoutProductLine(legacy, [], false, allow)).toBe('quarantine');
    expect(routeCheckoutProductLine(legacy, [{}], false, allow)).toBe('quarantine');
  });
  it('quarantines unknown modes and prices', () => {
    expect(routeCheckoutProductLine({ ...legacy, mode: 'setup' }, [saas], false, allow)).toBe('quarantine');
    expect(routeCheckoutProductLine(legacy, [saas], false, new Set())).toBe('quarantine');
  });
});
