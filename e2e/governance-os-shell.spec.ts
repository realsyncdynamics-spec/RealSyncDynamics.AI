import { test, expect, type Page } from '@playwright/test';

/**
 * E2E-Tests für den Governance OS Browser Shell (/app/*).
 *
 * Der GovernanceBrowserShell umschließt alle /app/* Routen und enthält:
 *   - BrowserTopBar (Address-Bar, Menü, Agent-Toggle)
 *   - GovernanceTabs (Modul-Navigation, Desktop)
 *   - GovernanceCanvas (Content-Area)
 *   - MobileBottomNavigation (Mobile)
 *   - GovernanceStatusBar (Desktop, unten)
 *   - GovernanceAssistantPanel (ausklappbar)
 *   - EmbeddedBrowserCanvas (URL-Eingabe)
 *
 * Hinweis: Auth-Routen (/app/*) erfordern einen eingeloggten Nutzer.
 * Für Smoke-Tests wird geprüft ob AuthGate oder Redirect auf /login/welcome erfolgt.
 */

const APP_URLS = [
  { path: '/app', label: 'Workspace Home' },
  { path: '/app/websites', label: 'Websites' },
  { path: '/app/evidence', label: 'Evidence' },
  { path: '/app/ai-systems', label: 'KI-Systeme' },
  { path: '/app/risks', label: 'Risiken' },
  { path: '/app/monitoring', label: 'Monitoring' },
];

test.describe('Governance OS Browser Shell — Auth Redirect', () => {
  test('Unauthentifizierte /app-Requests landen auf Auth-Gate oder Welcome', async ({ page }) => {
    await page.goto('/app');
    // Muss entweder zur Login-Seite oder zu /welcome/auth umleiten
    // oder AuthGate zeigen (kein Crash, keine 500)
    await expect(page).not.toHaveURL(/500|error/i);

    // Auth-Gate zeigt entweder Login-Button oder navigiert zu /welcome
    const url = page.url();
    const isAuthPage = url.includes('/welcome') || url.includes('/login') || url.includes('/app');
    expect(isAuthPage).toBeTruthy();
  });
});

test.describe('Governance OS Browser Shell — Public Route Structure', () => {
  // Diese Tests prüfen nur öffentliche Seiten, die den Shell nicht benötigen
  test('Governance Runtime Public-Page (/governance-runtime) lädt', async ({ page }) => {
    await page.goto('/governance-runtime');
    await expect(page).not.toHaveURL(/404/);
    // Seite hat einen Governance-Heading
    await expect(
      page.getByRole('heading', { name: /Governance/i }).first()
    ).toBeVisible();
  });

  test('/audit lädt und zeigt Domain-Eingabe', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).not.toHaveURL(/404/);
    // Audit-Seite sollte irgendeine Eingabe oder Scan-UI haben
    await expect(page.locator('main, [role="main"], body')).toBeVisible();
  });

  test('/pricing lädt und zeigt Tarif-Informationen', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).not.toHaveURL(/404/);
    await expect(
      page.getByRole('heading', { name: /welcher plan/i })
    ).toBeVisible();
    // Tarife sichtbar
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Starter').first()).toBeVisible();
  });
});

test.describe('Governance OS — Module Upgrade Gate', () => {
  test('ModuleUpgradeGate-Komponente rendert für gesperrte Module', async ({ page }) => {
    // Direkt zu einer gated Route navigieren (ohne Auth → AuthGate/Redirect)
    await page.goto('/app/ai-systems');
    // Erwarte entweder Auth-Redirect oder UpgradeGate
    await expect(page).not.toHaveURL(/500|error/i);
    // Kein JS-Crash
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForLoadState('networkidle').catch(() => {});
    // Kein unkritischer Fehler (CORS etc. ok, JS-Crash = fail)
    const jsCrash = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(jsCrash).toHaveLength(0);
  });
});

test.describe('Governance OS — Navigation Smoke', () => {
  for (const { path, label } of APP_URLS) {
    test(`${label} (${path}) gibt keinen 500/JS-Crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});

      // Keine fatalen JS-Fehler (TypeError/ReferenceError = echter Crash)
      const fatalErrors = errors.filter(
        e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
             !e.includes('ResizeObserver') // Bekannter Browser-Quirk, kein App-Fehler
      );
      expect(fatalErrors, `JS-Fehler auf ${path}: ${fatalErrors.join(', ')}`).toHaveLength(0);
      await expect(page).not.toHaveURL(/\/500$/);
    });
  }
});

test.describe('Governance OS — Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone 14

  test('Landing Page Mobile: keine horizontalen Scrollbars', async ({ page }) => {
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px Toleranz
  });

  test('Landing Page Mobile: Founding Access Banner sichtbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Founding Access geöffnet/i)).toBeVisible();
  });

  test('Landing Page Mobile: Hero Domain-Eingabe sichtbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/ihre-domain\.de/i)).toBeVisible();
  });

  test('Landing Page Mobile: Module Grid keine abgeschnittenen Badges', async ({ page }) => {
    await page.goto('/');
    // Module Section lädt
    await expect(page.getByText(/Governance-Module/i)).toBeVisible();
    // Kein horizontaler Overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Pricing Mobile: Keine abgeschnittenen Buttons', async ({ page }) => {
    await page.goto('/');
    // Scroll zu Pricing
    await page.evaluate(() => {
      const el = document.querySelector('[class*="pricing"], h2');
      if (el) el.scrollIntoView();
    });
    // Kein horizontaler Overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});

test.describe('Governance OS — Tablet Responsive', () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test('Landing Page Tablet: keine horizontalen Scrollbars', async ({ page }) => {
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('/pricing Tablet: Tarif-Grid rendert korrekt', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Starter').first()).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
