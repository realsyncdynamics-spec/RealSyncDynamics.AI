import { MODULAR_OFFERS, MODULAR_STANDALONE_MONTHLY_EUR, isValidModularSelection } from './pricing.generated.ts';

const SANDBOX_PRICE_IDS = {
  professional: 'price_1Ug3xhIEauIvbZDCHrLRmoWA',
  growth: 'price_1Ug3xsIEauIvbZDCynQsbLFO',
  agency: 'price_1Ug3xzIEauIvbZDChWdYsdK0',
  'ki-bots': 'price_1Ug3y1IEauIvbZDCxTcukikN',
  'app-builder': 'price_1Ug3y3IEauIvbZDCAqTlzfr4',
  'governance-os': 'price_1Ug3y4IEauIvbZDC16slho37',
  'claude-code-optimizer': 'price_1Ug3y6IEauIvbZDC8jxowdf2',
} as const;

export interface ModularSandboxPrice {
  id: string;
  product: string | { id: string };
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  tax_behavior: string | null;
  recurring?: { interval: string; interval_count: number; usage_type?: string } | null;
  metadata: Record<string, string>;
}

/** Pure validation only. Never creates a session or grants entitlements. */
export function resolveModularSandboxOffer(key: string, products: readonly string[]) {
  if (!Object.prototype.hasOwnProperty.call(SANDBOX_PRICE_IDS, key)) return null;
  const id = key as keyof typeof SANDBOX_PRICE_IDS;
  const bundle = MODULAR_OFFERS.find(o => o.id === id);
  let amount: number;
  if (bundle) {
    if (!isValidModularSelection(id, products)) return null;
    amount = bundle.monthlyEur;
  } else {
    if (products.length !== 1 || products[0] !== id ||
        !Object.prototype.hasOwnProperty.call(MODULAR_STANDALONE_MONTHLY_EUR, id)) return null;
    amount = MODULAR_STANDALONE_MONTHLY_EUR[id as keyof typeof MODULAR_STANDALONE_MONTHLY_EUR];
  }
  return { priceId: SANDBOX_PRICE_IDS[id], productId: 'rsd_modular_v2_' + id.replace(/-/g, '_'), amountCents: amount * 100, key: id };
}

/** Test secrets only; explicit environment, product, amount, cadence and tax checks. */
export function validateModularSandboxPrice(secret: string, key: string, products: readonly string[], price: ModularSandboxPrice): boolean {
  if (!/^(sk|rk)_test_/.test(secret)) return false;
  const offer = resolveModularSandboxOffer(key, products);
  if (!offer) return false;
  const product = typeof price.product === 'string' ? price.product : price.product?.id;
  return price.id === offer.priceId && product === offer.productId &&
    price.active === true && price.livemode === false &&
    price.currency === 'eur' && price.unit_amount === offer.amountCents &&
    price.tax_behavior === 'inclusive' &&
    price.recurring?.interval === 'month' && price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed' &&
    price.metadata?.catalog === 'modular-v2' && price.metadata?.offer_key === offer.key &&
    price.metadata?.tax_model === 'DE_KLEINUNTERNEHMER_19';
}
