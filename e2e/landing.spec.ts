import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Landing (Hero + Zielgruppen + FAQ sections).
 *
 * Asserts the Firmen-Pivot copy: H1 verspricht „DSGVO-sicher in 30 Sekunden",
 * Primary-CTA „Compliance-Check starten" → /audit, neue Trust-Leiste mit
 * Datenresidenz/AVV/Audit-Log/Made-in-Germany, Beispiel-Report-Modal
 * öffnet GA4-Finding, neue Sektionen Zielgruppen + FAQ rendern.
 */
test('Landing renders Firmen-Pivot Hero + Zielgruppen + FAQ + example-report modal', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Ihre Website & KI-Prozesse DSGVO-sicher/i }),
  ).toBeVisible();

  const primary = page.getByRole('link', { name: /Jetzt kostenlosen Compliance-Check starten/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  await expect(
    page.getByText(/EU-Datenresidenz · AVV inklusive · Vollständiges Audit-Log · Made in Germany/i),
  ).toBeVisible();

  // Sektion „Zielgruppen"
  await expect(
    page.getByRole('heading', { name: /Ideal für Unternehmen mit eigener Website und KI-Einsatz/i }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /Online-Unternehmen & SaaS/i })).toBeVisible();

  // Sektion „FAQ"
  await expect(page.getByRole('heading', { name: /^Häufige Fragen$/i })).toBeVisible();
  await expect(page.getByText(/Müssen wir dafür unsere ganze IT umbauen/i)).toBeVisible();

  await page.getByRole('button', { name: /Beispiel-Report ansehen/i }).click();
  await expect(
    page.getByRole('heading', { name: /GA4 ohne Consent geladen/i }),
  ).toBeVisible();
});
