import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für /settings/team — die P0b Tenant-Admin-Konsole.
 *
 * Volle Coverage (Mitglieder laden, Rolle ändern, entfernen) braucht einen
 * echten Supabase-Test-Tenant mit Session — out of scope für die Smoke-Spec.
 * Hier prüfen wir den stabilen Kontrakt:
 *
 *   - Route ist auth-gated: ohne Session erscheint der AuthGate
 *     ("Bei Kodee anmelden" / Magic-Link), NICHT die Konsole.
 *
 * Catcht Regressionen, falls die Konsole versehentlich ohne AuthGate
 * gemountet wird (Schreibaktionen würden sonst ungeschützt rendern).
 */
test.describe('/settings/team', () => {
  test('ist auth-gated (kein ungeschützter Zugriff)', async ({ page }) => {
    await page.goto('/settings/team');

    // AuthGate-Login-Karte muss erscheinen (Magic-Link-Einstieg).
    await expect(
      page.getByRole('heading', { name: /Bei Kodee anmelden|Supabase nicht konfiguriert/i }),
    ).toBeVisible();

    // Schreib-Steuerelemente der Konsole dürfen ohne Session NICHT sichtbar sein.
    await expect(page.getByRole('button', { name: /^Entfernen$/i })).toHaveCount(0);
  });
});
