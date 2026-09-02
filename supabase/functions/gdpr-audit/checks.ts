/**
 * Prüf-Heuristiken des öffentlichen DSGVO-Audits (`/audit`).
 *
 * ─── Warum diese Datei existiert ────────────────────────────────────────
 *
 * `gdpr-audit/index.ts` rief `runChecks`, `scanSubpages`, `extractFacts`,
 * `fetchWithTimeout`, `concat` und `scoreReport` auf — und **definierte
 * keine davon**. Die Datei endete nach dem `Deno.serve`-Block mit der
 * Überschrift „─── Heuristik-Checks ───“ und sonst nichts. Das galt nicht
 * nur im Repository, sondern auch in Produktion (Function-Version 46,
 * gemessen am 2026-08-29 über die Management-API).
 *
 * Folge: `runChecks(...)` warf bei **jedem** Aufruf ausserhalb eines
 * try/catch einen `ReferenceError`. Der Endpunkt antwortete nach bestandener
 * Eingabevalidierung mit HTTP 500. Beleg in den Daten: `gdpr_audits` hält
 * 159 Zeilen, die neueste vom **2026-08-11**; der abgeschnittene Stand kam
 * am 2026-08-16 ins Repository. Seither: null Audits.
 *
 * Der freie Scan ist der Kopf des Trichters (`docs/product/public-scan-funnel.md`).
 * Stand er still, stand das Produkt still.
 *
 * ─── Rekonstruktion, nicht Wiederherstellung ────────────────────────────
 *
 * Der ursprüngliche Code ist nicht mehr auffindbar — weder in der
 * Git-History (die Datei wurde in `7cfc199` bereits abgeschnitten
 * **hinzugefügt**) noch im Deployment. Diese Datei ist deshalb eine
 * **Rekonstruktion aus dem gemessenen Verhalten**, kein wiedergefundenes
 * Original. Was daran gemessen ist und was abgeleitet:
 *
 * | Bestandteil | Herkunft |
 * |---|---|
 * | Befund-Codes, Severities, Titel, Normbezüge | **gemessen** — `select i->>'id' … from gdpr_audits, jsonb_array_elements(issues) i`, 26 Codes über alle 159 Audits |
 * | Detailtexte | **gemessen** — längster beobachteter Text je Code |
 * | Scoring-Gewichte (25/12/6/2/0) | **exakt zurückgerechnet** — passt ohne Rest auf alle 27 beobachteten Kombinationen, siehe `scoreReport` |
 * | Severity-Stufe des Berichts | **gemessen** — höchste vorkommende Severity, `pass` bei null Befunden |
 * | Regexe, Schwellwerte, Reihenfolge | **abgeleitet** — plausibel aus Titel, Detailtext und Normbezug, nicht das Original |
 *
 * Deshalb steht die Engine-Version in `index.ts` auf `2026.08.1`: Ergebnisse
 * vor dem 2026-08-11 und danach sind vergleichbar **mit Vorbehalt**, nicht
 * stillschweigend dasselbe. Wer sie über die Version hinweg vergleicht,
 * muss das wissen.
 *
 * ─── Sprachregel, verbindlich ───────────────────────────────────────────
 *
 * Dieser Bericht entsteht ohne Vertrag, ohne Mandat und ohne Kenntnis der
 * Verarbeitungsvorgänge. Er sichert **niemals** Konformität zu. Befunde
 * beschreiben das **Beobachtete** („Tracker ohne sichtbares
 * Consent-Banner“), nicht die Rechtslage („verstösst gegen“). Dieselbe
 * Regel gilt in `_shared/public-scan/report.ts`.
 *
 * ─── ReDoS ──────────────────────────────────────────────────────────────
 *
 * Diese Ausdrücke laufen über das HTML einer **fremden**, potenziell
 * feindseligen Seite (bis 1 MB). Jeder Quantor ist deshalb begrenzt; kein
 * unbegrenztes `[^>]+` vor einem Literal. Vgl. die Messung in
 * `_shared/public-scan/detectors.ts`.
 *
 * Pure Funktionen ohne Netzwerk — direkt unter Vitest prüfbar, analog zu
 * `jurisdiction.ts`, `tracker-detection.ts` und `scan-coverage.ts`.
 */

import { isLikelyGermanJurisdiction } from '../_shared/jurisdiction.ts';
import { stripPolicyDeclarations, effectiveCspValue } from '../_shared/tracker-detection.ts';
import { detectAIDisclosure } from '../_shared/ai-disclosure-check.ts';
// Laufzeitsichere Tag-Extraktion: ein `indexOf`-Durchlauf statt eines
// Wildcard-Quantors ueber fremdes HTML. Begruendung und Messwerte im Kopf
// von `html-tags.ts`.
import { tagsOf, attrOf, stripElement } from '../_shared/html-tags.ts';
export { tagsOf, attrOf } from '../_shared/html-tags.ts';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Issue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

// ── Tracker-Erkennung ───────────────────────────────────────────────────
//
// Die Anzeigenamen sind bewusst kurz („Google Analytics“, nicht „Google
// Analytics 4 (GA4)“): Sie erscheinen im Kundentitel des Befunds, und genau
// so standen sie in den 159 historischen Audits.
//
// Die Nadeln sind mit `_shared/rules/tracker-registry.json` abgeglichen.
// Die Registry bleibt die reichere Quelle (Vendor, Drittland, Rechtsgrundlage);
// hier steht nur, was für die Erkennung nötig ist.

