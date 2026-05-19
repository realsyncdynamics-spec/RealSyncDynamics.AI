import { test, expect } from '@playwright/test';

/**
 * E2E-Smoke für /legal/impressum nach Env-Driven-Härtung.
 *
 * Schützt die Production-Schaltung gegen unvollständige Pflichtangaben:
 * solange VITE_BUSINESS_VAT_ID leer ist, MUSS der Warnung-Banner sichtbar
 * sein — auch im production build. Erst wenn die USt-IdNr. via ENV gesetzt
 * ist (oder Kleinunternehmer-Wahl getroffen wurde), verschwindet der
 * Hinweis und das Impressum gilt als § 5 TMG-vollständig.
 */

test.describe('/legal/impressum', () => {
  test('Pflichtsektionen sind sichtbar', async ({ page }) => {
    await page.goto('/legal/impressum');

    for (const heading of [
      /Anbieter \/ Verantwortlicher i\. S\. d\. § 5 TMG/i,
      /Kontakt/i,
      /Vertretungsberechtigte/i,
      /Umsatzsteuer-Identifikationsnummer/i,
      /Aufsichtsbehörde Datenschutz/i,
      /EU-Streitschlichtung/i,
    ]) {
      await expect(
        page.getByRole('heading', { name: heading }).first(),
      ).toBeVisible();
    }
  });

  test('Banner ist sichtbar solange USt-IdNr. fehlt', async ({ page }) => {
    await page.goto('/legal/impressum');

    // Ohne VITE_BUSINESS_VAT_ID in der Test-Umgebung MUSS der Banner-Text
    // mit dem konkreten Hinweis auf die fehlende USt-IdNr. rendern.
    await expect(
      page.getByText(/USt-IdNr\. fehlt/i).first(),
    ).toBeVisible();
  });
});
