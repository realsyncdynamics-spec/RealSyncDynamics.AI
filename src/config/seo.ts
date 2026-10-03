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
 *   max 60 Zeichen, Keyword zuerst, Brand am Ende mit "| RealSync Dynamics AI"
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
  /** Page-Title — sollte mit "| RealSync Dynamics AI" enden, sonst haengt der Hook " — RealSync Dynamics AI" an. */
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

import { lv2FaqJsonLd } from '../components/landing/v2/landing-v2-content';

const SITE_URL = 'https://realsyncdynamicsai.de';

export const DEFAULT_SEO: SEOConfig = {
  title: 'KI-Governance & Kontrollschicht | RealSync Dynamics AI',
  description:
    'Kontroll- und Nachweisschicht für Enterprise-KI: Systeme erfassen, Risiken bewerten, Policies steuern und Evidence für DSGVO und EU AI Act erzeugen.',
};

// ─── JSON-LD Templates (re-used) ─────────────────────────────────────────────

const PRICING_PRODUCT_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'RealSync Dynamics AI Compliance Platform',
  description:
    'EU-native DSGVO- und EU-AI-Act-Compliance-Infrastruktur mit Website-Audit, Consent-Timing-Analyse, Fix-Empfehlungen und Evidence-Export. Dauerhafte Domain-Überwachung: Coming Soon.',
  brand: { '@type': 'Brand', name: 'RealSync Dynamics AI' },
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

