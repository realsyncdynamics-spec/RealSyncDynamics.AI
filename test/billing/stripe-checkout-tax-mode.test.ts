import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRICING_TAX_MODE as WEB_TAX_MODE } from '../../shared/pricing';
import { PRICING_TAX_MODE as EDGE_TAX_MODE } from '../../supabase/functions/_shared/pricing.generated';

// Source-contract test: importing the Deno Edge handler itself would start Deno.serve.
// Assert the actual Checkout Session payload uses the same SSoT as the legal copy.
const CHECKOUT = readFileSync(
  resolve(process.cwd(), 'supabase/functions/stripe-checkout/index.ts'),
  'utf8',
);

describe('Stripe Checkout — tax mode alignment', () => {
  it('keeps website and Edge tax modes synchronized', () => {
    expect(EDGE_TAX_MODE).toBe(WEB_TAX_MODE);
  });

  it('disables Stripe automatic tax for the currently approved §19 mode', () => {
    expect(WEB_TAX_MODE).toBe('EXEMPT');
    expect(EDGE_TAX_MODE === 'EU_STANDARD').toBe(false);
  });

  it('derives automatic_tax from the server-side pricing SSoT, not a fixed true flag', () => {
    expect(CHECKOUT).toContain(
      "import { normalizePlanKey, planByKey, PRICING_TAX_MODE } from '../_shared/pricing.generated.ts';",
    );
    const taxAssignments = [...CHECKOUT.matchAll(/automatic_tax:\s*\{\s*enabled:\s*([^}]+)\}/g)];
    expect(taxAssignments).toHaveLength(1);
    expect(taxAssignments[0][1].trim()).toBe("PRICING_TAX_MODE === 'EU_STANDARD'");
    expect(CHECKOUT).not.toContain('automatic_tax: { enabled: true }');
  });
});