interface TrackerDef {
  key: string;
  name: string;
  /** Zählt für „Social-Media-Pixel“ — impliziert Drittlandtransfer. */
  socialPixel: boolean;
  needles: string[];
}

const TRACKERS: readonly TrackerDef[] = Object.freeze([
  { key: 'google_analytics', name: 'Google Analytics', socialPixel: false, needles: ['googletagmanager.com/gtag/js', 'google-analytics.com/g/collect', 'google-analytics.com/analytics.js', 'gtag('] },
  { key: 'google_tag_manager', name: 'Google Tag Manager', socialPixel: false, needles: ['googletagmanager.com/gtm.js'] },
  { key: 'meta_pixel', name: 'Meta Pixel', socialPixel: true, needles: ['connect.facebook.net/en_us/fbevents.js', 'connect.facebook.net/de_de/fbevents.js', 'fbq('] },
  { key: 'tiktok_pixel', name: 'TikTok Pixel', socialPixel: true, needles: ['analytics.tiktok.com', 'ttq.load(', 'ttq('] },
  { key: 'linkedin_insight', name: 'LinkedIn Insight', socialPixel: true, needles: ['snap.licdn.com/li.lms-analytics', 'px.ads.linkedin.com', 'lintrk('] },
  { key: 'pinterest_tag', name: 'Pinterest Tag', socialPixel: true, needles: ['s.pinimg.com/ct/core.js', 'pintrk('] },
  { key: 'twitter_x_pixel', name: 'X (Twitter) Pixel', socialPixel: true, needles: ['static.ads-twitter.com/uwt.js', 'twq('] },
  { key: 'hotjar', name: 'Hotjar', socialPixel: false, needles: ['static.hotjar.com', 'script.hotjar.com'] },
  { key: 'microsoft_clarity', name: 'Microsoft Clarity', socialPixel: false, needles: ['clarity.ms/tag'] },
  { key: 'hubspot', name: 'HubSpot', socialPixel: false, needles: ['js.hs-scripts.com', 'js.hsforms.net'] },
  { key: 'intercom', name: 'Intercom', socialPixel: false, needles: ['widget.intercom.io', 'api-iam.intercom.io'] },
  { key: 'matomo', name: 'Matomo', socialPixel: false, needles: ['matomo.js', 'piwik.js'] },
]);

export interface DetectedTrackers {
  keys: string[];
  names: string[];
  socialNames: string[];
}

/**
 * Erkennt Tracker im **ladewirksamen** HTML.
 *
 * `stripPolicyDeclarations` läuft zwingend vorher: Eine CSP-Allowlist
 * *listet* erlaubte Origins auf — das ist das Gegenteil eines Verstosses.
 * Ohne diesen Schritt bekam jede Seite mit breiter CSP denselben
 * Befund-Mix und denselben Score (~28/100); der Output wirkte hartcodiert,
 * obwohl die Engine rechnete. Siehe `tracker-detection.ts`.
 */
export function detectTrackers(html: string): DetectedTrackers {
  const hay = stripPolicyDeclarations(html).toLowerCase();
  const keys: string[] = [];
  const names: string[] = [];
  const socialNames: string[] = [];
  for (const t of TRACKERS) {
    if (!t.needles.some((n) => hay.includes(n))) continue;
    keys.push(t.key);
    names.push(t.name);
    if (t.socialPixel) socialNames.push(t.name);
  }
  return { keys, names, socialNames };
}

// ── Consent-Banner ──────────────────────────────────────────────────────

const CONSENT_BANNER_NEEDLES = [
  'cookiebot', 'usercentrics', 'onetrust', 'cookieyes', 'klaro', 'borlabs',
  'complianz', 'iubenda', 'termly', 'osano', 'didomi', 'consentmanager',
  'cookie-consent', 'cookieconsent', 'cookie-banner', 'cookiebanner',
  'cookie-notice', 'gdpr-consent', 'cmpbox', '__tcfapi',
];

/** Sichtbares Einwilligungswerkzeug im ausgelieferten HTML? */
export function hasConsentBanner(html: string): boolean {
  const hay = html.toLowerCase();
  if (CONSENT_BANNER_NEEDLES.some((n) => hay.includes(n))) return true;
  // Textuelle Banner ohne bekanntes CMP: „Cookies akzeptieren“ o. ä.
  return /cookies?\s{0,3}(akzeptieren|zustimmen|erlauben)|accept\s{0,3}(all\s{0,3})?cookies/i.test(html);
}

/**
 * Reject-Button mit gleicher Prominenz wie Accept?
 *
 * Konservativ: Wir können aus statischem HTML keine Pixel messen. Gewertet
 * wird deshalb allein, ob eine Ablehnen-Option **überhaupt** im Markup
 * steht. Fehlt sie, ist Gleichrangigkeit ausgeschlossen — das ist die
 * Richtung, in der die Aussage belastbar ist.
 */
export function hasEqualRejectOption(html: string): boolean {
  return /alle\s{0,3}ablehnen|nur\s{0,3}(technisch\s{0,3})?notwendige|ablehnen|reject\s{0,3}all|decline\s{0,3}all|deny\s{0,3}all|essential\s{0,3}only/i.test(html);
}

