import { test, expect } from '@playwright/test';

const CORE_SECTIONS = [
  'AI Governance Runtime',
  'Sichern Sie die Zukunft Ihres KI-gesteuerten Unternehmens.',
  'Die Plattform',
  'Evidence & Trust',
  'Governance Runtime',
  'Governance statt Checkliste.',
];

test.describe('Main Landing — visual and functional QA', () => {
  test('all critical visible content renders', async ({ page }) => {
    await page.goto('/');

    for (const text of CORE_SECTIONS) {
      await expect(page.getByText(text, { exact: true })).toBeVisible();
    }

    await expect(page.getByRole('link', { name: /Free Audit starten/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Preise/i }).first()).toBeVisible();
    await expect(page.getByLabel(/Website-URL für Governance-Scan/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Audit starten/i })).toBeVisible();

    // Prevent clipped/cropped desktop layouts.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('domain audit form routes to the unified scan flow', async ({ page }) => {
    await page.goto('/');

    const input = page.getByLabel(/Website-URL für Governance-Scan/i);
    await input.fill('example.com');
    await page.getByRole('button', { name: /Audit starten/i }).click();

    await expect(page).toHaveURL(/\/unified-entry\/scan\?domain=example\.com$/);
  });

  test('primary CTAs expose working destinations', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /Free Audit starten/i }).first().click();
    await expect(page).toHaveURL(/\/unified-entry\/scan$/);

    await page.goto('/');
    await page.getByRole('link', { name: /Preise/i }).first().click();
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test('mobile landing remains visible without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByText('AI Governance Runtime', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sichern Sie die Zukunft Ihres KI-gesteuerten Unternehmens/i })).toBeVisible();
    await expect(page.getByLabel(/Website-URL für Governance-Scan/i)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
