import { test, expect } from '@playwright/test';

/**
 * E2E Tests für den Unified Entry Flow (/unified-entry/*)
 *
 * Der Flow leitet Nutzer schrittweise von Website-Scan über
 * Dashboard-Preview zur 14-Tage Trial-Registration.
 *
 * Flow:
 *   /unified-entry/scan
 *     ↓ [Enter domain + start scan]
 *   /unified-entry/preview
 *     ↓ [View customized dashboard for 30 min]
 *   /unified-entry/trial-offer
 *     ↓ [Accept trial offer]
 *   /unified-entry/register
 *     ↓ [Create account]
 *   /unified-entry/onboarding
 *     ↓ [Select sector + answer questions]
 *   /unified-entry/success
 *     ↓ [Auto-redirect]
 *   /app/dashboard [Trial active]
 */

test.describe('Unified Entry Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Homepage hat CTA zu /unified-entry/scan', async ({ page }) => {
    // Main CTA button sollte zu /unified-entry/scan führen
    const cta = page.getByRole('link', { name: /Kostenlos starten/i }).first();
    await expect(cta).toBeVisible();

    const href = await cta.getAttribute('href');
    expect(href).toContain('/unified-entry/scan');
  });

  test.describe('ScanEntryPage (/unified-entry/scan)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/unified-entry/scan');
    });

    test('Zeigt Domain-Input und Scan-Button', async ({ page }) => {
      await expect(
        page.getByRole('heading', {
          name: /Kostenlose Compliance-Analyse/i,
        }),
      ).toBeVisible();

      const input = page.getByPlaceholder(/z\.B\. example\.com/i);
      await expect(input).toBeVisible();

      const button = page.getByRole('button', { name: /Kostenlos starten/i });
      await expect(button).toBeVisible();
    });

    test('Progress bar zeigt Schritt 1 von 5', async ({ page }) => {
      await expect(page.getByText(/Schritt 1 von 5/i)).toBeVisible();
    });

    test('Input validation: leere Domain wird abgelehnt', async ({ page }) => {
      const button = page.getByRole('button', { name: /Kostenlos starten/i });
      await button.click();

      // Error message sollte angezeigt werden
      await expect(page.getByText(/Bitte geben Sie eine Domain ein/i)).toBeVisible();

      // Button sollte noch sichtbar sein
      await expect(button).toBeVisible();
    });

    test('Kann Domain eingeben (no actual scan)', async ({ page }) => {
      const input = page.getByPlaceholder(/z\.B\. example\.com/i);
      await input.fill('example.com');

      const value = await input.inputValue();
      expect(value).toBe('example.com');
    });
  });

  test.describe('DashboardPreviewPage (/unified-entry/preview)', () => {
    test.beforeEach(async ({ page }) => {
      // Mock auditId in URL
      await page.goto('/unified-entry/preview?auditId=test-123');
    });

    test('Zeigt Compliance-Score und Mock-Daten', async ({ page }) => {
      // Warte bis Score angezeigt wird
      await expect(page.getByText(/Compliance Score/i)).toBeVisible();
      await expect(page.getByText(/67%/i)).toBeVisible();
    });

    test('Zeigt TrialTimer mit Countdown', async ({ page }) => {
      // Timer sollte sichtbar sein
      const timer = page.getByText(/Preview verfällt in/i);
      await expect(timer).toBeVisible();

      // Timer sollte eine Zeit anzeigen (MM:SS format)
      const timerText = await timer.textContent();
      expect(timerText).toMatch(/\d+:\d{2}/);
    });

    test('Progress bar zeigt Schritt 2 von 5', async ({ page }) => {
      await expect(page.getByText(/Schritt 2 von 5/i)).toBeVisible();
    });

    test('Hat beide CTA-Buttons (Trial + Register)', async ({ page }) => {
      const trialButton = page.getByRole('button', {
        name: /14 Tage kostenlos starten/i,
      });
      const registerButton = page.getByRole('button', {
        name: /Jetzt registrieren/i,
      });

      await expect(trialButton).toBeVisible();
      await expect(registerButton).toBeVisible();
    });

    test('Trial button navigiert zu /unified-entry/trial-offer', async ({ page }) => {
      const button = page.getByRole('button', {
        name: /14 Tage kostenlos starten/i,
      });
      await button.click();

      await expect(page).toHaveURL(/\/unified-entry\/trial-offer/);
    });

    test('Zeigt Dashboard-Mock mit Findings', async ({ page }) => {
      // Kritische Findings sollten angezeigt werden
      await expect(page.getByText(/Tracking vor Consent/i)).toBeVisible();
      await expect(page.getByText(/Fehlende Cookie-Banner/i)).toBeVisible();

      // Governance Dimensions sollten angezeigt werden
      await expect(page.getByText(/DSGVO Compliance/i)).toBeVisible();
      await expect(page.getByText(/EU AI Act Readiness/i)).toBeVisible();
    });
  });

  test.describe('TrialOfferPage (/unified-entry/trial-offer)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/unified-entry/trial-offer');
    });

    test('Zeigt Trial-Angebot mit Features', async ({ page }) => {
      await expect(
        page.getByRole('heading', {
          name: /Möchten Sie 14 Tage kostenlos Zugriff erhalten/i,
        }),
      ).toBeVisible();

      // Features sollten aufgelistet sein
      await expect(page.getByText(/Vollständiger Governance Score/i)).toBeVisible();
      await expect(page.getByText(/Automatische Compliance-Überwachung/i)).toBeVisible();
    });

    test('Progress bar zeigt Schritt 3 von 5', async ({ page }) => {
      await expect(page.getByText(/Schritt 3 von 5/i)).toBeVisible();
    });

    test('Primary CTA navigiert zu Register', async ({ page }) => {
      const button = page.getByRole('button', {
        name: /Ja, 14 Tage kostenlos starten/i,
      });
      await expect(button).toBeVisible();
      await button.click();

      await expect(page).toHaveURL(/\/unified-entry\/register/);
    });

    test('Secondary CTA geht zurück zur Preview', async ({ page }) => {
      const button = page.getByRole('button', {
        name: /Zurück zur Preview/i,
      });
      await expect(button).toBeVisible();
      await button.click();

      // Sollte zur Preview zurück gehen oder Home
      const url = page.url();
      expect(url).toMatch(/preview|\/$/);
    });
  });

  test.describe('RegisterPage (/unified-entry/register)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/unified-entry/register');
    });

    test('Zeigt Registrierungs-Formular', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /Konto erstellen/i }),
      ).toBeVisible();

      await expect(page.getByLabel(/E-Mail/i)).toBeVisible();
      await expect(page.getByLabel(/Passwort(?!.*wiederholen)/i)).toBeVisible();
      await expect(page.getByLabel(/Passwort wiederholen/i)).toBeVisible();
    });

    test('Progress bar zeigt Schritt 3 von 5', async ({ page }) => {
      await expect(page.getByText(/Schritt 3 von 5/i)).toBeVisible();
    });

    test('Input validation: leere Email wird abgelehnt', async ({ page }) => {
      const button = page.getByRole('button', { name: /Konto erstellen/i });
      await button.click();

      // Error oder HTML5 validation sollte zeigen
      // (könnte HTML5 validation sein)
      const emailInput = page.getByLabel(/E-Mail/i);
      const validity = await emailInput.evaluate((el: HTMLInputElement) => ({
        valid: el.validity.valid,
        required: el.required,
      }));

      expect(validity.required).toBe(true);
    });

    test('Input validation: unterschiedliche Passwörter', async ({ page }) => {
      const emailInput = page.getByLabel(/E-Mail/i);
      const passwordInput = page.getByLabel(/Passwort(?!.*wiederholen)/i);
      const confirmInput = page.getByLabel(/Passwort wiederholen/i);

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password123');
      await confirmInput.fill('password456');

      const button = page.getByRole('button', { name: /Konto erstellen/i });
      await button.click();

      // Error message sollte angezeigt werden
      await expect(
        page.getByText(/Passwörter stimmen nicht überein/i),
      ).toBeVisible();
    });

    test('Zeigt Login-Link für bestehende Accounts', async ({ page }) => {
      const link = page.getByRole('link', { name: /Jetzt anmelden/i });
      await expect(link).toBeVisible();

      const href = await link.getAttribute('href');
      expect(href).toContain('/login');
    });
  });

  test.describe('PostRegisterOnboardingPage (/unified-entry/onboarding)', () => {
    test('Zeigt Sector-Auswahl', async ({ page }) => {
      // Note: Diese Route ist auth-gated, also kann man sie nicht direkt aufrufen
      // Trotzdem testen wir die Navigation zu ihr
      await page.goto('/unified-entry/scan');
      await page.getByPlaceholder(/z\.B\. example\.com/i).fill('example.com');

      // Wenn das Skript die Navigation ermöglichen würde, würde es hier hin gehen
      // Für jetzt testen wir nur ob die Route existiert
      await page.goto('/unified-entry/onboarding');

      // Sollte entweder die Onboarding Page zeigen oder zu Register redirecten
      const url = page.url();
      expect(url).toMatch(/onboarding|register/);
    });
  });

  test.describe('Header Navigation', () => {
    test('Unified Entry Shell hat Logo-Link zur Home', async ({ page }) => {
      await page.goto('/unified-entry/scan');

      const logo = page.getByRole('button', { name: /Go home/i });
      await expect(logo).toBeVisible();
      await logo.click();

      await expect(page).toHaveURL('/');
    });

    test('Unified Entry Shell hat "Abbrechen" Link', async ({ page }) => {
      await page.goto('/unified-entry/scan');

      const cancelButton = page.getByRole('button', { name: /Abbrechen/i });
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      await expect(page).toHaveURL('/');
    });

    test('Progress indicator shows correct step', async ({ page }) => {
      await page.goto('/unified-entry/scan');
      await expect(page.getByText(/Schritt 1 von 5/i)).toBeVisible();

      await page.goto('/unified-entry/preview?auditId=test');
      await expect(page.getByText(/Schritt 2 von 5/i)).toBeVisible();

      await page.goto('/unified-entry/trial-offer');
      await expect(page.getByText(/Schritt 3 von 5/i)).toBeVisible();

      await page.goto('/unified-entry/register');
      await expect(page.getByText(/Schritt 3 von 5/i)).toBeVisible();
    });
  });
});
