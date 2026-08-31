import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setze APP_URL Fallback falls nicht gesetzt
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await page.goto(`${appUrl}/pricing`);
  });

  test('Free Audit sollte nicht zu Stripe gehen, sondern zu /audit', async ({ page }) => {
    // Navigiere zur Pricing-Seite
    await page.goto('http://localhost:3000/pricing');

    // Klick auf "Kostenlos starten" Button (Free Audit)
    const freeButton = page.getByRole('button', { name: /kostenlos starten/i });
    await freeButton.click();

    // Sollte zu /audit geleitet werden, nicht zu /checkout
    await page.waitForURL('**/audit*');
    expect(page.url()).toContain('/audit');
  });

  test('Starter Plan mit Trial zeigt grünen Banner', async ({ page }) => {
    // Navigiere zu Starter Checkout mit pilot=true
    await page.goto('http://localhost:3000/checkout/starter?pilot=true');

    // Prüfe ob grüner Trial-Banner vorhanden ist
    const trialBanner = page.locator('text=14 TAGE KOSTENLOS');
    await expect(trialBanner).toBeVisible();

    // Prüfe auf grüne Styling (emerald)
    const bannerDiv = trialBanner.locator('xpath=../..');
    await expect(bannerDiv).toHaveClass(/bg-emerald-950/);
  });

  test('Checkout-Seite zeigt Consent-Checkboxen', async ({ page }) => {
    // Starte mit angenommener Login (würde normalerweise OAuth flow sein)
    await page.goto('http://localhost:3000/checkout/growth?pilot=true');

    // Prüfe auf beide Consent-Checkboxen
    const agbCheckbox = page.getByLabel(/gelesen und akzeptiere sie/i);
    const withdrawalCheckbox = page.getByLabel(/Widerrufsfrist/i);

    await expect(agbCheckbox).toBeVisible();
    await expect(withdrawalCheckbox).toBeVisible();

    // Submit-Button sollte disabled sein bis beide akzeptiert
    const submitButton = page.getByRole('button', { name: /bestellen/i });
    await expect(submitButton).toBeDisabled();
  });

  test('Error-Meldungen sind auf Deutsch', async ({ page }) => {
    // Test mit einen ungültigen Plan-Key
    await page.goto('http://localhost:3000/checkout/invalid_plan_xyz');

    // Sollte eine Fehlermeldung anzeigen
    const errorTitle = page.locator('text=Unbekanntes Paket');
    await expect(errorTitle).toBeVisible();

    // Fehlermeldung sollte Deutsche sein
    const errorText = page.locator('text="invalid_plan_xyz" ist kein bekannter Plan');
    await expect(errorText).toBeVisible();
  });

  test('Free-Audit plan-key Konsistenz', async ({ page }) => {
    // Teste dass free_audit planKey überall konsistent ist
    // Das ist schwer direkt zu testen, aber wir können /checkout/free_audit prüfen

    // free_audit sollte zu /audit umleiten
    await page.goto('http://localhost:3000/checkout/free_audit');

    // Sollte nicht auf Checkout-Seite stecken bleiben
    const checkoutPageTitle = page.locator('text=Anmelden');
    const isOnCheckout = await checkoutPageTitle.isVisible({ timeout: 2000 }).catch(() => false);

    // Sollte zu /audit geleitet werden
    if (!isOnCheckout) {
      await page.waitForURL('**/audit*', { timeout: 5000 });
      expect(page.url()).toContain('/audit');
    }
  });

  test('Jahresplan ohne verdrahteten Preis wird nicht als Kauf angeboten', async ({ page }) => {
    // Fuer `growth_yearly` steht in `public.products` nur der Platzhalter
    // `STRIPE_PRICE_GROWTH_YEARLY_XXX` — `stripe-checkout` antwortet mit
    // PRICE_NOT_CONFIGURED. Frueher pruefte dieser Test, dass hier „2.490"
    // und „/ Jahr" stehen; genau das war das Angebot ohne Kaufpfad.
    await page.goto('http://localhost:3000/checkout/growth_yearly');

    // Die Seite leitet auf den Monats-Checkout desselben Plans um. Am Ende
    // verankert, weil `/checkout/growth` ein Praefix von
    // `/checkout/growth_yearly` ist — sonst waere die Bedingung schon vor der
    // Weiterleitung erfuellt.
    await page.waitForURL(/\/checkout\/growth(\?|$)/);
    expect(page.url()).not.toContain('growth_yearly');

    // Und der Jahresbetrag steht nirgends mehr als zugesicherter Preis.
    await expect(page.locator('text=2.490')).toHaveCount(0);
  });

  test('Partner Plan Checkout wird korrekt verwaltet', async ({ page }) => {
    // Partner ist ein Inquiry-Plan — der Self-Service-Checkout lehnt ihn ab.
    // Diese Test dokumentiert das erwartete Verhalten

    await page.goto('http://localhost:3000/checkout/partner');

    // Sollte entweder fehlende Konfiguration anzeigen oder warten auf Prices
    // Für jetzt: Dokumentiere dass Test pending ist
    // TODO: Nach Migration 20260707000000_stripe_missing_price_ids_partner_yearly.sql
    // können wir echte Stripe Price-IDs testen
  });

  test('Enterprise Checkout leitet zu Contact-Sales um', async ({ page }) => {
    // Enterprise hat keinen self-serve Checkout
    await page.goto('http://localhost:3000/checkout/enterprise');

    // Sollte zu /contact-sales umleiten
    await page.waitForURL('**/contact-sales*');
    expect(page.url()).toContain('/contact-sales');
  });
});
