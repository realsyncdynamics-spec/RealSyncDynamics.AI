/**
 * Single Source of Truth fuer alle Pricing-Tiers (6-Tier seit PR #XXX).
 *
 * Konsumenten:
 *   - src/features/billing/PricingPage.tsx  (volle Pricing-Page)
 *   - src/components/sections/PricingTeaserSection.tsx (Hero + Niche-Landings)
 *   - index.html JSON-LD <script type=application/ld+json>
 *   - Stripe-Webhook + Edge-Functions (plan_key Mapping in supabase/...)
 *
 * Aenderungen hier propagieren ueberall — niemals duplizieren.
 *
 * Pricing-Rebalance 2026-07 (Strukturoptimierung):
 *   Neue Struktur:
 *   - Free:       kostenlos (Audit-Scan)
 *   - Starter:    79 € / Monat (Einzelunternehmen)
 *   - Growth:     249 € / Monat (KMU, kleine Teams)
 *   - Agency:     699 € / Monat (mittlere Agenturen)
 *   - Enterprise: 1.249 € / Monat (Konzerne, Großunternehmen)
 *   - Partner:    1.999 € / Monat (Reseller, Kanzleien, MSPs — Multi-Tenant)
 *
 * Reasoning:
 *   - Enterprise als Zwischenschicht zwischen Agency und Partner
 *   - Bessere Preissprünge: 79 → 249 (215%) → 699 (180%) → 1.249 (78%) → 1.999 (60%)
 *   - Partner klar als spezialisiertes Multi-Tenant-Produkt positioniert
 *   - Reduziert Kaufabbrüche durch granularere Upsell-Pfade
 */

export type TierId = 'free' | 'starter' | 'growth' | 'agency' | 'enterprise' | 'scale' | 'starter_yearly' | 'growth_yearly' | 'agency_yearly' | 'enterprise_yearly' | 'scale_yearly';

export type BotChannelType = 'website' | 'whatsapp' | 'telegram' | 'slack' | 'teams' | 'email' | 'voice';

