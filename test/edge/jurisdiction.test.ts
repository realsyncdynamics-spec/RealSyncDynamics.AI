import { describe, expect, test } from 'vitest';
import { isLikelyGermanJurisdiction } from '../../supabase/functions/_shared/jurisdiction';

/**
 * Schützt den gdpr-audit-Scanner vor False-Positive § 5 TMG-Befunden
 * gegen ausländische Sites (gmail.com, github.com, ...). PR-Kontext:
 * Screenshots zeigten Score 61/100 „KRITISCH — handeln" für gmail.com
 * aufgrund eines „Kein Impressum-Link"-Befunds — § 5 TMG ist deutsches
 * Recht und greift dort nicht.
 */

describe('isLikelyGermanJurisdiction', () => {
  describe('non-DE Sites (sollen false zurückgeben)', () => {
    test('gmail.com (en HTML, .com, US-Anbieter)', () => {
      const html = `<!DOCTYPE html><html lang="en"><head><title>Gmail</title></head><body>Sign in to your Google Account</body></html>`;
      expect(isLikelyGermanJurisdiction('https://gmail.com/', html)).toBe(false);
    });

    test('github.com', () => {
      const html = `<!DOCTYPE html><html lang="en"><body>GitHub · Build software better, together. Inc. 88 Colin P Kelly Jr Street San Francisco, CA</body></html>`;
      expect(isLikelyGermanJurisdiction('https://github.com', html)).toBe(false);
    });

    test('stackoverflow.com (engl. Content)', () => {
      const html = `<html lang="en-US"><body>Stack Overflow — Where developers learn, share, &amp; build careers.</body></html>`;
      expect(isLikelyGermanJurisdiction('https://stackoverflow.com', html)).toBe(false);
    });

    test('engl. Site die zufällig "AG" im Body hat (aber nicht als Rechtsform)', () => {
      const html = `<html lang="en"><body>Welcome to ag-news, AG.com is not us. CEO speaking.</body></html>`;
      expect(isLikelyGermanJurisdiction('https://ag-news.com', html)).toBe(false);
    });
  });

  describe('DE/AT/CH Sites (sollen true zurückgeben)', () => {
    test('TLD .de allein reicht', () => {
      const html = `<html><body>Empty</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.de/', html)).toBe(true);
    });

    test('TLD .at allein reicht', () => {
      const html = `<html><body>Empty</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.at', html)).toBe(true);
    });

    test('TLD .ch allein reicht', () => {
      const html = `<html><body>Empty</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.ch', html)).toBe(true);
    });

    test('lang="de" im html-Tag', () => {
      const html = `<!DOCTYPE html><html lang="de"><body>Inhalt auf Deutsch</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });

    test('lang="de-DE" wird erkannt', () => {
      const html = `<html lang="de-DE"><body>Test</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.io', html)).toBe(true);
    });

    test('Rechtsform GmbH im Body', () => {
      const html = `<html><body>Über uns: Beispiel GmbH liefert Lösungen für die DACH-Region.</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });

    test('UG (haftungsbeschränkt) Signal', () => {
      const html = `<html><body>Test UG (haftungsbeschränkt) — Geschäftsführer Max Muster</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });

    test('Handelsregister-HRB Eintrag', () => {
      const html = `<html><body>Registergericht Jena HRB 12345</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });

    test('+49-Telefonnummer', () => {
      const html = `<html><body>Tel: +49 30 12345678</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });

    test('USt-IdNr.-Hinweis', () => {
      const html = `<html><body>USt-IdNr.: DE123456789</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });

    test('Sitz der Gesellschaft', () => {
      const html = `<html><body>Sitz der Gesellschaft: Berlin</body></html>`;
      expect(isLikelyGermanJurisdiction('https://example.com', html)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('ungültige URL → false', () => {
      expect(isLikelyGermanJurisdiction('not a url', '<html></html>')).toBe(false);
    });

    test('leerer HTML + non-DE-TLD → false', () => {
      expect(isLikelyGermanJurisdiction('https://example.com', '')).toBe(false);
    });

    test('leerer HTML + DE-TLD → true', () => {
      expect(isLikelyGermanJurisdiction('https://example.de', '')).toBe(true);
    });
  });
});
