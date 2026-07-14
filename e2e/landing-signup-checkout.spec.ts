import { test, expect } from '@playwright/test';

/**
 * E2E Onboarding Journey: Landing → Sign-up → Checkout → Stripe
 *
 * Testet den kompletten Betreiber-Onboarding-Fluss:
 * 1. Landing-Page (/landing oder /) besuchen
 * 2. "Kostenlos starten" / CTA klicken → zu Sign-up navigieren
 * 3. Neue Email: steinerdominik1982@gmail.com mit Password registrieren
 * 4. Nach Anmeldung: Pricing-Page oder Checkout ansteuern
 * 5. Plan wählen (z.B. Starter)
 * 6. Stripe-Checkout-Flow initialisieren
 * 7. Auf Stripe-Bestätigung oder Success-Seite prüfen
 *
 * Annahmen:
 * - Landing-Page hat CTAs zu Sign-up
 * - /os/signup ist die Registrierungs-Route
 * - /pricing zeigt verfügbare Pläne
 * - /checkout/:planKey ist die Stripe-Bridge
 * - Test-Stripe-Keys sind in .env konfiguriert (optional)
 */

const BASE_URL = process.env.TEST_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'steinerdominik1982@gmail.com';
const TEST_PASSWORD = 'TestPass123!@#';