const LANDING_V2_JSONLD: Record<string, unknown>[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#org`,
    name: 'RealSync Dynamics AI',
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.png`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Schwarzburger Str. 31',
      postalCode: '98724',
      addressLocality: 'Neuhaus am Rennweg',
      addressCountry: 'DE',
    },
  },
  PRICING_PRODUCT_JSONLD,
  lv2FaqJsonLd(),
];

export const SEO_CONFIG: Record<string, SEOConfig> = {
  // ─── Tier 1 — Hero / Top-Conversion ──────────────────────────────────────
  '/': {
    title: 'AI Compliance Operations OS für Europa – EU AI Act & DSGVO | RealSync Dynamics AI',
    description:
      'Erfassen, einstufen, steuern, nachweisen: KI-Inventar, Risikoklassen nach EU AI Act, Richtlinien zur Laufzeit und prüffähige Evidenz – gehostet in Frankfurt. Kostenloser Audit.',
    canonical: `${SITE_URL}/`,
    ogTitle: 'KI-Compliance als Betriebsaufgabe – EU AI Act & DSGVO',
    ogDescription:
      'EU AI Act, DSGVO und ISO/IEC 42001 als Betriebsaufgabe: Inventar, Risikoklassen, Runtime-Policies und prüffähige Evidenz aus einer Plattform.',
    jsonLd: LANDING_V2_JSONLD,
  },
  '/design/landing-v2': {
    title: 'RealSync Dynamics AI – Landing v2 (Design-Referenz)',
    description:
      'Design-Referenz der Startseite „AI Compliance Operations OS für Europa“. Kanonisch ist /.',
    canonical: `${SITE_URL}/`,
    noIndex: true,
  },
  // Marken-Landing aus LandingPagesOverview. Bis 2026-09-28 lieferte
  // Cloudflare hier `public/realsync-landing.html` aus — ein Inline-Redirect,
  // den die CSP-Haertung vom 2026-09-18 (`script-src` ohne 'unsafe-inline')
  // blockiert. Die Seite stand seither auf „Redirecting…". Jetzt rendert die
  // SPA-Route; als alternative Landing ist sie wie /design/landing-v2 noindex
  // und kanonisch auf /, damit sie nicht mit der Startseite konkurriert.
  '/realsync-landing': {
    title: 'RealSync Dynamics AI – Marken-Landing',
    description:
      'Marken-Landing von RealSync Dynamics AI:EU-souveräne AI-Governance-Runtime für DSGVO und EU AI Act. Kanonisch ist /.',
    canonical: `${SITE_URL}/`,
    noIndex: true,
  },
  '/design/titan': {
    title: 'RealSync Dynamics AI — Titan-Fallbackroute der Governance-Landing',
    description:
      'Fallbackroute der Landing-Positionierung (Legacy-Titan): Control Plane für Enterprise-KI mit Policies, Freigaben, Ausführung und Evidence als Proof-Layer.',
    canonical: `${SITE_URL}/design/titan`,
    ogTitle: 'Titan-Fallbackroute der Governance-Landing',
    ogDescription:
      'Fallbackroute: Any model. Any agent. One control plane.',
  },
  '/pricing': {
    title: 'Preise – Runtime-native AI-Governance-Plattform | RealSync Dynamics AI',
    description:
      'Free Audit (0 €), Starter (79 €), Growth (249 €), Agency (699 €), Enterprise (auf Anfrage). Runtime-native Governance: Website-Scans, Policy-Engine, kryptografisch nachvollziehbare Evidenz. EU-Hosting, AVV inklusive.',
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
    title: 'Claude Code Optimizer — DSGVO- & AI-Act-Audit direkt im Code | RealSync Dynamics AI',
    description:
      'Der Claude Code Optimizer prüft Ihr Repository auf Datenschutz- und AI-Act-Verstöße, liefert einfügbaren Fix-Code und sichert jeden Merge als auditfähige Evidenz. 14 Tage kostenlos testen.',
    canonical: `${SITE_URL}/claude-code-optimizer`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Claude Code Optimizer', url: '/claude-code-optimizer' },
    ]),
  },
  '/features': {
    title: 'Funktionen: Website-Scan, AI-Act-Inventar, Audit-Trail | RealSync Dynamics AI',
    description:
      'Automatische Cookie-Erkennung, Consent-Timing-Analyse, AVV-Generator, VVT, TOM und AI-Act-Risk-Assessment in einer Plattform. EU-Hosting Frankfurt.',
    canonical: `${SITE_URL}/features`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Funktionen', url: '/features' },
    ]),
  },
  '/audit': {
    title: 'Kostenloser DSGVO-Audit — URL-Scan in 60 Sekunden | RealSync Dynamics AI',
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
    title: 'AI Governance OS für DSGVO und EU AI Act | RealSync Dynamics AI',
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
    title: 'Runtime — Kontinuierliche Compliance-Überwachung | RealSync Dynamics AI',
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
    title: 'EU-AI-Act-Compliance: Klassifikation & Risiko | RealSync Dynamics AI',
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
    title: 'Warteliste — Früher Zugang zur AI Governance Runtime | RealSync Dynamics AI',
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
    title: 'Governance Complexity Score — passende Governance-Abdeckung | RealSync Dynamics AI',
    description:
      'Ermitteln Sie Ihren Governance Complexity Score aus Branche, Datenkategorien, KI-Nutzung, Drittanbietern, Tracking und Dokumentationspflichten — und finden Sie die passende Governance-Abdeckung statt einer Anzahl Webseiten.',
    canonical: `${SITE_URL}/governance-score`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Governance Complexity Score', url: '/governance-score' },
    ]),
  },
  '/digitale-souveraenitaet': {
    title: 'Digitale Souveränität als Betriebsmodell | RealSync Dynamics AI',
    description:
      'Digitale Souveränität praktisch umsetzen: transparente Anbieterstruktur, nachweisbare DSGVO- & AI-Act-Governance, Kontrolle über Drittanbieter und Datenflüsse, Evidence Vault; dauerhafte Domain-Überwachung als Coming Soon — das Governance OS im Browser-Format.',
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
    title: 'Founding Access — 14 Tage kostenlos | RealSync Dynamics AI',
    description:
      '14 Tage kostenloser Enterprise-Zugang für 100 Unternehmen bis 02.08.2026. Gegenleistung: Feedback, Verbesserungsvorschläge und Screenshots.',
    canonical: `${SITE_URL}/contact-sales`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Founding Access', url: '/contact-sales' },
    ]),
  },

  '/frontend-builder': {
    title: 'Frontend Builder für SaaS, AI und B2B-Websites',
    description:
      'Wir planen, designen und bauen performante Frontends mit klarem Scope statt endloser Vorabstimmungen. Projekt jetzt qualifizieren.',
    canonical: `${SITE_URL}/frontend-builder`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Frontend Builder', url: '/frontend-builder' },
    ]),
  },

  // ─── Tier 2 — Alternative Pages (high commercial intent) ─────────────────
  '/cookiebot-alternative': {
    title: 'Cookiebot Alternative mit EU-Hosting & AI-Act | RealSync Dynamics AI',
    description:
      'RealSync Dynamics AI vs. Cookiebot: Consent-Timing-Analyse, fertige Fix-Snippets & Remediation-Pläne, EU-Server Frankfurt, AI-Act-Inventar. Kostenloser Vergleichs-Scan.',
    canonical: `${SITE_URL}/cookiebot-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Cookiebot Alternative', url: '/cookiebot-alternative' },
    ]),
  },
  '/dataguard-alternative': {
    title: 'DataGuard Alternative — automatisierte Compliance ab 79 € | RealSync Dynamics AI',
    description:
      'Günstigere DataGuard Alternative mit automatischem Website-Scan, Consent-Timing und AI-Act-Compliance. Kein Setup, kein Berater erforderlich.',
    canonical: `${SITE_URL}/dataguard-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'DataGuard Alternative', url: '/dataguard-alternative' },
    ]),
  },
  '/onetrust-alternative': {
    title: 'OneTrust Alternative für KMU und Agenturen | RealSync Dynamics AI',
    description:
      'OneTrust ist für Enterprise. RealSync Dynamics AI ist für KMU: automatischer DSGVO-Scan, Consent-Management und AI-Act-Inventar — ab 79 €/Monat.',
    canonical: `${SITE_URL}/onetrust-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'OneTrust Alternative', url: '/onetrust-alternative' },
    ]),
  },
  '/usercentrics-alternative': {
    title: 'Usercentrics Alternative — Compliance statt CMP | RealSync Dynamics AI',
    description:
      'Usercentrics ist ein Cookie-CMP. RealSync Dynamics AI ist Compliance-Infrastruktur: Pre-Consent-Detection, AI-Act-Modul, Evidence Vault — Made in Germany.',
    canonical: `${SITE_URL}/usercentrics-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Usercentrics Alternative', url: '/usercentrics-alternative' },
    ]),
  },
  '/iubenda-alternative': {
    title: 'Iubenda Alternative — voller Compliance-Stack | RealSync Dynamics AI',
    description:
      'Iubenda generiert Texte. RealSync Dynamics AI auditet, monitort und remediatet kontinuierlich — mit echtem Headless-Browser, Evidence Vault und AI-Act-Modul.',
    canonical: `${SITE_URL}/iubenda-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Iubenda Alternative', url: '/iubenda-alternative' },
    ]),
  },
  '/borlabs-alternative': {
    title: 'Borlabs Cookie Alternative — alle Stacks, nicht nur WordPress | RealSync Dynamics AI',
    description:
      'Borlabs ist ein WP-Plugin. RealSync Dynamics AI ist Compliance-Infrastruktur für WordPress, Shopify, Webflow, custom — mit Pre-Consent-Audit + Fix-Empfehlungen.',
    canonical: `${SITE_URL}/borlabs-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Borlabs Alternative', url: '/borlabs-alternative' },
    ]),
  },
  '/proliance-alternative': {
    title: 'Proliance Alternative — Web-Compliance-Automation | RealSync Dynamics AI',
    description:
      'Proliance ist Compliance-Suite. RealSync Dynamics AI fokussiert auf Web-Compliance: Pre-Consent-Audit, Fix-Empfehlungen und Audit-Trail; dauerhafte Überwachung Coming Soon.',
    canonical: `${SITE_URL}/proliance-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Proliance Alternative', url: '/proliance-alternative' },
    ]),
  },
  '/caralegal-alternative': {
    title: 'caralegal Alternative — technische Governance-Runtime neben dem DSMS | RealSync Dynamics AI',
    description:
      'caralegal ist auf Datenschutz- und KI-Governance-Dokumentation ausgelegt. RealSync Dynamics AI ist die technische Compliance-Runtime daneben: Detect, Govern, Enforce, Prove — Befund, Policy-Entscheidung, Nachweis.',
    canonical: `${SITE_URL}/caralegal-alternative`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'caralegal Alternative', url: '/caralegal-alternative' },
    ]),
  },

  // ─── Tier 3 — Branchen-Landings ──────────────────────────────────────────
  '/healthtech': {
    title: 'DSGVO-Compliance für HealthTech & Praxen | RealSync Dynamics AI',
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
    title: 'DSGVO & BAIT-Compliance für FinTech | RealSync Dynamics AI',
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
    title: 'Versicherungs-Compliance — VAIT, BaFin, AI-Act | RealSync Dynamics AI',
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
    title: 'DSGVO-Compliance für Kanzleien & Legal Tech | RealSync Dynamics AI',
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
    title: 'DSGVO-Compliance für Kanzleien & Legal Tech | RealSync Dynamics AI',
    description:
      'Automatisierter DSGVO-Check für Anwaltskanzleien. Mandantendaten-Schutz, sichere Kontaktformulare, Impressum und Datenschutzerklärung prüfen.',
    canonical: `${SITE_URL}/legal-tech`,
  },
  '/oeffentliche-verwaltung': {
    title: 'Behörden-KI — IT-Grundschutz, DSGVO + AI-Act | RealSync Dynamics AI',
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
    title: 'Behörden-KI — IT-Grundschutz, DSGVO + AI-Act | RealSync Dynamics AI',
    description:
      'Für Bundes-, Landes- und Kommunalverwaltung: IT-Grundschutz, BSI C5, DSGVO + AI-Act-Hochrisiko-Klassifikation, Evidence Vault, On-Premise-Option.',
    canonical: `${SITE_URL}/oeffentliche-verwaltung`,
  },
  '/online-shops': {
    title: 'E-Commerce-Compliance — Cookie-Banner, AVV, Tracking | RealSync Dynamics AI',
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
    title: 'E-Commerce-Compliance — Cookie-Banner, AVV, Tracking | RealSync Dynamics AI',
    description:
      'Für Online-Shops: Pre-Consent-Tracker-Detection (Meta Pixel, Google Ads), Cookie-Banner-Audit, AVV mit Stripe/PayPal, automatische Datenschutzerklärung.',
    canonical: `${SITE_URL}/online-shops`,
  },
  '/personalwesen': {
    title: 'HR-Compliance — § 26 BDSG, AI-Act-Recruiting | RealSync Dynamics AI',
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
    title: 'HR-Software-Compliance — DSGVO + § 26 BDSG + AI Act | RealSync Dynamics AI',
    description:
      'Für HR-Software-Anbieter: § 26 BDSG-konforme Architektur, AI-Act-Klassifikation für Recruiting-Algorithmen, Audit-Trail für Performance-Reviews.',
    canonical: `${SITE_URL}/personalwesen`,
  },
  '/schulen': {
    title: 'Schulen-Compliance — DSGVO + KMK + Schüler-Datenschutz | RealSync Dynamics AI',
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
    title: 'Bildungs-Compliance — DSGVO + AI Act für EduTech | RealSync Dynamics AI',
    description:
      'Für EduTech und Hochschulen: DSGVO-konforme Lernplattformen, AI-Act-Klassifikation für adaptive Tests + Proctoring, KMK-Konformität, On-Premise-Option.',
    canonical: `${SITE_URL}/schulen`,
  },
  '/education': {
    title: 'Education Compliance — GDPR + EU AI Act for EdTech | RealSync Dynamics AI',
    description:
      'For EdTech, schools, and universities: GDPR-compliant learning platforms, EU AI Act classification for adaptive testing + proctoring, on-premise option.',
    canonical: `${SITE_URL}/schulen`,
  },
  '/saas-anbieter': {
    title: 'SaaS-Compliance — Multi-Tenant DSGVO, AVV, Sub-Prozessoren | RealSync Dynamics AI',
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
    title: 'SaaS Compliance — Multi-Tenant GDPR, DPA, Sub-Processors | RealSync Dynamics AI',
    description:
      'For SaaS providers: multi-tenant architecture, DPA with end customers, sub-processor list, GDPR Art. 32, EU AI Act classification, EU residency.',
    canonical: `${SITE_URL}/saas-anbieter`,
  },
  '/fuer-saas': {
    title: 'Für SaaS-Teams — DSGVO-Compliance als Infrastruktur | RealSync Dynamics AI',
    description:
      'Compliance-Layer für SaaS-Teams: API-First, Multi-Tenant, BYOK, Webhooks. Mechanical Input + AI Orchestration + Digital Output. Pilot ab 249 €/Monat.',
    canonical: `${SITE_URL}/fuer-saas`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Für SaaS', url: '/fuer-saas' },
    ]),
  },
  '/fuer-praxen': {
    title: 'Für Arztpraxen + Zahnärzte — DSGVO ohne IT-Aufwand | RealSync Dynamics AI',
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
      'DSGVO-Compliance für Agenturen — alle Kundenprojekte prüfen | RealSync Dynamics AI',
    description:
      'Als Agentur alle Kundenwebsites automatisch auf DSGVO-Konformität prüfen. Whitelabel-Reports, Multi-Domain-Scanning, Team-Zugänge.',
    canonical: `${SITE_URL}/fuer-agenturen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Für Agenturen', url: '/fuer-agenturen' },
    ]),
  },
  '/agencies': {
    title: 'GDPR Compliance for Marketing Agencies — White-Label Audits | RealSync Dynamics AI',
    description:
      'Audit engine for agencies: multi-tenant dashboard, white-label reports, API access for bulk scans, CI/CD integration. Deliver GDPR compliance as a service.',
    canonical: `${SITE_URL}/fuer-agenturen`,
  },
  '/steuerberater': {
    title: 'Steuerberater-Compliance — DSGVO + DATEV + Mandantenschutz | RealSync Dynamics AI',
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
    title: 'Steuerkanzlei-Compliance — DSGVO + DATEV + Mandantenschutz | RealSync Dynamics AI',
    description:
      'Für Steuerkanzleien: DSGVO + § 203 StGB Mandantengeheimnis, DATEV-konforme Schnittstellen, Audit-Trail für Belegverarbeitung, AVV mit Sub-Prozessoren.',
    canonical: `${SITE_URL}/steuerberater`,
  },

  // ─── Resources / Vergleich / FAQ / Guides ────────────────────────────────
  '/tools': {
    title: 'Compliance-Tools Hub — Scanner, Generatoren, Checks | RealSync Dynamics AI',
    description:
      'Alle DSGVO- und AI-Act-Tools auf einer Seite: Cookie-Scanner, AVV-Generator, Datenschutzerklärung-Generator, EU-AI-Act-Klassifikator, DSFA-Wizard.',
    canonical: `${SITE_URL}/tools`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Tools', url: '/tools' },
    ]),
  },
  '/dsfa-wizard': {
    title: 'DSFA-Wizard — Datenschutz-Folgenabschätzung nach Art. 35 DSGVO | RealSync Dynamics AI',
    description:
      'Strukturierte Datenschutz-Folgenabschätzung Schritt für Schritt: Verarbeitungsbeschreibung, Risiko-Bewertung, Maßnahmen. Konform mit Art. 35 DSGVO.',
    canonical: `${SITE_URL}/dsfa-wizard`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Tools', url: '/tools' },
      { name: 'DSFA-Wizard', url: '/dsfa-wizard' },
    ]),
  },
  '/bussgeld-rechner': {
    title: 'DSGVO-Bußgeld-Rechner — Risiko-Schätzung nach Art. 83 | RealSync Dynamics AI',
    description:
      'Schätzen Sie Ihr DSGVO-Bußgeld-Risiko: Branchen-Faktor, Verstoß-Kategorie (Art. 83 Abs. 4/5), Umsatz und Schweregrad — mit Behörden-Praxis von 2024-2026.',
    canonical: `${SITE_URL}/bussgeld-rechner`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Tools', url: '/tools' },
      { name: 'Bußgeld-Rechner', url: '/bussgeld-rechner' },
    ]),
  },
  // Tippfehler-Alias: voller Aufruf bekommt 301 (public/_redirects), die
  // SPA-Route konsolidiert per canonical.
  '/busseld-rechner': {
    title: 'DSGVO-Bußgeld-Rechner — Risiko-Schätzung nach Art. 83 | RealSync Dynamics AI',
    description:
      'Schätzen Sie Ihr DSGVO-Bußgeld-Risiko: Branchen-Faktor, Verstoß-Kategorie (Art. 83 Abs. 4/5), Umsatz und Schweregrad — mit Behörden-Praxis von 2024-2026.',
    canonical: `${SITE_URL}/bussgeld-rechner`,
  },
  '/ueber-uns': {
    title: 'Über uns — KI-Governance aus Europa | RealSync Dynamics AI',
    description:
      'Wer hinter RealSync Dynamics AI steht: eine EU-souveräne Kontroll- und Nachweisschicht für KI im Unternehmen, entwickelt und gehostet in Deutschland.',
    canonical: `${SITE_URL}/ueber-uns`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Über uns', url: '/ueber-uns' },
    ]),
  },
  '/about': {
    title: 'Über uns — KI-Governance aus Europa | RealSync Dynamics AI',
    description:
      'Wer hinter RealSync Dynamics AI steht: eine EU-souveräne Kontroll- und Nachweisschicht für KI im Unternehmen, entwickelt und gehostet in Deutschland.',
    canonical: `${SITE_URL}/ueber-uns`,
  },
  '/ressourcen': {
    title: 'Ressourcen — Whitepaper, Checklisten, Guides | RealSync Dynamics AI',
    description:
      'Praxis-Material zu DSGVO + AI Act: BAIT/MaRisk-Guide, Schrems-II-Erklärung, DSGVO-KI-Checkliste, Tool-Vergleiche. Stand 2026, ohne Marketing-Fluff.',
    canonical: `${SITE_URL}/ressourcen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Ressourcen', url: '/ressourcen' },
    ]),
  },
  '/resources': {
    title: 'Resources — Whitepapers, Checklists, Guides | RealSync Dynamics AI',
    description:
      'Practical material on GDPR + EU AI Act: BAIT/MaRisk guide, Schrems II explainer, GDPR AI checklist, tool comparisons. Stand 2026, no marketing fluff.',
    canonical: `${SITE_URL}/ressourcen`,
  },
  '/audit-pro': {
    title: 'Audit Pro — Vollständiger DSGVO + AI-Act-Audit | RealSync Dynamics AI',
    description:
      'Tiefen-Audit mit allen Findings, Paragraphen-Bezug, Auto-Fix-Empfehlungen und PDF-Report für Datenschutzbeauftragte. Inkl. Consent-Timing + AI-Act-Klassifikation.',
    canonical: `${SITE_URL}/audit-pro`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Audit Pro', url: '/audit-pro' },
    ]),
  },
  '/dsgvo-tool-vergleich': {
    title: 'DSGVO-Tool-Vergleich 2026 — Cookiebot vs Usercentrics vs OneTrust | RealSync Dynamics AI',
    description:
      'Direkter Feature-Vergleich der wichtigsten DSGVO-Tools. Pre-Consent-Detection, Fix-Empfehlungen, Evidence Vault, AI-Act-Module, Preise — was deckt welches Tool ab?',
    canonical: `${SITE_URL}/dsgvo-tool-vergleich`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'DSGVO-Tool-Vergleich', url: '/dsgvo-tool-vergleich' },
    ]),
  },
  '/dsgvo-ki-checkliste': {
    title: 'DSGVO + KI Checkliste 2026 — Praxis-Guide | RealSync Dynamics AI',
    description:
      '12 konkrete Prüfpunkte für DSGVO-konformen KI-Einsatz: Rechtsgrundlage, AVV, Schrems-II, AI-Act-Klassifikation, technische Maßnahmen, DSFA-Pflicht.',
    canonical: `${SITE_URL}/dsgvo-ki-checkliste`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'DSGVO + KI Checkliste', url: '/dsgvo-ki-checkliste' },
    ]),
  },
  '/bait-marisk-compliance-guide': {
    title: 'BAIT + MaRisk Compliance Guide — KI-Einsatz in Banken | RealSync Dynamics AI',
    description:
      'Praxis-Guide für BaFin-regulierte Institute: BAIT-Anforderungen, MaRisk-Audit-Trail für ML-Modelle, AI-Act-Klassifikation für Credit-Scoring.',
    canonical: `${SITE_URL}/bait-marisk-compliance-guide`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'BAIT + MaRisk Guide', url: '/bait-marisk-compliance-guide' },
    ]),
  },
  '/onboarding-erklaert': {
    title: 'Onboarding erklärt — IT verbinden statt ersetzen | RealSync Dynamics AI',
    description:
      'Wie das Onboarding abläuft: Unternehmensprofil, Systeme erkennen, verbinden, Datenflüsse analysieren, Risiken und Nachweise — ohne Ihre IT auszutauschen.',
    canonical: `${SITE_URL}/onboarding-erklaert`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Onboarding erklärt', url: '/onboarding-erklaert' },
    ]),
  },
  '/ki-governance-in-5-schritten': {
    title: 'KI-Governance in 5 Schritten — vom KI-Register zum laufenden Betrieb | RealSync Dynamics AI',
    description:
      'Unternehmen verstehen, KI-Register aufbauen, Governance-Regeln aktivieren, Nachweise erzeugen, KI sicher betreiben — mehr als eine KI-Richtlinie: ein Betriebssystem für KI-Governance.',
    canonical: `${SITE_URL}/ki-governance-in-5-schritten`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'KI-Governance in 5 Schritten', url: '/ki-governance-in-5-schritten' },
    ]),
  },
  '/schrems-ii-erklaert': {
    title: 'Schrems II erklärt — Was EuGH-Urteil C-311/18 bedeutet | RealSync Dynamics AI',
    description:
      'EuGH C-311/18 (Schrems II) hat den Privacy Shield gekippt. Was bedeutet das für SaaS, Cloud, KI-APIs? Konkrete Maßnahmen + EU-Hosting-Optionen.',
    canonical: `${SITE_URL}/schrems-ii-erklaert`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Schrems II erklärt', url: '/schrems-ii-erklaert' },
    ]),
  },
  '/faq': {
    title: 'FAQ — Häufige Fragen zu DSGVO, AI Act & Plattform | RealSync Dynamics AI',
    description:
      'Antworten zu Datenresidenz, AVV, Schrems-II, AI-Act-Klassifikation, Preisen, Setup, Kündigung, Sub-Prozessoren und Audit-Trail. Stand Mai 2026.',
    canonical: `${SITE_URL}/haeufige-fragen`,
  },
  '/haeufige-fragen': {
    title: 'Häufige Fragen — DSGVO, AI Act und Plattform-Details | RealSync Dynamics AI',
    description:
      'Antworten zu Datenresidenz, AVV, Schrems-II, AI-Act-Klassifikation, Preisen, Setup, Kündigung, Sub-Prozessoren und Audit-Trail. Stand Mai 2026.',
    canonical: `${SITE_URL}/haeufige-fragen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Häufige Fragen', url: '/haeufige-fragen' },
    ]),
  },
  '/case-studies': {
    title: 'Case Studies — DSGVO + AI-Act in der Praxis | RealSync Dynamics AI',
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
    title: 'Security — ISO 27001-Track, BSI C5, EU-Datenresidenz | RealSync Dynamics AI',
    description:
      'Security-Posture: ISO 27001-Track, BSI C5, EU-Datenresidenz Default, kryptografische Audit-Trails (Evidence Vault), Penetration-Test-Reports, BYOK.',
    canonical: `${SITE_URL}/security`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Security', url: '/security' },
    ]),
  },
  '/sicherheit': {
    title: 'Sicherheit — ISO 27001-Track, BSI C5, EU-Datenresidenz | RealSync Dynamics AI',
    description:
      'Security-Posture: ISO 27001-Track, BSI C5, EU-Datenresidenz Default, kryptografische Audit-Trails (Evidence Vault), Penetration-Test-Reports, BYOK.',
    canonical: `${SITE_URL}/security`,
  },
  '/methodik': {
    title: 'Methodik 2026.05.0 — Compliance-Detection-Methodik | RealSync Dynamics AI',
    description:
      'Volltransparente Methodik: Playwright-Engine, Regelengine, Tracker-Registry (18 Trackers), Consent-Timing-Algorithmus. Versionierte Releases, öffentlich auditierbar.',
    canonical: `${SITE_URL}/legal/methodology`,
  },
  '/legal/methodology': {
    title: 'Methodology 2026.05.0 — Compliance Detection | RealSync Dynamics AI',
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
    title: 'Grenzen — Was unsere Plattform NICHT kann | RealSync Dynamics AI',
    description:
      'Was wir bewusst NICHT versprechen: kein "100% rechtssicher", kein Anwalts-Ersatz, kein Audit für Backend-Server, kein automatischer DSB. Klare Grenzen.',
    canonical: `${SITE_URL}/grenzen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Grenzen', url: '/grenzen' },
    ]),
  },
  '/legal/privacy': {
    title: 'Datenschutzerklärung | RealSync Dynamics AI',
    description:
      'Datenschutzerklärung von RealSync Dynamics AI gemäß DSGVO Art. 13/14. Verantwortlicher, Verarbeitungszwecke, Betroffenenrechte und Sub-Prozessoren.',
    canonical: `${SITE_URL}/legal/privacy`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Datenschutz', url: '/legal/privacy' },
    ]),
  },
  '/legal/datenschutz': {
    title: 'Datenschutzerklärung | RealSync Dynamics AI',
    description:
      'Datenschutzerklärung von RealSync Dynamics AI gemäß DSGVO Art. 13/14. Verantwortlicher, Verarbeitungszwecke, Betroffenenrechte und Sub-Prozessoren.',
    canonical: `${SITE_URL}/legal/privacy`,
  },
  '/datenschutz': {
    title: 'Datenschutzerklärung | RealSync Dynamics AI',
    description:
      'Datenschutzerklärung von RealSync Dynamics AI gemäß DSGVO Art. 13/14. Verantwortlicher, Verarbeitungszwecke, Betroffenenrechte und Sub-Prozessoren.',
    canonical: `${SITE_URL}/legal/privacy`,
  },
  '/legal/impressum': {
    title: 'Impressum | RealSync Dynamics AI',
    description:
      'Impressum von RealSync Dynamics AI (RealSync Dynamics, Neuhaus am Rennweg). Angaben gemäß § 5 DDG und § 18 MStV.',
    canonical: `${SITE_URL}/legal/impressum`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'Impressum', url: '/legal/impressum' },
    ]),
  },
  '/impressum': {
    title: 'Impressum | RealSync Dynamics AI',
    description:
      'Impressum von RealSync Dynamics AI (RealSync Dynamics, Neuhaus am Rennweg). Angaben gemäß § 5 DDG und § 18 MStV.',
    canonical: `${SITE_URL}/legal/impressum`,
  },
  '/legal/sub-processors': {
    title: 'Sub-Prozessoren & Auftragsverarbeiter (DSGVO Art. 28) | RealSync Dynamics AI',
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
    title: 'AVV-Vorlage (Art. 28 DSGVO) | RealSync Dynamics AI',
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
    title: 'Allgemeine Geschäftsbedingungen | RealSync Dynamics AI',
    description:
      'AGB für die Nutzung der RealSync Dynamics AI-Plattform. Leistungsumfang, Vergütung, Kündigung, Haftung, Verbraucherwiderruf, Datenschutz-Verweise.',
    canonical: `${SITE_URL}/legal/terms`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Legal', url: '/legal/sub-processors' },
      { name: 'AGB', url: '/legal/terms' },
    ]),
  },
  '/agb': {
    title: 'Allgemeine Geschäftsbedingungen | RealSync Dynamics AI',
    description:
      'AGB für die Nutzung der RealSync Dynamics AI-Plattform. Leistungsumfang, Vergütung, Kündigung, Haftung, Verbraucherwiderruf, Datenschutz-Verweise.',
    canonical: `${SITE_URL}/legal/terms`,
  },
  '/legal/compliance-matrix': {
    title: 'Compliance-Matrix — DSGVO, AI Act, BAIT, MaRisk | RealSync Dynamics AI',
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
    title: 'Versicherungs-Compliance — VAIT, BaFin, AI-Act | RealSync Dynamics AI',
    description:
      'Für Versicherer: VAIT-konforme IT-Governance, BaFin-Audit-Trail, AI-Act-Klassifikation für Tarif- und Schadenmodelle. Schrems-II-konformes EU-Hosting.',
    canonical: `${SITE_URL}/insurance`,
  },
  '/presse': {
    title: 'Presse | RealSync Dynamics AI',
    description:
      'Pressemitteilungen, Medienanfragen und Logos von RealSync Dynamics AI — EU-native DSGVO- und AI-Act-Compliance-Plattform.',
    canonical: `${SITE_URL}/presse`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Presse', url: '/presse' },
    ]),
  },
  '/press': {
    title: 'Press | RealSync Dynamics AI',
    description:
      'Press releases, media inquiries and logos for RealSync Dynamics AI — EU-native GDPR + AI Act compliance platform.',
    canonical: `${SITE_URL}/presse`,
  },
  '/integrationen': {
    title: 'Integrationen — Shopify, WordPress, Matomo, n8n | RealSync Dynamics AI',
    description:
      'Alle Integrationen auf einen Blick: Shopify, WordPress, Matomo, HubSpot, n8n, Zapier, CI/CD-Webhooks. DSGVO-konforme Datenflüsse, keine Setup-Gebühr.',
    canonical: `${SITE_URL}/integrationen`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Integrationen', url: '/integrationen' },
    ]),
  },
  '/integrations': {
    title: 'Integrations — Shopify, WordPress, Matomo, n8n | RealSync Dynamics AI',
    description:
      'All integrations at a glance: Shopify, WordPress, Matomo, HubSpot, n8n, Zapier, CI/CD webhooks. GDPR-compliant data flows, no setup fee.',
    canonical: `${SITE_URL}/integrationen`,
  },
  '/marktanalyse': {
    title: 'DSGVO-Tool-Marktanalyse — DACH 2026 | RealSync Dynamics AI',
    description:
      'Marktanalyse: Cookiebot, OneTrust, Usercentrics, iubenda, DataGuard im Vergleich. Preise, Features, DACH-Tauglichkeit, AI-Act-Readiness — Stand 2026.',
    canonical: `${SITE_URL}/marktanalyse`,
    jsonLd: breadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Marktanalyse', url: '/marktanalyse' },
    ]),
  },
  '/market-analysis': {
    title: 'GDPR Tool Market Analysis — DACH 2026 | RealSync Dynamics AI',
    description:
      'Market analysis: Cookiebot, OneTrust, Usercentrics, iubenda, DataGuard compared. Pricing, features, DACH suitability, AI Act readiness — as of 2026.',
    canonical: `${SITE_URL}/marktanalyse`,
  },
};