// ── Pflicht-Links ───────────────────────────────────────────────────────

/** Erste passende `href`-Adresse zu einem Pflicht-Dokument, sonst null. */
export function findLegalLink(html: string, kind: 'privacy' | 'imprint'): string | null {
  const slugs = kind === 'privacy'
    ? ['datenschutz', 'privacy', 'privacy-policy', 'datenschutzerklaerung', 'datenschutzerklärung']
    : ['impressum', 'imprint', 'legal-notice', 'anbieterkennzeichnung'];

  const tags = tagsOf(html, 'a');

  // 1. Die Adresse selbst trägt den Slug.
  for (const tag of tags) {
    const href = attrOf(tag, 'href');
    if (!href) continue;
    const lc = href.toLowerCase();
    if (slugs.some((sl) => lc.includes(sl))) return href;
  }

  // 2. Die Adresse ist neutral (/legal/7), aber der Linktext benennt das
  //    Dokument. Der Text wird per indexOf geholt, nicht per Ausdruck über
  //    das ganze Dokument — linear und ohne Rückverfolgung.
  let cursor = 0;
  for (const tag of tags) {
    const at = html.indexOf(tag, cursor);
    if (at === -1) continue;
    cursor = at + tag.length;
    const close = html.indexOf('</a', cursor);
    if (close === -1) continue;
    const text = html.slice(cursor, Math.min(close, cursor + 200))
      .replace(/<[^>]{0,600}>/g, ' ')
      .toLowerCase();
    if (slugs.some((sl) => text.includes(sl))) {
      const href = attrOf(tag, 'href');
      if (href) return href;
    }
  }
  return null;
}

// ── Haupt-Heuristik ─────────────────────────────────────────────────────

/**
 * Prüfungen auf der abgerufenen Startseite.
 *
 * Bei fehlgeschlagenem Abruf bleibt es bei genau einem Befund: Über eine
 * Seite, die nicht geladen werden konnte, ist jede weitere Aussage
 * erfunden.
 */
