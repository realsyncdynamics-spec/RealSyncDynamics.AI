/**
 * Single Source of Truth fuer alle Pricing-Tiers (5-Tier seit PR #145).
 *
 * Konsumenten:
 *   - src/features/billing/PricingPage.tsx  (volle Pricing-Page)
 *   - src/components/sections/PricingTeaserSection.tsx (Hero + Niche-Landings)
 *   - index.html JSON-LD <script type=application/ld+json>
 *   - Stripe-Webhook + Edge-Functions (plan_key Mapping in supabase/...)
 *
 * Aenderungen hier propagieren ueberall — niemals duplizieren.
 *
 * Pricing-Rebalance vom 2026-05-18 (Conversation Punkt-Korrektur):
 *   alt:  Free / Starter 79  / Growth 249 / Agency 699 / Enterprise ab 1500
 *   neu:  Free / Starter 49  / Growth 179 / Agency 499 / Enterprise ab 998
 *
 * Reasoning (2026-05-18):
 *   - Starter 79 -> 49: aggressivere Penetration im KMU-Segment, das
 *     79 als Pflicht-Tool-Schwelle wahrnimmt. 49 senkt die Aktivierungs-
 *     Reibung ohne in den Hobby-Tool-Bereich (< 30) zu rutschen.
 *   - Growth 249 -> 179: bleibt deutlich ueber 99-Marke (Premium-Signal),
 *     aber unter der 200-Schwelle, ab der Procurement-Approval bei
 *     Mittelstaendlern haerter wird.
 *   - Agency 699 -> 499: White-Label-Pool wird breiter zugaenglich.
 *     Bei 10 Kunden-Sites = 49,90 € pro betreuter Site fuer den Endkunden.
 *   - Enterprise 1500 -> 998: psychologische Schwelle unter 1k, aber
 *     immer noch klares Premium-Tier; signalisiert Niveau, blockiert
 *     Tire-Kicker. Reale Vertraege werden weiterhin > 998 abgeschlossen.
 *
 * Frueherer Rebalance vom 2026-05-10 dokumentiert in PR #145.
 */

export type TierId = 'free' | 'starter' | 'growth' | 'agency' | 'enterprise';

export interface PricingTier {
  id: TierId;
  /** Marketing-Label */
  name: string;
  /** Plan-Key fuer Stripe / DB (matcht public.products.default_for_plan_key) */
  planKey: string;
  /** Anzeige-Preis (Euro). Fuer Enterprise: priceEur=0, priceString='individuell' */
  priceEur: number;
  /** "0", "49", "179", "499" — als String fuer Stripe Offer-Schema */
  priceString: string;
  /** "/ Monat", "einmalig", "individuell ab 998 €" */
  priceSuffix: string;
  /** isRecurring → mode: subscription bei Stripe Checkout */
  recurring: boolean;
  /** Kurz-Tagline */
  tagline: string;
  /** 3-7 Bullets fuer Tier-Card */
  bullets: string[];
  /** Optionale Badges (z.B. "Empfohlen", "Neu") */
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
    tagline: 'Für alle, die zuerst wissen wollen, ob ihre Website offensichtliche DSGVO-Risiken hat',
    bullets: [
      'URL-Scan mit Compliance-Score 0–100',
      'Top-3-Risiken sichtbar',
      'Mini-PDF-Report',
      'Kein Account, kein Setup',
    ],
    highlight: false,
    cta: { label: 'Run Scan', href: '/audit?source=pricing-free' },
  },
  {
    id: 'starter',
    name: 'Starter',
    planKey: 'starter',
    priceEur: 49,
    priceString: '49',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für kleine Unternehmen, lokale Betriebe und Einzel-Domains, die laufend überwacht werden sollen',
    bullets: [
      'Vollständiger DSGVO-Scan mit Paragraphenbezug',
      'DSE-Generator',
      'Technische Consent-Setup-Empfehlungen',
      'Monatlicher Re-Scan',
      'E-Mail-Alert bei neuen Findings',
      '1 Domain',
    ],
    highlight: false,
    cta: { label: 'Activate Monitoring', href: '/checkout/starter?source=pricing' },
  },
  {
    id: 'growth',
    name: 'Growth',
    planKey: 'growth',
    priceEur: 179,
    priceString: '179',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für wachsende Unternehmen, Shops und Mittelstand mit täglichem Monitoring und konkreten Fix-Hinweisen',
    bullets: [
      'Alles aus Starter',
      'Tägliches Monitoring + Drift-Detection',
      'Consent-Timing-Analyse (pre-consent requests)',
      'Fix-Empfehlungen mit Code-Snippets zum Copy-Paste',
      'Risk-Dashboard im Browser',
      'Bis zu 3 Domains',
    ],
    badges: ['Empfohlen'],
    highlight: true,
    cta: { label: 'Activate Governance', href: '/checkout/growth?source=pricing' },
  },
  {
    id: 'agency',
    name: 'Agency',
    planKey: 'agency',
    priceEur: 499,
    priceString: '499',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für Multi-Domain-Teams und Plattformbetreiber, die mehrere Kundenseiten betreuen',
    bullets: [
      'Alles aus Growth',
      'White-Label-Reports mit eigenem Logo',
      'Multi-Tenant-Dashboard (10 Kundenseiten inklusive)',
      'API + Webhooks für CI/CD-Integration',
      'Bulk-Audit für Domain-Portfolios',
      'Priority-Support',
    ],
    badges: ['Neu'],
    highlight: false,
    cta: { label: 'Activate Governance', href: '/audit?plan=agency&source=pricing' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    planKey: 'enterprise',
    priceEur: 0,
    priceString: 'individuell',
    priceSuffix: 'Custom Runtime Environment',
    recurring: true,
    tagline: 'Für regulierte Unternehmen, größere Mittelständler und Organisationen mit SLA-, DSB- oder AI-Act-Anforderungen',
    bullets: [
      'Alle Agency-Funktionen',
      'SLA und dedizierter Runtime-Kanal',
      'EU AI Act Governance-Modul',
      'DSB-Integration (interner oder externer DSB)',
      'Evidence Vault (Hash-Chain + HMAC-Signaturen)',
      'Unlimitierte Domains + unlimitierte Mitarbeiter',
      'Individuelle Vertragsgestaltung / DPA',
    ],
    highlight: false,
    cta: { label: 'Open Runtime', href: '/audit?plan=enterprise&source=pricing' },
  },
];

/** Quick-Lookup nach id */
export function tierById(id: TierId): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}

/** Trust-Note unter Pricing-Cards */
export const PRICING_TRUST_NOTE =
  'Free Audit kostenlos · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany';