/**
 * Geführter Flow (`/flow`, `/flow/*`, siehe `src/flow/flowRoutes.ts`):
 * Prozess- und Funnel-Schritte, keine Inhaltsseiten. Der Namespace ist als
 * Ganzes `noindex` — fail-closed auch für neue Schritte und unbekannte Slugs,
 * die `App.tsx` über `/flow/*` ins Flow-Modul leitet. Ein Einzeleintrag je
 * Schritt würde beides nicht abdecken, weil der Lookup unten exakt ist.
 *
 * Wirkt im gerenderten React-Dokument (`SEOHead`), nicht serverseitig: Die
 * Flow-Routen werden nicht vorgerendert, ein Fetcher ohne JavaScript sieht
 * weiterhin die generische SPA-Shell.
 */
const FLOW_NAMESPACE = '/flow';

export function isFlowPath(path: string): boolean {
  return path === FLOW_NAMESPACE || path.startsWith(`${FLOW_NAMESPACE}/`);
}

export const FLOW_SEO: SEOConfig = { ...DEFAULT_SEO, noIndex: true };

/**
 * Liefert SEO-Config für einen Pfad. Normalisiert trailing slash, setzt den
 * Flow-Namespace auf `noindex` und fällt sonst auf DEFAULT_SEO zurück, wenn
 * kein Map-Eintrag existiert (z.B. Auth-Pages oder neue Routes ohne Eintrag).
 * Die Namespace-Prüfung steht vor dem Lookup, damit kein späterer
 * Einzeleintrag sie still aushebelt.
 */
export function getSeoForPath(pathname: string): SEOConfig {
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  if (isFlowPath(path)) return FLOW_SEO;
  return SEO_CONFIG[path] ?? DEFAULT_SEO;
}