export function runChecks(
  url: string,
  html: string,
  headers: Headers | null,
  status: number | null,
  fetchError: string | null,
): Issue[] {
  if (fetchError || status === null) {
    return [{
      id: 'fetch_failed',
      severity: 'high',
      title: 'Site nicht erreichbar',
      detail:
        `Wir konnten Deine Seite nicht laden: ${fetchError ?? 'unbekannter Fehler'}. ` +
        'Wenn die Site live ist, prüfe DNS / Firewall / WAF-Block.',
    }];
  }

  const issues: Issue[] = [];
  const h = (name: string) => headers?.get(name) ?? null;
  const isHttps = url.toLowerCase().startsWith('https://');

  // ── Transport und Sicherheits-Header ──
  if (!isHttps) {
    issues.push({
      id: 'no_https',
      severity: 'critical',
      title: 'Keine HTTPS-Verschlüsselung',
      detail: 'Datenzübertragung im Klartext = direkter DSGVO Art. 32 Verstoß.',
      paragraph_ref: 'DSGVO Art. 32 Abs. 1 lit. a',
    });
  }

  if (isHttps && !h('strict-transport-security')) {
    issues.push({
      id: 'no_hsts',
      severity: 'medium',
      title: 'HSTS-Header fehlt',
      detail:
        'Strict-Transport-Security verhindert Downgrade-Angriffe auf HTTP. ' +
        'Empfohlen: max-age=31536000; includeSubDomains.',
    });
  }

  if (!effectiveCspValue(h('content-security-policy'), html)) {
    issues.push({
      id: 'no_csp',
      severity: 'low',
      title: 'Content-Security-Policy fehlt',
      detail: 'CSP-Header verhindert XSS und unautorisierte Tracker. Wichtig wenn Du externe Skripte einbettest.',
    });
  }

  // `frame-ancestors` wird per <meta> vom Browser NICHT durchgesetzt — der
  // Clickjacking-Check bleibt deshalb header-basiert und darf den
  // Meta-Wert nicht akzeptieren (siehe `tracker-detection.ts`).
  const headerCsp = h('content-security-policy') ?? '';
  if (!h('x-frame-options') && !/frame-ancestors/i.test(headerCsp)) {
    issues.push({
      id: 'no_xframe',
      severity: 'low',
      title: 'Clickjacking-Schutz fehlt',
      detail: 'X-Frame-Options oder CSP frame-ancestors fehlt — fremde Seiten können Deine Site iframen.',
    });
  }

  // Nur eingebundene Ressourcen zählen. Ein <a href="http://…"> auf eine
  // fremde Seite ist kein Mixed Content, sondern ein normaler Link.
  const embeds = ['script', 'img', 'iframe', 'link'].flatMap((t) => tagsOf(html, t));
  const loadsInsecurely = embeds.some((tag) => {
    const ref = attrOf(tag, 'src') ?? attrOf(tag, 'href');
    return ref !== null && ref.toLowerCase().startsWith('http://');
  });
  if (isHttps && loadsInsecurely) {
    issues.push({
      id: 'mixed_content',
      severity: 'medium',
      title: 'Mixed Content (HTTP-Ressourcen auf HTTPS-Site)',
      detail: 'Browser-Warnung, möglicher MITM-Vektor.',
    });
  }

  // ── Pflicht-Links ──
  const privacyHref = findLegalLink(html, 'privacy');
  const imprintHref = findLegalLink(html, 'imprint');

  if (!privacyHref) {
    issues.push({
      id: 'no_privacy_link',
      severity: 'critical',
      title: 'Kein Datenschutz-Link gefunden',
      detail: 'Datenschutzerklärung ist Pflicht (Art. 13 DSGVO). Im Footer / Hauptnavigation muss ein Link vorhanden sein.',
      paragraph_ref: 'DSGVO Art. 13',
    });
  }

  // § 5 TMG ist deutsches Recht. Für einen erkennbar nicht-deutschen
  // Anbieter wäre ein `critical` mit TMG-Bezug schlicht falsch — der
  // Befund bleibt dann informativ. Siehe `jurisdiction.ts`.
  if (!imprintHref) {
    const german = isLikelyGermanJurisdiction(url, html);
    issues.push(german
      ? {
        id: 'no_imprint_link',
        severity: 'critical',
        title: 'Kein Impressum-Link gefunden',
        detail: 'Impressum ist nach § 5 TMG / § 18 MStV Pflicht für gewerbliche Websites in Deutschland.',
        paragraph_ref: '§ 5 TMG / § 18 MStV',
      }
      : {
        id: 'no_imprint_link_non_de',
        severity: 'info',
        title: 'Kein Impressum-Link (DE-spezifisch)',
        detail:
          'Die Site weist keine deutschen Anbieter-Signale auf (TLD, lang-Attribut, Rechtsform). ' +
          '§ 5 TMG / § 18 MStV gilt nur für Anbieter in Deutschland — dieser Befund ist daher informativ.',
        paragraph_ref: '§ 5 TMG / § 18 MStV',
      });
  }

  // ── Tracker und Einwilligung ──
  const trackers = detectTrackers(html);
  const bannerSeen = hasConsentBanner(html);

  if (trackers.names.length > 0 && !bannerSeen) {
    issues.push({
      id: 'tracker_no_consent',
      severity: 'critical',
      title: `Tracker ohne sichtbares Consent-Banner: ${trackers.names.join(', ')}`,
      detail:
        'EuGH (C-673/17) + BGH „Cookie II" (2020): Nicht-essenzielle Tracker setzen aktives Opt-In ' +
        'voraus (DSGVO Art. 6, § 25 TTDSG). Technische Beobachtung — rechtliche Würdigung durch ' +
        'DSB/Fachjurist erforderlich.',
      paragraph_ref: 'DSGVO Art. 6 Abs. 1, § 25 TTDSG',
    });
  }

  if (trackers.socialNames.length > 0 && !bannerSeen) {
    issues.push({
      id: 'social_pixel_no_consent',
      severity: 'critical',
      title: `Social-Media-Pixel ohne Consent: ${trackers.socialNames.join(', ')}`,
      detail:
        'TikTok/Pinterest-Pixel impliziert Datentransfer in Drittländer (CN/US). ' +
        'Standardvertragsklauseln (SCC) bzw. Angemessenheitsbeschluss erforderlich (DSGVO Art. 44 ff.). ' +
        'Garantien sind im Scan nicht beobachtbar — DSB/Fachjurist sollte den Transfer prüfen.',
      paragraph_ref: 'DSGVO Art. 44',
    });
  }

  // Auch mit Einwilligung bleibt der US-Transfer begründungsbedürftig.
  if (trackers.keys.includes('google_analytics') && !/anonymize_?ip|ip_?anonymization/i.test(html)) {
    issues.push({
      id: 'ga_no_ip_anon',
      severity: 'high',
      title: 'Google Analytics ohne IP-Anonymisierung',
      detail:
        'Auch mit Consent: Datenübertragung in die USA (Schrems-II) erfordert IP-Anonymisierung ' +
        'als Mindest-Zusatz-Maßnahme.',
      paragraph_ref: 'EuGH C-311/18 (Schrems II)',
    });
  }

  // Cookies, die der Server schon beim ersten GET setzt — vor jeder
  // Einwilligung. Rein technische Cookies (Session, CSRF) sind zulässig
  // und werden deshalb nicht mitgezählt.
  const nonEssential = nonEssentialCookieNames(headers);
  if (nonEssential.length > 0) {
    issues.push({
      id: 'cookies_pre_consent',
      severity: 'high',
      title: `${nonEssential.length} Cookies bei erstem Aufruf gesetzt (vor Consent)`,
      detail:
        'Bei initialem GET sollten nur technisch notwendige Cookies (Session, CSRF) gesetzt werden. ' +
        'Tracking-Cookies erst nach explizitem Consent.',
      paragraph_ref: '§ 25 TTDSG',
    });
  }

  // ── Formulare, Redirects, Vorschau ──
  if (hasPersonalDataForm(html) && !mentionsPrivacyNearForm(html)) {
    issues.push({
      id: 'form_no_consent',
      severity: 'medium',
      title: 'Email-Formular ohne sichtbaren DSGVO-Hinweis',
      detail:
        'Bei jedem Formular mit personenbezogenen Daten muss ein Hinweis auf Verarbeitung + ' +
        'Verlinkung zur Datenschutzerklärung sichtbar sein.',
      paragraph_ref: 'DSGVO Art. 13',
    });
  }

  const metas = tagsOf(html, 'meta');
  if (metas.some((tag) => (attrOf(tag, 'http-equiv') ?? '').toLowerCase() === 'refresh')) {
    issues.push({
      id: 'meta_refresh',
      severity: 'low',
      title: 'Meta-Refresh-Redirect verwendet',
      detail:
        'WCAG 2.1: Auto-Redirects via meta-refresh sind problematisch für Screenreader-User. ' +
        'Server-Redirect (301) bevorzugen.',
      paragraph_ref: 'BITV 2.0 / WCAG 2.2.1',
    });
  }

  if (!metas.some((tag) => (attrOf(tag, 'property') ?? '').toLowerCase().startsWith('og:'))) {
    issues.push({
      id: 'no_og_tags',
      severity: 'info',
      title: 'Keine Open-Graph-Tags',
      detail:
        'Wenn Dein Link auf LinkedIn/WhatsApp gepostet wird, sieht er aus wie ein Lottoschein-URL — ' +
        'ohne Vorschau-Bild oder Beschreibung.',
    });
  }

  return issues;
}

