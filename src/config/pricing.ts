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
    name: 'Scale',
    planKey: 'scale',
    priceEur: 1999,
    priceString: '1.999',
    priceSuffix: '/ Monat',
    recurring: true,
    tagline: 'Für DSB-Kanzleien und Compliance-Dienstleister, die 11-50 Mandanten parallel betreuen',
    bullets: [
      'Alles aus Agency',
      'Governance-Bots (bis 50 Bots, 100.000 Antworten/Monat, Mandanten-segregiert)',
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
    priceEur: 0,
    priceString: 'individuell',
    priceSuffix: 'Individuelle Laufzeitumgebung',
    recurring: true,
    tagline: 'Für regulierte Unternehmen, größere Mittelständler und Organisationen mit SLA-, DSB- oder AI-Act-Anforderungen',
    bullets: [
      'Alle Agency-Funktionen',
      'Custom Governance-Bots (Anzahl, Volumen, Kanäle individuell)',
      'SLA und dedizierter Runtime-Kanal',
      'EU AI Act Governance-Modul',
      'DSB-Integration (interner oder externer DSB)',
      'Volles Evidence Vault (HMAC-Signaturen + Langzeit-Retention)',
      'Unlimitierte Domains + unlimitierte Mitarbeiter',
      'Individuelle Vertragsgestaltung / DPA',
    ],
    highlight: false,
    cta: { label: 'Enterprise anfragen', href: '/contact-sales?tier=enterprise&source=pricing' },
    botsQuota: {
      maxBots: -1, // Unlimited
      maxAnswersPerMonth: -1, // Unlimited
      channels: ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'],
      capabilities: [
        'AI-Act-Transparenzhinweis & Deep-Disclosures',
        'Antwort-Logging & Audit-Trail mit Langzeit-Retention',
        'Risiko-Tags & Compliance-Flags',
        'Terminbuchung & Fallbearbeitung',
        'Human Handoff mit Eskalation & Triage',
        'Custom Intent-Matching & LLM-Integration',
        'Evidence-Export mit DPA-Anhang',
        'Bot-White-Label & Custom-Branding',
        'Advanced Analytics & Sentiment-Analyse',
        'SLA-Monitoring & Uptime-Garantie',
        'Custom Channels & Integrations'
      ],
      meteringNotes: 'Enterprise Governance-Bots mit Custom Setup, Phase 3: DPA-konformes Usage-Metering & SLA-Tracking',
    },
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
