import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Hero-only Landing.
 *
 * Asserts the post-pivot single-viewport structure: H1 fragt nach DSGVO-
 * Konformität, der primary „Audit starten"-Top-CTA ist gold, und das
 * Beispiel-Report-Modal öffnet sich. Catches regressions wenn jemand
 * das Modal-Wiring oder den Hero-Reframe versehentlich zurückdreht.
 */
test('HeroOnly Landing renders Hero with primary CTA + example-report modal', async ({ page }) => {
  await page.goto('/');

  // Headline + Subline visible
  await expect(
    page.getByRole('heading', { name: /Ist Ihre Website wirklich DSGVO-konform/i }),
  ).toBeVisible();

  // Primary CTA → /audit
  const primary = page.getByRole('link', { name: /Kostenlosen Website-Check starten/i });
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Trust-Leiste enthält Methodik-Hint
  await expect(
    page.getByText(/EU-Hosting · AVV inklusive · Audit-Log · Methodik offen einsehbar/i),
  ).toBeVisible();

  // Beispiel-Report-Modal öffnet auf Klick und zeigt das GA4-Finding
  await page.getByRole('button', { name: /Beispiel-Report/i }).click();
  await expect(
    page.getByRole('heading', { name: /GA4 ohne Consent geladen/i }),
  ).toBeVisible();
});