/** Cookie-Namen aus `Set-Cookie`, die nicht offensichtlich technisch nötig sind. */
export function nonEssentialCookieNames(headers: Headers | null): string[] {
  if (!headers) return [];
  // `getSetCookie()` existiert in Deno und modernen Runtimes; der Fallback
  // hält die Funktion unter Vitest mit einfachen Headers-Mocks lauffähig.
  const raw: string[] = typeof (headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (headers as { getSetCookie: () => string[] }).getSetCookie()
    : (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);

  const essential = /^(sess|session|sid|phpsessid|jsessionid|csrf|xsrf|_csrf|token|auth|cf_|__cf|__host-|__secure-|locale|lang|currency|cart)/i;
  const names: string[] = [];
  for (const line of raw) {
    const name = line.split('=')[0]?.trim();
    if (!name || essential.test(name)) continue;
    names.push(name);
  }
  return names;
}

/** Formular, das personenbezogene Daten aufnimmt (E-Mail-Feld als Indikator). */
export function hasPersonalDataForm(html: string): boolean {
  if (!/<form\b/i.test(html)) return false;
  return tagsOf(html, 'input').some((tag) => {
    const type = (attrOf(tag, 'type') ?? '').toLowerCase();
    const name = (attrOf(tag, 'name') ?? '').toLowerCase();
    return type === 'email' || name.includes('email') || name.includes('e-mail');
  });
}

/** Datenschutz-Hinweis auf derselben Seite wie das Formular? */
export function mentionsPrivacyNearForm(html: string): boolean {
  return /datenschutz|privacy\s{0,3}policy|einwilligung/i.test(html);
}

// ── Unterseiten: Impressum und Datenschutzerklärung ─────────────────────
//
// Der Startseiten-Scan sieht nur, **ob** verlinkt wurde. Ob das verlinkte
// Dokument seine Pflichtangaben trägt, entscheidet sich erst im Dokument
// selbst — deshalb diese zweite Ebene. Sie liefert die häufigsten Befunde
// überhaupt (`sub_imprint_no_legal_form`: 62 von 159 Audits).

/**
 * Rufnummer im Text — als Durchlauf, nicht als Ausdruck.
 *
 * Der frühere Ausdruck `\(?\d{2,5}\)?[\s\-/]?\d{3,}` liess der Maschine
 * die Wahl, wie sie eine Ziffernfolge auf die beiden Quantoren verteilt;
 * auf einer langen Ziffernkette einer fremden Seite wächst der Aufwand
 * quadratisch. Ein Zähldurchlauf ist linear und sagt dasselbe: mindestens
 * sechs Ziffern, unterbrochen nur von üblichen Trennzeichen.
 */
export function hasPhoneNumber(text: string): boolean {
  const MIN_DIGITS = 6;
  let digits = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch >= '0' && ch <= '9') {
      if (++digits >= MIN_DIGITS) return true;
    } else if (ch !== ' ' && ch !== '-' && ch !== '/' && ch !== '(' && ch !== ')' && ch !== '+' && ch !== '.') {
      // Alles andere beendet die Rufnummer — Fliesstext soll nicht
      // versehentlich als Telefonnummer durchgehen.
      digits = 0;
    }
  }
  return false;
}

