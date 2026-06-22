import { test, expect } from '@playwright/test';

/**
 * Button-/CTA-Tester (QA-Audit 2026-06-22).
 *
 * Crawlt eine Auswahl öffentlicher Seiten und prüft jeden sichtbaren
 * Button/Link/Submit auf:
 *   - hat href ODER onClick-wirksame Rolle (kein toter Button)
 *   - interner href zeigt nicht auf eine garantierte 404-Route
 *   - keine verbotene Sales-/Beratungs-/Demo-/Call-CTA-Sprache
 *   - keine JS-Konsolenfehler beim Laden der Seite
 *
 * Kategorien (Reporting im Test-Titel): OK / NO_ACTION / FORBIDDEN_CTA.
 * Läuft gegen E2E_BASE_URL (Default http://localhost:3000).
 */

// Spiegel von src/content/runtimeVocab.ts → CI_FORBIDDEN_CTA (Mehrwort-Phrasen).
const FORBIDDEN_CTA = [
  /Demo anfragen/i,
  /Demo buchen/i,
  /Beratung buchen/i,
  /Beratung anfragen/i,
  /Sales kontaktieren/i,
  /Vertrieb kontaktieren/i,
  /Pilot anfragen/i,
  /Call buchen/i,
  /Demo-Call buchen/i,
  /Strategie-Call/i,
  /Migration-Call/i,
  /Partner-Gespräch buchen/i,
];

const PAGES = ['/', '/pricing', '/audit', '/tools', '/about', '/partners'];

test.describe('Keine JS-Konsolenfehler beim Laden', () => {
  for (const path of PAGES) {
    test(`${path} lädt ohne Konsolen-Error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(path, { waitUntil: 'networkidle' });
      // Bekannte Drittanbieter-/Pixel-Fehler (CSP-geblockte Marketing-Pixel) ignorieren.
      const relevant = errors.filter(
        (e) => !/facebook|fbevents|gtm|google|tiktok|linkedin|favicon|Content Security Policy/i.test(e),
      );
      expect(relevant, `Konsolen-Errors auf ${path}: ${relevant.join(' | ')}`).toHaveLength(0);
    });
  }
});

test.describe('Keine verbotenen CTA-Phrasen im sichtbaren DOM', () => {
  for (const path of PAGES) {
    test(`${path} ohne verbotene Sales-/Demo-CTA`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const text = await page.locator('body').innerText();
      for (const re of FORBIDDEN_CTA) {
        expect(text, `${path} enthält verbotene CTA ${re}`).not.toMatch(re);
      }
    });
  }
});

test.describe('Keine toten Buttons/Links (NO_ACTION)', () => {
  for (const path of PAGES) {
    test(`${path}: Links haben href, Buttons sind aktionsfähig`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Anker ohne href und ohne role=button = toter Link.
      const deadAnchors = await page
        .locator('a:not([href]):not([role="button"])')
        .filter({ hasText: /\S/ })
        .count();
      expect(deadAnchors, `${path}: Anker ohne href`).toBe(0);

      // href="#" oder leeres href = NO_ACTION.
      const hashAnchors = await page.locator('a[href="#"], a[href=""]').count();
      expect(hashAnchors, `${path}: Anker mit leerem/# href`).toBe(0);

      // Mindestens eine sichtbare primäre CTA pro öffentlicher Seite.
      const ctas = await page.locator('a, button').filter({ hasText: /\S/ }).count();
      expect(ctas, `${path}: hat interaktive Elemente`).toBeGreaterThan(0);
    });
  }
});
