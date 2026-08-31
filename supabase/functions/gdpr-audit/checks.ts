// Prueflogik des kostenlosen DSGVO-Audits.
//
// Rekonstruktion vom 2026-08-30. `index.ts` rief seit seiner Anlage
// (a67ae2c, 2026-08-19) sechs Hilfsfunktionen auf, die nie existierten —
// die Function antwortete deshalb auf JEDEN Request mit
// `ReferenceError: runChecks is not defined`, und `scan_runs` blieb leer.
//
// Bewusst frei von Deno-Globals und Netzwerkzugriff: Damit ist dieses Modul
// aus Vitest heraus testbar (`test/audit/gdpr-checks.test.ts`). Genau das
// hat vorher gefehlt — eine Edge Function, die niemand je aufruft, kann
// beliebig kaputt sein, ohne dass es auffaellt.
//
// Die Namen der Fakten sind NICHT frei gewaehlt: Sie sind der Vertrag mit
// der Rule Engine (`_shared/rules/gdpr.json`). Wer hier einen Schluessel
// umbenennt, macht die zugehoerige Regel still wirkungslos.

import trackerRegistry from '../_shared/rules/tracker-registry.json' with { type: 'json' };
import { stripPolicyDeclarations, effectiveCspValue } from '../_shared/tracker-detection.ts';
import { detectAIDisclosure } from '../_shared/ai-disclosure-check.ts';
import { isLikelyGermanJurisdiction } from '../_shared/jurisdiction.ts';

export interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface TrackerEntry {
  id: string;
  name: string;
  category: string;
  consent_required: boolean;
  third_country_transfer?: boolean;
  needles: string[];
}

const TRACKERS = (trackerRegistry as { trackers: TrackerEntry[] }).trackers;

/** Header-Zugriff, der auch mit einem einfachen Objekt funktioniert (Tests). */
export type HeaderLike = { get(name: string): string | null } | null;

function header(h: HeaderLike, name: string): string | null {
  try { return h?.get(name) ?? null; } catch { return null; }
}

// ── Erkennung ────────────────────────────────────────────────────────

/**
 * Findet eingebundene Drittanbieter-Dienste.
 *
 * `stripPolicyDeclarations` entfernt vorher CSP-Meta-Tags und
 * Verbindungs-Hints: Eine Domain, die nur in einer CSP-Allowlist oder einem
 * `preconnect` steht, wird nicht geladen. Ohne diesen Schritt meldet der
 * Scan ausgerechnet gut abgesicherten Seiten die meisten Tracker.
 */
export function detectTrackers(html: string): TrackerEntry[] {
  const haystack = stripPolicyDeclarations(html).toLowerCase();
  return TRACKERS.filter((t) => t.needles.some((n) => haystack.includes(n.toLowerCase())));
}

/** Sucht einen Link auf eine Unterseite, z. B. Impressum oder Datenschutz. */
function findLink(html: string, patterns: RegExp[]): string | null {
  const anchors = html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const a of anchors) {
    const href = a[1];
    const text = a[2].replace(/<[^>]*>/g, ' ');
    if (patterns.some((p) => p.test(href) || p.test(text))) return href;
  }
  return null;
}

const IMPRESSUM_RE = [/impressum/i, /imprint/i, /legal-notice/i];
const DATENSCHUTZ_RE = [/datenschutz/i, /privacy/i, /privacidad/i];

export function findImpressumLink(html: string): string | null {
  return findLink(html, IMPRESSUM_RE);
}

export function findPrivacyLink(html: string): string | null {
  return findLink(html, DATENSCHUTZ_RE);
}

/**
 * Cookie-Banner erkennen. Bewusst breit: Es geht nur um „irgendein
 * Consent-Mechanismus vorhanden", die Bewertung macht die Rule Engine.
 */
export function detectConsentBanner(html: string): boolean {
  const h = html.toLowerCase();
  return /cookiebot|usercentrics|borlabs|klaro|osano|onetrust|cookieyes|complianz|iubenda|termly/.test(h)
    || /(cookie|consent)[-_]?(banner|notice|consent|layer|dialog|modal)/.test(h)
    || (/cookie/.test(h) && /(einwillig|zustimm|akzeptier|accept all|alle akzeptieren)/.test(h));
}

