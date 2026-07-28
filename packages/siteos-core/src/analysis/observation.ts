// Live-Analyse einer ausgelieferten Site.
//
// Läuft nach jedem Deployment automatisch gegen die echte URL. Eingabe ist
// eine `SiteObservation` (HTTP-Abruf am Edge), nicht der Blueprint — hier
// zählt nur, was tatsächlich ausgeliefert wird.
//
// HTML wird bewusst mit Regex statt DOM ausgewertet: die Analyse läuft in
// Deno-Edge-Functions ohne DOM, und ein vollständiger Parser wäre für die
// hier geprüften Signale (Meta-Tags, alt-Attribute, lang) unverhältnismäßig.
// Die Heuristiken sind deshalb konservativ ausgelegt — im Zweifel kein
// Befund, damit keine Falschmeldung in einen Kundenbericht wandert.

import type { RuntimeFinding, SiteObservation } from '../types.ts';

export interface ObservationExpectations {
  /** Site enthält generierte Inhalte ⇒ Transparenzhinweis muss ausgeliefert werden. */
  expectsAiDisclosure?: boolean;
  /** Erwartete Standardsprache für das `lang`-Attribut. */
  expectedLang?: string;
}

/** Schwellwerte an einer Stelle, damit sie im Bericht zitierbar sind. */
export const THRESHOLDS = Object.freeze({
  ttfbGoodMs: 400,
  ttfbPoorMs: 800,
  transferWarnBytes: 1_500_000,
  transferPoorBytes: 3_000_000,
});

export function analyzeObservation(
  obs: SiteObservation,
  expectations: ObservationExpectations = {},
): RuntimeFinding[] {
  return [
    ...checkTransport(obs),
    ...checkSecurityHeaders(obs),
    ...checkConsent(obs),
    ...checkPrivacyLink(obs),
    ...checkAiDisclosure(obs, expectations),
    ...checkAccessibility(obs, expectations),
    ...checkSeo(obs),
    ...checkPerformance(obs),
  ];
}

// ── Transport ───────────────────────────────────────────────────────────

function checkTransport(obs: SiteObservation): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  if (obs.url.startsWith('http://')) {
    findings.push({
      code: 'security.insecure-transport',
      dimension: 'security',
      severity: 'critical',
      title: 'Seite wird unverschlüsselt ausgeliefert',
      reference: 'Art. 32 DSGVO',
      remediation: 'HTTPS erzwingen und HTTP dauerhaft auf HTTPS umleiten.',
      locator: obs.url,
    });
  }

  if (obs.statusCode >= 400) {
    findings.push({
      code: 'security.error-status',
      dimension: 'security',
      severity: obs.statusCode >= 500 ? 'critical' : 'high',
      title: `Seite antwortet mit HTTP ${obs.statusCode}`,
      reference: 'Verfügbarkeit',
      remediation: 'Ursache im Deployment prüfen; die Site ist für Besucher nicht nutzbar.',
      locator: obs.url,
    });
  }

  return findings;
}

// ── Sicherheits-Header ──────────────────────────────────────────────────

const REQUIRED_HEADERS: { header: string; code: string; severity: RuntimeFinding['severity']; title: string; remediation: string }[] = [
  {
    header: 'strict-transport-security',
    code: 'security.missing-hsts',
    severity: 'high',
    title: 'HSTS-Header fehlt',
    remediation: 'Strict-Transport-Security mit max-age von mindestens 15552000 setzen.',
  },
  {
    header: 'content-security-policy',
    code: 'security.missing-csp',
    severity: 'medium',
    title: 'Content-Security-Policy fehlt',
    remediation: 'CSP setzen; sie begrenzt zugleich ungewollte Drittanbieter-Aufrufe.',
  },
  {
    header: 'x-content-type-options',
    code: 'security.missing-content-type-options',
    severity: 'low',
    title: 'X-Content-Type-Options fehlt',
    remediation: 'X-Content-Type-Options: nosniff setzen.',
  },
  {
    header: 'referrer-policy',
    code: 'security.missing-referrer-policy',
    severity: 'low',
    title: 'Referrer-Policy fehlt',
    remediation: 'Referrer-Policy: strict-origin-when-cross-origin setzen.',
  },
];

function checkSecurityHeaders(obs: SiteObservation): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  for (const required of REQUIRED_HEADERS) {
    const value = obs.headers[required.header];
    if (value !== undefined && value.trim() !== '') continue;
    findings.push({
      code: required.code,
      dimension: 'security',
      severity: required.severity,
      title: required.title,
      reference: 'Art. 32 DSGVO / OWASP Secure Headers',
      remediation: required.remediation,
      locator: obs.url,
    });
  }

  return findings;
}

// ── TDDDG: Einwilligung ─────────────────────────────────────────────────

