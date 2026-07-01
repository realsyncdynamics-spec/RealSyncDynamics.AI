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

export type TierId = 'free' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';

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
    cta: { label: 'Kostenlos starten', href: '/audit?source=pricing-free' },
  },
  {
    id: 'starter',
    name: 'Starter',
    planKey: 'starter',
    priceEur: 79,
    priceString: '79',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für Unternehmen mit niedriger Governance-Komplexität, die ein klares, nachweisbares Fundament wollen',
    bullets: [
      'Vollständiger DSGVO-Scan mit Paragraphenbezug',
      'DSE-Generator',
      'Technische Consent-Setup-Empfehlungen',
      'Kontinuierliches DSGVO-Monitoring',
      'Lückenloser Evidence-Trail (Hash-Chain) + Audit-Export',
      'E-Mail-Alert bei neuen Findings',
      'Automatisierungs-Skills (Audit, Dokumente, Lead-Risk) – 25 Läufe/Monat',
    ],
    highlight: false,
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/starter?source=pricing&pilot=true' },
  },
  {
    id: 'growth',
    name: 'Growth',
    planKey: 'growth',
    priceEur: 249,
    priceString: '249',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für mittlere Governance-Komplexität: KI-Governance, AI Risk Register und kontinuierliches Monitoring',
    bullets: [
      'Alles aus Starter',
      'KI-Governance + AI Risk Register',
      'Tägliches Monitoring + Drift-Detection',
      'Consent-Timing-Analyse (pre-consent requests)',
      'Fix-Empfehlungen mit Code-Snippets zum Copy-Paste',
      'Risk-Dashboard im Browser',
      'Konversations-Bots für Chat, Telegram & WhatsApp (bis 2 Bots, 2.000 Antworten/Monat)',
      'Bot-Fähigkeiten: Terminbuchung & Bestellannahme',
      'Mehr Automatisierungs-Läufe (100/Monat)',
    ],
    badges: ['Empfohlen'],
    highlight: true,
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/growth?source=pricing&pilot=true' },
  },
  {
    id: 'agency',
    name: 'Agency',
    planKey: 'agency',
    priceEur: 699,
    priceString: '699',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für hohe Governance-Komplexität: Branchenbibliothek, Governance Agents und auditfähige Automatisierung',
    bullets: [
      'Alles aus Growth',
      'Bot-Telefonie (Voice) + höhere Bot-Kontingente (10 Bots, 10.000 Antworten, 500 Voice-Minuten/Monat)',
      'Branchenbibliothek (vorkonfigurierte Governance-Profile)',
      'Governance Agents für Prüfungen & Maßnahmen',
      'Automatische Dokumentation + Audit-Trail',
      'White-Label-Reports mit eigenem Logo',
      'API + Webhooks für CI/CD-Integration',
      'Kodee VPS-Assistent (Server-Ops per SSH: Status, Logs, TLS/DNS + Risiko-Advisor)',
      'Automatisierungs-Skills bis 500 Läufe/Monat',
      'Herkunftsnachweis (C2PA-angelehnt): Signatur, Chain-of-Custody & Trust-Score',
      'Bulk-Jobs: Massen-Scan vieler Domains (CSV-Import, Prioritäts-Queue, Retry)',
      'Scheduler: geplante Scans (täglich/wöchentlich/monatlich) + Slack/Teams/Webhook-Alerts',
      'Priority-Support',
    ],
    badges: [],
    highlight: false,
    cta: { label: '14 Tage Agency testen', href: '/checkout/agency?source=pricing&pilot=true' },
  },
  {
    id: 'scale',
    name: 'Scale',
    planKey: 'scale',
    priceEur: 1999,
    priceString: '1.999',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für DSB-Kanzleien und Compliance-Dienstleister, die 11-50 Mandanten parallel betreuen',
    bullets: [
      'Alles aus Agency',
      'Multi-Tenant-Dashboard für bis zu 50 Mandanten',
      'Eigene Sub-Domain (z.B. dsb.ihrekanzlei.de)',
      'White-Label PDFs + Live-Dashboard',
      'Voller API-Zugriff für eigene Integrationen',
      'SLA 4 h auf Bug-Reports + Priority-Support',
    ],
    badges: ['Reseller'],
    highlight: false,
    // Scale läuft Phase A noch über manuelles Onboarding (Sales-Call statt
    // self-serve Checkout). Sobald ein Stripe-Price-ID existiert UND die
    // 50-Tenant-Quotas im Backend erzwungen sind, kann die CTA auf
    // /checkout/scale flippen. Bis dahin geht jeder Scale-Interessent
    // durch /contact-sales mit `?tier=scale` für Lead-Routing.
    cta: { label: 'Scale anfragen', href: '/contact-sales?tier=scale&source=pricing' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    planKey: 'enterprise',
    priceEur: 0,
    priceString: 'individuell',
    priceSuffix: 'Individuelle Laufzeitumgebung',
    recurring: true,
    tagline: 'Für regulierte Unternehmen, größere Mittelständler und Organisationen mit SLA-, DSB- oder AI-Act-Anforderungen',
    bullets: [
      'Alle Agency-Funktionen',
      'SLA und dedizierter Runtime-Kanal',
      'EU AI Act Governance-Modul',
      'DSB-Integration (interner oder externer DSB)',
      'Volles Evidence Vault (HMAC-Signaturen + Langzeit-Retention)',
      'Unlimitierte Domains + unlimitierte Mitarbeiter',
      'Individuelle Vertragsgestaltung / DPA',
    ],
    highlight: false,
    cta: { label: 'Enterprise anfragen', href: '/contact-sales?tier=enterprise&source=pricing' },
  },
];

