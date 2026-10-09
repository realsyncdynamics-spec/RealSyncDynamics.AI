import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL ?? '';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';
const SLUG = 'realsyncdynamics-ai-das-governance-os-fuer-dsgvo-eu-ai-act';

test.describe.configure({ mode: 'serial' });

test('real owner session: governed SiteOS preview -> production', async ({ page, request }) => {
  test.setTimeout(240_000);
  test.skip(
    process.env.RUN_SITEOS_PRODUCTION_E2E !== 'true',
    'production publish E2E only runs in the dedicated guarded workflow',
  );

  if (!EMAIL || !PASSWORD) {
    throw new Error('E2E_TEST_EMAIL/E2E_TEST_PASSWORD GitHub Actions secrets are required');
  }

  await page.goto('/demo-login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(/\/demo-app$/, { timeout: 30_000 });

  await page.goto('/builder/' + SLUG);
  await expect(page.getByRole('button', { name: /Prüfen/ })).toBeVisible({ timeout: 30_000 });

  const previewButton = page.getByRole('button', { name: 'Cloudflare-Vorschau bereitstellen' });
  await expect(previewButton).toBeDisabled();

  await page.getByRole('button', { name: /Prüfen/ }).click();
  await expect(previewButton).toBeEnabled({ timeout: 60_000 });

  await previewButton.click();

  const previewLink = page.getByRole('link', { name: 'Cloudflare-Vorschau öffnen' });
  await expect(previewLink).toBeVisible({ timeout: 120_000 });
  const previewUrl = await previewLink.getAttribute('href');
  expect(previewUrl).toMatch(/^https:\/\/.+\.pages\.dev\/?$/);

  const previewResponse = await request.get(previewUrl!, { timeout: 30_000 });
  expect(previewResponse.status()).toBeLessThan(400);

  const liveButton = page.getByRole('button', { name: 'Live veröffentlichen' });
  await expect(liveButton).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toMatch(/Vorschau geprüft|Vorschau.*Production|veröffentlich/i);
    await dialog.accept();
  });
  await liveButton.click();

  const liveLink = page.getByRole('link', { name: 'Live-Seite öffnen' });
  await expect(liveLink).toBeVisible({ timeout: 120_000 });
  const liveUrl = await liveLink.getAttribute('href');
  expect(liveUrl).toMatch(/^https:\/\/.+\.pages\.dev\/?$/);

  const liveResponse = await request.get(liveUrl!, { timeout: 30_000 });
  expect(liveResponse.status()).toBeLessThan(400);

  expect(liveUrl).not.toBe(previewUrl);
});
