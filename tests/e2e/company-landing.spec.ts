import { test, expect } from '@playwright/test';

test.describe('Unternehmensseite – öffentliche Interaktionen', () => {
  test('öffnet und schließt alle drei Produktdialoge', async ({ page }) => {
    await page.goto('/unternehmen/', { waitUntil: 'domcontentloaded' });
    for (const index of [0, 1, 2]) {
      await page.locator('.htile[data-open="' + index + '"]').click();
      await expect(page.locator('#pm')).toHaveClass(/open/);
      await expect(page.locator('.pm-tabs button').nth(index)).toHaveAttribute('aria-selected', 'true');
      await page.locator('.pm-x').click();
      await expect(page.locator('#pm')).not.toHaveClass(/open/);
    }
  });

  test('reicht eine ausgewählte Branchenvorlage an den Anfrage-Builder weiter', async ({ page }) => {
    await page.goto('/unternehmen/', { waitUntil: 'domcontentloaded' });
    await page.locator('.htile[data-open="2"]').click();
    await page.locator('.pm-pane').nth(2).locator('.pgnav button', { hasText: 'Vorlagen' }).click();
    const template = page.locator('#tpls [data-tpl="handwerk"]');
    await template.click();
    await expect(template).toHaveAttribute('aria-pressed', 'true');
    const link = page.locator('#tpl-go');
    await expect(link).toHaveAttribute('href', '/frontend-builder?vorlage=handwerk#builder');
    await link.click();
    await expect(page).toHaveURL(/\/frontend-builder\?vorlage=handwerk#builder$/);
    await expect(page.getByText('Vorlagenauswahl aus der Unternehmensseite übernommen')).toBeVisible();
  });

  test('Governance-Demo zeigt ein verständliches Simulationsergebnis', async ({ page }) => {
    await page.goto('/unternehmen/', { waitUntil: 'domcontentloaded' });
    await page.locator('.htile[data-open="0"]').click();
    await page.locator('.pm-pane').nth(0).locator('.pgnav button', { hasText: 'Ausprobieren' }).click();
    await page.locator('#g-run').click();
    await expect(page.locator('#g-v')).toContainText('Blockiert', { timeout: 8_000 });
    await expect(page.locator('#g-h')).toContainText('BEISPIEL');
  });

  test('Voice-Simulation startet, ohne echte Telefonie vorzutäuschen', async ({ page }) => {
    await page.goto('/unternehmen/', { waitUntil: 'domcontentloaded' });
    await page.locator('.htile[data-open="1"]').click();
    await page.locator('.pm-pane').nth(1).locator('.pgnav button', { hasText: 'Anruf testen' }).click();
    await expect(page.getByText('Beispiel-Simulation im Browser – kein echter Anruf')).toBeVisible();
    await page.locator('#v-run').click();
    await expect(page.locator('#v-chat .c')).toHaveCount(1, { timeout: 8_000 });
    await expect(page.locator('#v-chat .a')).toHaveCount(1, { timeout: 8_000 });
  });

  test('alle Links zu rechtlichen Seiten haben ein gültiges Ziel', async ({ page }) => {
    await page.goto('/unternehmen/', { waitUntil: 'domcontentloaded' });
    for (const href of ['/impressum', '/datenschutz', '/agb', '/widerruf', '/legal/avv', '/legal/sub-processors']) {
      await expect(page.locator('footer a[href="' + href + '"]')).toHaveCount(1);
    }
  });
});
