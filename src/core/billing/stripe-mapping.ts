// Frontend-Convenience-Mapping plan_key → Stripe-Price-ID (+ Anzeige-Label).
//
// ACHTUNG — dies ist NICHT die maßgebliche Preisquelle des Checkouts.
// Die Edge-Function `supabase/functions/stripe-checkout` resolved die
// Stripe-Price-ID serverseitig aus `public.products.stripe_price_id`
// (`default_for_plan_key`-Match) und verwirft Sentinel-Werte
// (`internal_default_*`). Dieses Map dient ausschließlich Frontend-Zwecken
// (z.B. UI-Anzeige) und darf NIE als Zahlungsautorität verwendet werden.
//
// Die IDs werden zur Build-Zeit aus `VITE_STRIPE_PRICE_*` injiziert
// (.github/workflows/deploy-cloudflare-pages.yml, .env.example). Ohne
// gesetztes Env greift der dokumentierte Dev-Fallback unten — diese
// Fallback-Literale sind KEINE Garantie für einen aktiven Stripe-Preis und
// müssen mit der DB übereinstimmen, bevor sie produktiv genutzt werden.

const PRICE_FALLBACK = {
  free_audit: 'price_1TVbcMCNKcHrCAICoX7QYcxA',
  starter: 'price_1TVbdCCNKcHrCAICUiJEMfyf',
  growth: 'price_1TVbdbCNKcHrCAICBr5X3NmN',
  agency: 'price_1TVbduCNKcHrCAICT0IYHOmB',
  scale: 'price_1TVbePCNKcHrCAICE2Y5Z0mL',
  starter_yearly: 'price_internal_starter_yearly_790',
  growth_yearly: 'price_internal_growth_yearly_2490',
  agency_yearly: 'price_internal_agency_yearly_6900',
  scale_yearly: 'price_internal_scale_yearly_19000',
} as const;

const env = import.meta.env;

export const STRIPE_PLAN_MAPPING: Record<string, { priceId: string; label: string }> = {
  free_audit: {
    priceId: PRICE_FALLBACK.free_audit,
    label: 'Frei (Audit-Modus)',
  },
  starter: {
    priceId: env.VITE_STRIPE_PRICE_STARTER || PRICE_FALLBACK.starter,
    label: 'Anlasser (Starter)',
  },
  growth: {
    priceId: env.VITE_STRIPE_PRICE_GROWTH || PRICE_FALLBACK.growth,
    label: 'Wachstum (Growth)',
  },
  agency: {
    priceId: env.VITE_STRIPE_PRICE_AGENCY || PRICE_FALLBACK.agency,
    label: 'Unternehmen (Agency)',
  },
  scale: {
    priceId: env.VITE_STRIPE_PRICE_SCALE || PRICE_FALLBACK.scale,
    label: 'Scale (Reseller)',
  },
  starter_yearly: {
    priceId: env.VITE_STRIPE_PRICE_STARTER_YEARLY || PRICE_FALLBACK.starter_yearly,
    label: 'Anlasser Jährlich (Starter)',
  },
  growth_yearly: {
    priceId: env.VITE_STRIPE_PRICE_GROWTH_YEARLY || PRICE_FALLBACK.growth_yearly,
    label: 'Wachstum Jährlich (Growth)',
  },
  agency_yearly: {
    priceId: env.VITE_STRIPE_PRICE_AGENCY_YEARLY || PRICE_FALLBACK.agency_yearly,
    label: 'Unternehmen Jährlich (Agency)',
  },
  scale_yearly: {
    priceId: env.VITE_STRIPE_PRICE_SCALE_YEARLY || PRICE_FALLBACK.scale_yearly,
    label: 'Scale Jährlich (Reseller)',
  },
};

export function getStripePriceId(planKey: string): string {
  const mapping = STRIPE_PLAN_MAPPING[planKey];
  if (!mapping) {
    throw new Error(`[Billing Error] Unbekannter oder nicht autorisierter Plan-Key: ${planKey}`);
  }
  return mapping.priceId;
}
