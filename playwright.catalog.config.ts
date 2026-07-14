import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright-Config für die Testkatalog-Suite (tests/e2e/*).
 *
 * Diese Suite prüft öffentliche Routen, Navigation, Audit, AI-Act, Checkout,
 * Consent und Rechtstexte gegen eine deploybare Ziel-URL (Default: Live).
 * Sie ist bewusst von der App-internen Demo-/Dashboard-Suite (./e2e, via
 * `npm run e2e`) getrennt: andere Ziel-URL, andere ENV-Konvention.
 *
 * Ziel-URL überschreiben:
 *   TEST_BASE_URL=http://localhost:3000 npm run test:e2e   # lokal
 *   TEST_BASE_URL=https://staging.example npm run test:e2e # Staging
 *
 * CI: .github/workflows/e2e.yml (setzt TEST_BASE_URL + STRIPE_TEST_MODE).
 */
const BASE_URL = process.env.TEST_BASE_URL ?? 'https://realsyncdynamicsai.de';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
