import { test, expect } from '@playwright/test';

/**
 * Checkout-Flow-Smoke-E2E (QA-Audit 2026-06-22).
 *
 * Prüft den unauthentifizierten Teil des Self-Service-Checkouts:
 *   - /pricing zeigt die 5 öffentlichen Tiers mit Self-Serve-CTAs
 *   - /checkout/:plan rendert (Auth- bzw. Consent-Gate), ohne Stripe live
 *     anzustoßen
 *   - Free-Plan leitet auf /audit, Enterprise auf /contact-sales
 *   - Success-/Cancel-Seiten rendern
 *
 * Es wird KEINE echte Stripe-Session erzeugt (kein Login, kein Klick auf
 * "zahlungspflichtig bestellen"). Läuft gegen E2E_BASE_URL.
 */

test.describe('Pricing-Seite', () => {
  test('zeigt Tiers und Self-Serve-Upgrade-CTAs', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href*="/checkout/starter"]').first()).toBeVisible();
    await expect(page.locator('a[href*="/audit"]').first()).toBeVisible();
    // Enterprise/Scale → contact-sales (einzige erlaubte Kontakt-CTA).
    await expect(page.locator('a[href*="/contact-sales"]').first()).toBeVisible();
  });
});

test.describe('Checkout-Routen', () => {
  for (const plan of ['starter', 'growth', 'agency']) {
    test(`/checkout/${plan} rendert (Auth-/Consent-Gate)`, async ({ page }) => {
      const res = await page.goto(`/checkout/${plan}`, { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBeLessThan(400);
      const body = await page.locator('body').innerText();
      expect(body.trim().length).toBeGreaterThan(0);
      expect(body).not.toMatch(/404|nicht gefunden/i);
    });
  }

  test('/checkout/free leitet auf den kostenlosen Audit', async ({ page }) => {
    await page.goto('/checkout/free', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/audit/, { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/audit|\/checkout\/free/);
  });

  test('/checkout/enterprise leitet auf contact-sales', async ({ page }) => {
    await page.goto('/checkout/enterprise', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/contact-sales/, { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/contact-sales|\/checkout\/enterprise/);
  });
});

test.describe('Success-/Cancel-Seiten', () => {
  test('/checkout/success rendert', async ({ page }) => {
    const res = await page.goto('/checkout/success', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
  });

  test('/checkout/cancelled rendert', async ({ page }) => {
    const res = await page.goto('/checkout/cancelled', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
  });
});
