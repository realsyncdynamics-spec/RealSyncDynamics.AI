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

  test('alle Links zu rechtlichen Seiten haben ein gültiges Ziel', async ({ page }) => {
    await page.goto('/unternehmen/', { waitUntil: 'domcontentloaded' });
    for (const href of ['/impressum', '/datenschutz', '/agb', '/widerruf', '/legal/avv', '/legal/sub-processors']) {
      await expect(page.locator('footer a[href="' + href + '"]')).toHaveCount(1);
    }
  });
});