export function deepCheckImprint(html: string): Issue[] {
  const issues: Issue[] = [];
  const text = visibleText(html);

  const legalForm = /\b(GmbH|UG\s*\(haftungsbeschränkt\)|AG|KG|OHG|GbR|e\.\s?K\.|e\.\s?V\.|SE|Ltd\.?|Einzelunternehmen|Inhaber)\b/i;
  if (!legalForm.test(text)) {
    issues.push({
      id: 'sub_imprint_no_legal_form',
      severity: 'critical',
      title: 'Impressum nennt keine Rechtsform',
      detail:
        'Pflicht nach § 5 Abs. 1 Nr. 1 TMG: vollständige Angabe der Firma inkl. Rechtsform ' +
        '(GmbH, UG, e.K. etc.) bzw. Inhaber-Name bei Einzelunternehmen.',
      paragraph_ref: '§ 5 Abs. 1 Nr. 1 TMG',
    });
  }

  // Ladungsfähige Anschrift = Strasse mit Hausnummer *und* PLZ mit Ort.
  // Kein fuehrendes `[a-zäöüß.-]{2,30}` vor der Alternation: Beide koennten
  // dieselben Zeichen matchen, die Maschine probierte jede Aufteilung durch.
  // Das Strassenwort selbst plus Hausnummer traegt die Aussage genauso.
  const hasStreet = /(?:stra(?:ß|ss)e|str\.|weg|platz|allee|gasse|ring|damm)\s{0,3}\d{1,4}\b/i.test(text);
  const hasPostal = /\b\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß\-]{2,40}/.test(text);
  if (!hasStreet || !hasPostal) {
    issues.push({
      id: 'sub_imprint_no_address',
      severity: 'critical',
      title: 'Impressum hat keine ladungsfähige Anschrift',
      detail: 'Pflicht nach § 5 Abs. 1 Nr. 1 TMG. Postfach reicht nicht.',
      paragraph_ref: '§ 5 Abs. 1 Nr. 1 TMG',
    });
  }

  const hasEmail = /[\w.+-]@[\w-]{1,63}\.[a-z]{2,10}/i.test(text) || /mailto:/i.test(html);
  const hasPhone = hasPhoneNumber(text) && /tel(?:efon)?|phone|fon\b|tel:/i.test(html);
  if (!hasEmail || !hasPhone) {
    issues.push({
      id: 'sub_imprint_no_contact',
      severity: 'high',
      title: 'Impressum ohne unmittelbaren Kontaktweg',
      detail: 'Pflicht nach § 5 Abs. 1 Nr. 2 TMG: Email + Telefon müssen genannt sein.',
      paragraph_ref: '§ 5 Abs. 1 Nr. 2 TMG',
    });
  }

  return issues;
}

export function deepCheckPrivacy(html: string): Issue[] {
  const issues: Issue[] = [];
  const text = visibleText(html);

  // Drittland wird erwähnt — dann muss auch die Rechtsgrundlage dastehen.
  const mentionsThirdCountry = /\b(USA|United States|Drittland|Drittländer|third\s{0,3}country)\b/i.test(text);
  const namesLegalBasis = /standardvertragsklausel|standard\s{0,3}contractual|SCC\b|Data\s{0,3}Privacy\s{0,3}Framework|\bDPF\b|Angemessenheitsbeschluss|Art\.?\s{0,3}4[5-9]/i.test(text);
  if (mentionsThirdCountry && !namesLegalBasis) {
    issues.push({
      id: 'sub_privacy_third_country_no_legal_basis',
      severity: 'high',
      title: 'Drittlandtransfer erwähnt, aber keine Rechtsgrundlage',
      detail: 'Bei US/Drittland-Hinweis muss SCCs oder DPF (Data Privacy Framework) als Rechtsgrundlage genannt sein.',
      paragraph_ref: 'DSGVO Art. 44–46',
    });
  }

  if (!/beschwerde|aufsichtsbehörde|supervisory\s{0,3}authority|Art\.?\s{0,3}77/i.test(text)) {
    issues.push({
      id: 'sub_privacy_no_complaint_right',
      severity: 'medium',
      title: 'Kein Hinweis auf Beschwerderecht bei Aufsichtsbehörde',
      detail:
        'Pflicht-Hinweis nach Art. 13 Abs. 2 lit. d: Betroffene haben das Recht, sich bei einer ' +
        'Aufsichtsbehörde zu beschweren.',
      paragraph_ref: 'DSGVO Art. 13 Abs. 2 lit. d',
    });
  }

  if (!/datenschutzbeauftragt|data\s{0,3}protection\s{0,3}officer|\bDSB\b|\bDPO\b/i.test(text)) {
    issues.push({
      id: 'sub_privacy_no_dpo_contact',
      severity: 'medium',
      title: 'Kein DSB-Kontakt in Datenschutzerklärung',
      detail:
        'Bei DSB-Pflicht (>20 Personen mit personenbez. Daten regelmäßig befasst, oder Kerntätigkeit ' +
        '„umfangreiche Verarbeitung") muss Name + Email des DSB genannt sein.',
      paragraph_ref: 'DSGVO Art. 37 + 38, § 38 BDSG',
    });
  }

  // Art. 13 Abs. 1 lit. e verlangt Empfänger — namentlich, nicht als Gattung.
  if (!namesProcessors(text)) {
    issues.push({
      id: 'sub_privacy_no_avv_list',
      severity: 'high',
      title: 'Datenschutzerklärung nennt keine Auftragsverarbeiter',
      detail:
        'Art. 13 Abs. 1 lit. e: jeder Empfänger personenbezogener Daten muss namentlich genannt ' +
        'werden. „Wir nutzen Cookies" reicht nicht.',
      paragraph_ref: 'DSGVO Art. 13 Abs. 1 lit. e',
    });
  }

  return issues;
}

/** Nennt die Erklärung konkrete Empfänger oder einen AVV? */
export function namesProcessors(text: string): boolean {
  if (/auftragsverarbeit|auftragsdatenverarbeit|\bAVV\b|\bDPA\b|sub-?processor/i.test(text)) return true;
  const vendors = /\b(Google|Meta|Facebook|Microsoft|Amazon|AWS|Stripe|PayPal|Mailchimp|HubSpot|Cloudflare|Hetzner|IONOS|Salesforce|Shopify|Matomo|Hotjar|Intercom|Sendinblue|Brevo)\b/i;
  return vendors.test(text);
}

