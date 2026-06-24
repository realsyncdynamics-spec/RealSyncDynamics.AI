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
  // Inspector-panel tests require an authenticated session with real data —
  // they cannot run against the unauthenticated preview server in CI.
  testIgnore: process.env.CI ? ['**/governance/inspector-panel.spec.ts'] : [],
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Erzwingt den leichten SVG-Fallback statt WebGL (EarthScene/Three.js auf /)
    // und friert Animationen ein: deterministisch + kein GPU/CPU-Spike im
    // headless CI-Container (sonst flaky 15s-Timeouts → 10-Min-Job-Abbruch).
    reducedMotion: 'reduce',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: process.env.CI ? 15_000 : 0,
    navigationTimeout: process.env.CI ? 30_000 : 0,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
