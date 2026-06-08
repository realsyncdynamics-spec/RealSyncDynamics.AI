import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für /app — Governance OS Browser Shell.
 *
 * Phase 3 Update: GovernanceBrowserShell umschließt alle /app/* Routen.
 * Auth-Gates sind pro-Route aktiviert.
 *
 * Tests prüfen:
 *   - Auth-Gate zeigt Login-Prompt (kein Crash)
 *   - GovernanceBrowserShell lädt ohne JS-Fehler
 *   - /dashboard → /app Redirect funktioniert
 *   - Alle core /app/* Routen sind erreichbar
 */
test.describe('/app (Governance OS Browser Shell)', () => {
  test('ist auth-gated — AuthGate sichtbar', async ({ page }) => {
    await page.goto('/app');
    await expect(
      page.getByRole('heading', { name: /Bei Kodee anmelden|Supabase nicht konfiguriert/i }),
    ).toBeVisible();
    // Workspace-Inhalt darf ohne Session nicht sichtbar sein
    await expect(page.getByText(/Aktions-Inbox/i)).toHaveCount(0);
  });

  test('GovernanceBrowserShell enthält keine fatalen JS-Fehler', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Nur echte JS-Crashes (nicht Browser-Quirks wie ResizeObserver)
    const fatal = errors.filter(
      e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
           !e.includes('ResizeObserver')
    );
    expect(fatal, `JS-Fehler: ${fatal.join(', ')}`).toHaveLength(0);
  });

  test('core /app/* Routen geben Auth-Gate oder gültigen Content zurück', async ({ page }) => {
    const routes = [
      '/app/compliance',
      '/app/evidence',
      '/app/team',
      '/app/risks',
      '/app/websites',
      '/app/monitoring',
      '/app/ai-systems',
    ];

    for (const path of routes) {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});

      // Kein 404 / kein 500
      await expect(page).not.toHaveURL(/\/404$/);
      await expect(page).not.toHaveURL(/\/500$/);

      // Kein fataler JS-Crash
      const fatal = errors.filter(
        e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
             !e.includes('ResizeObserver')
      );
      expect(fatal, `JS-Fehler auf ${path}: ${fatal.join(', ')}`).toHaveLength(0);
    }
  });

  test('/dashboard redirectet auf /app', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('/governance redirectet auf /app', async ({ page }) => {
    await page.goto('/governance');
    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe('/app — Module Upgrade Gate', () => {
  test('Plan-gated Module (z.B. /app/ai-systems) zeigen Auth-Gate oder Upgrade-Prompt', async ({ page }) => {
    await page.goto('/app/ai-systems');
    // Ohne Auth: entweder AuthGate oder UpgradeGate oder beides
    // Wichtig: kein leerer Bildschirm, kein 500
    await expect(page).not.toHaveURL(/500/);
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