function checkConsent(obs: SiteObservation): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  if (obs.cookiesBeforeConsent.length > 0) {
    const names = obs.cookiesBeforeConsent.map((c) => c.name).join(', ');
    findings.push({
      code: 'tdddg.cookie-before-consent',
      dimension: 'tdddg',
      severity: 'critical',
      title: `${obs.cookiesBeforeConsent.length} Cookie(s) vor Einwilligung gesetzt`,
      reference: '§ 25 Abs. 1 TDDDG',
      remediation: `Setzen bis zur Einwilligung unterbinden (betroffen: ${names}).`,
      locator: obs.url,
    });
  }

  if (obs.thirdPartyHosts.length > 0) {
    findings.push({
      code: 'tdddg.third-party-before-consent',
      dimension: 'tdddg',
      severity: 'high',
      title: `${obs.thirdPartyHosts.length} Drittanbieter vor Einwilligung kontaktiert`,
      reference: '§ 25 Abs. 1 TDDDG / Art. 44 DSGVO',
      remediation: `Einbindung hinter die Einwilligung legen (Hosts: ${obs.thirdPartyHosts.join(', ')}).`,
      locator: obs.url,
    });
  }

  return findings;
}

// ── DSGVO: Pflichtverlinkung ────────────────────────────────────────────

function checkPrivacyLink(obs: SiteObservation): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];
  const html = obs.html;

  if (!/href\s*=\s*["'][^"']*(datenschutz|privacy)/i.test(html)) {
    findings.push({
      code: 'gdpr.privacy-link-not-delivered',
      dimension: 'gdpr',
      severity: 'high',
      title: 'Kein Link zur Datenschutzerklärung im ausgelieferten HTML',
      reference: 'Art. 13 DSGVO',
      remediation: 'Datenschutz-Link von jeder Seite aus erreichbar machen (Footer).',
      locator: obs.url,
    });
  }

  if (!/href\s*=\s*["'][^"']*(impressum|imprint|legal-notice)/i.test(html)) {
    findings.push({
      code: 'gdpr.imprint-link-not-delivered',
      dimension: 'gdpr',
      severity: 'high',
      title: 'Kein Link zum Impressum im ausgelieferten HTML',
      reference: '§ 5 DDG',
      remediation: 'Impressum-Link leicht erkennbar und unmittelbar erreichbar einbinden.',
      locator: obs.url,
    });
  }

  return findings;
}

// ── EU AI Act ───────────────────────────────────────────────────────────

function checkAiDisclosure(obs: SiteObservation, exp: ObservationExpectations): RuntimeFinding[] {
  if (exp.expectsAiDisclosure !== true) return [];

  const delivered =
    /data-ai-disclosure/i.test(obs.html) ||
    /(generativer?\s+KI|KI-gestützt|mit\s+Unterstützung\s+von\s+KI|AI-generated)/i.test(obs.html);
  if (delivered) return [];

  return [{
    code: 'eu-ai-act.disclosure-not-delivered',
    dimension: 'eu-ai-act',
    severity: 'high',
    title: 'Transparenzhinweis zur KI-Nutzung wird nicht ausgeliefert',
    reference: 'Art. 50 EU AI Act',
    remediation: 'Hinweisblock rendern und mit data-ai-disclosure auszeichnen.',
    locator: obs.url,
  }];
}

// ── Barrierefreiheit ────────────────────────────────────────────────────

function checkAccessibility(obs: SiteObservation, exp: ObservationExpectations): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];
  const html = obs.html;

  const langMatch = /<html[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html);
  if (!langMatch) {
    findings.push({
      code: 'accessibility.missing-lang',
      dimension: 'accessibility',
      severity: 'medium',
      title: 'html-Element ohne lang-Attribut',
      reference: 'WCAG 2.2 — 3.1.1',
      remediation: 'lang-Attribut auf die Standardsprache der Seite setzen.',
      locator: obs.url,
    });
  } else if (exp.expectedLang && !langMatch[1].toLowerCase().startsWith(exp.expectedLang.toLowerCase())) {
    findings.push({
      code: 'accessibility.lang-mismatch',
      dimension: 'accessibility',
      severity: 'low',
      title: `Sprachauszeichnung (${langMatch[1]}) weicht von der Standardsprache ab`,
      reference: 'WCAG 2.2 — 3.1.1',
      remediation: `lang-Attribut auf ${exp.expectedLang} korrigieren.`,
      locator: obs.url,
    });
  }

  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  const withoutAlt = images.filter((tag) => !/\balt\s*=/i.test(tag)).length;
  if (withoutAlt > 0) {
    findings.push({
      code: 'accessibility.image-without-alt',
      dimension: 'accessibility',
      severity: 'medium',
      title: `${withoutAlt} von ${images.length} Bildern ohne alt-Attribut`,
      reference: 'WCAG 2.2 — 1.1.1',
      remediation: 'Alternativtexte ergänzen; rein dekorative Bilder mit alt="" auszeichnen.',
      locator: obs.url,
    });
  }

  // Ein Formular ohne jedes <label> ist mit Screenreader praktisch
  // unbedienbar. aria-label zählt als gleichwertige Auszeichnung.
  const hasForm = /<form\b/i.test(html);
  if (hasForm && !/<label\b/i.test(html) && !/aria-label\s*=/i.test(html)) {
    findings.push({
      code: 'accessibility.form-without-labels',
      dimension: 'accessibility',
      severity: 'high',
      title: 'Formular ohne Beschriftungen',
      reference: 'WCAG 2.2 — 3.3.2',
      remediation: 'Jedem Eingabefeld ein <label> oder aria-label zuordnen.',
      locator: obs.url,
    });
  }

  return findings;
}

