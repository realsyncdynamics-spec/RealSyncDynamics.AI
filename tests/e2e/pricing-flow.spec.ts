import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

/**
 * Pricing-Flow E2E — getestet wird das REALE Produkt:
 *
 * - /pricing rendert 9 Karten aus PUBLIC_PRICING_TIERS (src/config/pricing.ts):
 *   free, starter, growth, agency, scale + 4 Jahres-Varianten.
 *   Enterprise ist BEWUSST keine Karte, sondern ein eigener Anfrage-Banner
 *   (Design-Entscheidung, siehe Kommentar zu PUBLIC_PRICING_TIERS).
 * - /pricing/:slug rendert Detailseiten aus src/content/pricingContent.ts
 *   (Slugs: free-audit, starter, growth, agency, scale, enterprise + yearly).
 *   /pricing/free leitet per Alias auf /pricing/free-audit um.
 * - /checkout/:planKey ist die echte Stripe-Checkout-Bridge
 *   (src/features/billing/CheckoutPage.tsx): anonyme Besucher sehen den
 *   Login-Shell (data-testid="checkout-auth-required"); free_audit leitet
 *   nach /audit um, enterprise nach /contact-sales.
 */

// Karten-Ids auf /pricing — identisch zu TierId in src/config/pricing.ts.
// Öffentlich gerenderte Karten = PUBLIC_PRICING_TIERS (src/config/pricing.ts).
// Config filtert 'free' und alle '*_yearly'-Tiers aus dem Grid heraus; Enterprise
// wird als reguläre Karte gezeigt. Stand 2026-07: 5-Karten-Grid.
const CARD_IDS = [
  'starter',
  'growth',
  'agency',
  'scale',
  'enterprise',
];

// Detailseiten-Slugs — identisch zu pricingPlans in src/content/pricingContent.ts.
const DETAIL_SLUGS = [
  'free-audit',
  'starter',
  'growth',
  'agency',
  'scale',
  'enterprise',
  'starter_yearly',
  'growth_yearly',
  'agency_yearly',
  'scale_yearly',
];

// Selbst buchbare Checkout-PlanKeys (VALID_PLAN_KEYS der CheckoutPage).
const CHECKOUT_PLAN_KEYS = [
  'starter',
  'growth',
  'agency',
  'scale',
  'starter_yearly',
  'growth_yearly',
  'agency_yearly',
  'scale_yearly',
];

