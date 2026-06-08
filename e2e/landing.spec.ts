import { test, expect } from '@playwright/test';

/**
 * E2E-Tests für die Landing-Seite (/).
 *
 * Phase 2 (PR #531): `/` zeigt jetzt Landing.tsx mit:
 *   - FoundingAccessBanner
 *   - Hero mit Domain-Eingabe
 *   - ModuleVisibilitySection (8 Module)
 *   - RuntimeGovernanceFlowSection
 *   - EnhancedPricingTeaserSection
 *
 * CTA-Disziplin: ausschließlich Self-Service-Strings (runtimeVocab.CTA).
 * Keine Beratungs-/Pilot-/Demo-/Call-/Sales-Sprache.
 */

test.describe('Landing Page (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Founding Access Banner sichtbar', async ({ page }) => {
    await expect(page.getByText(/Founding Access geöffnet/i)).toBeVisible();
    await expect(page.getByText(/ersten 100 Unternehmen/i)).toBeVisible();

    // Beide CTAs im Banner
    await expect(
      page.getByRole('link', { name: /Kostenlosen Audit starten/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Founding Access sichern/i }).first()
    ).toBeVisible();
  });

  test('Hero zeigt Domain-Eingabefeld und Primär-CTA', async ({ page }) => {
    // Headline
    await expect(
      page.getByRole('heading', { name: /Prüfen Sie Ihre Website/i })
    ).toBeVisible();

    // Eingabefeld
    const input = page.getByPlaceholder(/ihre-domain\.de/i);
    await expect(input).toBeVisible();

    // Submit-Button
    await expect(
      page.getByRole('button', { name: /Kostenlos prüfen/i })
    ).toBeVisible();

    // Trust Signals
    await expect(page.getByText(/Kein Account erforderlich/i)).toBeVisible();
    await expect(page.getByText(/Kostenloser Erstcheck/i)).toBeVisible();
  });

  test('Hero Domain-Eingabe navigiert zum Audit', async ({ page }) => {
    const input = page.getByPlaceholder(/ihre-domain\.de/i);
    await input.fill('example.de');
    await page.getByRole('button', { name: /Kostenlos prüfen/i }).click();
    await expect(page).toHaveURL(/\/audit/);
    await expect(page.url()).toContain('domain=example.de');
  });

  test('Hero ohne Eingabe navigiert zu /audit', async ({ page }) => {
    await page.getByRole('button', { name: /Kostenlos prüfen/i }).click();
    await expect(page).toHaveURL(/\/audit/);
  });

  test('Module Visibility Section zeigt 8 Module mit Status-Badges', async ({ page }) => {
    // Section-Heading
    await expect(
      page.getByRole('heading', { name: /Governance-Module/i })
    ).toBeVisible();

    // Mindestens 3 Module sichtbar
    const liveModules = ['Website Governance', 'Evidence Vault'];
    for (const mod of liveModules) {
      await expect(page.getByText(mod)).toBeVisible();
    }

    // Beta-Module sichtbar
    await expect(page.getByText(/Runtime Monitoring/i)).toBeVisible();
    await expect(page.getByText(/KI-System Registry/i)).toBeVisible();

    // Roadmap-Module sichtbar
    await expect(page.getByText(/Auto Remediation/i)).toBeVisible();
  });

  test('Module Visibility Section enthält Status-Badge-Begriffe', async ({ page }) => {
    // Live-Badges
    await expect(page.getByText('Live').first()).toBeVisible();
    // Beta-Badges
    await expect(page.getByText('Beta').first()).toBeVisible();
    // Roadmap-Badges
    await expect(page.getByText('Roadmap').first()).toBeVisible();
  });

  test('Runtime Governance Flow Section sichtbar', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Governance-Runtime-Flow/i })
    ).toBeVisible();

    // 6 Schritte vorhanden
    for (const step of ['Website', 'Scan', 'Finding', 'Risk', 'Evidence', 'Report']) {
      await expect(page.getByText(step).first()).toBeVisible();
    }

    // Differenzierer-Abschnitt
    await expect(page.getByText(/Cookie-Consent-Tools/i)).toBeVisible();
    await expect(page.getByText(/RealSync Runtime/i).first()).toBeVisible();
  });

  test('Pricing Section zeigt 4 Tarife', async ({ page }) => {
    // Scroll zur Pricing-Sektion
    await page.getByRole('heading', { name: /Preise — self-service/i }).scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('heading', { name: /Preise — self-service/i })
    ).toBeVisible();

    // Tarife sichtbar
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Monitoring').first()).toBeVisible();
    await expect(page.getByText('Governance').first()).toBeVisible();
    await expect(page.getByText('Agency').first()).toBeVisible();

    // Preise sichtbar
    await expect(page.getByText('€0').first()).toBeVisible();
    await expect(page.getByText(/ab €79/i).first()).toBeVisible();
  });

  test('Pricing Governance-Tier als "Most Popular" markiert', async ({ page }) => {
    await expect(page.getByText(/Most Popular/i)).toBeVisible();
  });

  test('Final CTA mit 3 Buttons sichtbar', async ({ page }) => {
    await page.getByRole('heading', { name: /Starten Sie noch heute/i }).scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('heading', { name: /Starten Sie noch heute/i })
    ).toBeVisible();

    // Keine Kreditkarte Trust-Signal
    await expect(page.getByText(/Keine Kreditkarte erforderlich/i)).toBeVisible();
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs auf der Seite', async ({ page }) => {
    const forbidden = [
      /Pilot anfragen/i,
      /Demo anfragen/i,
      /Demo buchen/i,
      /Gespräch buchen/i,
      /Call buchen/i,
      /Beratung anfragen/i,
      /Sales kontaktieren/i,
      /Vertrieb kontaktieren/i,
    ];
    for (const pattern of forbidden) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });

  test('Footer Links (Impressum, Datenschutz) erreichbar', async ({ page }) => {
    await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
  });
});

/**
 * Fallback: /landing und /preview sind weiterhin erreichbar.
 */
test('/landing alias gibt 200 zurück', async ({ page }) => {
  await page.goto('/landing');
  await expect(page).not.toHaveURL(/404/);
  // Hero-Eingabe auch auf /landing sichtbar
  await expect(
    page.getByPlaceholder(/ihre-domain\.de/i)
  ).toBeVisible();
});
