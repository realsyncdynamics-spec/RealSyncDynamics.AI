/**
 * SYNC brand E2E smoke: seven public entries, same canonical GLB,
 * usable on desktop/mobile, robust static fallback.
 *
 * Manual preview run (do not target production without approval):
 * TEST_BASE_URL=https://<verified-cloudflare-preview-host> npm run e2e -- e2e/brand/sync-seven-routes.spec.ts
 *
 * Browser screenshots, WebGL availability and media transport are NOT
 * certified by the existence of this spec alone; execute and review results.
 */
import { test, expect, type Page } from '@playwright/test';

const PRODUCT_ROUTES = [
  '/governance-os',
  '/voice-agent',
  '/app-builder',
  '/software-factory',
  '/automation-os',
  '/creative-studio',
] as const;

const STAGE = '[data-testid="sync-master-stage"]';
const MODEL = '/models/sync-mascot.glb';
const STILL = '/landing-v3/sync-still.jpg';

async function loadStage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), path + ' did not respond successfully').toBe(true);
  const stage = page.locator(STAGE);
  await expect(stage).toBeVisible({ timeout: 20000 });
  await expect(stage.locator('img')).toHaveAttribute('src', STILL);
  const variant = path === '/' ? 'home' : path.slice(1);
  await expect(stage).toHaveAttribute('data-variant', variant);
  return stage;
}

test.describe('SYNC brand · desktop + mobile', () => {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    for (const path of ['/', ...PRODUCT_ROUTES]) {
      test(viewport.name + ' · ' + path, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const stage = await loadStage(page, path);
        const box = await stage.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThan(200);
          expect(box.x).toBeGreaterThanOrEqual(-2);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
        }
        if (path === '/') {
          await expect(page.getByTestId('v3-hero-heading')).toBeVisible();
        } else {
          await expect(page.locator('#rpl-heading')).toBeVisible();
        }
      });
    }
  }
});

test.describe('SYNC brand · resilient fallback', () => {
  test('prefers-reduced-motion disables WebGL, keeps SYNC still visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const stage = await loadStage(page, '/voice-agent');
    await expect(stage).toHaveAttribute('data-scene', 'still');
    await expect(stage.locator('img')).toBeVisible();
    await expect(stage.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  test('blocked GLB leaves same SYNC still instead of another character', async ({ page }) => {
    await page.route('**' + MODEL, (route) => route.abort('failed'));
    const stage = await loadStage(page, '/creative-studio');
    await expect(stage.locator('img')).toHaveAttribute('src', STILL);
    // A machine with WebGL may retry then stay on the still; machines without
    // WebGL are in "still" from the beginning. Both must keep the same asset.
    await expect(stage).toHaveAttribute('data-variant', 'creative-studio');
    await expect(stage.locator('canvas')).toHaveCount(1);
  });

  test('no approved Higgsfield video means shared SYNC on the home hero', async ({ page }) => {
    // This PR's deployment must not enable the editorial video-release flag.
    const stage = await loadStage(page, '/');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('higgsfield-bot-hero')).toHaveCount(0);
  });
});
