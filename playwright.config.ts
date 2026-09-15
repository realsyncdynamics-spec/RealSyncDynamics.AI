import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — App-interne Suite unter ./e2e
 *
 * Lokal:
 *   npx playwright install chromium
 *   npm run build && npx vite preview --port 4173
 *   npm run e2e
 *
 * CI läuft über die Katalog-Suite (`npm run test:e2e`, playwright.catalog.config.ts).
 * Diese Datei bleibt für `npm run e2e` und lokale App-Pfade.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  testIgnore: process.env.CI ? ['**/governance/inspector-panel.spec.ts'] : [],
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: process.env.CI ? 45_000 : 30_000,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: process.env.CI ? 12_000 : 0,
    navigationTimeout: process.env.CI ? 20_000 : 0,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI && {
          launchArgs: ['--disable-dev-shm-usage', '--disable-gpu'],
        }),
      },
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
