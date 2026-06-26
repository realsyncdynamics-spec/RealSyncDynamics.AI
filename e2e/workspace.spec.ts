import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für /app — Governance OS Browser Shell.
 *
 * Volle Coverage (Status-Kacheln mit echten Counts) braucht eine Supabase-
 * Session — out of scope für die Smoke-Spec. Hier: stabiler Kontrakt.
 *   - /app rendert die Governance-OS-Shell (Auth-Guards liegen in den View-
 *     Komponenten selbst, nicht mehr auf Route-Ebene).
 */
test.describe('/app (Workspace-Home)', () => {
  test('rendert Governance-OS-Shell ohne Crash', async ({ page }) => {
    await page.goto('/app');
    // Die Tabs-Navigation ist immer sichtbar — unabhängig von Auth-Status.
    await expect(page.getByText(/Übersicht|Workspace|Websites/i).first()).toBeVisible();
    // Kein "Page not found" / Fehler-Overlay.
    await expect(page.getByText(/Page not found/i)).toHaveCount(0);
  });

  test('kanonische /app/*-Routen zeigen Shell (kein leerer 404)', async ({ page }) => {
    for (const path of ['/app/compliance', '/app/evidence', '/app/risks', '/app/monitoring']) {
      await page.goto(path);
      // URL bleibt unter /app (kein Redirect auf 404-Seite).
      await expect(page).toHaveURL(new RegExp(path));
      // Kein "Page not found".
      await expect(page.getByText(/Page not found/i)).toHaveCount(0);
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