export interface GovernanceBotsQuota {
  /** Maximale Anzahl produktiver Governance-Bots */
  maxBots: number;
  /** Maximale Antworten pro Monat */
  maxAnswersPerMonth: number;
  /** Verfuegbare Kanäle */
  channels: BotChannelType[];
  /** Fähigkeiten (z.B. "Terminbuchung", "Risk-Tags") */
  capabilities: string[];
  /** Besonderheiten für Phase 3 Metering */
  meteringNotes?: string;
}

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
  /** Governance-Bots Kontingent für diesen Tier */
  botsQuota: GovernanceBotsQuota;
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
    botsQuota: {
      maxBots: 0,
      maxAnswersPerMonth: 0,
      channels: [],
      capabilities: [],
      meteringNotes: 'Keine produktiven Bots im Free Audit',
    },
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
    botsQuota: {
      maxBots: 1,
      maxAnswersPerMonth: 500,
      channels: ['website'],
      capabilities: ['Basic Q&A', 'AI-Act-Transparenzhinweis', 'Usage-Logging'],
      meteringNotes: 'Test-Bot mit reduzierten Limits',
    },
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
      'Governance-Bots (2 Bots, 2.000 Antworten/Monat, Website+WhatsApp+Telegram)',
      'Bot-Fähigkeiten: Terminbuchung, Bestellannahme, Risk-Tags',
      'Mehr Automatisierungs-Läufe (100/Monat)',
    ],
    badges: ['Empfohlen'],
    highlight: true,
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/growth?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 2,
      maxAnswersPerMonth: 2000,
      channels: ['website', 'whatsapp', 'telegram'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging',
        'Risiko-Tags',
        'Terminbuchung',
        'Bestellannahme',
        'Evidence-Export'
      ],
      meteringNotes: 'Produktive Governance-Bots mit Compliance-Features',
    },
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
      'Governance-Bots (10 Bots, 25.000 Antworten/Monat, alle Kanäle inkl. Voice)',
      'Bot-White-Label mit eigenem Branding',
      'Bot-Fähigkeiten: Fallbearbeitung, Human Handoff, Custom Intent-Matching',
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
      'Evidence Vault Advanced: versionierte Immutable Snapshots, Retention & Legal-Hold',
      'Policy Packs: DSGVO, EU AI Act, NIS2, DORA, ISO 27001, TISAX (aktivierbar)',
      'Priority-Support',
    ],
    badges: [],
    highlight: false,
    cta: { label: '14 Tage Agency testen', href: '/checkout/agency?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 10,
      maxAnswersPerMonth: 25000,
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging & Audit-Trail',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation',
        'Custom Intent-Matching',
        'Evidence-Export',
        'Bot-White-Label',
        'Analytics & Sentiment-Analyse'
      ],
      meteringNotes: 'Vollständige Governance-Bots mit Enterprise-Features, Phase 3: botQuota im Subscription-Payload',
    },
  },
  {
    id: 'scale',
    name: 'Partner',
    planKey: 'scale',
    priceEur: 1999,
    priceString: '1.999',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für Reseller, Kanzleien und MSPs: Multi-Tenant-Plattform für bis zu 50 Mandanten',
    bullets: [
      'Alles aus Enterprise',
      'Governance-Bots (bis 50 Bots, 100.000 Antworten/Monat, Mandanten-segregiert)',
      'Multi-Tenant-Dashboard für bis zu 50 Mandanten',
      'Eigene Sub-Domains pro Mandant',
      'White-Label Branding (Logos, Farben, Texte)',
      'Voller API-Zugriff + Webhooks',
      'Mandanten-Isolation & Sub-Accounts',
      'SLA 4 h auf Bug-Reports + Dedicated Support',
    ],
    badges: ['Reseller', 'Multi-Tenant'],
    highlight: false,
    cta: { label: 'Partner anfragen', href: '/contact-sales?tier=scale&source=pricing' },
    botsQuota: {
      maxBots: 50,
      maxAnswersPerMonth: 100000,
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging & Audit-Trail',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation',
        'Custom Intent-Matching',
        'Evidence-Export',
        'Bot-White-Label (Mandanten-segregiert)',
        'Analytics & Sentiment-Analyse',
        'Mandanten-Isolation & Sub-Accounts'
      ],
      meteringNotes: 'Multi-Tenant Governance-Bots für DSB-Kanzleien und Reseller, Phase 3: Pro-Mandant Usage-Tracking',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    planKey: 'enterprise',
    priceEur: 1249,
    priceString: '1.249',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für Großunternehmen und Konzerne mit erweiterten Governance-Anforderungen und SLA-Bedarf',
    bullets: [
      'Alles aus Agency',
      'Governance-Bots (bis 20 Bots, 50.000 Antworten/Monat, alle Kanäle)',
      'Multi-Tenant-Dashboard für bis zu 5 Organisationen',
      'Zentrale Benutzerverwaltung & Rollen/Rechte',
      'API Premium + Webhooks',
      'White-Label Light (Branding, Logo, Farben)',
      'Priority Support (4h Response-Zeit)',
      'Audit Center Pro + Evidence Vault Enterprise',
      'Scheduler Unlimited für geplante Scans',
      'Advanced Analytics & Risk-Scoring',
    ],
    highlight: false,
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/enterprise?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 20,
      maxAnswersPerMonth: 50000,
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging & Audit-Trail',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation',
        'Custom Intent-Matching',
        'Evidence-Export',
        'Bot-White-Label',
        'Advanced Analytics & Sentiment-Analyse',
        'Multi-Tenant Support'
      ],
      meteringNotes: 'Enterprise Governance-Bots mit Multi-Tenant-Support für Großunternehmen, Phase 3: Pro-Org Usage-Tracking',
    },
  },
  // ─── Yearly Pricing Variants ────────────────────────────────────────────
  // 12 Monate zum Preis von 10 = 2-Monate-Rabatt (16,67%)
  {
    id: 'starter_yearly',
    name: 'Starter (Jährlich)',
    planKey: 'starter_yearly',
    priceEur: 790,
    priceString: '790',
    priceSuffix: '/ Jahr',
    recurring: true,
    tagline: 'Starter mit 2-Monate-Rabatt: 79 € × 10 = 790 €/Jahr',
    bullets: [
      'Alles aus Starter (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Kontinuierliche DSGVO-Compliance',
    ],
    highlight: false,
    badges: ['Sparen Sie 2 Monate'],
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/starter_yearly?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 1,
      maxAnswersPerMonth: 500,
      channels: ['website'],
      capabilities: ['Basic Q&A', 'AI-Act-Transparenzhinweis', 'Usage-Logging'],
      meteringNotes: 'Jährliche Abrechnung mit Rabatt',
    },
  },
  {
    id: 'growth_yearly',
    name: 'Growth (Jährlich)',
    planKey: 'growth_yearly',
    priceEur: 2490,
    priceString: '2.490',
    priceSuffix: '/ Jahr',
    recurring: true,
    tagline: 'Growth mit 2-Monate-Rabatt: 249 € × 10 = 2.490 €/Jahr',
    bullets: [
      'Alles aus Growth (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'KI-Governance + AI Risk Register (ganz Jahr)',
    ],
    badges: ['Empfohlen', 'Mit Rabatt'],
    highlight: true,
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/growth_yearly?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 2,
      maxAnswersPerMonth: 2000,
      channels: ['website', 'whatsapp', 'telegram'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging',
        'Risiko-Tags',
        'Terminbuchung',
        'Bestellannahme',
        'Evidence-Export'
      ],
      meteringNotes: 'Jährliche Abrechnung mit Rabatt',
    },
  },
  {
    id: 'agency_yearly',
    name: 'Agency (Jährlich)',
    planKey: 'agency_yearly',
    priceEur: 6900,
    priceString: '6.900',
    priceSuffix: '/ Jahr',
    recurring: true,
    tagline: 'Agency mit 2-Monate-Rabatt: 699 € × 10 = 6.900 €/Jahr',
    bullets: [
      'Alles aus Agency (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Branchenbibliothek + White-Label (ganz Jahr)',
    ],
    highlight: false,
    badges: ['Mit Rabatt'],
    cta: { label: 'Agency jährlich testen', href: '/checkout/agency_yearly?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 10,
      maxAnswersPerMonth: 25000,
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging & Audit-Trail',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation',
        'Custom Intent-Matching',
        'Evidence-Export',
        'Bot-White-Label',
        'Analytics & Sentiment-Analyse'
      ],
      meteringNotes: 'Jährliche Abrechnung mit Rabatt',
    },
  },
  {
    id: 'scale_yearly',
    name: 'Partner (Jährlich)',
    planKey: 'scale_yearly',
    priceEur: 19000,
    priceString: '19.000',
    priceSuffix: '/ Jahr',
    recurring: true,
    tagline: 'Partner mit 2-Monate-Rabatt: 1.999 € × 10 = 19.000 €/Jahr',
    bullets: [
      'Alles aus Partner (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Multi-Tenant für bis zu 50 Mandanten (ganz Jahr)',
    ],
    badges: ['Reseller', 'Mit Rabatt'],
    highlight: false,
    cta: { label: 'Partner jährlich anfragen', href: '/contact-sales?tier=scale_yearly&source=pricing' },
    botsQuota: {
      maxBots: 50,
      maxAnswersPerMonth: 100000,
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging & Audit-Trail',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation',
        'Custom Intent-Matching',
        'Evidence-Export',
        'Bot-White-Label (Mandanten-segregiert)',
        'Analytics & Sentiment-Analyse',
        'Mandanten-Isolation & Sub-Accounts'
      ],
      meteringNotes: 'Jährliche Abrechnung mit Rabatt für Multi-Tenant DSB-Kanzleien',
    },
  },
  {
    id: 'enterprise_yearly',
    name: 'Enterprise (Jährlich)',
    planKey: 'enterprise_yearly',
    priceEur: 12490,
    priceString: '12.490',
    priceSuffix: '/ Jahr',
    recurring: true,
    tagline: 'Enterprise mit 2-Monate-Rabatt: 1.249 € × 10 = 12.490 €/Jahr',
    bullets: [
      'Alles aus Enterprise (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Multi-Tenant für bis zu 5 Organisationen (ganz Jahr)',
    ],
    highlight: false,
    cta: { label: '14 Tage kostenlos testen', href: '/checkout/enterprise_yearly?source=pricing&pilot=true' },
    botsQuota: {
      maxBots: 20,
      maxAnswersPerMonth: 50000,
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis',
        'Antwort-Logging & Audit-Trail',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation',
        'Custom Intent-Matching',
        'Evidence-Export',
        'Bot-White-Label',
        'Advanced Analytics & Sentiment-Analyse',
        'Multi-Tenant Support'
      ],
      meteringNotes: 'Jährliche Abrechnung mit Rabatt für Enterprise Multi-Tenant',
    },
  },
];

