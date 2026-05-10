/**
 * Single Source of Truth fuer alle Pricing-Tiers.
 *
 * Konsumenten:
 *   - src/features/billing/PricingPage.tsx  (volle Pricing-Page)
 *   - src/components/sections/PricingTeaserSection.tsx (Hero + Niche-Landings)
 *   - index.html JSON-LD <script type=application/ld+json>
 *   - Stripe-Webhook + Edge-Functions (plan_key Mapping in supabase/...)
 *
 * Aenderungen hier propagieren ueberall — niemals duplizieren.
 */

export type TierId = 'free' | 'starter' | 'growth' | 'enterprise';

export interface PricingTier {
  id: TierId;
  /** Marketing-Label */
  name: string;
  /** Plan-Key fuer Stripe / DB (matcht public.products.default_for_plan_key) */
  planKey: string;
  /** Anzeige-Preis (Euro) */
  priceEur: number;
  /** "0", "49", "199" — als String fuer Stripe Offer-Schema */
  priceString: string;
  /** "/ Monat", "einmalig", "individuell" */
  priceSuffix: string;
  /** isRecurring → mode: subscription bei Stripe Checkout */
  recurring: boolean;
  /** Kurz-Tagline */
  tagline: string;
  /** 3-6 Bullets fuer Tier-Card */
  bullets: string[];
  /** Optionale Badges (z.B. "Empfohlen") */
  badges?: string[];
  /** Highlight-Ring auf der Card */
  highlight: boolean;
  /** Primary-CTA-Label + Ziel */
  cta: { label: string; href: string };
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free Audit',
    planKey: 'free_audit',
    priceEur: 0,
    priceString: '0',
    priceSuffix: 'einmalig · kein Account',
    recurring: false,
    tagline: 'Sofortiger DSGVO-Check ohne Verpflichtung',
    bullets: [
      'URL-Scan mit Compliance-Score 0-100',
      'Top-3-Risiken sichtbar',
      'Mini-PDF-Report',
      'Kein Account, kein Setup',
    ],
    highlight: false,
    cta: { label: 'Kostenlos scannen', href: '/audit?source=pricing-free' },
  },
  {
    id: 'starter',
    name: 'Starter',
    planKey: 'starter',
    priceEur: 49,
    priceString: '49',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Vollstaendige Compliance-Basis fuer eine Domain',
    bullets: [
      'Vollstaendiger DSGVO-Scan (alle Findings mit Paragraphenbezug)',
      'Datenschutzerklaerung (DSE) + Impressum-Generator',
      'Cookie-Banner-Konfiguration geliefert',
      'Monatlicher Re-Scan + Email-Alert bei neuen Verstoessen',
      '1 Domain',
    ],
    highlight: false,
    cta: { label: 'Starter buchen', href: '/contact-sales?intent=starter&source=pricing' },
  },
  {
    id: 'growth',
    name: 'Growth',
    planKey: 'growth',
    priceEur: 199,
    priceString: '199',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Continuous Monitoring + Auto-Fix-Engine',
    bullets: [
      'Alles aus Starter',
      'Taegliches Monitoring + Drift-Detection',
      'Consent-Timing-Analyse (pre-consent requests)',
      'Auto-Fix-Empfehlungen mit Code-Snippets',
      'Risk-Dashboard im Browser',
      'Bis zu 3 Domains',
    ],
    badges: ['Empfohlen'],
    highlight: true,
    cta: { label: 'Growth buchen', href: '/contact-sales?intent=growth&source=pricing' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    planKey: 'enterprise',
    priceEur: 0,
    priceString: 'individuell',
    priceSuffix: 'auf Anfrage',
    recurring: true,
    tagline: 'SLA · AI-Act-Modul · DSB-Integration · Evidence Vault',
    bullets: [
      'Alle Growth-Funktionen',
      'SLA-Garantie + dedizierter Account-Manager',
      'EU AI Act Compliance-Modul',
      'DSB-Integration (interner oder externer DSB)',
      'Evidence Vault (unveraenderliche Audit-Trails)',
      'Unlimitierte Domains',
      'Individuelle Vertragsgestaltung / DPA',
    ],
    highlight: false,
    cta: { label: 'Enterprise anfragen', href: '/contact-sales?intent=enterprise&source=pricing' },
  },
];

/** Quick-Lookup nach id */
export function tierById(id: TierId): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}

/** Trust-Note unter Pricing-Cards */
export const PRICING_TRUST_NOTE =
  'Free Audit kostenlos · Monatlich kuendbar · Keine Setup-Gebuehren · Made in Germany';