/**
 * Prueft, ob Ablehnen genauso prominent angeboten wird wie Zustimmen
 * (Dark-Pattern-Check, § 25 TDDDG i. V. m. Art. 7 Abs. 3 DSGVO).
 *
 * Konservativ: Nur wenn ein Zustimmen-Element existiert UND kein
 * Ablehnen-Element gefunden wird, gilt die Prominenz als ungleich. Die
 * feinere Pruefung (Groesse, Kontrast) braucht einen echten Browser und
 * gehoert nicht in eine HTML-Vorpruefung.
 */
export function hasEqualRejectButton(html: string): boolean {
  const h = html.toLowerCase();
  const accept = /(alle[sn]? akzeptier|accept all|zustimmen|einverstanden|agree)/.test(h);
  if (!accept) return true; // Kein Zustimmen-Button — nichts zu vergleichen.
  return /(alle[sn]? ablehn|reject all|decline|nur notwendig|only necessary|essenziell)/.test(h);
}

/**
 * Dynamisch nachgeladene Google Fonts (LG Muenchen I, 3 O 17493/20).
 *
 * Der Ausdruck ist bewusst am Host verankert — `//` davor, ein Trennzeichen
 * danach. Ohne diese Verankerung (CodeQL-Alert vom 2026-08-30) wuerde auch
 * `fonts.googleapis.com.angreifer.net` treffen, und der Scan meldete einem
 * Kunden einen `medium`-Befund fuer etwas, das er gar nicht einbindet.
 * Bei einem Werkzeug, das Befunde an Kunden ausliefert, ist ein Fehlalarm
 * teurer als eine Luecke.
 */
