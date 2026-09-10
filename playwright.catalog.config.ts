import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright-Config für die Testkatalog-Suite (tests/e2e/*).
 *
 * Öffentliche Routen, Navigation, Audit, AI-Act, Checkout, Consent, Rechtstexte.
 * Getrennt von der App-Suite (`./e2e`, `npm run e2e`).
 *
 * Default ist der lokale Preview-Port — nicht die Live-Domain. Live hat
 * Bot-Schutz und liefert dem Headless-Browser 403. Gegen Live/Staging:
 *   TEST_BASE_URL=https://staging.example npm run test:e2e
 *
 * CI: .github/workflows/e2e.yml setzt TEST_BASE_URL auf den Preview-Server.
 */
const LOCAL_PREVIEW = 'http://127.0.0.1:4173';
const BASE_URL = process.env.TEST_BASE_URL ?? process.env.E2E_BASE_URL ?? LOCAL_PREVIEW;
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(BASE_URL);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 3 : undefined,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: isLocalTarget
    ? {
        command: 'npx vite preview --port 4173 --host 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : undefined,
});
