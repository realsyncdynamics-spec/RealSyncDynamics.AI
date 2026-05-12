import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Landing (HeroOnly-Pivot).
 *
 * Aligned with the current HeroOnly.tsx. The pre-pivot long-form
 * Landing.tsx sections (Online-Unternehmen, PricingTeaserSection
 * with "Free Audit · Starter · Growth · Enterprise", FAQ-detail
 * questions) that an earlier revision of this spec asserted against
 * are no longer mounted on `/` — Landing.tsx returns `<HeroOnly />`
 * directly. The assertions below only cover what HeroOnly actually
 * renders.
 */
test('Landing renders HeroOnly Hero + section headings + example-report modal', async ({ page }) => {
  await page.goto('/');

  // H1 (current HeroOnly headline)
  await expect(
    page.getByRole('heading', {
      name: /Continuous Compliance Monitoring für Websites, Tracking-Stacks und KI-Systeme/i,
    }),
  ).toBeVisible();

  // Primary CTA → /audit
  const primary = page
    .getByRole('link', { name: /Jetzt kostenlosen Compliance-Check starten/i })
    .first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Trust-Leiste
  await expect(
    page.getByText(
      /EU-Datenresidenz · AVV inklusive · Continuous Monitoring · Made in Germany/i,
    ),
  ).toBeVisible();

  // Section H2s that HeroOnly renders inline
  await expect(
    page.getByRole('heading', { name: /Für wen RealSyncDynamics\.AI gebaut ist/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /In drei Schritten zu einem klaren Compliance-Bild/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /^Mehr als ein Cookie-Scanner$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Typische Gründe, warum Firmen RealSyncDynamics\.AI einsetzen/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Häufige Fragen$/i })).toBeVisible();

  // Beispiel-Report-Modal: Button öffnet Modal mit "GA4 ohne Consent geladen"
  await page.getByRole('button', { name: /Beispiel-Report ansehen/i }).click();
  await expect(
    page.getByRole('heading', { name: /GA4 ohne Consent geladen/i }),
  ).toBeVisible();
});
