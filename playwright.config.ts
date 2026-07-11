import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — E2E test suite for Demo Auth + Dashboard
 *
 * Run locally:
 *   npx playwright install chromium    one-time browser binary install
 *   npm run dev                        in one terminal
 *   npm run e2e                        in another terminal
 *
 * CI/CD:
 *   Runs on GitHub Actions via .github/workflows/e2e-tests.yml
 *   Tests include:
 *   - Demo Auth Flow (login/logout)
 *   - Dashboard Load (widgets, metrics)
 *   - Landing Page CTAs
 *   - Session Persistence
 *   - Protected Routes
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Inspector-panel tests require an authenticated session with real data —
  // they cannot run against the unauthenticated preview server in CI.
  testIgnore: process.env.CI ? ['**/governance/inspector-panel.spec.ts'] : [],
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: { timeout: process.env.CI ? 20_000 : 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: process.env.TEST_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: process.env.CI ? 15_000 : 0,
    navigationTimeout: process.env.CI ? 30_000 : 0,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use pre-installed Chromium in CI environment (/opt/pw-browsers/)
        ...(process.env.CI && {
          launchArgs: ['--disable-dev-shm-usage', '--disable-gpu'],
        }),
      },
    },
  ],
});
