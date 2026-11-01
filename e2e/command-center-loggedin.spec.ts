/**
 * E2E — Command Center eingeloggt (M9 Abnahme).
 *
 * Läuft NUR, wenn eine vorbereitete Session vorliegt:
 *   E2E_CC_STORAGE_STATE=<Pfad zu Playwright storageState.json eines Testnutzers mit Tenant>
 * Ohne diese Variable wird die Suite übersprungen (ehrliche Lücke, kein Scheinbestehen).
 * Rein lesend: klickt keine Freigabe-, Aktivierungs- oder Verschiebe-Aktion aus.
 */
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const STATE = process.env.E2E_CC_STORAGE_STATE;
const ready = Boolean(STATE && existsSync(STATE));

test.describe('Command Center — eingeloggt (lesend)', () => {
  test.skip(!ready, 'E2E_CC_STORAGE_STATE fehlt — eingeloggter E2E nicht ausführbar');
  test.use({ storageState: STATE });

  test('Agentenübersicht, Inbox und alle Bereiche erreichbar', async ({ page }) => {
    await page.goto('/app/command-center');
    await expect(page.getByRole('heading', { level: 1, name: 'Agentenübersicht' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('complementary', { name: 'Decision Inbox' })).toBeVisible();
    for (const [btn, heading] of [['Aufgaben', 'Aufgaben'], ['Gedächtnis', /Gedächtnis/], ['Routinen', 'Routinen'], ['Kosten & Monitoring', /Kosten/]] as const) {
      await page.getByRole('button', { name: btn, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('Freigabe-Buttons ohne Bestätigung gesperrt', async ({ page }) => {
    await page.goto('/app/command-center');
    const take = page.getByRole('button', { name: 'Vorschlag übernehmen' });
    if (await take.count() === 0) test.skip(true, 'Keine offenen Vorschläge im Testmandanten');
    await expect(take.first()).toBeDisabled();
  });

  test('mobil 375px: kein horizontaler Überlauf der Hauptansicht', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/command-center');
    await expect(page.getByRole('button', { name: 'Navigation' })).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
