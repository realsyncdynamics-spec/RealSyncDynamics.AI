import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für /app — das kanonische Governance-OS Status-Home.
 *
 * Volle Coverage (Status-Kacheln mit echten Counts) braucht eine Supabase-
 * Session — out of scope für die Smoke-Spec. Hier: stabiler Kontrakt.
 *   - /app ist auth-gated: ohne Session erscheint der AuthGate, nicht das
 *     Workspace-Dashboard.
 */
test.describe('/app (Workspace-Home)', () => {
  test('ist auth-gated', async ({ page }) => {
    await page.goto('/app');
    await expect(
      page.getByRole('heading', { name: /Bei Kodee anmelden|Supabase nicht konfiguriert/i }),
    ).toBeVisible();
    // Workspace-Inhalt darf ohne Session nicht sichtbar sein.
    await expect(page.getByText(/Aktions-Inbox/i)).toHaveCount(0);
  });
});
