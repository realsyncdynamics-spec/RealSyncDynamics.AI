import { test, expect } from '@playwright/test';

/**
 * Smoke für /unternehmen (Unternehmens-Landing v5, Gerüst):
 * Seite lädt, Modal öffnet per Klick auf eine Tafel, Esc schließt.
 */
test.describe('/unternehmen', () => {
  test('lädt, öffnet Produkt-Modal per Klick und schließt mit Esc', async ({ page }) => {
    await page.goto('/unternehmen');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByTestId('product-tile-free-audit').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab')).toHaveCount(3);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('product-tile-free-audit')).toBeFocused();
  });

  test('Rechtslinks im Footer zeigen auf die bestehenden Routen', async ({ page }) => {
    await page.goto('/unternehmen');
    const legal = page.getByRole('navigation', { name: 'Rechtliches' });
    for (const [name, href] of [
      ['Impressum', '/impressum'],
      ['Datenschutz', '/datenschutz'],
      ['AGB', '/agb'],
      ['Widerruf', '/widerruf'],
    ] as const) {
      await expect(legal.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
