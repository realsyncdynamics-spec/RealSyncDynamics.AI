import { test, expect } from '@playwright/test';

/**
 * E2E-Smoke fuer /legal/impressum.
 *
 * Vertrag mit der Live-Page (siehe src/features/legal/Impressum.tsx +
 * scripts/production-readiness-check.mjs):
 *
 *   1. Pflichtsektionen § 5 DDG sind sichtbar
 *   2. Die Page hat ein semantisches <h1>Impressum</h1>
 *   3. Im PROD-Build erscheint KEIN Alarm-Banner mit „Pflichtangaben
 *      unvollstaendig" oder „USt-IdNr. fehlt" — das wuerde gleichzeitig
 *      gegen scripts/production-readiness-check.mjs Check `impressum-vat`
 *      versto&szlig;en. Solange VITE_BUSINESS_VAT_ID leer ist, kündigt die
 *      Umsatzsteuer-Sektion die USt-IdNr. sachlich an („wird nach Erteilung
 *      ergänzt") — nicht als Alarm. Seit der Umstellung auf Regelbesteuerung
 *      erscheint dort kein § 19 UStG mehr.
 *
 *   DEV-Hinweis-Banner ist absichtlich nur in `npm run dev` sichtbar, nicht
 *   im Playwright-Lauf (der gegen den PROD-Build laeuft).
 */

test.describe('/legal/impressum', () => {
  test('Pflichtsektionen sind sichtbar', async ({ page }) => {
    await page.goto('/legal/impressum');

    for (const heading of [
      /Anbieter \/ Verantwortlicher i\. S\. d\. § 5 DDG/i,
      /Kontakt/i,
      /Vertretungsberechtigte/i,
      /Umsatzsteuer/i,
      /Aufsichtsbehörde Datenschutz/i,
      /EU-Streitschlichtung/i,
    ]) {
      await expect(
        page.getByRole('heading', { name: heading }).first(),
      ).toBeVisible();
    }
  });

  test('semantisches <h1> Impressum vorhanden', async ({ page }) => {
    await page.goto('/legal/impressum');
    await expect(
      page.getByRole('heading', { level: 1, name: /^Impressum$/i }),
    ).toBeVisible();
  });

  test('PROD-Build zeigt KEINE Alarm-Phrasen ("Pflichtangaben unvollstaendig", "USt-IdNr. fehlt")', async ({ page }) => {
    await page.goto('/legal/impressum');
    const body = await page.content();
    expect(body).not.toContain('Pflichtangaben unvollständig');
    expect(body).not.toContain('USt-IdNr. fehlt');
  });

  test('USt-Sektion zeigt USt-IdNr. oder sachlichen Hinweis, kein § 19 UStG', async ({ page }) => {
    await page.goto('/legal/impressum');
    // Regelbesteuerung: entweder die USt-IdNr. aus VITE_BUSINESS_VAT_ID oder
    // der Hinweis, dass sie nach Erteilung ergänzt wird.
    await expect(
      page.getByText(/Umsatzsteuer-Identifikationsnummer (gemäß § 27 a|wird nach Erteilung ergänzt)/).first(),
    ).toBeVisible();
    await expect(page.getByText(/Kleinunternehmer|§ 19 UStG/)).toHaveCount(0);
  });
});
