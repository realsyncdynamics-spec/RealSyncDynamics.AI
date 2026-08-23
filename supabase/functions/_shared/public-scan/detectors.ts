// Zusatz-Signale des öffentlichen Scans.
//
// `analyzeObservation()` aus `packages/siteos-core` prüft acht Dimensionen
// gegen eine **eigene** ausgelieferte Site. Der öffentliche Scan richtet
// sich dagegen an eine fremde Website, über die wir nichts wissen. Zwei
// Dinge fehlen deshalb dort und stehen hier:
//
//  1. **KI-Einsatz muss erkannt werden, bevor er beurteilt werden kann.**
//     Die SiteOS-Analyse setzt `expectsAiDisclosure` von außen — bei einer
//     fremden Seite gibt es niemanden, der das setzen könnte. Art. 50 EU AI
//     Act greift aber genau dann, wenn eine Seite ein KI-System einsetzt.
//  2. Signale, die im Kundengespräch den Ausschlag geben (Google Fonts,
//     Consent-Manager, mobile Darstellung, erkannte Technologie).
//
// Bewusste Zurückhaltung: Alle Heuristiken hier arbeiten auf dem
// ausgelieferten HTML. Was sich erst nach JavaScript-Ausführung zeigt,
// sehen sie nicht. Im Zweifel entsteht **kein** Befund — eine
// Falschmeldung im Erstkontakt kostet mehr als ein übersehener Hinweis.
//
// Die Befund-Codes sind stabil und versionsrelevant (`CLAUDE.md`, SiteOS-
// Regel): Sie erscheinen in Kundenberichten und dürfen nicht umbenannt
// werden. Neue Codes dürfen ergänzt werden.

import type { RuntimeFinding, SiteObservation } from '../../../../packages/siteos-core/src/index.ts';

/** Aus dem HTML ablesbare Signale — Grundlage der Befunde und des Berichts. */
export interface PublicScanSignals {
  /** Erkannte Technologien (CMS, Framework, Analyse-Dienste). */
  technologies: string[];
  /** Erkannte KI-Dienste (API-Endpunkte, SDK-Spuren). */
  aiTools: string[];
  /** Erkannte Chat-/Assistenz-Widgets. */
  chatWidgets: string[];
  /** Hinweis auf ein Consent-Management-Werkzeug im HTML. */
  hasConsentManager: boolean;
  /** Fremd-Hosts, von denen Schriften geladen werden. */
  externalFontHosts: string[];
  /** Hinweis auf einen Transparenzhinweis zur KI-Nutzung. */
  hasAiDisclosure: boolean;
  formCount: number;
  hasViewportMeta: boolean;
  hasStructuredData: boolean;
  headingLevels: number[];
}

// ── Erkennungsmuster ────────────────────────────────────────────────────
//
// Jedes Muster zielt auf eine Zeichenkette, die im ausgelieferten HTML
// steht (Skript-URL, Klassenname, globale Variable). Reine Wortfunde im
// Fließtext werden vermieden — „wir nutzen künstliche Intelligenz“ in einem
// Blogtext ist kein Nachweis eines eingesetzten Systems.
//
// ## Warum jeder Quantor eine Obergrenze hat
//
// Diese Ausdrücke laufen über das HTML einer **fremden** Seite, die ein
// nicht angemeldeter Besucher benennt. Sie ist damit potenziell feindselig,
// und bis zu 1,5 MB davon werden gelesen.
//
// Ein unbegrenztes `[^>]+` vor einem Literal ist in dieser Lage eine
// Denial-of-Service-Lücke, keine Stilfrage: Gemessen am 2026-08-23 kostete
// `/<meta[^>]+name…robots…[^>]*content…/` bei 16 000 Wiederholungen von
// `'<meta '` (96 kB) bereits 1,3 s — und die Kosten wachsen quadratisch.
// Auf 1,5 MB hochgerechnet bindet ein einziger Aufruf den Worker minutenlang.
//
// `ATTR` begrenzt die Rückverfolgung je Fundstelle auf eine Konstante und
// macht den Durchlauf damit linear. Der Preis ist bewusst in Kauf genommen:
// Ein Tag, dessen gesuchtes Attribut jenseits von 200 Zeichen steht, wird
// nicht erkannt. Reale Tags liegen weit darunter — ein übersehener Hinweis
// wiegt hier leichter als ein blockierter Dienst.
const ATTR = '[^>]{0,200}';

