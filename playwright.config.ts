import { defineConfig, devices } from '@playwright/test';
import { AUTH_STATE_PATH } from './e2e/auth-state';

/**
 * Playwright config — App-Suite (./e2e)
 *
 * Zwei Projekte, getrennt nach Auth-Bedarf:
 *
 *   chromium       öffentliche Flächen — laufen ohne Anmeldung
 *   chromium-auth  alles hinter `/app/*` — braucht eine Supabase-Session,
 *                  die `setup` (e2e/auth.setup.ts) einmalig beschafft
 *
 * Die `/app/*`-Specs prüfen Flächen hinter `AppGate`
 * (`src/features/auth/AppGate.tsx`). Ohne Session leitet der Guard auf
 * `/welcome?next=…` um — die Specs warteten dann auf Elemente, die auf der
 * Zielseite nicht existieren können, und meldeten Timeouts, die wie
 * Produktfehler aussehen. Deshalb laufen sie ausschließlich im Projekt
 * `chromium-auth`, und dieses existiert nur mit hinterlegten Zugangsdaten.
 *
 * Lokal:
 *   npx playwright install chromium        einmalig
 *   npm run dev                            in einem Terminal
 *   npm run e2e                            in einem zweiten
 *
 * Mit Auth-Suite zusätzlich:
 *   E2E_TEST_EMAIL=… E2E_TEST_PASSWORD=… npm run e2e
 *
 * Die Katalog-Suite (`tests/e2e`, öffentliche Routen gegen eine deploybare
 * Ziel-URL) ist bewusst getrennt: `playwright.catalog.config.ts`,
 * `npm run test:e2e`. Nur diese läuft heute in CI (.github/workflows/e2e.yml).
 */

/**
 * Specs hinter `/app/*`. Sie laufen nur mit Session.
 *
 * Bewusst als explizite Liste statt als Glob: Der Auth-Bedarf steckt im
 * Inhalt der Datei, nicht im Dateinamen. Eine neue Spec, die `/app/*`
 * ansteuert, gehört hier ergänzt — sonst läuft sie unangemeldet und meldet
 * denselben irreführenden Timeout wie früher die ganze Suite.
 */
const AUTH_SPECS = [
  '**/api-rate-limiting-analytics.spec.ts',
  '**/api-webhook-management.spec.ts',
  '**/evidence-vault-export.spec.ts',
  '**/governance-evidence.spec.ts',
  '**/governance/inspector-panel.spec.ts',
  '**/phase2-week3-free-tier.spec.ts',
  '**/phase3-advanced-governance.spec.ts',
  '**/provenance-external-verification.spec.ts',
  '**/seo-dashboard-compliance.spec.ts',
  '**/seo-marketing-dashboard.spec.ts',
  '**/workspace.spec.ts',
];

/**
 * Ohne Testkonto gibt es keine Session — dann wird das Projekt `chromium-auth`
 * gar nicht erst gebildet. Das Setup läuft trotzdem und meldet sich als
 * übersprungen, damit der Grund im Report sichtbar bleibt statt still zu sein.
 */
const HAS_E2E_CREDENTIALS = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

const chromiumLaunch = {
  ...devices['Desktop Chrome'],
  // Vorinstalliertes Chromium in CI (/opt/pw-browsers/)
  ...(process.env.CI && {
    launchArgs: ['--disable-dev-shm-usage', '--disable-gpu'],
  }),
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
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
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: chromiumLaunch,
    },
    {
      name: 'chromium',
      testIgnore: [...AUTH_SPECS, '**/auth.setup.ts'],
      use: chromiumLaunch,
    },
    ...(HAS_E2E_CREDENTIALS
      ? [
          {
            name: 'chromium-auth',
            testMatch: AUTH_SPECS,
            dependencies: ['setup'],
            use: { ...chromiumLaunch, storageState: AUTH_STATE_PATH },
          },
        ]
      : []),
  ],
});
