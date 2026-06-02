import { describe, expect, test } from 'vitest';
import {
  assessScanCoverage,
  visibleTextLength,
} from '../../supabase/functions/_shared/scan-coverage';

/**
 * Schützt den gdpr-audit-Scanner vor trügerischer Entwarnung bei rein
 * client-gerenderten Seiten: Eine SPA-Shell liefert statisch kaum Inhalt,
 * Tracker/Consent/Pflicht-Links werden erst per JS nachgeladen. Statt
 * selbstbewusst einen Score zu präsentieren, soll die Engine 'limited'
 * melden. Prerendered/SSG-Seiten (echter Inhalt) bleiben 'full'.
 */

const BUNDLE = '<script type="module" crossorigin src="/assets/index-abc.js"></script>';

describe('assessScanCoverage — failed', () => {
  test('Fetch-Fehler → failed', () => {
    expect(assessScanCoverage('', null, 'timeout').coverage).toBe('failed');
  });
  test('kein Status → failed', () => {
    expect(assessScanCoverage('<html></html>', null, null).coverage).toBe('failed');
  });
});

describe('assessScanCoverage — limited', () => {
  test('Vite/CRA-Shell ohne Inhalt → limited (client_rendered_shell)', () => {
    const html = `<!DOCTYPE html><html lang="de"><head><title>App</title></head><body><div id="root"></div>${BUNDLE}</body></html>`;
    const a = assessScanCoverage(html, 200, null);
    expect(a.coverage).toBe('limited');
    expect(a.reason).toBe('client_rendered_shell');
    expect(a.notice).toMatch(/client-seitig/i);
  });

  test('Shell mit noscript-„enable JavaScript" → limited', () => {
    const html = `<html><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>`;
    expect(assessScanCoverage(html, 200, null).coverage).toBe('limited');
  });

  test('HTTP-Fehlerseite → limited (http_*)', () => {
    const html = `<html><body><h1>403 Forbidden</h1></body></html>`;
    const a = assessScanCoverage(html, 403, null);
    expect(a.coverage).toBe('limited');
    expect(a.reason).toBe('http_403');
  });
});

describe('assessScanCoverage — full (keine False-Positives)', () => {
  test('prerendered SPA mit echtem Inhalt + Navigation → full', () => {
    // Realistischer Auszug: Root-Mount + Module-Bundle, aber viel sichtbarer
    // Text und >5 Links (wie realsyncdynamicsai.de, ~4900 Zeichen / 36 Links).
    const nav = Array.from({ length: 8 }, (_, i) => `<a href="/seite-${i}">Navigationspunkt ${i}</a>`).join('');
    const prose = 'Governance Operating System für DSGVO, AI Act und Continuous Compliance. '.repeat(12);
    const html = `<!DOCTYPE html><html lang="de"><head><title>RSD</title></head><body><div id="root"><header>${nav}</header><main><h1>Compliance-Plattform</h1><p>${prose}</p></main></div>${BUNDLE}</body></html>`;
    expect(assessScanCoverage(html, 200, null).coverage).toBe('full');
  });

  test('klassische server-gerenderte Seite ohne Root-Mount → full', () => {
    const html = `<html><body><h1>Kanzlei Müller</h1><p>${'Wir beraten Sie umfassend. '.repeat(40)}</p><a href="/datenschutz">Datenschutz</a></body></html>`;
    expect(assessScanCoverage(html, 200, null).coverage).toBe('full');
  });
});

describe('visibleTextLength', () => {
  test('ignoriert script/style/head', () => {
    const html = `<head><title>x</title></head><body><script>var a=${'x'.repeat(999)}</script><p>Hallo Welt</p></body>`;
    expect(visibleTextLength(html)).toBeLessThan(20);
  });
});
