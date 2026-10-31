import { test, expect } from '@playwright/test';

test.describe('COSMOS geographical Earth navigation', () => {
  test('switches between solar and geo modes and flies to a known coordinate', async ({ page }) => {
    await page.goto('/cosmos');
    await expect(page.getByRole('heading', { name: 'COSMOS Explorer' })).toBeVisible();

    await page.getByRole('button', { name: 'Erde geografisch erkunden' }).click();
    await expect(page.getByRole('heading', { name: 'Erde erkunden' })).toBeVisible();
    await expect(page.getByText('Noch keine Gelände- oder 3D-Gebäudedaten.', { exact: false }))
      .toBeVisible();

    await page.getByRole('button', { name: 'Tokio' }).click();
    await expect(page.getByText('35.6762° N · 139.6503° E')).toBeVisible();

    await page.getByLabel('Breitengrad').fill('-33.9');
    await page.getByLabel('Längengrad').fill('-70.6');
    await page.getByRole('button', { name: 'Anfliegen' }).click();
    await expect(page.getByText('33.9000° S · 70.6000° W')).toBeVisible();
    await expect(page.getByText('Eigene Koordinaten', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sonnensystem' }).click();
    await expect(page.getByRole('heading', { name: 'COSMOS Explorer' })).toBeVisible();
  });
});