const GOOGLE_FONTS_RE = /(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com(?=[:/?"'\s>]|$)/i;

export function usesDynamicGoogleFonts(html: string): boolean {
  return GOOGLE_FONTS_RE.test(stripPolicyDeclarations(html));
}

// ── Fakten fuer die Rule Engine ──────────────────────────────────────

/**
 * Uebersetzt den Scan in die Fakten, gegen die `evaluateAll()` auswertet.
 *
 * Die Schluessel stammen 1:1 aus den Bedingungen in `gdpr.json` — sie sind
 * der Vertrag zwischen Scan und Regelwerk, keine freie Wahl.
 */
export function extractFacts(
  url: string,
  html: string,
  headers: HeaderLike,
  issues: Issue[],
): Record<string, unknown> {
  const trackers = detectTrackers(html);
  const bannerDetected = detectConsentBanner(html);
  const privacyHref = findPrivacyLink(html);

  return {
    'tracker.any_external': trackers.length > 0,
    'tracker.google_analytics.detected': trackers.some((t) => t.id.startsWith('google_analytics')),
    'tracker.meta_pixel.detected': trackers.some((t) => t.id.includes('meta') || t.id.includes('facebook')),
    'consent.banner.detected': bannerDetected,
    'consent.banner.reject_button_equal_prominence': hasEqualRejectButton(html),
    // Ohne echten Browser laesst sich die Ladereihenfolge nicht messen. Ein
    // einwilligungspflichtiger Tracker im HTML-Quelltext bedeutet aber, dass
    // er ohne vorherige Einwilligung ausgeliefert wird — genau der Befund.
    'consent.detected_before_load': !trackers.some((t) => t.consent_required),
    'page.impressum.url_found': findImpressumLink(html) !== null,
    'page.privacy_policy.url_found': privacyHref !== null,
    // Aus dem HTML der Startseite nicht entscheidbar; die Unterseiten-Pruefung
    // setzt den Wert, wenn sie die Datenschutzseite tatsaechlich gelesen hat.
    'page.privacy_policy.mentions_avv': issues.some((i) => i.id === 'privacy_mentions_avv'),
    'asset.google_fonts.dynamic': usesDynamicGoogleFonts(html),
  };
}

// ── Die Pruefungen ───────────────────────────────────────────────────

/**
 * Die technische Vorpruefung der Startseite.
 *
 * Ergaenzt die Rule Engine, statt sie zu doppeln: Hier stehen die Befunde,
 * die sich direkt aus HTTP-Antwort und Markup ergeben (Transport, Header,
 * Pflichtangaben, KI-Kennzeichnung). Die normative Bewertung von Consent
 * und Trackern macht `evaluateAll()`.
 */
export function runChecks(
  url: string,
  html: string,
  headers: HeaderLike,
  status: number | null,
  fetchError: string | null,
): Issue[] {
  const issues: Issue[] = [];

  // Nicht erreichbar: Alles Weitere waere geraten.
  if (fetchError || status === null) {
    issues.push({
      id: 'site_unreachable',
      severity: 'info',
      title: 'Website nicht erreichbar',
      detail: `Die Seite konnte nicht geladen werden (${fetchError ?? 'kein Status'}). `
        + 'Ohne Abruf lassen sich keine Aussagen treffen.',
    });
    return issues;
  }

  // 1 · Transportverschluesselung
  if (!url.toLowerCase().startsWith('https://')) {
    issues.push({
      id: 'no_https',
      severity: 'critical',
      title: 'Keine Transportverschluesselung',
      detail: 'Die Seite ist ueber HTTP erreichbar. Personenbezogene Daten aus Formularen '
        + 'werden dabei unverschluesselt uebertragen.',
      paragraph_ref: 'Art. 32 Abs. 1 lit. a DSGVO',
    });
  }

  // 2 · HSTS
  if (!header(headers, 'strict-transport-security')) {
    issues.push({
      id: 'no_hsts',
      severity: 'low',
      title: 'HSTS-Header fehlt',
      detail: 'Ohne `Strict-Transport-Security` kann der erste Aufruf auf HTTP herabgestuft werden.',
      paragraph_ref: 'Art. 32 DSGVO',
    });
  }

  // 3 · Content-Security-Policy (Header oder wirksames <meta>)
  if (!effectiveCspValue(header(headers, 'content-security-policy'), html)) {
    issues.push({
      id: 'no_csp',
      severity: 'low',
      title: 'Keine Content-Security-Policy',
      detail: 'Ohne CSP kann eingeschleustes Skript beliebige Drittanbieter nachladen.',
      paragraph_ref: 'Art. 32 DSGVO',
    });
  }

  // 4 · Clickjacking — bewusst nur header-basiert: `frame-ancestors` wird
  //     per <meta> vom Browser NICHT durchgesetzt.
  const headerCsp = header(headers, 'content-security-policy') ?? '';
  if (!header(headers, 'x-frame-options') && !/frame-ancestors/i.test(headerCsp)) {
    issues.push({
      id: 'no_clickjacking_protection',
      severity: 'low',
      title: 'Kein Clickjacking-Schutz',
      detail: 'Weder `X-Frame-Options` noch `frame-ancestors` im CSP-Header gesetzt.',
      paragraph_ref: 'Art. 32 DSGVO',
    });
  }

  // 5 · Impressum — § 5 DDG greift nur im deutschsprachigen Raum. Ausserhalb
  //     bleibt es ein Hinweis, kein Verstoss.
  const deutschsprachig = isLikelyGermanJurisdiction(url, html);
  if (!findImpressumLink(html)) {
    issues.push({
      id: 'no_impressum_link',
      severity: deutschsprachig ? 'high' : 'info',
      title: 'Kein Impressum verlinkt',
      detail: deutschsprachig
        ? 'Auf der Startseite ist kein Impressum verlinkt. Die Anbieterkennzeichnung muss '
          + 'leicht erkennbar und unmittelbar erreichbar sein.'
        : 'Kein Impressum verlinkt. Ausserhalb des deutschsprachigen Raums nur ein Hinweis.',
      paragraph_ref: deutschsprachig ? '§ 5 DDG · § 18 MStV' : undefined,
    });
  }

  // 6 · Datenschutzerklaerung
  if (!findPrivacyLink(html)) {
    issues.push({
      id: 'no_privacy_link',
      severity: 'high',
      title: 'Keine Datenschutzerklaerung verlinkt',
      detail: 'Auf der Startseite ist keine Datenschutzerklaerung verlinkt. Die Informationspflicht '
        + 'ist zum Zeitpunkt der Erhebung zu erfuellen.',
      paragraph_ref: 'Art. 13 DSGVO',
    });
  }

  // 7 · Einwilligungspflichtige Tracker ohne Banner
  const trackers = detectTrackers(html);
  const einwilligungspflichtig = trackers.filter((t) => t.consent_required);
  if (einwilligungspflichtig.length > 0 && !detectConsentBanner(html)) {
    issues.push({
      id: 'tracking_without_consent',
      severity: 'critical',
      title: 'Tracking ohne Einwilligung',
      detail: `Einwilligungspflichtige Dienste eingebunden, aber kein Consent-Banner erkannt: `
        + einwilligungspflichtig.map((t) => t.name).join(', ') + '.',
      paragraph_ref: '§ 25 Abs. 1 TDDDG · Art. 6 Abs. 1 lit. a DSGVO',
    });
  }

  // 8 · Drittlandtransfer
  const drittland = trackers.filter((t) => t.third_country_transfer);
  if (drittland.length > 0) {
    issues.push({
      id: 'third_country_transfer',
      severity: 'medium',
      title: 'Datenuebermittlung in Drittlaender',
      detail: `Dienste mit Drittlandbezug eingebunden: ${drittland.map((t) => t.name).join(', ')}. `
        + 'Erforderlich sind geeignete Garantien und ein Hinweis in der Datenschutzerklaerung.',
      paragraph_ref: 'Art. 44 ff. DSGVO',
    });
  }

  // 9 · Dark Pattern im Cookie-Banner
  if (detectConsentBanner(html) && !hasEqualRejectButton(html)) {
    issues.push({
      id: 'consent_dark_pattern',
      severity: 'high',
      title: 'Ablehnen nicht gleichwertig angeboten',
      detail: 'Es wurde ein Zustimmen-, aber kein gleichwertiges Ablehnen-Element gefunden. '
        + 'Die Einwilligung ist dann nicht freiwillig.',
      paragraph_ref: 'Art. 4 Nr. 11 · Art. 7 Abs. 3 DSGVO',
    });
  }

  // 10 · Dynamische Google Fonts
  if (usesDynamicGoogleFonts(html)) {
    issues.push({
      id: 'dynamic_google_fonts',
      severity: 'medium',
      title: 'Google Fonts werden dynamisch geladen',
      detail: 'Beim Seitenaufruf wird die IP-Adresse des Besuchers an Google uebertragen — '
        + 'ohne Einwilligung. Abhilfe: Schriften lokal ausliefern.',
      paragraph_ref: 'Art. 6 Abs. 1 DSGVO · LG Muenchen I, 3 O 17493/20',
    });
  }

  // 11 · Kennzeichnung von KI-Systemen (Art. 50 EU AI Act)
  const ki = detectAIDisclosure(html);
  if (ki.detected_ai_tools.length > 0 && !ki.has_disclosure) {
    issues.push({
      id: 'ai_no_disclosure',
      severity: 'medium',
      title: 'KI-Interaktion ohne Kennzeichnung',
      detail: `Erkannte KI-Dienste: ${ki.detected_ai_tools.join(', ')}. Ein Hinweis darauf, dass `
        + 'Besucher mit einem KI-System interagieren, wurde nicht gefunden.',
      paragraph_ref: 'Art. 50 Abs. 1 EU AI Act',
    });
  }

  // 12 · Serverstandort-Hinweis im Klartext
  const serverHeader = header(headers, 'server') ?? '';
  if (/cloudflare|amazonaws|vercel|netlify/i.test(serverHeader) && !findPrivacyLink(html)) {
    issues.push({
      id: 'hosting_undisclosed',
      severity: 'low',
      title: 'Hosting-Dienstleister nicht dokumentiert',
      detail: `Der Server meldet sich als "${serverHeader}". Ohne Datenschutzerklaerung fehlt `
        + 'die Angabe zum Auftragsverarbeiter.',
      paragraph_ref: 'Art. 28 DSGVO',
    });
  }

  return issues;
}

// ── Bewertung ────────────────────────────────────────────────────────

/**
 * Punktabzug je Befund.
 *
 * ACHTUNG — versionsrelevant: Diese Gewichte bestimmen den Score, den der
 * Kunde sieht und der in Reports und Vergleichen auftaucht. Aenderungen
 * verschieben alle bestehenden Ergebnisse und gehoeren entschieden, nicht
 * nebenbei angepasst.
 *
 * Kalibrierung: Ein einzelner `critical` (Tracking ohne Einwilligung, kein
 * HTTPS) drueckt von 100 auf 70 und damit unter jede „gruen"-Schwelle — das
 * ist beabsichtigt, denn beides ist fuer sich genommen abmahnfaehig.
 * `info` zaehlt nie ab; es ist ein Hinweis, kein Mangel.
 */
export const SEVERITY_WEIGHTS: Record<Issue['severity'], number> = {
  critical: 30,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

export function scoreReport(issues: Issue[]): {
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
} {
  const abzug = issues.reduce((sum, i) => sum + SEVERITY_WEIGHTS[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - abzug));

  // Die Gesamteinstufung folgt dem schwersten Einzelbefund, nicht dem Score:
  // Ein einzelner kritischer Verstoss bleibt kritisch, auch wenn sonst alles
  // sauber ist.
  const severity = issues.some((i) => i.severity === 'critical') ? 'critical'
    : issues.some((i) => i.severity === 'high') ? 'high'
    : issues.some((i) => i.severity === 'medium') ? 'medium'
    : issues.some((i) => i.severity === 'low') ? 'low'
    : 'none';

  return { score, severity };
}
