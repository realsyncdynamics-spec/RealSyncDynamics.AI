/**
 * E2E — Agent Command Center (M1)
 *
 * Deterministisch ohne Anmeldung prüfbar:
 *   1. /app/command-center ist registriert und liefert die SPA aus.
 *   2. Die Route ist auth-gated — ohne Session erscheint der AuthGate,
 *      niemals Agentenkarten oder die Decision Inbox.
 *
 * Der eingeloggte Zustand (UNBEKANNT-Status, Decision-Inbox-Platzhalter,
 * Suche/Filter, mobile Navigation, axe) ist in
 * test/command-center/CommandCenterView.test.tsx abgedeckt. Ein
 * eingeloggter E2E braucht Testnutzer + Tenant und fehlt hier bewusst.
 */
import { test, expect } from '@playwright/test';

const ROUTE = '/app/command-center';

test.describe('Agent Command Center — Route & Zugriffsschutz', () => {
  test('Route liefert die SPA aus', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).toBeAttached();
  });

  test('ohne Session: AuthGate, keine Agentenkarten, keine Decision Inbox', async ({ page }) => {
    await page.goto(ROUTE);
    const authGate = page.getByRole('button', { name: /Magic.?Link senden/i })
      .or(page.getByText('Supabase nicht konfiguriert'));
    await expect(authGate.first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('agent-card')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Decision Inbox' })).toHaveCount(0);
  });

  test('mobil (375px): AuthGate statt Inhalten', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ROUTE);
    const authGate = page.getByRole('button', { name: /Magic.?Link senden/i })
      .or(page.getByText('Supabase nicht konfiguriert'));
    await expect(authGate.first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('agent-card')).toHaveCount(0);
  });
});
