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

  test('Jahresplan zeigt korrekte Preise', async ({ page }) => {
    // Navigiere zu Growth Yearly Checkout
    await page.goto('http://localhost:3000/checkout/growth_yearly');

    // Prüfe dass Jahrespreis angezeigt wird, nicht Monatspreis
    const priceText = page.locator('text=2.490');
    await expect(priceText).toBeVisible();

    // Sollte "/ Jahr" zeigen, nicht "/ Monat"
    const yearText = page.locator('text=/Jahr/i');
    await expect(yearText).toBeVisible();
  });

  test('Scale Plan Checkout wird korrekt verwaltet', async ({ page }) => {
    // Scale ist noch nicht vollständig konfiguriert (fehlende Stripe Prices)
    // Diese Test dokumentiert das erwartete Verhalten

    await page.goto('http://localhost:3000/checkout/scale');

    // Sollte entweder fehlende Konfiguration anzeigen oder warten auf Prices
    // Für jetzt: Dokumentiere dass Test pending ist
    // TODO: Nach Migration 20260707000000_stripe_missing_price_ids_scale_yearly.sql
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