/** Quick-Lookup nach id */
export function tierById(id: TierId): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}

/**
 * Die 5 selbst buchbaren Pakete (Free Audit → Scale 1.999 €) für Pricing-
 * Grids auf Landing/Pricing/Checkout. "Enterprise" (individuell, kein fester
 * Preis) wird NICHT als 6. Karte gerendert — sonst entsteht ein 6-Karten-
 * Grid in 5 Spalten ("durcheinander"). Enterprise läuft als eigener
 * Anfrage-CTA neben/unter dem 5er-Grid, siehe ENTERPRISE_TIER.
 */
export const PUBLIC_PRICING_TIERS: PricingTier[] = PRICING_TIERS.filter((t) => t.id !== 'enterprise');

/** Custom/individuell-Tier — separater CTA, kein Grid-Card. */
export const ENTERPRISE_TIER: PricingTier = PRICING_TIERS.find((t) => t.id === 'enterprise')!;

/**
 * Akzentfarbe pro Tier — sorgt für farbliche Trennung der Pakete in
 * Pricing-Grids. Klassen sind als vollstaendige Literale hinterlegt, damit
 * Tailwinds Content-Scanner sie erkennt (dynamisch zusammengesetzte
 * Klassennamen wie `border-t-${x}` werden NICHT erkannt).
 */
export const TIER_ACCENT: Record<TierId, { border: string; text: string }> = {
  free:       { border: 'border-t-silver-400',    text: 'text-silver-400' },
  starter:    { border: 'border-t-ai-cyan-400',   text: 'text-ai-cyan-400' },
  growth:     { border: 'border-t-security-500',  text: 'text-security-500' },
  agency:     { border: 'border-t-violet-400',    text: 'text-violet-400' },
  scale:      { border: 'border-t-gold-400',      text: 'text-gold-400' },
  enterprise: { border: 'border-t-titanium-200',  text: 'text-titanium-200' },
};

/** Trust-Note unter Pricing-Cards */
export const PRICING_TRUST_NOTE =
  'Free Audit kostenlos · 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany';