/** Quick-Lookup nach id */
export function tierById(id: TierId): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}

/**
 * Die 5 selbst buchbaren Pakete (Starter 79 € → Scale 1.999 €) für Pricing-
 * Grids auf Landing/Pricing/Checkout. Enterprise ist jetzt ein 1.249 €
 * self-service-Tier zwischen Agency (699 €) und Scale (1.999 €).
 * Yearly-Varianten sind hier ausgeschlossen (werden separat verwaltet).
 */
export const PUBLIC_PRICING_TIERS: PricingTier[] = PRICING_TIERS.filter(
  (t) => !['free', 'starter_yearly', 'growth_yearly', 'agency_yearly', 'enterprise_yearly', 'scale_yearly'].includes(t.id)
);

/**
 * Akzentfarbe pro Tier — sorgt für farbliche Trennung der Pakete in
 * Pricing-Grids. Klassen sind als vollstaendige Literale hinterlegt, damit
 * Tailwinds Content-Scanner sie erkennt (dynamisch zusammengesetzte
 * Klassennamen wie `border-t-${x}` werden NICHT erkannt).
 */
export const TIER_ACCENT: Record<TierId, { border: string; text: string }> = {
  free:              { border: 'border-t-silver-400',    text: 'text-silver-400' },
  starter:           { border: 'border-t-ai-cyan-400',   text: 'text-ai-cyan-400' },
  growth:            { border: 'border-t-security-500',  text: 'text-security-500' },
  agency:            { border: 'border-t-violet-400',    text: 'text-violet-400' },
  enterprise:        { border: 'border-t-emerald-400',   text: 'text-emerald-400' },
  scale:             { border: 'border-t-gold-400',      text: 'text-gold-400' },
  starter_yearly:    { border: 'border-t-ai-cyan-400',   text: 'text-ai-cyan-400' },
  growth_yearly:     { border: 'border-t-security-500',  text: 'text-security-500' },
  agency_yearly:     { border: 'border-t-violet-400',    text: 'text-violet-400' },
  enterprise_yearly: { border: 'border-t-emerald-400',   text: 'text-emerald-400' },
  scale_yearly:      { border: 'border-t-gold-400',      text: 'text-gold-400' },
};

