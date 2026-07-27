import { test, expect } from '@playwright/test';

/**
 * Cookie-Consent: Reject-Equivalence (Befund #3, findings-2026-05-14.md).
 *
 * DSGVO Art. 7 III + TTDSG §25 verlangen, dass „Ablehnen" UI-gleichwertig
 * zu „Akzeptieren" ist. „Volumen" interpretieren wir hier als
 * Bounding-Box-Fläche; Farb-Differenzierung bleibt erlaubt, solange beide
 * Buttons gleich sichtbar, gleich groß und nicht hinter Mehr-Klick versteckt sind.
 */

test.describe('CookieConsent — Reject-Equivalence', () => {
  test.beforeEach(async ({ context }) => {
    // Banner-Storage zurücksetzen, damit das Banner garantiert rendert.
    await context.clearCookies();
  });

  test('Accept und Reject sind beide auf erster Ebene sichtbar', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByTestId('consent-accept-all');
    const reject = page.getByTestId('consent-reject-all');

    await expect(accept).toBeVisible();
    await expect(reject).toBeVisible();
  });

  test('Bounding-Box-Volumen Accept ≈ Reject (±10 %)', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByTestId('consent-accept-all');
    const reject = page.getByTestId('consent-reject-all');

    const acceptBox = await accept.boundingBox();
    const rejectBox = await reject.boundingBox();

    expect(acceptBox).not.toBeNull();
    expect(rejectBox).not.toBeNull();
    if (!acceptBox || !rejectBox) return;

    const acceptArea = acceptBox.width * acceptBox.height;
    const rejectArea = rejectBox.width * rejectBox.height;
    const ratio = Math.min(acceptArea, rejectArea) / Math.max(acceptArea, rejectArea);

    expect(ratio).toBeGreaterThanOrEqual(0.9);
    expect(acceptBox.height).toBeCloseTo(rejectBox.height, 0);
  });

  test('Beide Buttons haben identischen font-weight und font-size', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByTestId('consent-accept-all');
    const reject = page.getByTestId('consent-reject-all');

    const acceptStyle = await accept.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { fontWeight: cs.fontWeight, fontSize: cs.fontSize };
    });
    const rejectStyle = await reject.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { fontWeight: cs.fontWeight, fontSize: cs.fontSize };
    });

    expect(acceptStyle.fontWeight).toBe(rejectStyle.fontWeight);
    expect(acceptStyle.fontSize).toBe(rejectStyle.fontSize);
  });

  test('Reject ist nicht hinter Mehr-Klick versteckt', async ({ page }) => {
    await page.goto('/');
    // „Einstellungen"-Toggle darf NICHT nötig sein, um Reject zu erreichen.
    const reject = page.getByTestId('consent-reject-all');
    await expect(reject).toBeVisible();
    // Direkt klickbar, ohne erst „Einstellungen" zu öffnen.
    await reject.click();
    // Banner verschwindet nach Click.
    await expect(reject).not.toBeVisible();
  });
});
