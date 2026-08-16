import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';

/**
 * Pixel-/Kompositions-Kontrakt des Gemini-Hero (Referenz-Viewport 1365×768).
 *
 * Der Gemini-Screenshot ist die verbindliche Design-Spezifikation; dieser Test
 * hält die daraus abgeleiteten Fixpunkte fest:
 *   - Hero füllt den 768er-Viewport exakt
 *   - Visual-Panel (Globus-Szene) beginnt bei x ≈ 327 px (24 % Breite)
 *   - H1 sitzt links bei x ≈ 70 px im oberen Drittel
 *   - alle sechs Status-Karten sind sichtbar
 *   - AssistantBar ist unten mittig ausgerichtet
 * Toleranzen decken Font-Rendering-Unterschiede zwischen Umgebungen ab.
 */
test.describe('Gemini-Hero — Komposition bei 1365×768', () => {
  test.use({ viewport: { width: 1365, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  });

  test('Hero füllt den Referenz-Viewport exakt', async ({ page }) => {
    const hero = page.locator('#produkt');
    await expect(hero).toBeVisible();
    const box = await hero.boundingBox();
    expect(box, 'Hero-Sektion hat eine BoundingBox').toBeTruthy();
    expect(Math.round(box!.height)).toBe(768);
  });

  test('Visual-Panel beginnt bei x ≈ 327 px', async ({ page }) => {
    const panel = page.getByTestId('hero-visual-panel');
    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    // 24 % von 1365 = 327,6 px — Toleranz ±6 px.
    expect(box!.x).toBeGreaterThanOrEqual(321);
    expect(box!.x).toBeLessThanOrEqual(334);
    // Panel reicht bis an den oberen und rechten Rand (keine Naht).
    expect(box!.y).toBeLessThanOrEqual(1);
    expect(box!.x + box!.width).toBeGreaterThanOrEqual(1364);
  });

  test('H1 sitzt auf der Referenz-Position', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    const box = await h1.boundingBox();
    expect(box).toBeTruthy();
    // Linke Kante: Content-Padding 70 px (±8 px).
    expect(box!.x).toBeGreaterThanOrEqual(62);
    expect(box!.x).toBeLessThanOrEqual(78);
    // Oberkante im oberen Drittel (Referenz ≈ 150 px, ±25 px).
    expect(box!.y).toBeGreaterThanOrEqual(125);
    expect(box!.y).toBeLessThanOrEqual(180);
  });

  test('alle sechs Status-Karten sind sichtbar', async ({ page }) => {
    for (const label of ['DSGVO', 'Risk Score', 'Claude Code Audit', 'EU AI ACT', 'Evidence', 'Monitoring']) {
      await expect(
        page.locator('#produkt').getByText(label, { exact: false }).first(),
        `Karte "${label}"`,
      ).toBeVisible();
    }
  });

  test('AssistantBar ist unten mittig ausgerichtet', async ({ page }) => {
    const bar = page.getByTestId('hero-assistant-bar');
    await expect(bar).toBeVisible();
    const box = await bar.boundingBox();
    expect(box).toBeTruthy();
    // Unterkante schließt mit dem Viewport ab (bottom-4 → 16 px Abstand, ±6 px).
    const bottomGap = 768 - (box!.y + box!.height);
    expect(bottomGap).toBeGreaterThanOrEqual(8);
    expect(bottomGap).toBeLessThanOrEqual(24);
    // Mittig: Kartenmitte = Viewportmitte (±10 px).
    const center = box!.x + box!.width / 2;
    expect(Math.abs(center - 1365 / 2)).toBeLessThanOrEqual(10);
  });

  test('kein horizontales Scrollen', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('Gemini-Hero — Mobile (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  });

  test('H1 sichtbar, kein horizontales Scrollen', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('AssistantBar ist mobil ausgeblendet (xl-only)', async ({ page }) => {
    await expect(page.getByTestId('hero-assistant-bar')).toBeHidden();
  });
});