// ── SEO ─────────────────────────────────────────────────────────────────

function checkSeo(obs: SiteObservation): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];
  const html = obs.html;

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  if (!title) {
    findings.push({
      code: 'seo.title-not-delivered',
      dimension: 'seo',
      severity: 'high',
      title: 'Kein <title> im ausgelieferten HTML',
      reference: 'SEO-Basis',
      remediation: 'Seitentitel serverseitig rendern (nicht erst per JavaScript setzen).',
      locator: obs.url,
    });
  }

  if (!/<meta[^>]+name\s*=\s*["']description["'][^>]*>/i.test(html)) {
    findings.push({
      code: 'seo.meta-description-not-delivered',
      dimension: 'seo',
      severity: 'medium',
      title: 'Keine Meta-Beschreibung im ausgelieferten HTML',
      reference: 'SEO-Basis',
      remediation: 'meta[name=description] mit 120–160 Zeichen ausliefern.',
      locator: obs.url,
    });
  }

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count === 0) {
    findings.push({
      code: 'seo.missing-h1',
      dimension: 'seo',
      severity: 'medium',
      title: 'Keine H1-Überschrift',
      reference: 'SEO-Basis / WCAG 2.2 — 1.3.1',
      remediation: 'Genau eine H1 je Seite vergeben.',
      locator: obs.url,
    });
  } else if (h1Count > 1) {
    findings.push({
      code: 'seo.multiple-h1',
      dimension: 'seo',
      severity: 'low',
      title: `${h1Count} H1-Überschriften auf einer Seite`,
      reference: 'SEO-Basis',
      remediation: 'Auf eine H1 reduzieren, weitere Überschriften als H2 auszeichnen.',
      locator: obs.url,
    });
  }

  if (!/<link[^>]+rel\s*=\s*["']canonical["']/i.test(html)) {
    findings.push({
      code: 'seo.missing-canonical',
      dimension: 'seo',
      severity: 'low',
      title: 'Kein Canonical-Link',
      reference: 'SEO-Basis',
      remediation: 'link[rel=canonical] auf die bevorzugte URL setzen.',
      locator: obs.url,
    });
  }

  return findings;
}

// ── Performance ─────────────────────────────────────────────────────────

function checkPerformance(obs: SiteObservation): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  if (obs.ttfbMs > THRESHOLDS.ttfbPoorMs) {
    findings.push({
      code: 'performance.slow-ttfb',
      dimension: 'performance',
      severity: 'high',
      title: `Langsame Serverantwort (${Math.round(obs.ttfbMs)} ms)`,
      reference: `Zielwert < ${THRESHOLDS.ttfbGoodMs} ms`,
      remediation: 'Edge-Caching aktivieren und dynamische Anteile reduzieren.',
      locator: obs.url,
    });
  } else if (obs.ttfbMs > THRESHOLDS.ttfbGoodMs) {
    findings.push({
      code: 'performance.elevated-ttfb',
      dimension: 'performance',
      severity: 'low',
      title: `Erhöhte Serverantwortzeit (${Math.round(obs.ttfbMs)} ms)`,
      reference: `Zielwert < ${THRESHOLDS.ttfbGoodMs} ms`,
      remediation: 'Cache-Header prüfen; die Seite ist noch im Toleranzbereich.',
      locator: obs.url,
    });
  }

  if (obs.transferBytes > THRESHOLDS.transferPoorBytes) {
    findings.push({
      code: 'performance.excessive-transfer',
      dimension: 'performance',
      severity: 'medium',
      title: `Übertragungsvolumen ${formatMb(obs.transferBytes)} MB`,
      reference: `Zielwert < ${formatMb(THRESHOLDS.transferWarnBytes)} MB`,
      remediation: 'Bilder in modernen Formaten ausliefern und ungenutztes JavaScript entfernen.',
      locator: obs.url,
    });
  } else if (obs.transferBytes > THRESHOLDS.transferWarnBytes) {
    findings.push({
      code: 'performance.elevated-transfer',
      dimension: 'performance',
      severity: 'low',
      title: `Übertragungsvolumen ${formatMb(obs.transferBytes)} MB`,
      reference: `Zielwert < ${formatMb(THRESHOLDS.transferWarnBytes)} MB`,
      remediation: 'Bildgrößen und Bundle-Umfang prüfen.',
      locator: obs.url,
    });
  }

  return findings;
}

function formatMb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}
