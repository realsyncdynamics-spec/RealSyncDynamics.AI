import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — minimal smoke-E2E setup.
 *
 * Run locally:
 *   npx playwright install chromium    one-time browser binary install
 *   npm run dev                        in one terminal
 *   npm run e2e                        in another terminal
 *
 * Not wired into CI yet — Playwright in GH Actions needs the playwright
 * docker image or a setup-step (~30 s) to install browsers, which is
 * disproportionate to the single smoke spec right now. Promote to CI once
 * the spec count justifies it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
