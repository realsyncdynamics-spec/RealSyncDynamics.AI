import {
  checkoutHrefForPlan,
  formatPriceEur,
  planById,
  type PlanId,
} from '@/shared/pricing';

/** Die vier Monatstarife. Voice ist kein Eintrag. */
export const V8_PLAN_IDS = ['starter', 'growth', 'agency', 'enterprise'] as const satisfies readonly PlanId[];

/**
 * Einzig erlaubter Zusatz an der Preiszeile.
 * Kein weiterer Steuer- oder Umsatzsteuerhinweis auf der Seite.
 */
export const V8_PRICE_SUFFIX = '/ Monat, netto';

/**
 * PLACEHOLDER — finale Preisliste ausstehend.
 * Freigabe: Dominik, Phase 8.
 * Kein Betrag und keine Abrechnungseinheit.
 * Die Stripe-Staffel 89/199/349 € gehört zu einem anderen Katalog und darf hier nicht erscheinen.
 */
export const V8_VOICE_PLACEHOLDER = {
  title: 'Voice Agents',
  priceLabel: 'Preis auf Anfrage',
  note: 'als Add-on oder Inklusivkontingent, je nach Tarif',
} as const;

export interface V8PlanCard {
  id: PlanId;
  name: string;
  blurb: string;
  monthlyEur: number;
  priceLabel: string;
  href: string;
  cta: string;
  highlight: boolean;
  badge: string | null;
}

const BLURBS: Record<(typeof V8_PLAN_IDS)[number], string> = {
  starter: 'Einstieg in die Plattform. Preis und Name aus der gemeinsamen Preisliste.',
  growth: 'Für wachsende Teams mit mehreren KI-Systemen.',
  agency: 'Für Betriebe mit mehreren Kunden.',
  enterprise: 'Für größere Organisationen.',
};

export function v8PlanCards(): V8PlanCard[] {
  return V8_PLAN_IDS.map((id) => {
    const plan = planById(id);
    return {
      id: plan.id,
      name: plan.name,
      blurb: BLURBS[id],
      monthlyEur: plan.price.monthlyEur,
      priceLabel: formatPriceEur(plan.price.monthlyEur),
      href: checkoutHrefForPlan(plan, { source: 'landing-v8' }),
      cta: 'Plan wählen',
      highlight: plan.highlight,
      badge: plan.badges[0] ?? null,
    };
  });
}

export function v8PriceLine(card: Pick<V8PlanCard, 'priceLabel'>): string {
  return `${card.priceLabel} ${V8_PRICE_SUFFIX}`;
}
