import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Landing (Hero + Zielgruppen + So-funktioniert +
 * Leistungen + Gründe + Preise + FAQ sections).
 *
 * Asserts the Firmen-Pivot copy: H1 verspricht „DSGVO-sicher in 30 Sekunden",
 * Primary-CTA „Compliance-Check starten" → /audit, Trust-Leiste mit
 * Datenresidenz/AVV/Audit-Log/Made-in-Germany, Beispiel-Report-Modal
 * öffnet GA4-Finding, alle 6 Long-Form-Sektionen rendern.
 */
test('Landing renders Firmen-Pivot Hero + 6 sections + example-report modal', async ({ page }) => {
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

  // Sektion „So funktioniert"
  await expect(
    page.getByRole('heading', { name: /In drei Schritten zu einem klaren Compliance-Bild/i }),
  ).toBeVisible();

  // Sektion „Leistungen"
  await expect(page.getByRole('heading', { name: /^Mehr als ein Cookie-Scanner$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^KI-Workflow-Check$/i })).toBeVisible();

  // Sektion „Gründe"
  await expect(
    page.getByRole('heading', { name: /Typische Gründe, warum Firmen RealSyncDynamics.AI einsetzen/i }),
  ).toBeVisible();

  // Sektion „Preise"
  await expect(
    page.getByRole('heading', { name: /Plan für jede Unternehmensgröße/i }),
  ).toBeVisible();
  await expect(page.getByText(/29 € \/ Monat/).first()).toBeVisible();

  // Sektion „FAQ"
  await expect(page.getByRole('heading', { name: /^Häufige Fragen$/i })).toBeVisible();
  await expect(page.getByText(/Müssen wir dafür unsere ganze IT umbauen/i)).toBeVisible();

  await page.getByRole('button', { name: /Beispiel-Report ansehen/i }).click();
  await expect(
    page.getByRole('heading', { name: /GA4 ohne Consent geladen/i }),
  ).toBeVisible();
});
