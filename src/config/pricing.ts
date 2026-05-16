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
 * Pricing-Rebalance vom 2026-05-10 (Test-Kunde-Critique):
 *   alt:  Free / Starter 49 / Growth 199 / Enterprise individuell  (4 Tier)
 *   neu:  Free / Starter 79 / Growth 249 / Agency 699 / Enterprise ab 1500
 *
 * Reasoning:
 *   - Starter 49 -> 79: 49 wirkt wie Hobby-Tool. 79 ist das DACH-Pflicht-
 *     Compliance-Sweet-Spot (Cookiebot Premium ~110, Iubenda Plus ~280)
 *   - Growth 199 -> 249: leichte Anhebung weil Auto-Fix + Daily-Monitoring
 *     mehr wert ist als 199, und 249 markiert klar die Premium-Linie
 *   - Agency 699 NEU: fehlte komplett. Agenturen sind in DACH der schnellste
 *     Vertriebskanal — 1 Agency-Kunde = 5-15 End-Domains. Sweet-Spot 699:
 *     OneTrust ab ~600, aber wir liefern White-Label + DACH-Pricing
 *   - Enterprise jetzt mit Floor "ab 1500": signalisiert Niveau,
 *     blockiert Tire-Kicker
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
  /** "0", "79", "249", "699" — als String fuer Stripe Offer-Schema */
  priceString: string;
  /** "/ Monat", "einmalig", "individuell ab 1.500 €" */
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
    priceEur: 79,
    priceString: '79',
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
    cta: { label: 'Activate Monitoring', href: '/contact-sales?intent=plan-starter&source=pricing' },
  },
  {
    id: 'growth',
    name: 'Growth',
    planKey: 'growth',
    priceEur: 249,
    priceString: '249',
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
    cta: { label: 'Activate Governance', href: '/contact-sales?intent=plan-growth&source=pricing' },
  },
  {
    id: 'agency',
    name: 'Agency',
    planKey: 'agency',
    priceEur: 699,
    priceString: '699',
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
