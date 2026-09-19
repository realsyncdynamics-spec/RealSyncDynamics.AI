/**
 * Per-Route SEO-Config — Single Source of Truth fuer <title>, <meta description>,
 * <link rel=canonical>, OpenGraph-Tags und route-spezifisches JSON-LD.
 *
 * Konsumiert von src/components/SEOHead.tsx ueber useLocation() — wenn die
 * Component ohne Props gerendert wird, wird der Eintrag fuer location.pathname
 * automatisch geladen. Props ueberschreiben Config (z.B. fuer dynamische
 * Detail-Pages mit User-Generated-Content im Titel).
 *
 * Alias-Strategie: Routes wie /faq und /haeufige-fragen rendern dieselbe
 * Component (Faq.tsx). Beide haben eigene Eintraege hier, aber das Alias zeigt
 * mit `canonical` auf die primaere URL — Duplicate-Content wird konsolidiert.
 *
 * Title-Konvention (vom User-Audit vorgegeben):
 *   max 60 Zeichen, Keyword zuerst, Brand am Ende mit "| RealSyncDynamics.AI"
 *
 * Description-Konvention:
 *   130-155 Zeichen, konkret, Nutzen-orientiert, mit Keyword
 *
 * JSON-LD-Konvention (siehe SEOHead.tsx fuer Render-Logik):
 *   FAQPage   nur auf Seiten mit echten FAQ-Akkordeons
 *   WebApplication fuer Tool-Seiten (Cookie-Scanner, Generators)
 *   Product   nur auf /pricing
 *   BreadcrumbList automatisch fuer alle Subroutes (>= 2 Segmente)
 *   Organization bleibt auf der Homepage in index.html (statisch)
 */

export interface SEOConfig {
  /** Page-Title — sollte mit "| RealSyncDynamics.AI" enden, sonst haengt der Hook " — RealSyncDynamics.AI" an. */
  title: string;
  /** Meta-Description — 130-155 Zeichen ideal. */
  description: string;
  /** Canonical — vollstaendige URL bevorzugt, Pfad wird sonst zur Domain ergaenzt. */
  canonical?: string;
  /** OG-Title kann emotionaler / laenger sein als der SEO-Title. Default: title */
  ogTitle?: string;
  /** OG-Description darf konversionalsoer formuliert sein. Default: description */
  ogDescription?: string;
  /** OG-Image-Pfad. Default: /og-image.png */
  ogImage?: string;
  /** OG-Type. Default: "website" */
  ogType?: 'website' | 'article' | 'product';
  /** Twitter-Card-Title — kann separat von OG. Default: ogTitle */
  twitterTitle?: string;
  /** Twitter-Card-Description — kann separat von OG. Default: ogDescription */
  twitterDescription?: string;
  /** noindex,nofollow — nur fuer interne Pages oder Beta */
  noIndex?: boolean;
  /** Route-spezifisches JSON-LD. Wird unter <script type="application/ld+json" data-seo-id="route"> gerendert. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = 'https://realsyncdynamicsai.de';

export const DEFAULT_SEO: SEOConfig = {
  title: 'RealSyncDynamics.AI — Das Governance OS für DSGVO & EU AI Act',
  description:
    'Das Governance OS für DSGVO und EU AI Act: AI-Systeme, Websites, Agents und Datenflüsse erfassen, Risiken bewerten, Governance durchsetzen und Nachweise führen.',
};

// ─── JSON-LD Templates (re-used) ─────────────────────────────────────────────

const PRICING_PRODUCT_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'RealSyncDynamics.AI Compliance Platform',
  description:
    'EU-native DSGVO- und EU-AI-Act-Compliance-Infrastruktur mit Website-Audit, Consent-Timing-Analyse, Fix-Empfehlungen und Continuous Monitoring.',
  brand: { '@type': 'Brand', name: 'RealSyncDynamics.AI' },
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Audit',
      price: '0',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/audit`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '0',
        priceCurrency: 'EUR',
        priceType: 'https://schema.org/InvoicePrice',
      },
    },
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '79',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '79',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
    {
      '@type': 'Offer',
      name: 'Growth',
      price: '249',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '249',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
    {
      '@type': 'Offer',
      name: 'Agency',
      price: '699',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/checkout/agency`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '699',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
    {
      '@type': 'Offer',
      name: 'Enterprise',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/contact-sales?intent=enterprise`,
      // Kein Festpreis in schema.org-Offer: Enterprise wird vertraglich
      // vereinbart und manuell fakturiert. Ein `price` hier waere ein
      // maschinenlesbares Angebot, das der Checkout nicht erfuellt.
      description: 'Preis auf Anfrage — SLA nach Vereinbarung, AI-Act-Modul, DSB-Integration, Evidence Vault',
    },
  ],
};

const COOKIE_SCANNER_WEBAPP_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Cookie-Scanner',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/cookie-scanner`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  description:
    'Kostenloser Cookie-Scanner: erkennt Tracker und Cookies, die VOR dem Consent geladen werden. Echter Headless-Browser, kein DOM-Scrape.',
};

// Q+A sind 1:1 aus src/pages/AiActFaq.tsx (siehe FAQ_ENTRIES) uebernommen.
// Google bestraft Schema-Inhalt der nicht sichtbar auf der Seite steht —
// daher Wort-fuer-Wort identisch mit dem was der User im Akkordeon sieht.
const AI_ACT_FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Was ist der EU AI Act?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Der AI Act (Verordnung (EU) 2024/1689) ist die weltweit erste umfassende Regulierung von KI-Systemen. Er trat im August 2024 in Kraft und gilt EU-weit unmittelbar — wie die DSGVO. Anders als die DSGVO regelt er nicht primär Daten, sondern KI-Systeme als Produkt.',
      },
    },
    {
      '@type': 'Question',
      name: 'Wer ist betroffen?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Alle Anbieter, Importeure, Händler und Betreiber von KI-Systemen, die in der EU Wirkung entfalten — auch ohne EU-Sitz (Marktortprinzip). Kanzleien, Krankenhäuser, Banken, HR-Abteilungen und Behörden, die KI einsetzen, sind als „Betreiber" verantwortlich.',
      },
    },
    {
      '@type': 'Question',
      name: 'Welche Risiko-Klassen gibt es?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Vier Stufen: (1) Unacceptable Risk — verboten (Social Scoring, Realtime-Biometrie im öffentlichen Raum). (2) High-Risk — strenge Auflagen (Medizin, Verkehr, HR, Bonität, Strafverfolgung). (3) Limited Risk — Transparenzpflichten (Chatbots, Deepfakes). (4) Minimal Risk — keine Auflagen (Spam-Filter, Spielhilfen).',
      },
    },
    {
      '@type': 'Question',
      name: 'Wann gilt der AI Act?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Stufenweise: (1) Verbotene Praktiken: 2. Februar 2025. (2) GPAI-Pflichten: 2. August 2025. (3) High-Risk-Systeme + Sanktionsregime: 2. August 2026. (4) Bereits in Verkehr gebrachte High-Risk-Systeme bekommen bis 2. August 2027 Zeit zur Anpassung.',
      },
    },
    {
      '@type': 'Question',
      name: 'Wie hoch sind die Bußgelder?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Drei Stufen: (1) Verstoß gegen verbotene Praktiken: bis 35 Mio. € oder 7 % des weltweiten Jahresumsatzes. (2) Sonstige Pflichten (High-Risk): bis 15 Mio. € oder 3 %. (3) Falschangaben gegenüber Behörden: bis 7,5 Mio. € oder 1 %.',
      },
    },
  ],
};

/**
 * FAQ der Warteliste-Landingpage. Liegt hier statt in der Page, weil derselbe
 * Text zweimal gebraucht wird: sichtbar im Akkordeon und als FAQPage-JSON-LD.
 * Google straft Schema-Inhalt ab, der nicht auf der Seite steht — eine zweite
 * Kopie waere ein Drift-Risiko, deshalb eine Quelle fuer beides.
 * Konsumiert von src/pages/WaitlistLanding.tsx.
 */
export const WAITLIST_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Kostet die Warteliste etwas?',
    a: 'Nein. Der Eintrag ist kostenlos und unverbindlich. Es entsteht kein Vertrag und keine Zahlungspflicht — erst beim tatsächlichen Start entscheiden Sie über einen Plan.',
  },
  {
    q: 'Warum gibt es überhaupt eine Warteliste?',
    a: 'Zum Onboarding gehört bei uns ein begleitetes Setup — KI-Inventar, Policy Packs, erste Risikoklassifikation. Das ist pro Woche nur für eine begrenzte Zahl von Organisationen sinnvoll leistbar.',
  },
  {
    q: 'Muss ich warten, um überhaupt loszulegen?',
    a: 'Nein. Der DSGVO-Website-Scan und die kostenlosen Tools sind sofort verfügbar. Die Warteliste betrifft nur Module, deren Freigabe gestaffelt erfolgt.',
  },
  {
    q: 'Was passiert mit meinen Daten?',
    a: 'Ihre Angaben werden ausschließlich für die Kontaktaufnahme zur Freigabe verwendet — kein Newsletter, keine Weitergabe an Dritte. Gespeichert wird in Frankfurt; von Ihrer IP-Adresse wird nur ein Hash zur Missbrauchsabwehr abgelegt, nie die Adresse selbst.',
  },
  {
    q: 'Wie komme ich schneller dran?',
    a: 'Beschreiben Sie im Formular kurz Ihren Anwendungsfall. Wenn ein Modul dazu schon freigegeben ist, melden wir uns direkt — und wenn Sie eine feste Frist haben (etwa eine anstehende Prüfung), sagen Sie es dort.',
  },
];

