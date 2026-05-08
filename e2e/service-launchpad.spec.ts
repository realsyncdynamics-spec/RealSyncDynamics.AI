import { test, expect, type Page } from '@playwright/test';

/**
 * ServiceLaunchpad navigation specs.
 *
 * The Launchpad sits directly under the Hero on `/` and is the primary
 * action surface (4 cards: Audit / Website-Service / Pricing / Methodik).
 * Wenn eine Card-Route bricht oder die CTA-Labels verändern sich, müssen
 * diese Specs failen, bevor ein PR gemerged wird.
 *
 * Scoping: alle Card-Lookups laufen über die <section aria-label="Service-
 * Launchpad">, damit ähnlich-getextete Hero-CTAs (z. B. „Jetzt kostenlos
 * scannen") die Spec nicht versehentlich grün erscheinen lassen.
 */

const launchpad = (page: Page) =>
  page.getByRole('region', { name: 'Service-Launchpad' });

test.describe('ServiceLaunchpad', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders 4 service cards with the expected eyebrow labels', async ({ page }) => {
    const region = launchpad(page);
    await expect(region.getByText('Quick-Scan')).toBeVisible();
    await expect(region.getByText('Website-Service')).toBeVisible();
    await expect(region.getByText('Pricing')).toBeVisible();
    await expect(region.getByText('Methodology')).toBeVisible();
  });

  test('Audit card navigates to /audit', async ({ page }) => {
    await launchpad(page).getByRole('link', { name: /Kostenlos scannen/i }).click();
    await expect(page).toHaveURL(/\/audit($|\?)/);
  });

  test('Website-Service card navigates to /dsgvo-website', async ({ page }) => {
    await launchpad(page).getByRole('link', { name: /3-Paket-Angebot/i }).click();
    await expect(page).toHaveURL(/\/dsgvo-website/);
  });

  test('Pricing card navigates to /pricing', async ({ page }) => {
    await launchpad(page).getByRole('link', { name: /Pricing ansehen/i }).click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test('Methodology card navigates to /legal/methodology', async ({ page }) => {
    await launchpad(page).getByRole('link', { name: /Methodik einsehen/i }).click();
    await expect(page).toHaveURL(/\/legal\/methodology/);
  });
});
