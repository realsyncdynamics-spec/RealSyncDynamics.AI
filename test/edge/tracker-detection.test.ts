import { describe, expect, test } from 'vitest';
import {
  stripPolicyDeclarations,
  effectiveCspValue,
} from '../../supabase/functions/_shared/tracker-detection';

/**
 * Schützt den gdpr-audit-Scanner vor False-Positive Tracker-Befunden, die
 * allein aus einer Content-Security-Policy-Allowlist stammen.
 *
 * PR-Kontext: Der Audit lieferte für realsyncdynamicsai.de (GitHub-Pages-
 * SPA mit CSP-Meta-Tag) IMMER 6 Befunde / Score 28/100 — unabhängig von der
 * gescannten Seite. Ursache: Die Tracker-Regexes matchten die in der CSP
 * erlaubten Domains (googletagmanager.com, connect.facebook.net,
 * analytics.tiktok.com, snap.licdn.com), obwohl gar kein Tracker geladen
 * wurde. Eine erlaubte Domain ist das Gegenteil eines Verstoßes.
 */

// Reale CSP-Allowlist der eigenen Seite (gekürzt) — listet Tracker-Domains
// als ERLAUBT, lädt sie aber nicht.
const CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; ` +
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net ` +
  `https://www.googletagmanager.com https://www.google-analytics.com ` +
  `https://analytics.tiktok.com https://snap.licdn.com">`;