/**
 * Grob sichtbarer Text ohne Skripte, Styles und Tags.
 *
 * Skript- und Style-Inhalt wird ueber `stripElement` entfernt, nicht ueber
 * einen Ausdruck: `</script >` ist ein gueltiges End-Tag, und ein Ausdruck,
 * der es verfehlt, laesst den Skript-Inhalt als „Seiteninhalt" durchgehen —
 * mit falsch-negativen Befunden als Folge. Begruendung und Beleg im Kopf von
 * `stripElement`.
 */
export function visibleText(html: string): string {
  return stripElement(stripElement(html, 'script'), 'style')
    .replace(/<[^>]{0,2000}>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Fakten für die Rule Engine ──────────────────────────────────────────

export interface ExtractFactsInput {
  url: string;
  html: string;
  headers: Headers | null;
  privacyHtml: string | null;
  imprintFound: boolean;
  privacyFound: boolean;
}

/**
 * Baut das Fakten-Objekt, gegen das `_shared/rules/evaluator.ts` auswertet.
 *
 * Die Pfade sind **Vertrag**: Sie stehen wörtlich in `gdpr.json` und
 * `ai-act.json` (`tracker.google_analytics.detected`, `consent.banner.detected`,
 * …). Wer hier umbenennt, schaltet die betroffene Regel stumm, ohne dass
 * etwas bricht — `test/edge/gdpr-audit-checks.test.ts` nagelt sie deshalb fest.
 *
 * Bewusst **nicht** gesetzt sind die Fakten der High-Risk- und
 * Prohibited-Regeln (`ai_use_case.purpose`, `.detects_emotion`, `.actor`, …).
 * Ob ein Unternehmen KI im Recruiting einsetzt, ist aus dem HTML seiner
 * Startseite nicht beobachtbar. Ein geratener Wert würde einen
 * `critical`-Befund mit AI-Act-Bezug erzeugen, für den es keine Grundlage
 * gibt. Undefined lässt die Regel schweigen — das ist hier die richtige
 * Antwort, nicht eine Lücke.
 */
export function extractFacts(input: ExtractFactsInput): Record<string, unknown> {
  const { url, html, headers, privacyHtml, imprintFound, privacyFound } = input;
  const trackers = detectTrackers(html);
  const bannerSeen = hasConsentBanner(html);
  const ai = detectAIDisclosure(html);
  const privacyText = privacyHtml ? visibleText(privacyHtml) : '';

  const externalTracker = trackers.keys.some((k) => k !== 'matomo');

  // Ein Chatbot gilt als erkannt, wenn ein Widget im Markup steht oder ein
  // KI-Dienst angesprochen wird — beides ist am HTML beobachtbar.
  const isChatbot = /intercom|drift\.com|tawk\.to|crisp\.chat|zendesk|livechat|hubspot-messages|chatbot|chat-widget/i.test(html) ||
    ai.detected_ai_tools.length > 0;

  return {
    url,
    tracker: {
      google_analytics: { detected: trackers.keys.includes('google_analytics') },
      meta_pixel: { detected: trackers.keys.includes('meta_pixel') },
      any_external: externalTracker,
    },
    consent: {
      banner: {
        detected: bannerSeen,
        reject_button_equal_prominence: bannerSeen ? hasEqualRejectOption(html) : false,
      },
      // Ohne Banner kann vor dem Laden nichts eingewilligt worden sein.
      detected_before_load: bannerSeen,
    },
    page: {
      privacy_policy: {
        url_found: privacyFound,
        mentions_avv: privacyText ? namesProcessors(privacyText) : false,
      },
      impressum: { url_found: imprintFound },
    },
    // `asset.google_fonts.dynamic` bleibt **bewusst ungesetzt**.
    //
    // Die Regel `GOOGLE_FONTS_EMBEDDED` feuerte in **keinem** der 159
    // historischen Audits — obwohl extern eingebundene Google Fonts zu den
    // häufigsten Einbindungen im Netz gehören. Der produktive Scanner hat
    // diesen Fakt also nie gesetzt. Ihn hier zu setzen, würde in nahezu
    // jedem künftigen Bericht einen zusätzlichen `medium`-Befund erzeugen,
    // den es vor dem Ausfall nicht gab: eine erfundene Verschärfung,
    // getarnt als Wiederherstellung.
    //
    // Das ist eine **benannte Lücke des rekonstruierten Vertrags**, kein
    // Versehen. Wer sie schliessen will, entscheidet damit eine
    // Produktfrage (strengere Bewertung als bisher) — und das gehört
    // entschieden, nicht nebenbei mitgeliefert.
    ai_use_case: {
      is_chatbot: isChatbot,
      disclosure_visible: ai.has_disclosure,
    },
    security: {
      https: url.toLowerCase().startsWith('https://'),
      hsts: Boolean(headers?.get('strict-transport-security')),
    },
  };
}

/**
 * Regel-Befunde, die einen Heuristik-Befund **verdoppeln**.
 *
 * Beobachtung an den 159 historischen Audits: Von den 14 Regeln erschienen
 * nur drei je als `rule:`-Befund — `COOKIE_BANNER_DARK_PATTERN` (47×),
 * `AI_ACT_LIMITED_RISK_CHATBOT` (14×) und `MISSING_AVV_REFERENCE` (1×).
 * Genau jene drei, für die es **keine** Heuristik-Entsprechung gibt.
 *
 * `rule:MISSING_PRIVACY_POLICY` erschien in keinem einzigen Audit — auch
 * nicht in den 18, die `no_privacy_link` trugen. Dasselbe Muster bei
 * Impressum und bei den beiden Tracker-Regeln. Der produktive Scanner hat
 * denselben Sachverhalt also nie zweimal berichtet.
 *
 * Das ist keine Kosmetik, sondern Scoring: Ein doppelt gemeldeter fehlender
 * Datenschutz-Link kostet 2 × 25 Punkte statt 25. Ohne diese Unterdrückung
 * fiele jeder Score mit fehlendem Pflicht-Link um 25 bis 50 Punkte tiefer
 * aus als vor dem Ausfall — bei identischer Website.
 */
export const RULE_HEURISTIC_OVERLAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  MISSING_PRIVACY_POLICY: ['no_privacy_link'],
  MISSING_IMPRESSUM: ['no_imprint_link', 'no_imprint_link_non_de'],
  GA4_WITHOUT_CONSENT: ['tracker_no_consent'],
  META_PIXEL_WITHOUT_CONSENT: ['tracker_no_consent', 'social_pixel_no_consent'],
});

