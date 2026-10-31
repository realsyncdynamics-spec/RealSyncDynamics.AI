import { test, expect } from '@playwright/test';

test('COSMOS planet scale and original texture opt-in are controllable', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => {
    if (request.url().includes('cdn.jsdelivr.net')) external.push(request.url());
  });

  await page.goto('/cosmos');
  await expect(page.getByRole('heading', { name: 'COSMOS Explorer' })).toBeVisible();
  await expect(page.getByText('Visuelle Planetengröße: 100 %')).toBeVisible();

  const scale = page.getByRole('slider', { name: 'Planetengröße skalieren' });
  await scale.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Visuelle Planetengröße: 105 %')).toBeVisible();

  const originals = page.getByRole('checkbox', {
    name: /Original-Planetentexturen laden/,
  });
  await expect(originals).not.toBeChecked();
  expect(external, 'no third-party planet texture network before opt-in').toHaveLength(0);
  await originals.check();
  await expect(originals).toBeChecked();
  await expect(page.getByText('Erst nach deiner Auswahl:', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(page.getByText('Visuelle Planetengröße: 100 %')).toBeVisible();
  // The texture opt-in deliberately persists across simulation resets.
  await expect(originals).toBeChecked();
});