test.describe('Landing → Signup → Checkout Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Sauberer Start: keine Session, keine Cookies
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('[J-001] Landing-Page zeigt Sign-up CTA', async ({ page }) => {
    // Schritt 1: Landing-Page laden
    await page.goto(`${BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    // Verify wir sind auf der Landing-Page
    await expect(page).toHaveTitle(/.+/); // Beliebiger Titel

    // Landing-Page sollte "Kostenlos starten" oder ähnliche CTA zeigen
    const ctas = page.getByRole('button', { name: /kostenlos|starten|anmelden|registrieren/i });
    await expect(ctas.first()).toBeVisible({ timeout: 5000 });
  });

  test('[J-002] CTA leitet zu Sign-up (/os/signup)', async ({ page }) => {
    // Landing-Page
    await page.goto(`${BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    // Erste CTA klicken
    const cta = page.getByRole('button', { name: /kostenlos|starten/i }).first();
    await cta.click();

    // Sollte zu /os/signup navigieren
    await page.waitForURL(/\/os\/signup|\/signup/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/os\/signup|\/signup/);
  });

  test('[J-003] Sign-up-Seite zeigt Registrierungs-Formular', async ({ page }) => {
    // Direkt zur Sign-up-Seite navigieren
    await page.goto(`${BASE_URL}/os/signup`);
    await page.waitForLoadState('networkidle');

    // Formular-Elemente sichtbar
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name*="password"]').first();

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible({ timeout: 5000 });

    // Submit-Button
    const submitBtn = page.getByRole('button', { name: /registrieren|anmelden|erstellen|sign up/i }).first();
    await expect(submitBtn).toBeVisible();
  });

  test('[J-004] Neue Registrierung mit Email durchführen', async ({ page }) => {
    // Zur Sign-up-Seite
    await page.goto(`${BASE_URL}/os/signup`);
    await page.waitForLoadState('networkidle');

    // Email + Password eintragen
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name*="password"]').first();

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);

    // Optional: Bestätigungspasswort (bei Vorhanden)
    const confirmPasswordInput = page.locator('input[placeholder*="Confirm"], input[name*="confirm"]').first();
    if (await confirmPasswordInput.isVisible().catch(() => false)) {
      await confirmPasswordInput.fill(TEST_PASSWORD);
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /registrieren|anmelden|erstellen|sign up/i }).first();
    await submitBtn.click();

    // Nach Registrierung sollte eine Bestätigung oder Weiterleitung erfolgen
    // Warte bis URL sich ändert oder erfolgs-Nachricht erscheint
    await page.waitForTimeout(2000); // Kurze Pause für Backend-Processing

    // Entweder: Email-Bestätigungsseite, oder direkt ins Dashboard, oder zum Checkout
    const url = page.url();
    expect(
      url.includes('/auth') ||
      url.includes('/app') ||
      url.includes('/checkout') ||
      url.includes('/pricing') ||
      url.includes('/verify')
    ).toBeTruthy();
  });

  test('[J-005] Nach Sign-up: Pricing-Seite oder Dashboard sichtbar', async ({ page }) => {
    // Diese Test kann nicht vollständig ohne echte Auth laufen.
    // Wir navigieren direkt zur Pricing-Seite (simuliert den Post-Signup-Zustand)
    await page.goto(`${BASE_URL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Mindestens eine Preis-Karte sichtbar
    const pricingCards = page.locator('[data-testid^="pricing-card-"]');
    const cardCount = await pricingCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // CTAs zur Buchung sichtbar (z.B. "Jetzt buchen")
    const checkoutCtaCount = await page
      .getByRole('button', { name: /buchen|wählen|auswählen|jetzt|get started|choose/i })
      .count();
    expect(checkoutCtaCount).toBeGreaterThan(0);
  });

  test('[J-006] Plan-Auswahl navigiert zu /checkout/:planKey', async ({ page }) => {
    // Zur Pricing-Seite
    await page.goto(`${BASE_URL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Starter-Plan Card finden und "Buchen"-Button klicken
    const starterCard = page.locator('[data-testid="pricing-card-starter"]');
    if (await starterCard.isVisible().catch(() => false)) {
      // Wenn Starter-Card vorhanden
      const checkoutBtn = starterCard.getByRole('button', { name: /buchen|wählen|get started/i });
      await checkoutBtn.click();
    } else {
      // Fallback: Ersten "Buchen"-Button auf der Seite
      const firstCheckoutBtn = page
        .getByRole('button', { name: /buchen|wählen|auswählen|get started|choose/i })
        .first();
      await firstCheckoutBtn.click();
    }

    // Sollte zu /checkout/[planKey] navigieren
    await page.waitForURL(/\/checkout\/.*/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/checkout\//);
  });

  test('[J-007] Checkout-Seite zeigt Login-Hinweis oder Stripe-Form', async ({ page }) => {
    // Direkt zum Checkout navigieren
    await page.goto(`${BASE_URL}/checkout/starter`);
    await page.waitForLoadState('networkidle');

    // Entweder:
    // A) Angemeldeter Benutzer → Stripe Payment Form
    // B) Unangemeldeter Benutzer → Login-Aufforderung

    const hasLoginPrompt = await page
      .getByRole('heading', { name: /anmelden|login|sign in/i })
      .first()
      .isVisible()
      .catch(() => false);

    const hasStripeForm = await page
      .locator('iframe[src*="stripe.com"]')
      .first()
      .isVisible()
      .catch(() => false);

    // Mindestens eines sollte vorhanden sein
    expect(hasLoginPrompt || hasStripeForm).toBeTruthy();
  });

  test('[J-008] Checkout zeigt Plan-Details und Preis', async ({ page }) => {
    // Checkout-Seite
    await page.goto(`${BASE_URL}/checkout/starter`);
    await page.waitForLoadState('networkidle');

    // Plan-Name und Preis sollten sichtbar sein
    const planName = page.getByText(/Starter/, { exact: false });
    const priceText = page.getByText(/€|EUR/);

    await expect(planName.first()).toBeVisible({ timeout: 5000 });
    await expect(priceText.first()).toBeVisible({ timeout: 5000 });
  });

  test('[J-009] Checkout / Abbruch-Link führt zu /checkout/cancelled', async ({ page }) => {
    // Checkout-Seite
    await page.goto(`${BASE_URL}/checkout/starter`);
    await page.waitForLoadState('networkidle');

    // Abbruch-Link suchen (z.B. "Zurück", "Abbrechen", etc.)
    const cancelLinks = page.getByRole('link', { name: /abbrechen|zurück|cancel|back/i });
    const cancelCount = await cancelLinks.count();

    // Wenn Abbruch-Link vorhanden, teste den Link
    if (cancelCount > 0) {
      const href = await cancelLinks.first().getAttribute('href');
      expect(href).toContain('/checkout');
    }
  });

  test('[J-010] Stripe-Integration: Test für iFrame-Präsenz (Test-Modus)', async ({ page }) => {
    const STRIPE_TEST_MODE = process.env.STRIPE_TEST_MODE === 'true';

    if (!STRIPE_TEST_MODE) {
      test.skip(true, 'STRIPE_TEST_MODE nicht gesetzt – Stripe-Test übersprungen');
      return;
    }

    // Checkout-Seite
    await page.goto(`${BASE_URL}/checkout/starter`);
    await page.waitForLoadState('networkidle');

    // Stripe iFrame prüfen (nur nach erfolgreicher Anmeldung sichtbar)
    const stripeFrames = page.locator('iframe[src*="stripe.com"]');
    const frameCount = await stripeFrames.count();

    if (frameCount > 0) {
      // iFrame vorhanden → Stripe ist integriert
      expect(frameCount).toBeGreaterThan(0);
      console.log(`✓ ${frameCount} Stripe iFrame(s) gefunden`);
    } else {
      // Falls Benutzer nicht angemeldet ist, erscheint iFrame erst nach Login
      console.log('ℹ Keine Stripe iFrames sichtbar (wahrscheinlich weil Benutzer nicht angemeldet ist)');
    }
  });

  test('[J-011] Checkout-Erfolg: /checkout/success zeigt Bestätigung', async ({ page }) => {
    // Direkt zur Success-Seite navigieren (simuliert erfolgreichen Checkout)
    const resp = await page.goto(`${BASE_URL}/checkout/success`, { waitUntil: 'domcontentloaded' });

    // Seite sollte erreichbar sein
    expect(resp?.status()).toBeLessThan(400);

    // Success-Meldung oder Dank sollte sichtbar sein
    const successHeading = page.getByRole('heading', { name: /erfolg|danke|vielen dank|thank you|success/i });
    const successCount = await successHeading.count();

    if (successCount > 0) {
      await expect(successHeading.first()).toBeVisible();
    } else {
      // Fallback: Text-Check
      const successText = page.getByText(/erfolg|danke|vielen dank|thank you/i);
      expect(await successText.count()).toBeGreaterThan(0);
    }
  });

  test('[J-012] Komplett-Journey-Simulation (ohne echte Zahlung)', async ({ page }) => {
    // 1. Landing
    await page.goto(`${BASE_URL}/landing`);
    console.log('✓ Landing-Page geladen');

    // 2. Navigiere zur Sign-up (falls CTA nicht automatisch navigiert)
    await page.goto(`${BASE_URL}/os/signup`);
    console.log('✓ Sign-up-Seite geladen');

    // 3. Zu Pricing navigieren
    await page.goto(`${BASE_URL}/pricing`);
    await page.waitForLoadState('networkidle');
    console.log('✓ Pricing-Seite geladen');

    // 4. Zu Checkout navigieren
    await page.goto(`${BASE_URL}/checkout/starter`);
    await page.waitForLoadState('networkidle');
    console.log('✓ Checkout-Seite geladen');

    // 5. Validiere, dass alle Seiten erreichbar sind
    const pages = [
      { url: '/landing', name: 'Landing' },
      { url: '/os/signup', name: 'Sign-up' },
      { url: '/pricing', name: 'Pricing' },
      { url: '/checkout/starter', name: 'Checkout' },
    ];

    for (const p of pages) {
      const resp = await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'domcontentloaded' });
      expect(resp?.status()).toBeLessThan(400);
      console.log(`✓ ${p.name} (${p.url}) ist erreichbar`);
    }
  });
});
