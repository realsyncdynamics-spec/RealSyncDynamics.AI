/**
 * Real SYNC WebGL acceptance. The viewport/fallback suite alone cannot prove
 * that the canonical GLB loads or that its wave animation completes.
 *
 * Runs solely against an isolated locally built Vite preview, never production.
 * CI forces software WebGL (SwiftShader); physical-device performance and
 * mobile GPU compatibility still require separate approval.
 */
import { expect, test } from '@playwright/test';

test.use({
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  },
});

for (const route of ['/', '/voice-agent'] as const) {
  test('canonical GLB loads, renders and wave completes on ' + route, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      // Exercise the normal 3D branch instead of the deliberately conservative
      // low-memory/low-core fallback branch on CI's virtual machine.
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
    });

    const glbResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/models/sync-mascot.glb',
      { timeout: 30_000 },
    );

    const navigation = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(navigation?.ok()).toBe(true);
    const stage = page.getByTestId('sync-master-stage');

    const webgl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    });
    expect(webgl, 'Software WebGL must work; fallback-only is not a 3D pass').toBe(true);

    const response = await glbResponse;
    expect(response.ok(), 'Canonical SYNC GLB must load successfully').toBe(true);

    await expect(stage).toHaveAttribute('data-scene', 'scene', { timeout: 30_000 });
    await expect(stage.locator('canvas')).toHaveAttribute('data-visible', 'true');
    await expect(stage).toHaveAttribute('data-wave', 'finished', { timeout: 30_000 });
  });
}