/**
 * Ein Signal, das an einer **Adresse** hängt.
 *
 * ## Warum hier keine regulären Ausdrücke mehr stehen
 *
 * Bis zum 2026-08-23 wurden Hosts mit Mustern wie `/static\.hotjar\.com/i`
 * im HTML gesucht. Das war aus drei Gründen falsch, und zwei davon hat erst
 * die Sicherheitsanalyse sichtbar gemacht:
 *
 *  1. **Zu unscharf.** Die Zeichenfolge trifft auch im Fliesstext („wir
 *     verzichten auf static.hotjar.com"), in Kommentaren und in
 *     Beispiel-URLs. Für einen Bericht, der „wir haben Hotjar erkannt"
 *     behauptet, ist das eine Falschmeldung.
 *  2. **Nicht abgrenzbar.** `googleapis\.com` trifft auch
 *     `boesegoogleapis.com`. Ein Muster kann Subdomain-Grenzen nicht
 *     zuverlässig ausdrücken, ein Hostvergleich schon.
 *  3. **Teuer.** Dreissig Muster über 1,5 MB fremdes HTML, jedes mit eigenem
 *     Rückverfolgungsverhalten.
 *
 * Jetzt werden die Adressen des Dokuments **einmal** geparst und die Hosts
 * **verglichen**. Das ist schneller, exakt an der Subdomain-Grenze und
 * braucht für den Host-Teil überhaupt keinen regulären Ausdruck.
 *
 * Zwei Anläufe davor haben nur am Muster geschraubt und die Zahl der
 * Sicherheitsmeldungen erst nicht bewegt und dann verdoppelt. Die Lehre
 * steht in `docs/product/public-scan-funnel.md` §4.1b: Die Ursache war die
 * Methode, nicht das Muster.
 */
interface HostSignal {
  /** Registrierbarer Host oder vollständiger Hostname. */
  host: string;
  /** Muss zusätzlich im Pfad vorkommen. Ohne Angabe genügt der Host. */
  pathContains?: string;
}

interface Detector {
  label: string;
  /** Adressen, an denen der Dienst erkennbar ist. */
  hosts?: readonly HostSignal[];
  /**
   * Signale, die **keine** Adresse sind: globale Variablen, Attribute,
   * ausgelieferte Pfade auf der eigenen Domain. Bleiben Muster — sie
   * enthalten keinen Hostnamen und sind damit weder unscharf noch teuer.
   */
  raw?: RegExp;
}

