import { test, expect } from '@playwright/test';
import { PRICING_TAX_MODE, PRICING_TAX_NOTE_EXEMPT, PRICING_TAX_NOTE_STANDARD } from '../shared/pricing';

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
 *      versto&szlig;en. Solange VITE_BUSINESS_VAT_ID leer ist, steht in der
 *      Umsatzsteuer-Sektion stattdessen sachlich „noch nicht vergeben“
 *      — nicht als Alarm. Die Preisseite muss den aktuellen Steuermodus
 *      der Preis-SSoT abbilden (§ 19 UStG bei `EXEMPT`).
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

  test('USt-Sektion ist vorhanden ohne alarmierende Fehlermeldung', async ({ page }) => {
    await page.goto('/legal/impressum');
    await expect(page.getByRole('heading', { name: /Umsatzsteuer-Identifikationsnummer/i })).toBeVisible();
    await expect(page.getByText(/USt-IdNr\. fehlt/i)).toHaveCount(0);
    // Kein pauschales Verbot von § 19 UStG im EXEMPT-Modus.
  });

  test('Preisseite zeigt den Steuerhinweis passend zur Preis-SSoT', async ({ page }) => {
    await page.goto('/pricing');
    const note = page.getByTestId('pricing-tax-note');
    await expect(note).toBeVisible();
    if (PRICING_TAX_MODE === 'EXEMPT') {
      await expect(note).toContainText(PRICING_TAX_NOTE_EXEMPT);
      await expect(note).not.toContainText(/zzgl\. gesetzlicher Umsatzsteuer/i);
    } else {
      await expect(note).toContainText(PRICING_TAX_NOTE_STANDARD);
      await expect(note).not.toContainText(/§\s*19\s*UStG/i);
    }
  });
});
