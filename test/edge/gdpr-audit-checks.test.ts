import { describe, it, expect } from 'vitest';
import {
  runChecks,
  extractFacts,
  scoreReport,
  detectTrackers,
  detectConsentBanner,
  hasEqualRejectButton,
  usesDynamicGoogleFonts,
  findImpressumLink,
  SEVERITY_WEIGHTS,
  type Issue,
} from '../../supabase/functions/gdpr-audit/checks';

/**
 * Tests für die Prüflogik des kostenlosen DSGVO-Audits.
 *
 * Warum diese Datei existiert: `gdpr-audit` rief seit dem 2026-08-19 sechs
 * Funktionen auf, die es nie gab, und antwortete deshalb auf jeden Request
 * mit HTTP 500 — unbemerkt, weil keine Prüfung die Function je aufrief.
 * `scan_runs` blieb dauerhaft leer. Diese Tests sorgen dafür, dass ein
 * solcher Ausfall am Schreibtisch auffällt und nicht erst in Produktion.
 */

const HEADERS = (h: Record<string, string>) => ({
  get: (n: string) => h[n.toLowerCase()] ?? null,
});

// Eine Seite, die alles richtig macht — Referenz für die Gegenprobe.
const SAUBERE_SEITE = `<!doctype html><html lang="de"><head>
  <meta http-equiv="content-security-policy" content="default-src 'self'">
</head><body>
  <a href="/impressum">Impressum</a>
  <a href="/datenschutz">Datenschutzerklärung</a>
</body></html>`;

const SAUBERE_HEADER = HEADERS({
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
  'x-frame-options': 'SAMEORIGIN',
});

describe('Tracker-Erkennung', () => {
  it('findet Google Analytics am Skript-Pfad', () => {
    const html = '<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>';
    expect(detectTrackers(html).map((t) => t.id)).toContain('google_analytics_ga4');
  });

  it('zählt eine CSP-Allowlist NICHT als Einbindung', () => {
    // Regression-Schutz: Ohne `stripPolicyDeclarations` bekäme ausgerechnet
    // eine gut abgesicherte Seite die meisten Tracker gemeldet.
    const html = `<meta http-equiv="Content-Security-Policy"
      content="script-src https://www.googletagmanager.com/gtag/js">`;
    expect(detectTrackers(html)).toHaveLength(0);
  });

  it('zählt einen preconnect-Hint NICHT als Einbindung', () => {
    const html = '<link rel="preconnect" href="https://www.googletagmanager.com/gtag/js">';
    expect(detectTrackers(html)).toHaveLength(0);
  });
});

describe('Consent-Banner', () => {
  it('erkennt einen benannten Anbieter', () => {
    expect(detectConsentBanner('<script src="/usercentrics.js"></script>')).toBe(true);
  });

  it('meldet auf einer Seite ohne Banner nichts', () => {
    expect(detectConsentBanner(SAUBERE_SEITE)).toBe(false);
  });

  it('erkennt ein fehlendes Ablehnen als ungleiche Prominenz', () => {
    expect(hasEqualRejectButton('<button>Alle akzeptieren</button>')).toBe(false);
  });

  it('akzeptiert ein gleichwertiges Ablehnen', () => {
    expect(hasEqualRejectButton('<button>Alle akzeptieren</button><button>Alle ablehnen</button>')).toBe(true);
  });

  it('wertet eine Seite ohne Zustimmen-Element nicht als Dark Pattern', () => {
    expect(hasEqualRejectButton(SAUBERE_SEITE)).toBe(true);
  });
});

describe('Pflichtangaben', () => {
  it('findet das Impressum über den Linktext', () => {
    expect(findImpressumLink('<a href="/rechtliches">Impressum</a>')).toBe('/rechtliches');
  });

  it('findet das Impressum über den Pfad', () => {
    expect(findImpressumLink('<a href="/impressum">Rechtliches</a>')).toBe('/impressum');
  });

  it('erkennt dynamisch geladene Google Fonts', () => {
    expect(usesDynamicGoogleFonts('<link href="https://fonts.googleapis.com/css?family=Roboto">')).toBe(true);
    expect(usesDynamicGoogleFonts(SAUBERE_SEITE)).toBe(false);
  });
});

