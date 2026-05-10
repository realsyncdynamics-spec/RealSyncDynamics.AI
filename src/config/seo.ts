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
  title: 'RealSyncDynamics.AI — DSGVO-konforme KI-Compliance-Plattform',
  description:
    'EU-konforme KI-Infrastruktur für regulierte Branchen: EU-Datenresidenz, lückenloser Audit-Trail, automatisierte DSGVO-Selfservice (Art. 15 + 17). DSGVO Art. 32, AI Act, BAIT, MaRisk konform.',
};

// ─── JSON-LD Templates (re-used) ─────────────────────────────────────────────

const PRICING_PRODUCT_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'RealSyncDynamics.AI Compliance Platform',
  description:
    'Automatisierte DSGVO- und EU-AI-Act-Compliance-Infrastruktur mit Website-Audit, Consent-Timing-Analyse, Auto-Remediation und Continuous Monitoring.',
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
      price: '49',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '49',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
    {
      '@type': 'Offer',
      name: 'Growth',
      price: '199',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '199',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
    {
      '@type': 'Offer',
      name: 'Enterprise',
      priceCurrency: 'EUR',
      url: `${SITE_URL}/contact-sales?intent=enterprise`,
      description: 'Auf Anfrage — SLA, AI-Act-Modul, DSB-Integration, Evidence Vault',
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

const DSGVO_WEBSITE_WEBAPP_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'DSGVO-Website-Check',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/dsgvo-website`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  description:
    'Kostenloser DSGVO-Scan Ihrer Website. Tracker, fehlende Rechtsdokumente, Consent-Probleme und Security-Header werden automatisch erkannt.',
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
    title: 'Continuous DSGVO- & AI-Act-Compliance für Websites | RealSyncDynamicsAI',
    description:
      'Continuous Compliance Monitoring für Websites, KI-Systeme und digitale Prozesse. Tagesgenaue Überwachung gegen DSGVO- und EU-AI-Act-Drift — Free Audit als Einstieg, Drift-Alerts im Abo.',
    canonical: `${SITE_URL}/`,
  },
  '/pricing': {
    title: 'Preise – RealSyncDynamicsAI Compliance-Plattform',
    description:
      'Wählen Sie zwischen Free Audit, Starter, Growth und Enterprise für automatisierte DSGVO- und AI-Act-Compliance.',
    canonical: `${SITE_URL}/pricing`,
    jsonLd: [
      PRICING_PRODUCT_JSONLD,
      breadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'Preise', url: '/pricing' },
      ]),
    ],
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
      'Inventarisieren, klassifizieren und überwachen Sie AI-Systeme, Policies und Audit-Trails mit RealSyncDynamicsAI. Inventory · Policy Engine · Evidence Vault — Audit-ready für EU AI Act.',
    canonical: `${SITE_URL}/ai-governance`,
    ogTitle: 'AI Governance OS für Unternehmen',
    ogDescription:
      'AI-Systeme inventarisieren, EU-AI-Act-Risiken klassifizieren, Policies definieren und Audit-Trails erzeugen.',
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'AI Governance OS', url: '/ai-governance' },
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
  '/dsgvo-website': {
    title: 'DSGVO-Website-Check — Ihre Website in 30 Sekunden geprüft | RealSyncDynamics.AI',
    description:
      'Kostenloser DSGVO-Scan Ihrer Website. Tracker, fehlende Rechtsdokumente, Consent-Probleme und Security-Header werden automatisch erkannt.',
    canonical: `${SITE_URL}/dsgvo-website`,
    jsonLd: [
      DSGVO_WEBSITE_WEBAPP_JSONLD,
      breadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'DSGVO-Website', url: '/dsgvo-website' },
      ]),
    ],
  },
  '/contact-sales': {
    title: 'Demo buchen — 30 Minuten, kein Pitch | RealSyncDynamics.AI',
    description:
      'Buchen Sie eine kostenlose 30-Minuten-Demo. Wir zeigen Ihnen live: EU-Modus, Audit-Log, n8n-Workflows, GDPR-Selfservice, Multi-Tenant-Setup.',
    canonical: `${SITE_URL}/contact-sales`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Demo buchen', url: '/contact-sales' },
    ]),
  },

  // ─── Tier 2 — Alternative Pages (high commercial intent) ─────────────────
  '/cookiebot-alternative': {
    title: 'Cookiebot Alternative mit EU-Hosting & AI-Act | RealSyncDynamics.AI',
    description:
      'RealSyncDynamics.AI vs. Cookiebot: Consent-Timing-Analyse, automatische Remediation, EU-Server Frankfurt, AI-Act-Inventar. Kostenloser Vergleichs-Scan.',
    canonical: `${SITE_URL}/cookiebot-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Cookiebot Alternative', url: '/cookiebot-alternative' },
    ]),
  },
  '/dataguard-alternative': {
    title: 'DataGuard Alternative — automatisierte Compliance ab 49€ | RealSyncDynamics.AI',
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
      'OneTrust ist für Enterprise. RealSyncDynamics.AI ist für KMU: automatischer DSGVO-Scan, Consent-Management und AI-Act-Inventar — ab 49€/Monat.',
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
      'Borlabs ist ein WP-Plugin. RealSyncDynamics.AI ist Compliance-Infrastruktur für WordPress, Shopify, Webflow, custom — mit Pre-Consent-Audit + Auto-Fix.',
    canonical: `${SITE_URL}/borlabs-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Borlabs Alternative', url: '/borlabs-alternative' },
    ]),
  },
  '/proliance-alternative': {
    title: 'Proliance Alternative — Web-Compliance-Automation | RealSyncDynamics.AI',
    description:
      'Proliance ist Compliance-Suite. RealSyncDynamics.AI fokussiert auf automatisierte Web-Compliance: Pre-Consent-Audit, Auto-Fix und Continuous Monitoring.',
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
      'Compliance-Layer für SaaS-Teams: API-First, Multi-Tenant, BYOK, Webhooks. Mechanical Input + AI Orchestration + Digital Output. Pilot ab 199 €/Monat.',
    canonical: `${SITE_URL}/fuer-saas`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Für SaaS', url: '/fuer-saas' },
    ]),
  },
  '/fuer-praxen': {
    title: 'Für Arztpraxen + Zahnärzte — DSGVO ohne IT-Aufwand | RealSyncDynamics.AI',
    description:
      'DSGVO-Komplettpaket für Arzt- und Zahnarztpraxen: Cookie-Banner, Datenschutzerklärung, AVV mit Praxisverwaltung, Patientendaten-Schutz. Festpreis 99 €/Monat.',
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
      'Direkter Feature-Vergleich der wichtigsten DSGVO-Tools. Pre-Consent-Detection, Auto-Fix, Evidence Vault, AI-Act-Module, Preise — was deckt welches Tool ab?',
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
  '/legal/impressum': {
    title: 'Impressum | RealSyncDynamics.AI',
    description:
      'Impressum von RealSyncDynamics.AI (RealSync Dynamics, Neuhaus am Rennweg). Angaben gemäß § 5 TMG.',
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
      'Impressum von RealSyncDynamics.AI (RealSync Dynamics, Neuhaus am Rennweg). Angaben gemäß § 5 TMG.',
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