// GA/Meta/TikTok/LinkedIn-Erkennung wie in gdpr-audit/runChecks.
function detectTrackers(html: string) {
  const h = stripPolicyDeclarations(html);
  return {
    ga: /google-analytics\.com|googletagmanager\.com|gtag\(/i.test(h),
    meta: /connect\.facebook\.net|fbq\(/i.test(h),
    li: /snap\.licdn\.com|lintrk\(/i.test(h),
    tiktok: /analytics\.tiktok\.com|ttq\(/i.test(h),
  };
}

describe('stripPolicyDeclarations — CSP-Allowlist erzeugt keine Tracker-Befunde', () => {
  test('CSP-Meta-Allowlist allein → kein Tracker erkannt', () => {
    const html = `<!DOCTYPE html><html lang="de"><head>${CSP_META}</head><body>Hallo</body></html>`;
    const t = detectTrackers(html);
    expect(t.ga).toBe(false);
    expect(t.meta).toBe(false);
    expect(t.li).toBe(false);
    expect(t.tiktok).toBe(false);
  });

  test('CSP-Report-Only-Meta wird ebenfalls entfernt', () => {
    const html = `<head><meta http-equiv="Content-Security-Policy-Report-Only" content="script-src https://www.googletagmanager.com"></head>`;
    expect(detectTrackers(html).ga).toBe(false);
  });

  test('Resource-Hints (preconnect/dns-prefetch) zählen nicht als Tracker', () => {
    const html =
      `<head><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>` +
      `<link rel="dns-prefetch" href="https://connect.facebook.net"></head>`;
    const t = detectTrackers(html);
    expect(t.ga).toBe(false);
    expect(t.meta).toBe(false);
  });

  test('Attribut-Reihenfolge content vor http-equiv wird gematcht', () => {
    const html = `<head><meta content="script-src https://analytics.tiktok.com" http-equiv="content-security-policy"></head>`;
    expect(detectTrackers(html).tiktok).toBe(false);
  });
});

describe('stripPolicyDeclarations — echte Tracker bleiben erkennbar', () => {
  test('echtes <script src> für GA wird trotz CSP weiterhin erkannt', () => {
    const html = `<head>${CSP_META}</head><body>` +
      `<script src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script></body>`;
    expect(detectTrackers(html).ga).toBe(true);
  });

  test('Runtime-Aufruf fbq( bleibt erkennbar', () => {
    const html = `<head>${CSP_META}</head><body><script>fbq('init','123');</script></body>`;
    expect(detectTrackers(html).meta).toBe(true);
  });

  test('TikTok ttq( Runtime-Aufruf bleibt erkennbar', () => {
    const html = `<body><script>ttq.load('XYZ');ttq('track','PageView');</script></body>`;
    expect(detectTrackers(html).tiktok).toBe(true);
  });

  test('nicht-Tracker-HTML bleibt unverändert (kein versehentliches Strippen)', () => {
    const html = `<html><body><p>Datenschutz & Impressum</p></body></html>`;
    expect(stripPolicyDeclarations(html)).toBe(html);
  });
});

describe('effectiveCspValue — Meta-CSP zählt für no_csp-Check', () => {
  test('Header-CSP hat Vorrang', () => {
    expect(effectiveCspValue("default-src 'self'", '<html></html>')).toBe("default-src 'self'");
  });

  test('Meta-CSP wird erkannt wenn Header fehlt (GitHub-Pages-Fall)', () => {
    const html = `<head>${CSP_META}</head>`;
    expect(effectiveCspValue(null, html)).toContain('script-src');
  });

  test('Single-Quote-content-Attribut wird unterstützt', () => {
    const html = `<head><meta http-equiv='Content-Security-Policy' content='default-src self'></head>`;
    expect(effectiveCspValue(undefined, html)).toBe('default-src self');
  });

  test('weder Header noch Meta → leerer String (no_csp feuert)', () => {
    expect(effectiveCspValue(null, '<html><head></head></html>')).toBe('');
  });
});

describe('Laufzeit auf feindseligem HTML (ReDoS, behoben 2026-08-30)', () => {
  // Beide Funktionen liefen ueber `<meta[^>]*http-equiv=…>`. Weil `[^>]` auch
  // `h`, `t`, `p` matcht, probierte die Maschine an jeder Fundstelle jede
  // Aufteilung durch. Auf dieser Eingabe — 360 kB Fast-Treffer ohne ein
  // einziges `>` — waren es 8 815 ms bzw. 9 233 ms.
  //
  // Erreichbar ueber einen oeffentlichen, nicht authentifizierten Endpunkt
  // (/audit, cookie-scan), ausloesbar mit einer einzigen praeparierten Seite.
  const hostile = '<meta '.repeat(60_000);
  const BUDGET_MS = 1000;

  test('stripPolicyDeclarations bleibt unter einer Sekunde', () => {
    const t0 = Date.now();
    stripPolicyDeclarations(hostile);
    const ms = Date.now() - t0;
    expect(ms, `brauchte ${ms} ms`).toBeLessThan(BUDGET_MS);
  });

  test('effectiveCspValue bleibt unter einer Sekunde', () => {
    const t0 = Date.now();
    effectiveCspValue(null, hostile);
    const ms = Date.now() - t0;
    expect(ms, `brauchte ${ms} ms`).toBeLessThan(BUDGET_MS);
  });

  test('bleibt auch bei sehr vielen vollstaendigen Meta-Tags schnell', () => {
    const many = '<meta name="x" content="y">'.repeat(40_000);
    const t0 = Date.now();
    stripPolicyDeclarations(many);
    effectiveCspValue(null, many);
    const ms = Date.now() - t0;
    expect(ms, `brauchte ${ms} ms`).toBeLessThan(BUDGET_MS);
  });

  test('entfernt den CSP-Meta-Tag weiterhin, egal in welcher Attribut-Reihenfolge', () => {
    const a = '<meta http-equiv="Content-Security-Policy" content="script-src https://www.googletagmanager.com">';
    const b = '<meta content="script-src https://www.googletagmanager.com" http-equiv="Content-Security-Policy">';
    expect(stripPolicyDeclarations(`<html>${a}</html>`)).not.toContain('googletagmanager');
    expect(stripPolicyDeclarations(`<html>${b}</html>`)).not.toContain('googletagmanager');
  });

  test('liest den CSP-Wert auch, wenn content vor http-equiv steht', () => {
    // Der alte Ausdruck verlangte content NACH http-equiv und uebersah das.
    const tag = `<meta content="default-src 'self'" http-equiv="Content-Security-Policy">`;
    expect(effectiveCspValue(null, tag)).toBe("default-src 'self'");
  });

  test('akzeptiert report-only nicht als durchgesetzten CSP', () => {
    const tag = `<meta http-equiv="Content-Security-Policy-Report-Only" content="default-src 'self'">`;
    expect(effectiveCspValue(null, tag)).toBe('');
  });
});
