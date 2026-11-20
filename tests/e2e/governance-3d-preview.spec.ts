import { expect, test } from '@playwright/test';

/**
 * Dedicated Governance 3D preview acceptance tests.
 * These run against Vite preview in the existing test:e2e workflow.
 * The visual WebGL scene is progressive enhancement, not a prerequisite for conversion.
 */
test.describe('Governance OS 3D preview', () => {
  test('renders the real copy and connected audit/governance CTAs', async ({ page }) => {
    await page.goto('/design/governance-3d', { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Govern AI.');
    await expect(heading).toContainText('Prove Everything.');

    await expect(page.getByRole('link', { name: /Governance Audit starten/ }))
      .toHaveAttribute('href', '/audit');
    await expect(page.getByRole('link', { name: /Plattform entdecken/ }))
      .toHaveAttribute('href', '/governance-runtime');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('heading', { level: 2, name: /Vom KI-System zum nachvollziehbaren Nachweis/ }))
      .toBeVisible();
  });

  test('is readable on a narrow mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/design/governance-3d', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Governance Audit starten/ })).toBeVisible();
    await expect(page.locator('.rs-governance-hero__scene')).toHaveAttribute('data-scene-requested', 'false');
    await expect(page.locator('.rs-governance-hero__scene canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Interaktive Governance-3D-Ansicht aktivieren/ })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 2);
  });

  test('reduced-motion mode avoids WebGL and keeps the primary actions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/design/governance-3d', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.rs-governance-hero__fallback')).toBeVisible();
    await expect(page.locator('.rs-governance-hero__scene canvas')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Governance Audit starten/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Plattform entdecken/ })).toBeVisible();
  });
});

/** The public conversion buttons must work when WebGL cannot be created. */
test('Governance preview retains real actions when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function (this: HTMLCanvasElement, id: string, ...args: unknown[]) {
        if (id === 'webgl' || id === 'webgl2' || id === 'experimental-webgl') return null;
        return Reflect.apply(original, this, [id, ...args]);
      },
    });
  });
  await page.goto('/design/governance-3d', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.rs-governance-hero__scene')).toHaveAttribute('data-scene-requested', 'true');
  await expect(page.locator('.rs-governance-hero__fallback')).toBeVisible();
  await expect(page.locator('.rs-governance-hero__scene canvas')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Governance Audit starten/ })).toHaveAttribute('href', '/audit');
  await expect(page.getByRole('link', { name: /Plattform entdecken/ })).toHaveAttribute('href', '/governance-runtime');
});

test('mobile users can opt into genuine 3D without losing the audit CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design/governance-3d', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Interaktive Governance-3D-Ansicht aktivieren/ }).click();
  await expect(page.locator('.rs-governance-hero__scene')).toHaveAttribute('data-scene-requested', 'true');
  await expect(page.getByRole('link', { name: /Governance Audit starten/ })).toHaveAttribute('href', '/audit');
});