/** Hat eine Heuristik denselben Sachverhalt bereits berichtet? */
export function isDuplicateOfHeuristic(ruleId: string, issues: Issue[]): boolean {
  const overlaps = RULE_HEURISTIC_OVERLAP[ruleId];
  if (!overlaps) return false;
  return overlaps.some((id) => issues.some((i) => i.id === id));
}

// ── Scoring ─────────────────────────────────────────────────────────────

/**
 * Abzug je Befund-Severity.
 *
 * **Exakt aus Produktion zurückgerechnet**, nicht gewählt: Die Formel
 * `score = max(0, 100 − 25·critical − 12·high − 6·medium − 2·low)` passt
 * ohne einen einzigen Rest auf alle 27 unterschiedlichen
 * Severity-Kombinationen der 159 historischen Audits — von (0,0,0,1,0)→98
 * über (1,1,2,0,0)→51 bis (3,1,1,2,·)→3.
 *
 * `info` wiegt **null**. Das ist Absicht und ebenfalls gemessen: Ein
 * Hinweis, der nichts zu tun gibt (`no_og_tags`, `scan_coverage_limited`),
 * darf den Score nicht drücken.
 *
 * Diese Gewichte erscheinen in Kundenberichten, die über Zeit verglichen
 * werden. Eine Änderung ist versionsrelevant — dann `AUDIT_ENGINE_VERSION`
 * in `gdpr-audit/index.ts` hochzählen.
 */
export const SEVERITY_WEIGHTS: Readonly<Record<IssueSeverity, number>> = Object.freeze({
  critical: 25,
  high: 12,
  medium: 6,
  low: 2,
  info: 0,
});

export type ReportSeverity = IssueSeverity | 'pass';

/** Gesamt-Severity = höchste vorkommende Stufe; `pass` bei null Befunden. */
const SEVERITY_RANK: readonly IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function scoreReport(issues: Issue[]): { score: number; severity: ReportSeverity } {
  let deduction = 0;
  for (const i of issues) deduction += SEVERITY_WEIGHTS[i.severity] ?? 0;
  const score = Math.max(0, 100 - deduction);

  let severity: ReportSeverity = 'pass';
  for (const level of SEVERITY_RANK) {
    if (issues.some((i) => i.severity === level)) { severity = level; break; }
  }
  return { score, severity };
}


// ── Namen aus der Fassung auf `main` ────────────────────────────────────
//
// Die Rekonstruktion auf `main` (2305e3f) hat dieselbe Aufgabe unabhaengig
// geloest und dabei eigene Namen vergeben. Ihre Dateistruktur wird hier
// weitergefuehrt; damit `index.ts` und die dort entstandenen Tests
// weitgehend unveraendert bleiben, tragen die Funktionen beide Namen.
//
// Was NICHT uebernommen wurde, ist das Befund-Vokabular: Es wich in 12
// Codes vom gemessenen Produktionsvertrag ab und liess 19 weg, darunter
// alle sieben Unterseiten-Pruefungen. Beleg: `test/fixtures/
// gdpr-audit-production-contract.json`, Begruendung:
// `docs/product/free-scan-recovery.md`.

/** Alias zu {@link findLegalLink}(html, 'imprint'). */
export function findImpressumLink(html: string): string | null {
  return findLegalLink(html, 'imprint');
}

/** Alias zu {@link findLegalLink}(html, 'privacy'). */
export function findPrivacyLink(html: string): string | null {
  return findLegalLink(html, 'privacy');
}

/** Alias zu {@link hasConsentBanner}. */
export function detectConsentBanner(html: string): boolean {
  return hasConsentBanner(html);
}

/** Alias zu {@link hasEqualRejectOption}. */
export function hasEqualRejectButton(html: string): boolean {
  return hasEqualRejectOption(html);
}