const AI_SERVICE_DETECTORS: readonly Detector[] = [
  { label: 'OpenAI', hosts: [{ host: 'api.openai.com' }, { host: 'cdn.openai.com' }], raw: /["']gpt-(?:3\.5|4|4o|5)/i },
  { label: 'Anthropic', hosts: [{ host: 'api.anthropic.com' }], raw: /["']claude-[a-z0-9-]/i },
  { label: 'Google Gemini', hosts: [{ host: 'generativelanguage.googleapis.com' }], raw: /["']gemini-[a-z0-9-]/i },
  { label: 'Azure OpenAI', hosts: [{ host: 'openai.azure.com' }] },
  { label: 'Cohere', hosts: [{ host: 'api.cohere.ai' }, { host: 'api.cohere.com' }] },
  { label: 'Mistral', hosts: [{ host: 'api.mistral.ai' }] },
  { label: 'Hugging Face', hosts: [{ host: 'api-inference.huggingface.co' }] },
  { label: 'Perplexity', hosts: [{ host: 'api.perplexity.ai' }] },
];

const CHAT_WIDGET_DETECTORS: readonly Detector[] = [
  { label: 'Intercom', hosts: [{ host: 'widget.intercom.io' }], raw: /intercomSettings/i },
  { label: 'Drift', hosts: [{ host: 'js.driftt.com' }], raw: /drift\.load/i },
  { label: 'Tidio', hosts: [{ host: 'code.tidio.co' }] },
  { label: 'Crisp', hosts: [{ host: 'client.crisp.chat' }] },
  { label: 'Zendesk', hosts: [{ host: 'static.zdassets.com' }], raw: /zEmbed/i },
  { label: 'HubSpot Chat', hosts: [{ host: 'js.hs-scripts.com' }], raw: /hubspot-messages/i },
  { label: 'LiveChat', hosts: [{ host: 'cdn.livechatinc.com' }] },
  { label: 'Tawk.to', hosts: [{ host: 'embed.tawk.to' }] },
  { label: 'Userlike', hosts: [{ host: 'widget.userlike.com' }], raw: /userlike-cdn/i },
  { label: 'Botpress', hosts: [{ host: 'cdn.botpress.cloud' }] },
  { label: 'Voiceflow', hosts: [{ host: 'cdn.voiceflow.com' }] },
];

const TECHNOLOGY_DETECTORS: readonly Detector[] = [
  // Die vier CMS liegen auf der Domain des Kunden — sie sind an
  // ausgelieferten Pfaden und der Generator-Angabe erkennbar, nicht an
  // einem Fremd-Host.
  { label: 'WordPress', raw: new RegExp(`wp-content/|wp-includes/|name=["']generator["']${ATTR}WordPress`, 'i') },
  { label: 'TYPO3', raw: new RegExp(`typo3temp/|name=["']generator["']${ATTR}TYPO3`, 'i') },
  { label: 'Drupal', raw: /sites\/default\/files\/|Drupal\.settings/i },
  { label: 'Joomla', raw: new RegExp(`/media/jui/|name=["']generator["']${ATTR}Joomla`, 'i') },
  { label: 'Shopify', hosts: [{ host: 'cdn.shopify.com' }], raw: /Shopify\.theme/i },
  { label: 'Wix', hosts: [{ host: 'static.wixstatic.com' }] },
  { label: 'Squarespace', hosts: [{ host: 'static1.squarespace.com' }] },
  { label: 'Webflow', hosts: [{ host: 'website-files.com' }], raw: /data-wf-page/i },
  { label: 'Next.js', raw: /\/_next\/static\/|__NEXT_DATA__/i },
  { label: 'Nuxt', raw: /\/_nuxt\/|__NUXT__/i },
  { label: 'React', raw: /data-reactroot|__REACT_DEVTOOLS/i },
  { label: 'Vue', raw: /data-v-[0-9a-f]{8}|__VUE__/i },
  { label: 'Angular', raw: /ng-version=|\bng-app\b/i },
  {
    label: 'Google Analytics',
    hosts: [
      { host: 'googletagmanager.com', pathContains: '/gtag/js' },
      { host: 'google-analytics.com', pathContains: '/analytics.js' },
    ],
  },
  {
    label: 'Google Tag Manager',
    hosts: [{ host: 'googletagmanager.com', pathContains: '/gtm.js' }],
    raw: /dataLayer\.push/i,
  },
  {
    label: 'Meta Pixel',
    hosts: [{ host: 'connect.facebook.net', pathContains: '/fbevents.js' }],
    raw: /fbq\(/i,
  },
  { label: 'Matomo', raw: /matomo\.js|piwik\.js/i },
  { label: 'Hotjar', hosts: [{ host: 'static.hotjar.com' }] },
];

const CONSENT_MANAGER_PATTERN =
  /cookiebot|usercentrics|onetrust|borlabs|klaro|cookieyes|iubenda|complianz|consentmanager|didomi|osano|termly|cmplz|__tcfapi/i;

/** Schrift-Dienste, die als Fremd-Host ins HTML eingebunden werden. */
const FONT_HOSTS: readonly string[] = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'p.typekit.net',
  'use.fontawesome.com',
  'cdn.fonts.net',
  'fast.fonts.net',
];

/**
 * Die Google-Schrift-Hosts, exakt.
 *
 * Bewusst eine Menge und kein `endsWith('googleapis.com')`: Jene Prüfung
 * trifft auch `boesegoogleapis.com` oder `meine-fonts.googleapis.com.evil.example`.
 * Der Unterschied ist hier nicht theoretisch — an ihm hängt, ob der Bericht
 * das Urteil des LG München I zitiert. Ein Gerichtsurteil dem falschen
 * Sachverhalt zuzuordnen ist genau die Art Falschaussage, die dieser Scan
 * nicht treffen darf.
 */
const GOOGLE_FONT_HOSTS: ReadonlySet<string> = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

/**
 * Transparenzhinweis zur KI-Nutzung. Verlangt eine **Aussage**, nicht nur
 * das Vorkommen des Wortes „KI“: Ein Blogartikel über künstliche
 * Intelligenz ist kein Hinweis nach Art. 50.
 */
const AI_DISCLOSURE_PATTERN =
  /data-ai-disclosure|(?:ki|künstliche[rn]?\s+intelligenz|ai)[\s-]*(?:generiert|gestützt|unterstützt|generated|powered)|(?:diese[rs]?\s+(?:seite|website|chat|assistent)[^.]{0,60}(?:ki|künstlicher?\s+intelligenz))|(?:you\s+are\s+(?:chatting|interacting)\s+with\s+an?\s+ai)|(?:powered\s+by\s+(?:openai|anthropic|gpt|claude|gemini))/i;

// ── Signalerhebung ──────────────────────────────────────────────────────

export function collectSignals(obs: SiteObservation): PublicScanSignals {
  const html = obs.html;
  // Einmal parsen, dreimal auswerten. Vorher lief je Detektor ein eigener
  // Ausdruck über das gesamte Dokument.
  const urls = extractDocumentUrls(html);

  return {
    technologies: matchDetectors(html, urls, TECHNOLOGY_DETECTORS),
    aiTools: matchDetectors(html, urls, AI_SERVICE_DETECTORS),
    chatWidgets: matchDetectors(html, urls, CHAT_WIDGET_DETECTORS),
    hasConsentManager: CONSENT_MANAGER_PATTERN.test(html),
    externalFontHosts: uniqueFontHosts(urls),
    hasAiDisclosure: AI_DISCLOSURE_PATTERN.test(html),
    formCount: (html.match(/<form\b/gi) ?? []).length,
    hasViewportMeta: new RegExp(`<meta${ATTR}name\\s*=\\s*["']viewport["']`, 'i').test(html),
    hasStructuredData:
      new RegExp(`<script${ATTR}type\\s*=\\s*["']application/ld\\+json["']`, 'i').test(html) ||
      /\bitemscope\b/i.test(html),
    headingLevels: collectHeadingLevels(html),
  };
}

/** Eine im Dokument gefundene Adresse, zerlegt. */
interface DocumentUrl {
  host: string;
  path: string;
}

/**
 * Alle absoluten Adressen des Dokuments, einmal geparst.
 *
 * Erfasst `src`/`href`-Attribute **und** Adressen im Skript-Text (ein
 * `fetch("https://api.openai.com/…")` steht in keinem Attribut). Relative
 * Verweise werden übergangen — sie tragen keinen Host, und die Signale auf
 * der eigenen Domain laufen ohnehin über `raw`.
 *
 * Die Quantoren sind begrenzt: Auch dieser Ausdruck läuft über fremdes HTML.
 */
export function extractDocumentUrls(html: string): DocumentUrl[] {
  const urls: DocumentUrl[] = [];
  const seen = new Set<string>();

  // Schema-relative Adressen (`//cdn.example.com/x.js`) sind im Web üblich
  // und tragen einen Host — deshalb die Auflösung gegen eine Basis.
  for (const match of html.matchAll(/(?:https?:)?\/\/[^\s"'<>()\\]{1,600}/gi)) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    try {
      const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
      urls.push({ host: url.hostname.toLowerCase(), path: url.pathname });
    } catch {
      // Unlesbares wird übergangen, nicht geraten.
    }
  }

  return urls;
}

/**
 * Gehört `candidate` zu `host`? Exakt oder als echte Subdomain.
 *
 * Der Punkt vor `host` ist der ganze Punkt: Ohne ihn würde
 * `boesegoogleapis.com` als Treffer für `googleapis.com` gelten — genau der
 * Fehler, den die Sicherheitsanalyse in der Schrift-Einstufung gefunden hat.
 */
export function hostMatches(candidate: string, host: string): boolean {
  return candidate === host || candidate.endsWith(`.${host}`);
}

function matchDetectors(
  html: string,
  urls: readonly DocumentUrl[],
  detectors: readonly Detector[],
): string[] {
  const found: string[] = [];

  for (const detector of detectors) {
    const viaHost = detector.hosts?.some((signal) =>
      urls.some((url) =>
        hostMatches(url.host, signal.host) &&
        (signal.pathContains === undefined || url.path.includes(signal.pathContains)),
      ),
    ) ?? false;

    if (viaHost || detector.raw?.test(html) === true) found.push(detector.label);
  }

  return found;
}

/**
 * Schrift-Hosts aus den bereits geparsten Adressen.
 *
 * Läuft über denselben Weg wie die Technologie-Erkennung — ein zweiter
 * Extraktionspfad daneben wäre eine zweite Wahrheit über denselben
 * Gegenstand.
 */
function uniqueFontHosts(urls: readonly DocumentUrl[]): string[] {
  const hosts = new Set<string>();
  for (const url of urls) {
    for (const font of FONT_HOSTS) {
      if (hostMatches(url.host, font)) hosts.add(url.host);
    }
  }
  return [...hosts].sort();
}

function collectHeadingLevels(html: string): number[] {
  const levels: number[] = [];
  for (const match of html.matchAll(/<h([1-6])\b/gi)) levels.push(Number(match[1]));
  return levels;
}

// ── Befunde ─────────────────────────────────────────────────────────────

/**
 * Befunde, die zusätzlich zu `analyzeObservation()` entstehen. Sie nutzen
 * ausschließlich die acht bestehenden Dimensionen — die Gewichte in
 * `scoring/scores.ts` bleiben damit unangetastet.
 */
export function detectAdditionalFindings(
  obs: SiteObservation,
  signals: PublicScanSignals,
): RuntimeFinding[] {
  return [
    ...checkAiTransparency(obs, signals),
    ...checkExternalFonts(obs, signals),
    ...checkConsentManagement(obs, signals),
    ...checkFormPrivacy(obs, signals),
    ...checkMobileAndStructure(obs, signals),
    ...checkDiscoverability(obs, signals),
  ];
}

/**
 * Art. 50 EU AI Act: Wer mit einem KI-System interagiert, muss das
 * erfahren. Der Befund entsteht nur, wenn ein KI-System **erkannt** wurde
 * und ein Hinweis **fehlt** — nicht allein aus dem Einsatz von KI.
 */
function checkAiTransparency(obs: SiteObservation, s: PublicScanSignals): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];
  const usesAi = s.aiTools.length > 0;
  const usesChat = s.chatWidgets.length > 0;

  if (usesAi && !s.hasAiDisclosure) {
    findings.push({
      code: 'eu-ai-act.ai-service-without-disclosure',
      dimension: 'eu-ai-act',
      severity: 'high',
      title: `KI-Dienst eingebunden, kein Transparenzhinweis erkennbar (${s.aiTools.join(', ')})`,
      reference: 'Art. 50 EU AI Act',
      remediation:
        'Sichtbaren Hinweis ergänzen, dass an dieser Stelle ein KI-System eingesetzt wird, und den Hinweis maschinenlesbar auszeichnen.',
      locator: obs.url,
    });
  }

  if (usesChat && !s.hasAiDisclosure) {
    findings.push({
      code: 'eu-ai-act.chat-widget-without-disclosure',
      dimension: 'eu-ai-act',
      severity: 'medium',
      title: `Chat-Assistent eingebunden, kein Transparenzhinweis erkennbar (${s.chatWidgets.join(', ')})`,
      reference: 'Art. 50 Abs. 1 EU AI Act',
      remediation:
        'Im Chat-Fenster kenntlich machen, ob ein Mensch oder ein KI-System antwortet. Wird ausschließlich menschlich geantwortet, ist kein Hinweis nötig.',
      locator: obs.url,
    });
  }

  // Ohne jedes Signal bleibt die Lage offen — das ist ein eigener Zustand
  // und ausdrücklich kein Freispruch. Der Bericht formuliert ihn als
  // „nicht feststellbar“, nicht als „konform“.
  if (!usesAi && !usesChat) {
    findings.push({
      code: 'eu-ai-act.no-ai-signal-detected',
      dimension: 'eu-ai-act',
      severity: 'info',
      title: 'Im ausgelieferten HTML kein KI-System erkennbar',
      reference: 'Art. 50 EU AI Act',
      remediation:
        'Nur eine Aussage über das ausgelieferte HTML. Serverseitig eingesetzte KI-Systeme sind von außen nicht sichtbar und gehören in die eigene Bestandsaufnahme.',
      locator: obs.url,
    });
  }

  return findings;
}

/**
 * Fremd geladene Schriften übertragen die IP-Adresse des Besuchers ohne
 * Einwilligung an den Anbieter. Für Google Fonts hat das LG München I
 * (Urteil vom 20.01.2022, 3 O 17493/20) einen Unterlassungsanspruch
 * bejaht — der praktisch häufigste Befund überhaupt.
 */
function checkExternalFonts(obs: SiteObservation, s: PublicScanSignals): RuntimeFinding[] {
  if (s.externalFontHosts.length === 0) return [];

  const isGoogle = s.externalFontHosts.some((h) => GOOGLE_FONT_HOSTS.has(h));

  return [{
    code: 'gdpr.external-font-host',
    dimension: 'gdpr',
    severity: isGoogle ? 'high' : 'medium',
    title: `Schriften werden von einem Fremd-Host geladen (${s.externalFontHosts.join(', ')})`,
    reference: isGoogle
      ? 'Art. 6 Abs. 1 DSGVO — LG München I, 3 O 17493/20'
      : 'Art. 6 Abs. 1 DSGVO',
    remediation:
      'Schriften lokal ausliefern. Dadurch entfällt die Übertragung der Besucher-IP an den Anbieter und der Aufruf wird zugleich schneller.',
    locator: obs.url,
  }];
}

/**
 * § 25 Abs. 1 TDDDG verlangt die Einwilligung **vor** dem Speichern von
 * Informationen auf dem Endgerät. Ein erkanntes Analyse-Werkzeug ohne
 * jedes Consent-Werkzeug ist der klassische Verstoß.
 */
function checkConsentManagement(obs: SiteObservation, s: PublicScanSignals): RuntimeFinding[] {
  const trackingTech = s.technologies.filter((t) =>
    ['Google Analytics', 'Google Tag Manager', 'Meta Pixel', 'Hotjar'].includes(t),
  );
  if (trackingTech.length === 0 || s.hasConsentManager) return [];

  return [{
    code: 'tdddg.tracking-without-consent-manager',
    dimension: 'tdddg',
    severity: 'high',
    title: `Analyse-Werkzeuge ohne erkennbares Einwilligungs-Werkzeug (${trackingTech.join(', ')})`,
    reference: '§ 25 Abs. 1 TDDDG',
    remediation:
      'Einwilligung vor dem Laden der Analyse-Werkzeuge einholen und die Werkzeuge erst nach erteilter Einwilligung ausführen.',
    locator: obs.url,
  }];
}

/**
 * Art. 13 DSGVO: Wer Daten über ein Formular erhebt, muss zum Zeitpunkt
 * der Erhebung informieren. Ein Formular ohne Datenschutz-Link auf
 * derselben Seite erfüllt das regelmäßig nicht.
 */
function checkFormPrivacy(obs: SiteObservation, s: PublicScanSignals): RuntimeFinding[] {
  if (s.formCount === 0) return [];
  // Reine Suchfelder sind keine Datenerhebung im Sinne der Norm.
  const onlySearch = new RegExp(`<form${ATTR}role\\s*=\\s*["']search["']`, 'i').test(obs.html) && s.formCount === 1;
  if (onlySearch) return [];
  if (/href\s*=\s*["'][^"']*(datenschutz|privacy)/i.test(obs.html)) return [];

  return [{
    code: 'gdpr.form-without-privacy-reference',
    dimension: 'gdpr',
    severity: 'medium',
    title: `${s.formCount} Formular(e) ohne Datenschutz-Hinweis auf derselben Seite`,
    reference: 'Art. 13 DSGVO',
    remediation:
      'Am Formular auf die Datenschutzerklärung verweisen, damit die Information zum Zeitpunkt der Erhebung vorliegt.',
    locator: obs.url,
  }];
}

/**
 * Darstellung und Struktur. Beides zahlt auf die Dimension `content` ein —
 * sie ist im Gewichtungsmodell für redaktionelle Reife vorgesehen und
 * bleibt in der SiteOS-Live-Analyse bislang unbesetzt.
 */
function checkMobileAndStructure(obs: SiteObservation, s: PublicScanSignals): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  if (!s.hasViewportMeta) {
    findings.push({
      code: 'content.missing-viewport',
      dimension: 'content',
      severity: 'high',
      title: 'Keine Viewport-Angabe — die Seite ist auf Mobilgeräten nicht angepasst',
      reference: 'Mobile Darstellung',
      remediation: 'meta[name=viewport] mit width=device-width, initial-scale=1 ausliefern.',
      locator: obs.url,
    });
  }

  // Ein Sprung von H1 auf H3 bricht die Vorlesereihenfolge. Geprüft wird
  // nur der erste Sprung — eine vollständige Gliederungsprüfung braucht
  // den DOM und gehört in den vertieften Scan.
  const levels = s.headingLevels;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      findings.push({
        code: 'accessibility.heading-level-skip',
        dimension: 'accessibility',
        severity: 'low',
        title: `Überschriften-Ebene übersprungen (H${levels[i - 1]} → H${levels[i]})`,
        reference: 'WCAG 2.2 — 1.3.1',
        remediation: 'Überschriften lückenlos schachteln; Ebenen nicht zur Gestaltung wählen.',
        locator: obs.url,
      });
      break;
    }
  }

  return findings;
}

/** Auffindbarkeit: strukturierte Daten und Indexierungssteuerung. */
function checkDiscoverability(obs: SiteObservation, s: PublicScanSignals): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  if (!s.hasStructuredData) {
    findings.push({
      code: 'seo.missing-structured-data',
      dimension: 'seo',
      severity: 'low',
      title: 'Keine strukturierten Daten (schema.org) im ausgelieferten HTML',
      reference: 'schema.org / Rich Results',
      remediation:
        'Organisation, Angebot oder Artikel als JSON-LD auszeichnen — Grundlage für erweiterte Suchergebnisse.',
      locator: obs.url,
    });
  }

  // Ein `noindex` auf der Startseite ist fast immer ein Versehen aus einer
  // Testumgebung und nimmt die Seite vollständig aus der Suche.
  if (new RegExp(`<meta${ATTR}name\\s*=\\s*["']robots["']${ATTR}content\\s*=\\s*["'][^"']{0,200}noindex`, 'i').test(obs.html)) {
    findings.push({
      code: 'seo.noindex-delivered',
      dimension: 'seo',
      severity: 'critical',
      title: 'Die Seite ist per robots-Meta von der Indexierung ausgeschlossen',
      reference: 'Indexierungssteuerung',
      remediation:
        'noindex entfernen, sofern der Ausschluss nicht beabsichtigt ist — die Seite erscheint sonst in keiner Suchmaschine.',
      locator: obs.url,
    });
  }

  return findings;
}
