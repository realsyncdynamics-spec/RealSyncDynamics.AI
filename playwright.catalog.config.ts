import { defineConfig, devices } from '@playwright/test';

const LOCAL_PREVIEW = 'http://127.0.0.1:4173';
const BASE_URL = process.env.TEST_BASE_URL ?? process.env.E2E_BASE_URL ?? LOCAL_PREVIEW;
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(BASE_URL);

const CI_LAUNCH_ARGS = [
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--mute-audio',
  '--disable-extensions',
  '--disable-background-networking',
];

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
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    launchOptions: { args: CI_LAUNCH_ARGS },
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