/** Trust-Note unter Pricing-Cards */
export const PRICING_TRUST_NOTE =
  'Free Audit kostenlos · 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany';

// ─── Governance-Bots Add-ons ──────────────────────────────────────────────────

export interface BotAddOn {
  id: string;
  name: string;
  description: string;
  bullets: string[];
  priceEur: number;
  priceSuffix: string;
  includeInTiers: TierId[]; // Welche Tiers zeigen dieses Add-on?
}

/**
 * Bot Add-on-Karten — zusätzlich buchbar für Growth/Agency/Scale/Enterprise.
 * Free/Starter: keine Add-ons, da maxBots=0 oder sehr niedrig.
 *
 * Phase 3 TODO: Diese Add-ons in den Checkout-Payload mit answerQuota, channels, addons[] weben.
 */
export const BOT_ADDONS: BotAddOn[] = [
  {
    id: 'response-pack-5k',
    name: 'Response Pack 5K',
    description: 'Zusätzliche 5.000 Bot-Antworten pro Monat',
    bullets: [
      'Weitere 5.000 Antworten/Monat',
      'Alle Kanäle nutzbar',
      'Zur bestehenden Quote addierbar',
      'Überschuss-Antworten: automatisch auf nächsten Monat verrechnet',
    ],
    priceEur: 49,
    priceSuffix: '/ Monat',
    includeInTiers: ['growth', 'agency', 'scale', 'enterprise'],
  },
  {
    id: 'whatsapp-channel',
    name: 'WhatsApp Bot Erweiterung',
    description: 'WhatsApp Business-Integration für Ihre Governance-Bots',
    bullets: [
      'WhatsApp Business API Integration',
      'Nachrichten-Verifizierung & Compliance-Badges',
      'Media-Support (Bilder, Dokumente)',
      'Service-Level: 24/7 Verfügbarkeit',
      'Setup: ~2 Stunden Onboarding durch Team',
    ],
    priceEur: 99,
    priceSuffix: '/ Monat',
    includeInTiers: ['growth', 'agency', 'scale', 'enterprise'],
  },
  {
    id: 'voice-addon',
    name: 'Voice-Bot Addon',
    description: 'Sprach-Bots über Telefonie (Voice + IVR)',
    bullets: [
      'Eingehend & Ausgehend Anrufe unterstützen',
      'IVR (Interactive Voice Response)',
      'Speech-to-Text & Text-to-Speech (Neural)',
      'Multilingual-Support (DE, EN, FR, ES)',
      'Abrechnung: pro Minute (ab min. 500 Min./Monat)',
    ],
    priceEur: 150,
    priceSuffix: '/ Monat + 0,25 € pro Minute',
    includeInTiers: ['agency', 'scale', 'enterprise'],
  },
  {
    id: 'agency-bot-pack',
    name: 'Agency Bot Pack (5 zusätzliche Bots)',
    description: 'Für Agenturen: 5 weitere Governance-Bots (z.B. für Kundenprojekte)',
    bullets: [
      'Weitere 5 produktive Governance-Bots',
      'Kundensegmentierung per API',
      'White-Label pro Bot konfigurierbar',
      'Multi-Account Management',
      'Priority Onboarding (24h Support)',
    ],
    priceEur: 199,
    priceSuffix: '/ Monat',
    includeInTiers: ['agency', 'scale', 'enterprise'],
  },
  {
    id: 'white-label-bot',
    name: 'White-Label Bot',
    description: 'Vollständig gebranded Bot mit eigener Domain',
    bullets: [
      'Subdomain oder Custom-Domain',
      'Branding: Logo, Farben, Texte vollständig anpassbar',
      'Eigener Bot-Name & Persona',
      'Custom Welcome-Message & Fallback-Flows',
      'Analytics unter eigenem Dashboard',
    ],
    priceEur: 299,
    priceSuffix: '/ Monat',
    includeInTiers: ['agency', 'scale', 'enterprise'],
  },
  {
    id: 'compliance-pack',
    name: 'Compliance Pack',
    description: 'Erweitertes Logging, Audit-Export & Compliance-Features',
    bullets: [
      'DSGVO-Audit-Trail (alle Interactions + Entscheidungen)',
      'EU AI Act Risk-Tagging (automatisch per Inferenzen)',
      'Quarterly Compliance-Report (PDF export-ready)',
      'Human-Review Workflow für sensible Intents',
      'GDPR-Export auf Anfrage (Kundendaten, Konversationen)',
    ],
    priceEur: 149,
    priceSuffix: '/ Monat',
    includeInTiers: ['agency', 'scale', 'enterprise'],
  },
];

export function botAddonsByTier(tierId: TierId): BotAddOn[] {
  return BOT_ADDONS.filter((addon) => addon.includeInTiers.includes(tierId));
}