describe('runChecks', () => {
  it('meldet auf einer sauberen Seite keinen Mangel', () => {
    const issues = runChecks('https://beispiel.de', SAUBERE_SEITE, SAUBERE_HEADER, 200, null);
    const maengel = issues.filter((i) => i.severity !== 'info');
    expect(maengel, `unerwartet: ${maengel.map((i) => i.id).join(', ')}`).toEqual([]);
  });

  it('meldet fehlendes HTTPS als kritisch', () => {
    const issues = runChecks('http://beispiel.de', SAUBERE_SEITE, SAUBERE_HEADER, 200, null);
    expect(issues.find((i) => i.id === 'no_https')?.severity).toBe('critical');
  });

  it('meldet Tracking ohne Einwilligung als kritisch', () => {
    const html = SAUBERE_SEITE + '<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>';
    const issues = runChecks('https://beispiel.de', html, SAUBERE_HEADER, 200, null);
    expect(issues.find((i) => i.id === 'tracking_without_consent')?.severity).toBe('critical');
  });

  it('stuft ein fehlendes Impressum außerhalb DE nur als Hinweis ein', () => {
    // § 5 DDG greift nicht weltweit — ein englischsprachiges .com darf dafür
    // keinen schweren Befund bekommen.
    const html = '<html lang="en"><body><a href="/privacy">Privacy</a></body></html>';
    const de = runChecks('https://beispiel.de', html.replace('en', 'de'), SAUBERE_HEADER, 200, null);
    const com = runChecks('https://example.com', html, SAUBERE_HEADER, 200, null);
    expect(de.find((i) => i.id === 'no_impressum_link')?.severity).toBe('high');
    expect(com.find((i) => i.id === 'no_impressum_link')?.severity).toBe('info');
  });

  it('bricht bei nicht erreichbarer Seite mit einem einzigen Hinweis ab', () => {
    const issues = runChecks('https://beispiel.de', '', null, null, 'timeout');
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('site_unreachable');
    // Nicht erreichbar ist kein Datenschutzmangel — sonst bekäme jede kurz
    // gestörte Seite einen vernichtenden Score.
    expect(issues[0].severity).toBe('info');
  });

  it('akzeptiert eine CSP aus dem Meta-Tag, aber nicht für Clickjacking', () => {
    // frame-ancestors wird per <meta> vom Browser nicht durchgesetzt.
    const html = `<html lang="de"><head><meta http-equiv="content-security-policy"
      content="default-src 'self'; frame-ancestors 'none'"></head><body>
      <a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></body></html>`;
    const issues = runChecks('https://beispiel.de', html, HEADERS({ 'strict-transport-security': 'max-age=1' }), 200, null);
    expect(issues.some((i) => i.id === 'no_csp')).toBe(false);
    expect(issues.some((i) => i.id === 'no_clickjacking_protection')).toBe(true);
  });
});

describe('extractFacts', () => {
  it('liefert genau die Schlüssel, die gdpr.json abfragt', () => {
    // Diese Namen sind der Vertrag mit der Rule Engine. Wird hier einer
    // umbenannt, läuft die zugehörige Regel still ins Leere.
    const facts = extractFacts('https://beispiel.de', SAUBERE_SEITE, SAUBERE_HEADER, []);
    for (const key of [
      'tracker.any_external',
      'tracker.google_analytics.detected',
      'tracker.meta_pixel.detected',
      'consent.banner.detected',
      'consent.banner.reject_button_equal_prominence',
      'consent.detected_before_load',
      'page.impressum.url_found',
      'page.privacy_policy.url_found',
      'page.privacy_policy.mentions_avv',
      'asset.google_fonts.dynamic',
    ]) {
      expect(facts, `Fakt fehlt: ${key}`).toHaveProperty(key);
    }
  });

  it('übernimmt den AVV-Befund aus der Unterseiten-Prüfung', () => {
    const treffer: Issue[] = [{ id: 'privacy_mentions_avv', severity: 'info', title: '', detail: '' }];
    expect(extractFacts('https://b.de', SAUBERE_SEITE, null, [])['page.privacy_policy.mentions_avv']).toBe(false);
    expect(extractFacts('https://b.de', SAUBERE_SEITE, null, treffer)['page.privacy_policy.mentions_avv']).toBe(true);
  });
});

describe('scoreReport', () => {
  const issue = (severity: Issue['severity']): Issue => ({ id: severity, severity, title: '', detail: '' });

  it('gibt einer mangelfreien Seite 100 Punkte', () => {
    expect(scoreReport([])).toEqual({ score: 100, severity: 'none' });
  });

  it('lässt Hinweise den Score nicht drücken', () => {
    expect(scoreReport([issue('info'), issue('info')]).score).toBe(100);
  });

  it('drückt einen einzelnen kritischen Befund unter jede grüne Schwelle', () => {
    // Bewusste Kalibrierung: Tracking ohne Einwilligung ist für sich genommen
    // abmahnfähig und darf nicht als „fast grün" erscheinen.
    expect(scoreReport([issue('critical')]).score).toBe(70);
  });

  it('begrenzt den Score bei null', () => {
    expect(scoreReport(Array.from({ length: 20 }, () => issue('critical'))).score).toBe(0);
  });

  it('folgt bei der Einstufung dem schwersten Einzelbefund', () => {
    expect(scoreReport([issue('low'), issue('critical')]).severity).toBe('critical');
    expect(scoreReport([issue('low'), issue('medium')]).severity).toBe('medium');
  });

  it('hält die Gewichte in absteigender Schwere', () => {
    expect(SEVERITY_WEIGHTS.critical).toBeGreaterThan(SEVERITY_WEIGHTS.high);
    expect(SEVERITY_WEIGHTS.high).toBeGreaterThan(SEVERITY_WEIGHTS.medium);
    expect(SEVERITY_WEIGHTS.medium).toBeGreaterThan(SEVERITY_WEIGHTS.low);
    expect(SEVERITY_WEIGHTS.info).toBe(0);
  });
});
