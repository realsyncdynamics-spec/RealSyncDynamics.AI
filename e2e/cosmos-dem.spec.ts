import { test, expect } from '@playwright/test';

test('COSMOS DEM mode fails closed when source tile is not shipped', async ({ page }) => {
  await page.goto('/cosmos');
  await expect(page.getByRole('heading', { name: 'COSMOS Explorer' })).toBeVisible();
  await page.getByRole('button', { name: 'Erde geografisch erkunden' }).click();
  await expect(page.getByRole('heading', { name: 'Erde erkunden' })).toBeVisible();
  await page.getByRole('button', { name: 'Lokales 3D-Höhenmodell (DEM)' }).click();
  await expect(page.getByRole('heading', { name: 'Matterhorn – DEM-Ansicht' })).toBeVisible();
  await expect(page.getByText('Echte Geländedaten fehlen noch.', { exact: false })).toBeVisible();
  await expect(page.getByText('Keine Höhen werden erfunden.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Weltkugel' }).click();
  await expect(page.getByRole('heading', { name: 'Erde erkunden' })).toBeVisible();
});
