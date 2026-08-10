/**
 * E2E — Memory Governance (RFC-003)
 *
 * Prüft, was ohne Anmeldung deterministisch prüfbar ist:
 *   1. Die Route /app/governance/memory ist registriert und liefert die SPA
 *      aus (ein vergessener Route-Eintrag zeigt sonst eine leere Seite).
 *   2. Sie ist auth-gated — ohne Session erscheint der AuthGate, niemals
 *      Memory-Inhalte. Memory enthält personenbezogene Daten (subject_ref);
 *      eine versehentlich öffentliche Route wäre ein DSGVO-Vorfall.
 *
 * Der eingeloggte Zustand braucht Testnutzer und Tenant-Daten und ist hier
 * bewusst nicht abgedeckt — ein Test, der ohne Credentials zwangsläufig
 * fehlschlägt, hätte keinen Aussagewert.
 */

import { test, expect } from '@playwright/test';

const MEMORY_ROUTE = '/app/governance/memory';

test.describe('Memory Governance — Route & Zugriffsschutz', () => {
  test('Route liefert die SPA aus (kein 404, kein leeres Dokument)', async ({ page }) => {
    const response = await page.goto(MEMORY_ROUTE);

    expect(response?.status(), 'SPA-Fallback muss 200 liefern').toBe(200);
    // #root wird von Vite ausgeliefert; ein fehlender Mount deutet auf einen
    // Build- oder Routing-Fehler hin.
    await expect(page.locator('#root')).toBeAttached();
  });

  test('ohne Session erscheint der AuthGate, keine Memory-Inhalte', async ({ page }) => {
    await page.goto(MEMORY_ROUTE);

    // Bewusst eng gefasst: Nur Text, den ausschließlich der AuthGate rendert.
    // Ein breiterer Locator (z. B. /Login|E-Mail/) trifft auch das
    // Cookie-Banner und bliebe grün, selbst wenn die Route ungeschützt wäre.
    const authGate = page.getByRole('button', { name: /Magic Link senden/i })
      .or(page.getByText('Supabase nicht konfiguriert'));
    await expect(authGate.first()).toBeVisible({ timeout: 15_000 });

    // Gegenprobe: Weder Kopfzeile noch Inhaltsmarker der Ansicht dürfen ohne
    // Session erscheinen. "Kühlt ab" und "Frische" rendert ausschließlich die
    // Memory-Tabelle — tauchen sie auf, sind echte Daten durchgesickert.
    await expect(page.getByText('Memory Governance', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Kühlt ab|Frische/)).toHaveCount(0);
  });

  test('kein unbehandelter Seitenfehler beim Laden', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(MEMORY_ROUTE);
    await page.waitForLoadState('networkidle');

    expect(pageErrors, `Unbehandelte Fehler: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });
});