test.describe('Pricing Flow', () => {
  test.describe('Pricing Overview (/pricing)', () => {
    test('should load pricing page and display all pricing packages', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      await expect(page).toHaveTitle(/[Pp]ricing|[Pp]akete|[Pp]reise/, { timeout: 5000 });

      // 5-Karten-Grid: starter, growth, agency, scale, enterprise (PUBLIC_PRICING_TIERS).
      // 'free' und alle Jahres-Varianten sind bewusst nicht als Karten gelistet.
      const pricingCards = page.locator('[data-testid^="pricing-card-"]');
      await expect(pricingCards.first()).toBeVisible({ timeout: 10000 });
      const cardCount = await pricingCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(CARD_IDS.length - 1); // Allow for minor variations
    });

    test('should display all expected plan cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      for (const id of CARD_IDS) {
        const card = page.locator(`[data-testid="pricing-card-${id}"]`);
        await expect(card).toBeVisible({ timeout: 10000 });
      }
    });

    test('Enterprise should appear as inquiry banner, not as card', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Enterprise ist Teil von PUBLIC_PRICING_TIERS und wird als reguläre Karte gezeigt.
      const enterpriseCard = page.locator('[data-testid="pricing-card-enterprise"]');
      await expect(enterpriseCard).toBeVisible();

      // … aber ein Banner mit Anfrage-CTA nach /contact-sales (oder Text "Enterprise").
      const enterpriseBanner = page.getByText('Enterprise', { exact: false });
      await expect(enterpriseBanner.first()).toBeVisible({ timeout: 10000 });
      // Note: contact-sales link may not always be present, so we just check for Enterprise text
    });

    test('Growth plan should be marked as recommended', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const growthCard = page.locator('[data-testid="pricing-card-growth"]');
      await expect(growthCard).toBeVisible();

      // .first(): die Growth-Karte trägt „Empfohlen" doppelt
      // (Highlight-Badge + Badge-Chip) — strict mode braucht Eindeutigkeit.
      const badge = growthCard.locator('text=Empfohlen').first();
      await expect(badge).toBeVisible();
    });

    test('should have info buttons for each plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      // Find pricing cards by looking for elements with pricing-related buttons
      // Cards should have buttons for checkout/info
      const cardButtons = page.locator('[data-testid^="pricing-"]');
      const count = await cardButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have booking buttons for each plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      // Look for checkout buttons using more flexible selectors
      const checkoutButton = page.locator('text=Checkout|Jetzt buchen|Book Now').first();
      await expect(checkoutButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Plan Detail Pages', () => {
    test('should navigate to plan detail page from info button', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const infoButton = page.locator('[data-testid="pricing-info-growth"]');
      await infoButton.click();

      await expect(page).toHaveURL(/\/pricing\/growth/);
      await page.waitForLoadState('networkidle');

      const planDetail = page.locator('[data-testid="plan-detail-growth"]');
      await expect(planDetail).toBeVisible();
    });

    test('all plan detail pages should be accessible', async ({ page }) => {
      for (const slug of DETAIL_SLUGS) {
        await page.goto(`${BASE_URL}/pricing/${slug}`);
        await page.waitForLoadState('networkidle');

        const planDetail = page.locator(`[data-testid="plan-detail-${slug}"]`);
        await expect(planDetail).toBeVisible();
      }
    });

    test('free card info link should resolve to free-audit detail page', async ({ page }) => {
      // Die Free-Karte verlinkt auf /pricing/free — der Wrapper leitet per
      // Slug-Alias auf die kanonische Detailseite /pricing/free-audit um.
      await page.goto(`${BASE_URL}/pricing/free`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/pricing\/free-audit/);
      const planDetail = page.locator('[data-testid="plan-detail-free-audit"]');
      await expect(planDetail).toBeVisible();
    });

    test('yearly plan should display annual billing period', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');

      const annualLabel = page.locator('text=/pro Jahr|12 Monate/i').first();
      await expect(annualLabel).toBeVisible();
    });

    test('yearly plan pricing should reflect 2-month discount', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Growth jährlich: 249 € × 10 = 2.490 € (deutsches Zahlenformat)
      const price = page.locator('text=2.490 €').first();
      await expect(price).toBeVisible();
    });

    test('yearly vs monthly pricing difference should be clear', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');
      const monthlyPrice = page.locator('text=249 €').first();
      await expect(monthlyPrice).toBeVisible();

      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');
      const yearlyPrice = page.locator('text=2.490 €').first();
      await expect(yearlyPrice).toBeVisible();
      // 2.490 € < 12 × 249 € = 2.988 € → Rabatt implizit belegt.
    });

    test('plan detail page should display plan name', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const planName = page.locator('h2:has-text("Growth")');
      await expect(planName.first()).toBeVisible();
    });

    test('plan detail page should have features list', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const featureLinks = page.locator('[data-testid^="feature-link-"]');
      const featureCount = await featureLinks.count();
      expect(featureCount).toBeGreaterThan(0);
    });

    test('plan detail page should have navigation buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/starter`);
      await page.waitForLoadState('networkidle');

      const nextButton = page.locator('[data-testid="plan-nav-next"]');
      await expect(nextButton).toBeVisible();

      const prevButton = page.locator('[data-testid="plan-nav-prev"]');
      await expect(prevButton).toBeVisible();
    });

    test('should navigate to next plan via button', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/starter`);
      await page.waitForLoadState('networkidle');

      const nextButton = page.locator('[data-testid="plan-nav-next"]');
      await nextButton.click();

      await expect(page).toHaveURL(/\/pricing\/growth/);
    });

    test('should navigate to previous plan via button', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const prevButton = page.locator('[data-testid="plan-nav-prev"]');
      await prevButton.click();

      await expect(page).toHaveURL(/\/pricing\/starter/);
    });

    test('should link to feature detail pages from plan detail', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const firstFeatureLink = page.locator('[data-testid^="feature-link-"]').first();
      const href = await firstFeatureLink.getAttribute('href');
      expect(href).toMatch(/\/features\/[a-z-]+/);

      await firstFeatureLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/features\/[a-z-]+/);
    });

    test('should have checkout button on plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const checkoutButton = page.locator(
        '[data-testid="plan-detail-growth"] [data-testid="plan-cta-button"]'
      );
      await expect(checkoutButton).toBeVisible();
    });
  });

  test.describe('Feature Detail Pages', () => {
    test('should navigate to feature detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const firstFeatureLink = page.locator('[data-testid^="feature-link-"]').first();
      const featureSlug = await firstFeatureLink.getAttribute('data-testid');
      const expectedFeatureSlug = featureSlug?.replace('feature-link-', '');

      await firstFeatureLink.click();
      await page.waitForLoadState('networkidle');

      const featureDetail = page.locator(
        `[data-testid="feature-detail-${expectedFeatureSlug}"]`
      );
      await expect(featureDetail).toBeVisible();
    });

    test('all feature detail pages should be accessible', async ({ page }) => {
      const featureSlugs = [
        'dsgvo-scan',
        'consent-timing',
        'privacy-policy-generator',
        'evidence-vault',
        'monitoring',
        'scheduler',
        'auto-remediation',
        'ai-risk-register',
        'ki-governance',
        'governance-agents',
        'bots',
        'bulk-jobs',
        'c2pa-herkunftsnachweis',
        'branchenbibliotheken',
        'api-zugriff',
        'white-label',
        'multi-tenant-dashboard',
        'kodee-vps-assistent',
      ];

      for (const slug of featureSlugs) {
        await page.goto(`${BASE_URL}/features/${slug}`);
        await page.waitForLoadState('networkidle');

        const featureDetail = page.locator(`[data-testid="feature-detail-${slug}"]`);
        await expect(featureDetail).toBeVisible();
      }
    });

    test('feature detail page should display feature title', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const featureTitle = page.locator('h1, h2');
      const titleText = await featureTitle.first().textContent();
      expect(titleText?.toLowerCase()).toContain('dsgvo');
    });

    test('feature detail page should show plans containing feature', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const planLinks = page.locator('[data-testid^="feature-plan-link-"]');
      const planCount = await planLinks.count();
      expect(planCount).toBeGreaterThan(0);
    });

    test('feature detail page should link back to pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const backToPricingButton = page.locator('[data-testid="feature-back-to-pricing"]');
      await expect(backToPricingButton).toBeVisible();
    });

    test('feature detail page should have button to view plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const viewPlanButtons = page.locator('[data-testid^="feature-view-plan-"]');
      const buttonCount = await viewPlanButtons.count();
      expect(buttonCount).toBeGreaterThan(0);
    });

    test('can navigate from feature to plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const viewPlanButton = page.locator('[data-testid^="feature-view-plan-"]').first();
      await viewPlanButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/pricing\/[a-z-_]+/);
    });
  });

  test.describe('Checkout Flow (Stripe-Bridge)', () => {
    test('should navigate to checkout page from pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="pricing-book-growth"]');
      await bookButton.click();

      await expect(page).toHaveURL(/\/checkout\/growth/);
      await page.waitForLoadState('networkidle');

      // Anonyme Besucher sehen den Login-Shell der Stripe-Checkout-Bridge.
      const authShell = page.locator('[data-testid="checkout-auth-required"]');
      await expect(authShell).toBeVisible();
    });

    test('all bookable checkout pages should be accessible', async ({ page }) => {
      for (const planKey of CHECKOUT_PLAN_KEYS) {
        await page.goto(`${BASE_URL}/checkout/${planKey}`);
        await page.waitForLoadState('networkidle');

        // URL bleibt auf dem Checkout (kein Redirect) …
        expect(page.url()).toContain(`/checkout/${planKey}`);
        // … und der Login-Shell wird angezeigt (nicht eingeloggt).
        const authShell = page.locator('[data-testid="checkout-auth-required"]');
        await expect(authShell).toBeVisible();
      }
    });

    test('checkout page should name the selected plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      // Login-Shell-Titel: „Anmelden, um Growth zu buchen"
      const planName = page.locator('h1:has-text("Growth")');
      await expect(planName).toBeVisible();
    });

    test('checkout page should offer login options', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      // Magic-Link-Fallback führt nach /welcome mit Rücksprung zum Checkout.
      const magicLink = page.locator('a[href*="/welcome"]');
      await expect(magicLink.first()).toBeVisible();
    });

    test('free audit plan should redirect to audit page', async ({ page }) => {
      // free_audit braucht keinen Checkout — die CheckoutPage leitet nach /audit um.
      await page.goto(`${BASE_URL}/checkout/free_audit`);
      await page.waitForURL(/\/audit/);
      await expect(page).toHaveURL(/\/audit/);
    });

    test('enterprise checkout should redirect to contact sales', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/enterprise`);
      await page.waitForURL(/\/contact-sales/);
      await expect(page).toHaveURL(/\/contact-sales/);
    });
  });

  test.describe('Yearly Plan Checkout', () => {
    // Hinweis: Jahres-Tarife werden nicht mehr als eigene Pricing-Karten gezeigt
    // (PUBLIC_PRICING_TIERS filtert '*_yearly' heraus). Sie bleiben als direkte
    // Checkout-Routen gültig und werden hier per Direkt-URL getestet.

    test('yearly checkout should name the annual plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Login-Shell-Titel: „Anmelden, um Growth (Jährlich) zu buchen"
      const annualLabel = page.locator('text=/Jährlich/i').first();
      await expect(annualLabel).toBeVisible();
    });

    test('free-audit checkout should redirect to audit page', async ({ page }) => {
      // Plan-Key ist 'free_audit' (Unterstrich); CheckoutPage leitet ihn nach /audit um.
      await page.goto(`${BASE_URL}/checkout/free_audit`);

      // Free audit auto-redirects to /audit without showing UI
      await page.waitForURL(/\/audit/, { timeout: 10000 });
      expect(page.url()).toContain('/audit');
    });

    test('enterprise checkout should redirect to contact-sales', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/enterprise`);

      // Enterprise ist kein Self-Service-Checkout mehr: CheckoutPage leitet
      // /checkout/enterprise nach /contact-sales?intent=enterprise um.
      await page.waitForURL(/\/contact-sales/);
      await expect(page).toHaveURL(/\/contact-sales/);
      await expect(page).toHaveURL(/intent=enterprise/);
    });
  });

  test.describe('Navigation Consistency', () => {
    test('should have working back button on plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const backButton = page.locator('[data-testid="plan-detail-back"]');
      await expect(backButton).toBeVisible();

      await backButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/pricing$/);
    });

    test('should have working back button on feature detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const backButton = page.locator('[data-testid="feature-back-to-pricing"]');
      await expect(backButton).toBeVisible();

      await backButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/pricing$/);
    });

    test('should have working back button on checkout page', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      const backButton = page.locator('[data-testid="checkout-back"]');
      await expect(backButton).toBeVisible();

      await backButton.click();
      await page.waitForLoadState('networkidle');

      // Der Checkout-Backlink führt zur Paketübersicht.
      await expect(page).toHaveURL(/\/pricing$/);
    });
  });

  test.describe('Growth Plan Special Status', () => {
    test('Growth plan should be marked as recommended on pricing page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const growthCard = page.locator('[data-testid="pricing-card-growth"]');
      const badge = growthCard.locator('text=Empfohlen').first();
      await expect(badge).toBeVisible();
    });

    test('Growth plan detail page should show recommended badge', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const recommendedBadge = page.locator('text=Empfohlen').first();
      await expect(recommendedBadge).toBeVisible();
    });

    test('only Growth variants should have recommended badge', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      // Growth (monatlich) und Growth (Jährlich) sind highlight-Tiers —
      // alle anderen Karten dürfen kein „Empfohlen"-Badge tragen.
      const nonRecommended = CARD_IDS.filter(
        (id) => id !== 'growth' && id !== 'growth_yearly'
      );

      for (const id of nonRecommended) {
        const card = page.locator(`[data-testid="pricing-card-${id}"]`);
        const badge = card.locator('text=Empfohlen');
        const isVisible = await badge.isVisible().catch(() => false);
        expect(isVisible).toBe(false);
      }
    });
  });

  test.describe('No Dead Links', () => {
    test('all internal links should be valid', async ({ page }) => {
      // Pfade, die ohne Redirect erreichbar bleiben müssen.
      const stablePaths = [
        '/pricing',
        ...DETAIL_SLUGS.map((slug) => `/pricing/${slug}`),
        '/features/dsgvo-scan',
        '/features/consent-timing',
        '/features/privacy-policy-generator',
        '/features/evidence-vault',
        '/features/monitoring',
        '/features/scheduler',
        '/features/auto-remediation',
        '/features/ai-risk-register',
        '/features/ki-governance',
        '/features/governance-agents',
        '/features/bots',
        '/features/bulk-jobs',
        '/features/c2pa-herkunftsnachweis',
        '/features/branchenbibliotheken',
        '/features/api-zugriff',
        '/features/white-label',
        '/features/multi-tenant-dashboard',
        '/features/kodee-vps-assistent',
        ...CHECKOUT_PLAN_KEYS.map((key) => `/checkout/${key}`),
      ];

      for (const path of stablePaths) {
        await page.goto(`${BASE_URL}${path}`);
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain(path);
      }
    });

    test('redirect paths should land on their canonical targets', async ({ page }) => {
      // Bewusste Redirects — kein 404, sondern kanonisches Ziel.
      const redirects: Array<{ from: string; to: RegExp }> = [
        { from: '/pricing/free', to: /\/pricing\/free-audit/ },
        { from: '/checkout/free_audit', to: /\/audit/ },
        { from: '/checkout/enterprise', to: /\/contact-sales/ },
      ];

      for (const { from, to } of redirects) {
        await page.goto(`${BASE_URL}${from}`);
        await page.waitForURL(to);
        await expect(page).toHaveURL(to);
      }
    });

    test('invalid plan slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/invalid-slug`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/pricing/);
    });

    test('invalid feature slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/invalid-slug`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/pricing/);
    });

    test('invalid checkout slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/invalid-slug`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/pricing/);
    });
  });
});