const WAITLIST_FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: WAITLIST_FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

function breadcrumbs(items: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : SITE_URL + item.url,
    })),
  };
}

// ─── Route → SEO-Config Map ──────────────────────────────────────────────────

export const SEO_CONFIG: Record<string, SEOConfig> = {
  // ─── Tier 1 — Hero / Top-Conversion ──────────────────────────────────────
  '/': {
    // Europe-OS hero lock — matches hero-content.ts H1.
    title: 'RealSyncDynamics.AI — AI Compliance Operations OS for Europe',
    description:
      'Runtime governance for regulated AI systems. Continuous evidence. EU-native by design. Free Audit starten — Acquisition-Scan, dann Governance OS.',
    canonical: `${SITE_URL}/`,
    ogTitle: 'AI Compliance Operations OS for Europe',
    ogDescription:
      'Runtime governance for regulated AI systems. Continuous evidence. EU-native by design.',
  },
  '/pricing': {
    title: 'Preise – Runtime-native AI-Governance-Plattform | RealSyncDynamics.AI',
    description:
      'Free Audit (0 €), Starter (79 €), Growth (249 €), Agency (699 €), Enterprise (auf Anfrage). Runtime-native Governance: kontinuierliche Telemetrie, Policy-Engine, kryptografisch nachvollziehbare Evidenz. EU-Hosting, AVV inklusive.',
    canonical: `${SITE_URL}/pricing`,
    jsonLd: [
      PRICING_PRODUCT_JSONLD,
      breadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'Preise', url: '/pricing' },
      ]),
    ],
  },
  '/claude-code-optimizer': {
    title: 'Claude Code Optimizer — DSGVO- & AI-Act-Audit direkt im Code | RealSyncDynamics.AI',
    description:
      'Der Claude Code Optimizer prüft Ihr Repository auf Datenschutz- und AI-Act-Verstöße, liefert einfügbaren Fix-Code und sichert jeden Merge als auditfähige Evidenz. 14 Tage kostenlos testen.',
    canonical: `${SITE_URL}/claude-code-optimizer`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Claude Code Optimizer', url: '/claude-code-optimizer' },
    ]),
  },
  '/features': {
    title: 'Funktionen: Website-Scan, AI-Act-Inventar, Audit-Trail | RealSyncDynamics.AI',
    description:
      'Automatische Cookie-Erkennung, Consent-Timing-Analyse, AVV-Generator, VVT, TOM und AI-Act-Risk-Assessment in einer Plattform. EU-Hosting Frankfurt.',
    canonical: `${SITE_URL}/features`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Funktionen', url: '/features' },
    ]),
  },
  '/audit': {
    title: 'Kostenloser DSGVO-Audit — URL-Scan in 60 Sekunden | RealSyncDynamics.AI',
    description:
      'Sofortiger Compliance-Score (0-100) für jede URL. Top-Risiken sichtbar, Mini-PDF-Report, kein Account. Echter Playwright-Browser misst Pre-Consent-Tracker.',
    canonical: `${SITE_URL}/audit`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Audit', url: '/audit' },
    ]),
  },
  '/cookie-scanner': {
    title: 'Kostenloser Cookie-Scanner für DSGVO-Websites',
    description:
      'Prüfen Sie, ob Ihre Website Cookies, Tracker oder externe Dienste vor Einwilligung lädt. Kostenloser DSGVO-Cookie-Scan ohne Account.',
    canonical: `${SITE_URL}/cookie-scanner`,
    jsonLd: [
      COOKIE_SCANNER_WEBAPP_JSONLD,
      breadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'Cookie-Scanner', url: '/cookie-scanner' },
      ]),
    ],
  },
  '/ai-governance': {
    title: 'AI Governance OS für DSGVO und EU AI Act | RealSyncDynamicsAI',
    description:
      'Inventory · Policy Engine · Evidence Vault · Runtime Telemetry. AI-Systeme inventarisieren, klassifizieren, überwachen und nachweisen — Audit-ready für EU AI Act.',
    canonical: `${SITE_URL}/ai-governance`,
    ogTitle: 'AI Governance OS für Unternehmen',
    ogDescription:
      'AI-Systeme inventarisieren, EU-AI-Act-Risiken klassifizieren, Policies definieren, Runtime-Events erfassen und Audit-Trails erzeugen.',
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AI Governance OS', url: '/ai-governance' },
    ]),
  },
  '/runtime': {
    title: 'Runtime — Kontinuierliche Compliance-Überwachung | RealSyncDynamics.AI',
    description:
      'Governance-Runtime mit kontinuierlicher Überwachung: Compliance-Agenten, überprüfbare Evidence-Reports, dokumentierte Policies und Incident-Tracking. Demo-Surface für Pilot-Evaluierung.',
    canonical: `${SITE_URL}/runtime`,
    ogTitle: 'Governance Runtime — Kontinuierliche Compliance-Überwachung',
    ogDescription:
      'Kontinuierliche Compliance-Überwachung mit Agenten, Evidence Vault und Policy Enforcement — auditfähig, EU-gehostet.',
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Runtime', url: '/runtime' },
    ]),
  },
  '/ai-act': {
    title: 'AI Act Governance — Klassifikation & Risiko-Assessment | RealSyncDynamics.AI',
    description:
      'EU AI Act ohne Beratung: AI-Systeme klassifizieren (minimal/limited/high/prohibited), Hochrisiko-Profile, Agent-Oversight und Policy Engine — alle Findings in der Evidence Chain.',
    canonical: `${SITE_URL}/ai-act`,
    ogTitle: 'AI Act Governance — Klassifikation & Compliance',
    ogDescription:
      'Automatisierte Klassifikation von KI-Systemen nach EU AI Act. Hochrisiko-Erkennung, Oversight und Policies für regulierte Branchen.',
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AI Act Governance', url: '/ai-act' },
    ]),
  },
  // Warteliste. Das englische Alias /waitlist bekommt hier bewusst keinen
  // eigenen Eintrag: es wird per 301 (public/_redirects) auf diese URL
  // umgeleitet und rendert nie selbst.
  '/warteliste': {
    title: 'Warteliste — Früher Zugang zur AI Governance Runtime | RealSyncDynamics.AI',
    description:
      'Sichern Sie sich Ihren Platz für Governance Runtime, Evidence Vault, Policy Packs und Herkunftsnachweis. Kostenlos, unverbindlich, Position sofort sichtbar — EU-gehostet in Frankfurt.',
    canonical: `${SITE_URL}/warteliste`,
    ogTitle: 'Warteliste — Früher Zugang zur AI Governance Runtime',
    ogDescription:
      'Module werden in Wellen freigegeben. Tragen Sie sich ein und erhalten Sie die Einladung, sobald ein Platz frei wird.',
    jsonLd: [
      breadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'Warteliste', url: '/warteliste' },
      ]),
      WAITLIST_FAQ_JSONLD,
    ],
  },
  '/governance-score': {
    title: 'Governance Complexity Score — passende Governance-Abdeckung | RealSyncDynamics.AI',
    description:
      'Ermitteln Sie Ihren Governance Complexity Score aus Branche, Datenkategorien, KI-Nutzung, Drittanbietern, Tracking und Dokumentationspflichten — und finden Sie die passende Governance-Abdeckung statt einer Anzahl Webseiten.',
    canonical: `${SITE_URL}/governance-score`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Governance Complexity Score', url: '/governance-score' },
    ]),
  },
  '/digitale-souveraenitaet': {
    title: 'Digitale Souveränität als Betriebsmodell | RealSyncDynamics.AI',
    description:
      'Digitale Souveränität praktisch umsetzen: transparente Anbieterstruktur, nachweisbare DSGVO- & AI-Act-Governance, Kontrolle über Drittanbieter und Datenflüsse, Evidence Vault und kontinuierliches Monitoring — das Governance OS im Browser-Format.',
    canonical: `${SITE_URL}/digitale-souveraenitaet`,
    ogTitle: 'Digitale Souveränität als Betriebsmodell',
    ogDescription:
      'Souveräne Compliance-Infrastruktur für DSGVO, EU AI Act und Software-Supply-Chain-Governance — kontinuierlich, auditfähig, EU-gehostet.',
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Digitale Souveränität', url: '/digitale-souveraenitaet' },
    ]),
  },
  '/ai-act-faq': {
    title: 'EU AI Act FAQ für Unternehmen',
    description:
      'Die wichtigsten Fragen zum EU AI Act für Unternehmen, Datenschutzbeauftragte und regulierte Branchen verständlich erklärt.',
    canonical: `${SITE_URL}/ai-act-faq`,
    jsonLd: [
      AI_ACT_FAQ_JSONLD,
      breadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'EU AI Act FAQ', url: '/ai-act-faq' },
      ]),
    ],
  },
  '/contact-sales': {
    title: 'Founding Access — 14 Tage kostenlos | RealSyncDynamics.AI',
    description:
      '14 Tage kostenloser Enterprise-Zugang für 100 Unternehmen bis 02.08.2026. Gegenleistung: Feedback, Verbesserungsvorschläge und Screenshots.',
    canonical: `${SITE_URL}/contact-sales`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Founding Access', url: '/contact-sales' },
    ]),
  },

  // ─── Tier 2 — Alternative Pages (high commercial intent) ─────────────────
  '/cookiebot-alternative': {
    title: 'Cookiebot Alternative mit EU-Hosting & AI-Act | RealSyncDynamics.AI',
    description:
      'RealSyncDynamics.AI vs. Cookiebot: Consent-Timing-Analyse, fertige Fix-Snippets & Remediation-Pläne, EU-Server Frankfurt, AI-Act-Inventar. Kostenloser Vergleichs-Scan.',
    canonical: `${SITE_URL}/cookiebot-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Cookiebot Alternative', url: '/cookiebot-alternative' },
    ]),
  },
  '/dataguard-alternative': {
    title: 'DataGuard Alternative — automatisierte Compliance ab 79 € | RealSyncDynamics.AI',
    description:
      'Günstigere DataGuard Alternative mit automatischem Website-Scan, Consent-Timing und AI-Act-Compliance. Kein Setup, kein Berater erforderlich.',
    canonical: `${SITE_URL}/dataguard-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'DataGuard Alternative', url: '/dataguard-alternative' },
    ]),
  },
  '/onetrust-alternative': {
    title: 'OneTrust Alternative für KMU und Agenturen | RealSyncDynamics.AI',
    description:
      'OneTrust ist für Enterprise. RealSyncDynamics.AI ist für KMU: automatischer DSGVO-Scan, Consent-Management und AI-Act-Inventar — ab 79 €/Monat.',
    canonical: `${SITE_URL}/onetrust-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'OneTrust Alternative', url: '/onetrust-alternative' },
    ]),
  },
  '/usercentrics-alternative': {
    title: 'Usercentrics Alternative — Compliance statt CMP | RealSyncDynamics.AI',
    description:
      'Usercentrics ist ein Cookie-CMP. RealSyncDynamics.AI ist Compliance-Infrastruktur: Pre-Consent-Detection, AI-Act-Modul, Evidence Vault — Made in Germany.',
    canonical: `${SITE_URL}/usercentrics-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Usercentrics Alternative', url: '/usercentrics-alternative' },
    ]),
  },
  '/iubenda-alternative': {
    title: 'Iubenda Alternative — voller Compliance-Stack | RealSyncDynamics.AI',
    description:
      'Iubenda generiert Texte. RealSyncDynamics.AI auditet, monitort und remediatet kontinuierlich — mit echtem Headless-Browser, Evidence Vault und AI-Act-Modul.',
    canonical: `${SITE_URL}/iubenda-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Iubenda Alternative', url: '/iubenda-alternative' },
    ]),
  },
  '/borlabs-alternative': {
    title: 'Borlabs Cookie Alternative — alle Stacks, nicht nur WordPress | RealSyncDynamics.AI',
    description:
      'Borlabs ist ein WP-Plugin. RealSyncDynamics.AI ist Compliance-Infrastruktur für WordPress, Shopify, Webflow, custom — mit Pre-Consent-Audit + Fix-Empfehlungen.',
    canonical: `${SITE_URL}/borlabs-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Borlabs Alternative', url: '/borlabs-alternative' },
    ]),
  },
  '/proliance-alternative': {
    title: 'Proliance Alternative — Web-Compliance-Automation | RealSyncDynamics.AI',
    description:
      'Proliance ist Compliance-Suite. RealSyncDynamics.AI fokussiert auf Web-Compliance: Pre-Consent-Audit, Fix-Empfehlungen und Continuous Monitoring.',
    canonical: `${SITE_URL}/proliance-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Proliance Alternative', url: '/proliance-alternative' },
    ]),
  },

  // ─── Tier 3 — Branchen-Landings ──────────────────────────────────────────
  '/healthtech': {
    title: 'DSGVO-Compliance für HealthTech & Praxen | RealSyncDynamics.AI',
    description:
      'Automatische DSGVO-Prüfung für Gesundheits-Apps, Praxiswebsites und HealthTech-Plattformen. Sensible Patientendaten DSGVO-konform verarbeiten.',
    canonical: `${SITE_URL}/healthtech`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'HealthTech', url: '/healthtech' },
    ]),
  },
  '/fintech': {
    title: 'DSGVO & BAIT-Compliance für FinTech | RealSyncDynamics.AI',
    description:
      'Compliance für Finanzdienstleister: DSGVO, BAIT, MaRisk und AI-Act in einem automatisierten Audit. EU-Datenresidenz, Audit-Trail, DSB-Workflows.',
    canonical: `${SITE_URL}/fintech`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'FinTech', url: '/fintech' },
    ]),
  },
  '/insurance': {
    title: 'Versicherungs-Compliance — VAIT, BaFin, AI-Act | RealSyncDynamics.AI',
    description:
      'Für Versicherer: VAIT-konforme IT-Governance, BaFin-Audit-Trail, AI-Act-Klassifikation für Tarif- und Schadenmodelle. Schrems-II-konformes EU-Hosting.',
    canonical: `${SITE_URL}/insurance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'Versicherung', url: '/insurance' },
    ]),
  },
  '/legal-tech': {
    title: 'DSGVO-Compliance für Kanzleien & Legal Tech | RealSyncDynamics.AI',
    description:
      'Automatisierter DSGVO-Check für Anwaltskanzleien. Mandantendaten-Schutz, sichere Kontaktformulare, Impressum und Datenschutzerklärung prüfen.',
    canonical: `${SITE_URL}/legal-tech`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'Legal Tech', url: '/legal-tech' },
    ]),
  },
  '/kanzleien': {
    title: 'DSGVO-Compliance für Kanzleien & Legal Tech | RealSyncDynamics.AI',
    description:
      'Automatisierter DSGVO-Check für Anwaltskanzleien. Mandantendaten-Schutz, sichere Kontaktformulare, Impressum und Datenschutzerklärung prüfen.',
    canonical: `${SITE_URL}/legal-tech`,
  },
  '/oeffentliche-verwaltung': {
    title: 'Behörden-KI — IT-Grundschutz, DSGVO + AI-Act | RealSyncDynamics.AI',
    description:
      'Für Bundes-, Landes- und Kommunalverwaltung: IT-Grundschutz, BSI C5, DSGVO + AI-Act-Hochrisiko-Klassifikation, Evidence Vault, On-Premise-Option.',
    canonical: `${SITE_URL}/oeffentliche-verwaltung`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'Öffentliche Verwaltung', url: '/oeffentliche-verwaltung' },
    ]),
  },
  '/behoerden': {
    title: 'Behörden-KI — IT-Grundschutz, DSGVO + AI-Act | RealSyncDynamics.AI',
    description:
      'Für Bundes-, Landes- und Kommunalverwaltung: IT-Grundschutz, BSI C5, DSGVO + AI-Act-Hochrisiko-Klassifikation, Evidence Vault, On-Premise-Option.',
    canonical: `${SITE_URL}/oeffentliche-verwaltung`,
  },
  '/online-shops': {
    title: 'E-Commerce-Compliance — Cookie-Banner, AVV, Tracking | RealSyncDynamics.AI',
    description:
      'Für Online-Shops: Pre-Consent-Tracker-Detection (Meta Pixel, Google Ads), Cookie-Banner-Audit, AVV mit Stripe/PayPal, automatische Datenschutzerklärung.',
    canonical: `${SITE_URL}/online-shops`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'Online-Shops', url: '/online-shops' },
    ]),
  },
  '/ecommerce': {
    title: 'E-Commerce-Compliance — Cookie-Banner, AVV, Tracking | RealSyncDynamics.AI',
    description:
      'Für Online-Shops: Pre-Consent-Tracker-Detection (Meta Pixel, Google Ads), Cookie-Banner-Audit, AVV mit Stripe/PayPal, automatische Datenschutzerklärung.',
    canonical: `${SITE_URL}/online-shops`,
  },
  '/personalwesen': {
    title: 'HR-Compliance — § 26 BDSG, AI-Act-Recruiting | RealSyncDynamics.AI',
    description:
      'Für HR-Abteilungen und HR-Tech: § 26 BDSG, AI-Act-Hochrisiko für KI-Recruiting, Löschfristen, AVV mit ATS-Anbietern. Bewerber-DSE und VVT automatisiert.',
    canonical: `${SITE_URL}/personalwesen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'HR / Personalwesen', url: '/personalwesen' },
    ]),
  },
  '/hr-software': {
    title: 'HR-Software-Compliance — DSGVO + § 26 BDSG + AI Act | RealSyncDynamics.AI',
    description:
      'Für HR-Software-Anbieter: § 26 BDSG-konforme Architektur, AI-Act-Klassifikation für Recruiting-Algorithmen, Audit-Trail für Performance-Reviews.',
    canonical: `${SITE_URL}/personalwesen`,
  },
  '/schulen': {
    title: 'Schulen-Compliance — DSGVO + KMK + Schüler-Datenschutz | RealSyncDynamics.AI',
    description:
      'Für Schulen und Schulträger: KMK-Empfehlungen, DSGVO für Schüler- und Elterndaten, AI-Act für Bildungs-KI, Evidence Vault für Behörden-Auditierung.',
    canonical: `${SITE_URL}/schulen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'Schulen', url: '/schulen' },
    ]),
  },
  '/bildung': {
    title: 'Bildungs-Compliance — DSGVO + AI Act für EduTech | RealSyncDynamics.AI',
    description:
      'Für EduTech und Hochschulen: DSGVO-konforme Lernplattformen, AI-Act-Klassifikation für adaptive Tests + Proctoring, KMK-Konformität, On-Premise-Option.',
    canonical: `${SITE_URL}/schulen`,
  },
  '/education': {
    title: 'Education Compliance — GDPR + EU AI Act for EdTech | RealSyncDynamics.AI',
    description:
      'For EdTech, schools, and universities: GDPR-compliant learning platforms, EU AI Act classification for adaptive testing + proctoring, on-premise option.',
    canonical: `${SITE_URL}/schulen`,
  },
  '/saas-anbieter': {
    title: 'SaaS-Compliance — Multi-Tenant DSGVO, AVV, Sub-Prozessoren | RealSyncDynamics.AI',
    description:
      'Für SaaS-Anbieter: Multi-Tenant-Architektur, AVV mit Endkunden, Sub-Prozessor-Liste, DSGVO Art. 32, AI-Act-Klassifikation, EU-Datenresidenz Default.',
    canonical: `${SITE_URL}/saas-anbieter`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'SaaS-Anbieter', url: '/saas-anbieter' },
    ]),
  },
  '/saas-providers': {
    title: 'SaaS Compliance — Multi-Tenant GDPR, DPA, Sub-Processors | RealSyncDynamics.AI',
    description:
      'For SaaS providers: multi-tenant architecture, DPA with end customers, sub-processor list, GDPR Art. 32, EU AI Act classification, EU residency.',
    canonical: `${SITE_URL}/saas-anbieter`,
  },
  '/fuer-saas': {
    title: 'Für SaaS-Teams — DSGVO-Compliance als Infrastruktur | RealSyncDynamics.AI',
    description:
      'Compliance-Layer für SaaS-Teams: API-First, Multi-Tenant, BYOK, Webhooks. Mechanical Input + AI Orchestration + Digital Output. Pilot ab 249 €/Monat.',
    canonical: `${SITE_URL}/fuer-saas`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Für SaaS', url: '/fuer-saas' },
    ]),
  },
  '/fuer-praxen': {
    title: 'Für Arztpraxen + Zahnärzte — DSGVO ohne IT-Aufwand | RealSyncDynamics.AI',
    description:
      'DSGVO-Komplettpaket für Arzt- und Zahnarztpraxen: Cookie-Banner, Datenschutzerklärung, AVV mit Praxisverwaltung, Patientendaten-Schutz. Starter ab 79 €/Monat, Growth ab 249 €/Monat.',
    canonical: `${SITE_URL}/fuer-praxen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Für Praxen', url: '/fuer-praxen' },
    ]),
  },
  '/fuer-agenturen': {
    title:
      'DSGVO-Compliance für Agenturen — alle Kundenprojekte prüfen | RealSyncDynamics.AI',
    description:
      'Als Agentur alle Kundenwebsites automatisch auf DSGVO-Konformität prüfen. Whitelabel-Reports, Multi-Domain-Scanning, Team-Zugänge.',
    canonical: `${SITE_URL}/fuer-agenturen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Für Agenturen', url: '/fuer-agenturen' },
    ]),
  },
  '/agencies': {
    title: 'GDPR Compliance for Marketing Agencies — White-Label Audits | RealSyncDynamics.AI',
    description:
      'Audit engine for agencies: multi-tenant dashboard, white-label reports, API access for bulk scans, CI/CD integration. Deliver GDPR compliance as a service.',
    canonical: `${SITE_URL}/fuer-agenturen`,
  },
  '/steuerberater': {
    title: 'Steuerberater-Compliance — DSGVO + DATEV + Mandantenschutz | RealSyncDynamics.AI',
    description:
      'Für Steuerberatungs-Kanzleien: DSGVO + § 203 StGB Mandantengeheimnis, DATEV-konforme Schnittstellen, Audit-Trail für Belegverarbeitung.',
    canonical: `${SITE_URL}/steuerberater`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/' },
      { name: 'Steuerberater', url: '/steuerberater' },
    ]),
  },
  '/steuerkanzlei': {
    title: 'Steuerkanzlei-Compliance — DSGVO + DATEV + Mandantenschutz | RealSyncDynamics.AI',
    description:
      'Für Steuerkanzleien: DSGVO + § 203 StGB Mandantengeheimnis, DATEV-konforme Schnittstellen, Audit-Trail für Belegverarbeitung, AVV mit Sub-Prozessoren.',
    canonical: `${SITE_URL}/steuerberater`,
  },

  // ─── Resources / Vergleich / FAQ / Guides ────────────────────────────────
  '/tools': {
    title: 'Compliance-Tools Hub — Scanner, Generatoren, Checks | RealSyncDynamics.AI',
    description:
      'Alle DSGVO- und AI-Act-Tools auf einer Seite: Cookie-Scanner, AVV-Generator, Datenschutzerklärung-Generator, EU-AI-Act-Klassifikator, DSFA-Wizard.',
    canonical: `${SITE_URL}/tools`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Tools', url: '/tools' },
    ]),
  },
  '/dsfa-wizard': {
    title: 'DSFA-Wizard — Datenschutz-Folgenabschätzung nach Art. 35 DSGVO | RealSyncDynamics.AI',
    description:
      'Strukturierte Datenschutz-Folgenabschätzung Schritt für Schritt: Verarbeitungsbeschreibung, Risiko-Bewertung, Maßnahmen. Konform mit Art. 35 DSGVO.',
    canonical: `${SITE_URL}/dsfa-wizard`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Tools', url: '/tools' },
      { name: 'DSFA-Wizard', url: '/dsfa-wizard' },
    ]),
  },
  '/busseld-rechner': {
    title: 'DSGVO-Bußgeld-Rechner — Risiko-Schätzung nach Art. 83 | RealSyncDynamics.AI',
    description:
      'Schätzen Sie Ihr DSGVO-Bußgeld-Risiko: Branchen-Faktor, Verstoß-Kategorie (Art. 83 Abs. 4/5), Umsatz und Schweregrad — mit Behörden-Praxis von 2024-2026.',
    canonical: `${SITE_URL}/busseld-rechner`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Tools', url: '/tools' },
      { name: 'Bußgeld-Rechner', url: '/busseld-rechner' },
    ]),
  },
  '/ressourcen': {
    title: 'Ressourcen — Whitepaper, Checklisten, Guides | RealSyncDynamics.AI',
    description:
      'Praxis-Material zu DSGVO + AI Act: BAIT/MaRisk-Guide, Schrems-II-Erklärung, DSGVO-KI-Checkliste, Tool-Vergleiche. Stand 2026, ohne Marketing-Fluff.',
    canonical: `${SITE_URL}/ressourcen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Ressourcen', url: '/ressourcen' },
    ]),
  },
  '/resources': {
    title: 'Resources — Whitepapers, Checklists, Guides | RealSyncDynamics.AI',
    description:
      'Practical material on GDPR + EU AI Act: BAIT/MaRisk guide, Schrems II explainer, GDPR AI checklist, tool comparisons. Stand 2026, no marketing fluff.',
    canonical: `${SITE_URL}/ressourcen`,
  },
  '/audit-pro': {
    title: 'Audit Pro — Vollständiger DSGVO + AI-Act-Audit | RealSyncDynamics.AI',
    description:
      'Tiefen-Audit mit allen Findings, Paragraphen-Bezug, Auto-Fix-Empfehlungen und PDF-Report für Datenschutzbeauftragte. Inkl. Consent-Timing + AI-Act-Klassifikation.',
    canonical: `${SITE_URL}/audit-pro`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Audit Pro', url: '/audit-pro' },
    ]),
  },
  '/dsgvo-tool-vergleich': {
    title: 'DSGVO-Tool-Vergleich 2026 — Cookiebot vs Usercentrics vs OneTrust | RealSyncDynamics.AI',
    description:
      'Direkter Feature-Vergleich der wichtigsten DSGVO-Tools. Pre-Consent-Detection, Fix-Empfehlungen, Evidence Vault, AI-Act-Module, Preise — was deckt welches Tool ab?',
    canonical: `${SITE_URL}/dsgvo-tool-vergleich`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'DSGVO-Tool-Vergleich', url: '/dsgvo-tool-vergleich' },
    ]),
  },
  '/dsgvo-ki-checkliste': {
    title: 'DSGVO + KI Checkliste 2026 — Praxis-Guide | RealSyncDynamics.AI',
    description:
      '12 konkrete Prüfpunkte für DSGVO-konformen KI-Einsatz: Rechtsgrundlage, AVV, Schrems-II, AI-Act-Klassifikation, technische Maßnahmen, DSFA-Pflicht.',
    canonical: `${SITE_URL}/dsgvo-ki-checkliste`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'DSGVO + KI Checkliste', url: '/dsgvo-ki-checkliste' },
    ]),
  },
  '/bait-marisk-compliance-guide': {
    title: 'BAIT + MaRisk Compliance Guide — KI-Einsatz in Banken | RealSyncDynamics.AI',
    description:
      'Praxis-Guide für BaFin-regulierte Institute: BAIT-Anforderungen, MaRisk-Audit-Trail für ML-Modelle, AI-Act-Klassifikation für Credit-Scoring.',
    canonical: `${SITE_URL}/bait-marisk-compliance-guide`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'BAIT + MaRisk Guide', url: '/bait-marisk-compliance-guide' },
    ]),
  },
  '/onboarding-erklaert': {
    title: 'Onboarding erklärt — IT verbinden statt ersetzen | RealSyncDynamics.AI',
    description:
      'Wie das Onboarding abläuft: Unternehmensprofil, Systeme erkennen, verbinden, Datenflüsse analysieren, Risiken und Nachweise — ohne Ihre IT auszutauschen.',
    canonical: `${SITE_URL}/onboarding-erklaert`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Onboarding erklärt', url: '/onboarding-erklaert' },
    ]),
  },
  '/schrems-ii-erklaert': {
    title: 'Schrems II erklärt — Was EuGH-Urteil C-311/18 bedeutet | RealSyncDynamics.AI',
    description:
      'EuGH C-311/18 (Schrems II) hat den Privacy Shield gekippt. Was bedeutet das für SaaS, Cloud, KI-APIs? Konkrete Maßnahmen + EU-Hosting-Optionen.',
    canonical: `${SITE_URL}/schrems-ii-erklaert`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Schrems II erklärt', url: '/schrems-ii-erklaert' },
    ]),
  },
  '/faq': {
    title: 'FAQ — Häufige Fragen zu DSGVO, AI Act & Plattform | RealSyncDynamics.AI',
    description:
      'Antworten zu Datenresidenz, AVV, Schrems-II, AI-Act-Klassifikation, Preisen, Setup, Kündigung, Sub-Prozessoren und Audit-Trail. Stand Mai 2026.',
    canonical: `${SITE_URL}/haeufige-fragen`,
  },
  '/haeufige-fragen': {
    title: 'Häufige Fragen — DSGVO, AI Act und Plattform-Details | RealSyncDynamics.AI',
    description:
      'Antworten zu Datenresidenz, AVV, Schrems-II, AI-Act-Klassifikation, Preisen, Setup, Kündigung, Sub-Prozessoren und Audit-Trail. Stand Mai 2026.',
    canonical: `${SITE_URL}/haeufige-fragen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Häufige Fragen', url: '/haeufige-fragen' },
    ]),
  },
  '/case-studies': {
    title: 'Case Studies — DSGVO + AI-Act in der Praxis | RealSyncDynamics.AI',
    description:
      'Anonymisierte Case Studies aus HealthTech, FinTech, LegalTech: konkrete Compliance-Probleme, technische Lösung, Audit-Outcome — mit DSB-Stimmen.',
    canonical: `${SITE_URL}/case-studies`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Case Studies', url: '/case-studies' },
    ]),
  },

  // ─── Trust / Methodik / Legal ────────────────────────────────────────────
  '/security': {
    title: 'Security — ISO 27001-Track, BSI C5, EU-Datenresidenz | RealSyncDynamics.AI',
    description:
      'Security-Posture: ISO 27001-Track, BSI C5, EU-Datenresidenz Default, kryptografische Audit-Trails (Evidence Vault), Penetration-Test-Reports, BYOK.',
    canonical: `${SITE_URL}/security`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Security', url: '/security' },
    ]),
  },
  '/sicherheit': {
    title: 'Sicherheit — ISO 27001-Track, BSI C5, EU-Datenresidenz | RealSyncDynamics.AI',
    description:
      'Security-Posture: ISO 27001-Track, BSI C5, EU-Datenresidenz Default, kryptografische Audit-Trails (Evidence Vault), Penetration-Test-Reports, BYOK.',
    canonical: `${SITE_URL}/security`,
  },
  '/methodik': {
    title: 'Methodik 2026.05.0 — Compliance-Detection-Methodik | RealSyncDynamics.AI',
    description:
      'Volltransparente Methodik: Playwright-Engine, Regelengine, Tracker-Registry (18 Trackers), Consent-Timing-Algorithmus. Versionierte Releases, öffentlich auditierbar.',
    canonical: `${SITE_URL}/legal/methodology`,
  },
  '/legal/methodology': {
    title: 'Methodology 2026.05.0 — Compliance Detection | RealSyncDynamics.AI',
    description:
      'Fully transparent methodology: Playwright engine, rules engine, tracker registry (18 trackers), consent-timing algorithm. Versioned releases, publicly auditable.',
    canonical: `${SITE_URL}/legal/methodology`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Methodology', url: '/legal/methodology' },
    ]),
  },
  '/grenzen': {
    title: 'Grenzen — Was unsere Plattform NICHT kann | RealSyncDynamics.AI',
    description:
      'Was wir bewusst NICHT versprechen: kein "100% rechtssicher", kein Anwalts-Ersatz, kein Audit für Backend-Server, kein automatischer DSB. Klare Grenzen.',
    canonical: `${SITE_URL}/grenzen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Grenzen', url: '/grenzen' },
    ]),
  },
  '/legal/privacy': {
    title: 'Datenschutzerklärung | RealSyncDynamics.AI',
    description:
      'Datenschutzerklärung von RealSyncDynamics.AI gemäß DSGVO Art. 13/14. Verantwortlicher, Verarbeitungszwecke, Betroffenenrechte und Sub-Prozessoren.',
    canonical: `${SITE_URL}/legal/privacy`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Datenschutz', url: '/legal/privacy' },
    ]),
  },
  '/legal/datenschutz': {
    title: 'Datenschutzerklärung | RealSyncDynamics.AI',
    description:
      'Datenschutzerklärung von RealSyncDynamics.AI gemäß DSGVO Art. 13/14. Verantwortlicher, Verarbeitungszwecke, Betroffenenrechte und Sub-Prozessoren.',
    canonical: `${SITE_URL}/legal/privacy`,
  },
  '/datenschutz': {
    title: 'Datenschutzerklärung | RealSyncDynamics.AI',
    description:
      'Datenschutzerklärung von RealSyncDynamics.AI gemäß DSGVO Art. 13/14. Verantwortlicher, Verarbeitungszwecke, Betroffenenrechte und Sub-Prozessoren.',
    canonical: `${SITE_URL}/legal/privacy`,
  },
  '/legal/impressum': {
    title: 'Impressum | RealSyncDynamics.AI',
    description:
      'Impressum von RealSyncDynamics.AI (RealSync Dynamics, Neuhaus am Rennweg). Angaben gemäß § 5 DDG und § 18 MStV.',
    canonical: `${SITE_URL}/legal/impressum`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Impressum', url: '/legal/impressum' },
    ]),
  },
  '/impressum': {
    title: 'Impressum | RealSyncDynamics.AI',
    description:
      'Impressum von RealSyncDynamics.AI (RealSync Dynamics, Neuhaus am Rennweg). Angaben gemäß § 5 DDG und § 18 MStV.',
    canonical: `${SITE_URL}/legal/impressum`,
  },
  '/legal/sub-processors': {
    title: 'Sub-Prozessoren & Auftragsverarbeiter (DSGVO Art. 28) | RealSyncDynamics.AI',
    description:
      'Vollständige Liste aller Auftragsverarbeiter: Supabase, Anthropic, Google, OpenAI, Stripe — mit DPA-Links, Regionen und Stand-Datum.',
    canonical: `${SITE_URL}/legal/sub-processors`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Sub-Prozessoren', url: '/legal/sub-processors' },
    ]),
  },
  '/legal/avv': {
    title: 'AVV-Vorlage (Art. 28 DSGVO) | RealSyncDynamics.AI',
    description:
      'Auftragsverarbeitungsvertrag-Vorlage zum Download nach Art. 28 DSGVO. Inkl. Sub-Prozessoren-Liste, TOMs nach Art. 32, EU-Standardvertragsklauseln (SCCs).',
    canonical: `${SITE_URL}/legal/avv`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'AVV-Vorlage', url: '/legal/avv' },
    ]),
  },
  '/legal/terms': {
    title: 'Allgemeine Geschäftsbedingungen | RealSyncDynamics.AI',
    description:
      'AGB für die Nutzung der RealSyncDynamics.AI-Plattform. Leistungsumfang, Vergütung, Kündigung, Haftung, Verbraucherwiderruf, Datenschutz-Verweise.',
    canonical: `${SITE_URL}/legal/terms`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'AGB', url: '/legal/terms' },
    ]),
  },
  '/agb': {
    title: 'Allgemeine Geschäftsbedingungen | RealSyncDynamics.AI',
    description:
      'AGB für die Nutzung der RealSyncDynamics.AI-Plattform. Leistungsumfang, Vergütung, Kündigung, Haftung, Verbraucherwiderruf, Datenschutz-Verweise.',
    canonical: `${SITE_URL}/legal/terms`,
  },
  '/legal/compliance-matrix': {
    title: 'Compliance-Matrix — DSGVO, AI Act, BAIT, MaRisk | RealSyncDynamics.AI',
    description:
      'Vollständige Mapping-Matrix: welche Plattform-Kontrolle welche Norm erfüllt. DSGVO Art. 32, AI Act Annex III, BAIT, MaRisk, BSI C5, ISO 27001 — Audit-ready.',
    canonical: `${SITE_URL}/legal/compliance-matrix`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Compliance-Matrix', url: '/legal/compliance-matrix' },
    ]),
  },

  // ─── DE/EN-Alias-Einträge (fehlende Canonicals — fix #286) ──────────────
  // Jeder EN-Alias zeigt canonical auf die DE-Primär-URL, damit Google
  // nur eine URL indexiert. Die EN-Routen laufen weiter (keine 301-Weiterleitungen
  // nötig), aber Google konsolidiert Link-Equity auf die DE-URL.

  '/versicherungen': {
    title: 'Versicherungs-Compliance — VAIT, BaFin, AI-Act | RealSyncDynamics.AI',
    description:
      'Für Versicherer: VAIT-konforme IT-Governance, BaFin-Audit-Trail, AI-Act-Klassifikation für Tarif- und Schadenmodelle. Schrems-II-konformes EU-Hosting.',
    canonical: `${SITE_URL}/insurance`,
  },
  '/presse': {
    title: 'Presse | RealSyncDynamics.AI',
    description:
      'Pressemitteilungen, Medienanfragen und Logos von RealSyncDynamics.AI — EU-native DSGVO- und AI-Act-Compliance-Plattform.',
    canonical: `${SITE_URL}/presse`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Presse', url: '/presse' },
    ]),
  },
  '/press': {
    title: 'Press | RealSyncDynamics.AI',
    description:
      'Press releases, media inquiries and logos for RealSyncDynamics.AI — EU-native GDPR + AI Act compliance platform.',
    canonical: `${SITE_URL}/presse`,
  },
  '/integrationen': {
    title: 'Integrationen — Shopify, WordPress, Matomo, n8n | RealSyncDynamics.AI',
    description:
      'Alle Integrationen auf einen Blick: Shopify, WordPress, Matomo, HubSpot, n8n, Zapier, CI/CD-Webhooks. DSGVO-konforme Datenflüsse, keine Setup-Gebühr.',
    canonical: `${SITE_URL}/integrationen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Integrationen', url: '/integrationen' },
    ]),
  },
  '/integrations': {
    title: 'Integrations — Shopify, WordPress, Matomo, n8n | RealSyncDynamics.AI',
    description:
      'All integrations at a glance: Shopify, WordPress, Matomo, HubSpot, n8n, Zapier, CI/CD webhooks. GDPR-compliant data flows, no setup fee.',
    canonical: `${SITE_URL}/integrationen`,
  },
  '/marktanalyse': {
    title: 'DSGVO-Tool-Marktanalyse — DACH 2026 | RealSyncDynamics.AI',
    description:
      'Marktanalyse: Cookiebot, OneTrust, Usercentrics, iubenda, DataGuard im Vergleich. Preise, Features, DACH-Tauglichkeit, AI-Act-Readiness — Stand 2026.',
    canonical: `${SITE_URL}/marktanalyse`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Marktanalyse', url: '/marktanalyse' },
    ]),
  },
  '/market-analysis': {
    title: 'GDPR Tool Market Analysis — DACH 2026 | RealSyncDynamics.AI',
    description:
      'Market analysis: Cookiebot, OneTrust, Usercentrics, iubenda, DataGuard compared. Pricing, features, DACH suitability, AI Act readiness — as of 2026.',
    canonical: `${SITE_URL}/marktanalyse`,
  },

  // ─── Tier 4 — Content, Tools, Trust & Docs ───────────────────────────────
  // Diese 38 Pfade standen in public/sitemap.xml, hatten aber keinen eigenen
  // Eintrag — sie fielen damit alle auf DEFAULT_SEO zurueck und lieferten auf
  // einem Drittel der indexierten Flaeche denselben Title und dieselbe
  // Description aus. Alias-Pfade (/api, /ueber-uns, /release-notes) zeigen per
  // canonical auf die primaere URL, analog zur Alias-Strategie im Datei-Kopf.

  // ── Ueber uns / Unternehmen ──
  '/about': {
    title: 'Über uns — EU-Datensouveränität als Default | RealSyncDynamics.AI',
    description:
      'Warum wir RealSyncDynamics.AI bauen: EU-Datensouveränität als Standard statt Premium-Feature. Team, Haltung und der Weg zum Governance OS.',
    canonical: `${SITE_URL}/about`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Über uns', url: '/about' },
    ]),
  },
  '/ueber-uns': {
    title: 'Über uns — EU-Datensouveränität als Default | RealSyncDynamics.AI',
    description:
      'Warum wir RealSyncDynamics.AI bauen: EU-Datensouveränität als Standard statt Premium-Feature. Team, Haltung und der Weg zum Governance OS.',
    canonical: `${SITE_URL}/about`,
  },
  '/trust': {
    title: 'Trust Center — SLOs, Betriebsmetriken, Sicherheit | RealSyncDynamics.AI',
    description:
      'Trust Center: SLOs und Betriebskennzahlen, Sicherheitsarchitektur, Subprozessoren und EU-Hosting — die Belege für Procurement und Security-Review.',
    canonical: `${SITE_URL}/trust`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Trust Center', url: '/trust' },
    ]),
  },
  '/status': {
    title: 'System-Status und Wartungsfenster | RealSyncDynamics.AI',
    description:
      'Aktueller Betriebsstatus der Governance-Runtime, laufende Störungen und geplante Wartungsfenster. Transparenz über Verfügbarkeit in Echtzeit.',
    canonical: `${SITE_URL}/status`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Status', url: '/status' },
    ]),
  },
  '/changelog': {
    title: 'Changelog — was sich in der Runtime geändert hat | RealSyncDynamics.AI',
    description:
      'Chronologischer Changelog der Governance-Runtime: neue Routen, Scanner-Erweiterungen, Policy-Änderungen und Fixes — mit Datum und Wirkung.',
    canonical: `${SITE_URL}/changelog`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Changelog', url: '/changelog' },
    ]),
  },
  '/release-notes': {
    title: 'Release Notes — Änderungen an der Runtime | RealSyncDynamics.AI',
    description:
      'Chronologischer Changelog der Governance-Runtime: neue Routen, Scanner-Erweiterungen, Policy-Änderungen und Fixes — mit Datum und Wirkung.',
    canonical: `${SITE_URL}/changelog`,
  },
  '/pilot-readiness': {
    title: 'Pilot Readiness — Governance-Daten vor dem Start | RealSyncDynamics.AI',
    description:
      'Pilot Readiness prüft vor dem Rollout, welche Governance-Daten bereits vorliegen und welche Nachweise für einen belastbaren Pilotbetrieb noch fehlen.',
    canonical: `${SITE_URL}/pilot-readiness`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Pilot Readiness', url: '/pilot-readiness' },
    ]),
  },
  '/enterprise-konfigurator': {
    title: 'Enterprise-Konfigurator — Vertrag zusammenstellen | RealSyncDynamics.AI',
    description:
      'Enterprise-Umfang selbst zusammenstellen: Module, Mandanten, SLA und Sonderanforderungen erfassen — als Grundlage für ein vertragliches Angebot.',
    canonical: `${SITE_URL}/enterprise-konfigurator`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Enterprise-Konfigurator', url: '/enterprise-konfigurator' },
    ]),
  },
  '/branchen': {
    title: 'Branchen-Übersicht — Governance je Sektor | RealSyncDynamics.AI',
    description:
      'Welche Governance-Pflichten je Branche greifen: Healthcare, FinTech, HR, E-Commerce, Public Sector und Legal — mit Einstieg in die passende Landing.',
    canonical: `${SITE_URL}/branchen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Branchen', url: '/branchen' },
    ]),
  },

  // ── Produkt-Content: die Runtime erklärt ──
  '/governance-runtime': {
    title: 'Governance Runtime für AI, Web und Compliance | RealSyncDynamics.AI',
    description:
      'Event-driven Compliance Runtime für AI-Systeme, Websites und Agents: Policies, Evidence Vault und Framework-Mapping in einer laufenden Schicht.',
    canonical: `${SITE_URL}/governance-runtime`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Governance Runtime', url: '/governance-runtime' },
    ]),
  },
  '/agent-governance': {
    title: 'Agent Governance — Kontrolle über autonome Agenten | RealSyncDynamics.AI',
    description:
      'Warum autonome Agenten Governance brauchen: sechs Säulen der Agent Governance und was passiert, wenn Agenten ohne Aufsicht miteinander reden.',
    canonical: `${SITE_URL}/agent-governance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Agent Governance', url: '/agent-governance' },
    ]),
  },
  '/ai-act-governance': {
    title: 'AI-Act-Governance — Klassifizierung statt Vermutung | RealSyncDynamics.AI',
    description:
      'EU AI Act operativ umsetzen: Systeme klassifizieren statt schätzen, Art.-15-Anforderungen an Accuracy und Robustness belegen, Regressionen erkennen.',
    canonical: `${SITE_URL}/ai-act-governance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AI-Act-Governance', url: '/ai-act-governance' },
    ]),
  },
  '/policy-engine': {
    title: 'Policy Engine — Default, Industry Pack, Custom | RealSyncDynamics.AI',
    description:
      'Drei Policy-Ebenen: plattformweite Default-Policies als Floor, Industry Packs für Healthcare, FinTech und HR, dazu mandantenspezifische Custom-Policies.',
    canonical: `${SITE_URL}/policy-engine`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Policy Engine', url: '/policy-engine' },
    ]),
  },
  '/governance-graph': {
    title: 'Governance Graph — Zusammenhänge statt Listen | RealSyncDynamics.AI',
    description:
      'Drei Fragen, die ein klassisches Audit-Tool nicht beantwortet. Der Governance Graph auf Postgres und Apache AGE verbindet Systeme, Daten und Policies.',
    canonical: `${SITE_URL}/governance-graph`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Governance Graph', url: '/governance-graph' },
    ]),
  },
  '/deployment-governance': {
    title: 'Deployment Governance — Änderungen prüfen | RealSyncDynamics.AI',
    description:
      'Was als governance-relevantes Deployment gilt: neue Third-Party-Vendors, veränderter Tracking-Stack, zusätzliche AI-APIs — erkannt statt übersehen.',
    canonical: `${SITE_URL}/deployment-governance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Deployment Governance', url: '/deployment-governance' },
    ]),
  },
  '/evidence': {
    title: 'Evidence — Chain-Integrität geprüft | RealSyncDynamics.AI',
    description:
      'Nachweise als überprüfbare Kette statt als Ordner: jeder Governance-Event signiert und verkettet, Integrität jederzeit maschinell nachprüfbar.',
    canonical: `${SITE_URL}/evidence`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Evidence', url: '/evidence' },
    ]),
  },
  '/evidence-vault': {
    title: 'Evidence Vault — signierte Nachweiskette | RealSyncDynamics.AI',
    description:
      'Ed25519-Signaturen mit Key je Mandant, leeres Result-Set bedeutet unversehrte Kette. Was im Vault liegt — und was dort bewusst nicht landet.',
    canonical: `${SITE_URL}/evidence-vault`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Evidence Vault', url: '/evidence-vault' },
    ]),
  },
  '/automations': {
    title: 'Automations — Skill wählen, aktivieren, Ergebnis | RealSyncDynamics.AI',
    description:
      'Jeder Skill liefert ein klares Ergebnis: Report, Dokument, Protokoll oder Ticket. Läuft auf der EU-souveränen Infrastruktur, Prüfpfad inklusive.',
    canonical: `${SITE_URL}/automations`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Automations', url: '/automations' },
    ]),
  },

  // ── Tools (Free Tier, ohne Account) ──
  '/avv-generator': {
    title: 'AVV-Generator — Art. 28 DSGVO in 3 Schritten | RealSyncDynamics.AI',
    description:
      'Auftragsverarbeitungsvertrag nach Art. 28 DSGVO in drei Schritten erstellen. Kostenlos, ohne Account, direkt als Dokument zum Weiterverwenden.',
    canonical: `${SITE_URL}/avv-generator`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AVV-Generator', url: '/avv-generator' },
    ]),
  },
  '/datenschutz-generator': {
    title: 'Datenschutzerklärung-Generator — Art. 13 DSGVO | RealSyncDynamics.AI',
    description:
      'DSGVO-konforme Datenschutzerklärung in drei Schritten: alle Pflichtfelder nach Art. 13 geführt erfassen. Kostenlos, ohne Anmeldung, sofort nutzbar.',
    canonical: `${SITE_URL}/datenschutz-generator`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Datenschutz-Generator', url: '/datenschutz-generator' },
    ]),
  },
  '/tom-generator': {
    title: 'TOM-Generator — Art. 32 DSGVO exportfertig | RealSyncDynamics.AI',
    description:
      'Technische und organisatorische Maßnahmen strukturiert dokumentieren und als exportfertiges Dokument nach Art. 32 DSGVO ausgeben — ohne Account.',
    canonical: `${SITE_URL}/tom-generator`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'TOM-Generator', url: '/tom-generator' },
    ]),
  },
  '/vvt-wizard': {
    title: 'VVT-Wizard — Verarbeitungsverzeichnis Art. 30 | RealSyncDynamics.AI',
    description:
      'Verarbeitungsverzeichnis nach Art. 30 DSGVO strukturiert erfassen: Datenkategorien, Empfänger, Zwecke und Fristen — als PDF exportierbar.',
    canonical: `${SITE_URL}/vvt-wizard`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'VVT-Wizard', url: '/vvt-wizard' },
    ]),
  },
  '/datenpanne-meldung': {
    title: 'Datenpanne melden — 72-Stunden-Frist Art. 33 | RealSyncDynamics.AI',
    description:
      'Die 72-Stunden-Frist nach Art. 33 DSGVO läuft ab Kenntnisnahme, nicht ab Eintritt. Frist berechnen und zuständige Aufsichtsbehörde bestimmen.',
    canonical: `${SITE_URL}/datenpanne-meldung`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Datenpanne melden', url: '/datenpanne-meldung' },
    ]),
  },
  '/ai-act-klassifikator': {
    title: 'AI-Act-Klassifikator — Risikoklasse bestimmen | RealSyncDynamics.AI',
    description:
      'Risikoklasse eines KI-Systems nach EU AI Act bestimmen: System beschreiben, Querschnittsfragen beantworten, begründete Einordnung erhalten.',
    canonical: `${SITE_URL}/ai-act-klassifikator`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AI-Act-Klassifikator', url: '/ai-act-klassifikator' },
    ]),
  },
  '/ai-act-workflows': {
    title: 'AI-Act-Workflows — Doku-Pflichten je Use-Case | RealSyncDynamics.AI',
    description:
      'Dokumentationspflichten für Ihre KI-Use-Cases klären — inklusive der Querschnittsthemen Tracker, Security und Drittlandtransfer. Ohne Account.',
    canonical: `${SITE_URL}/ai-act-workflows`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AI-Act-Workflows', url: '/ai-act-workflows' },
    ]),
  },
  '/dokumente-bundle': {
    title: 'Dokumente-Bundle — Pflichtdokumente auf einmal | RealSyncDynamics.AI',
    description:
      'Die DSGVO-Pflichtdokumente in einem Durchgang erzeugen: Stammdaten einmal erfassen, Datenschutzerklärung, AVV und TOM konsistent ausgeben.',
    canonical: `${SITE_URL}/dokumente-bundle`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Dokumente-Bundle', url: '/dokumente-bundle' },
    ]),
  },
  '/cookie-consent-sdk': {
    title: 'Cookie-Consent-SDK — kein Dark Pattern | RealSyncDynamics.AI',
    description:
      'Cookie-Banner mit drei gleichberechtigten Buttons: Accept, Reject, Customize. Kein Cookie vor Consent, kein Dark Pattern, Open-Source-kompatibel.',
    canonical: `${SITE_URL}/cookie-consent-sdk`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Cookie-Consent-SDK', url: '/cookie-consent-sdk' },
    ]),
  },

  // ── SEO-Doorways: regulatorische Suchanfragen ──
  '/cookie-compliance': {
    title: 'Cookie-Compliance prüfen — § 25 TDDDG | RealSyncDynamics.AI',
    description:
      'Cookie-Compliance prüfen: kein Tracker-Load vor Consent, sauberes Double-Opt-In, korrekte Einwilligungsdokumentation nach § 25 TDDDG und DSGVO.',
    canonical: `${SITE_URL}/cookie-compliance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Cookie-Compliance', url: '/cookie-compliance' },
    ]),
  },
  '/pre-consent-tracking': {
    title: 'Pre-Consent-Tracking erkennen und abstellen | RealSyncDynamics.AI',
    description:
      'Pre-Consent-Tracking ist DSGVO- und TDDDG-relevant: Analytics oder Tag Manager direkt im head laden Daten vor der Einwilligung. Erkennen und abstellen.',
    canonical: `${SITE_URL}/pre-consent-tracking`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Pre-Consent-Tracking', url: '/pre-consent-tracking' },
    ]),
  },
  '/google-analytics-consent': {
    title: 'Google Analytics und Consent richtig einordnen | RealSyncDynamics.AI',
    description:
      'Google Analytics DSGVO-konform betreiben: typische technische Indikatoren für Verstöße und wie Google Consent Mode v2 sauber eingeordnet wird.',
    canonical: `${SITE_URL}/google-analytics-consent`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Google Analytics und Consent', url: '/google-analytics-consent' },
    ]),
  },
  '/eu-ai-act-check': {
    title: 'EU-AI-Act-Check — Enforcement-Timeline 2026 | RealSyncDynamics.AI',
    description:
      'Warum der EU AI Act jetzt relevant wird: Enforcement-Timeline, Fristen je Risikoklasse und was Betreiber bis zum Stichtag belegen können müssen.',
    canonical: `${SITE_URL}/eu-ai-act-check`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'EU-AI-Act-Check', url: '/eu-ai-act-check' },
    ]),
  },
  '/bait-compliance': {
    title: 'BAIT-Compliance — bankaufsichtskonform auditierbar | RealSyncDynamics.AI',
    description:
      'BAIT operativ belegen: AT 7.2 Identitäts- und Berechtigungsmanagement, AT 9 IT-Sicherheitsmanagement — bankaufsichtskonform auditierbar dokumentiert.',
    canonical: `${SITE_URL}/bait-compliance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'BAIT-Compliance', url: '/bait-compliance' },
    ]),
  },
  '/marisk-audit': {
    title: 'MaRisk-Audit — KI als operationelles Risiko | RealSyncDynamics.AI',
    description:
      'KI als operationelles Risiko nach MaRisk abbilden: BTO 1.4 Modellvalidierung und BT 3 Internes Kontrollsystem mit laufenden Nachweisen unterlegen.',
    canonical: `${SITE_URL}/marisk-audit`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'MaRisk-Audit', url: '/marisk-audit' },
    ]),
  },

  // ── Entwickler & Integrationen ──
  '/api-docs': {
    title: 'API-Referenz — tenant-scoped Keys, Rate-Limits | RealSyncDynamics.AI',
    description:
      'API-Referenz der Governance-Runtime: Key-Erzeugung, tenant-scoped Zugriff und Rate-Limits je Plan — von Starter 60/min bis Enterprise.',
    canonical: `${SITE_URL}/api-docs`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'API-Referenz', url: '/api-docs' },
    ]),
  },
  '/api': {
    title: 'API-Referenz — tenant-scoped Keys, Rate-Limits | RealSyncDynamics.AI',
    description:
      'API-Referenz der Governance-Runtime: Key-Erzeugung, tenant-scoped Zugriff und Rate-Limits je Plan — von Starter 60/min bis Enterprise.',
    canonical: `${SITE_URL}/api-docs`,
  },
  '/docs': {
    title: 'Docs — Architektur, Tech-Security, Integrationen | RealSyncDynamics.AI',
    description:
      'Architektur, Tech-Security, Scanner-Stack und Integrationen. Genug Tiefe für Procurement und technisches Review vor der Kaufentscheidung.',
    canonical: `${SITE_URL}/docs`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Docs', url: '/docs' },
    ]),
  },
  '/docs/governance': {
    title: 'Governance Runtime — API-Referenz | RealSyncDynamics.AI',
    description:
      'API-Referenz der Governance Runtime: Events über governance-ingest melden, AI-Calls zuordnen und Nachweise maschinenlesbar abrufen.',
    canonical: `${SITE_URL}/docs/governance`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Docs', url: '/docs' },
      { name: 'Governance Runtime', url: '/docs/governance' },
    ]),
  },
  '/integrations/shopify': {
    title: 'Shopify-Integration — Consent und Tracker prüfen | RealSyncDynamics.AI',
    description:
      'Shopify-Shop an die Governance-Runtime anbinden: Tracker und Consent-Verhalten laufend prüfen, Befunde und Nachweise im Evidence Vault führen.',
    canonical: `${SITE_URL}/integrations/shopify`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Integrationen', url: '/integrations' },
      { name: 'Shopify', url: '/integrations/shopify' },
    ]),
  },
};

/**
 * Liefert SEO-Config für einen Pfad. Normalisiert trailing slash und fällt
 * auf DEFAULT_SEO zurück, wenn keine Map-Eintrag existiert (z.B. Auth-Pages
 * oder neue Routes ohne Eintrag).
 */
export function getSeoForPath(pathname: string): SEOConfig {
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return SEO_CONFIG[path] ?? DEFAULT_SEO;
}
