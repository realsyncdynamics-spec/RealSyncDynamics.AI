import { test, expect } from '@playwright/test';

/**
 * Smoke für /unternehmen (Unternehmens-Landing v5): Seite lädt (noindex),
 * Dialog öffnet per Klick auf eine Tafel, Esc schließt, Fokus kehrt zurück;
 * Governance-Tafel scrollt zum Abschnitt; Rechtslinks zeigen auf echte Routen.
 * Die 3D-Szene mountet unter navigator.webdriver nicht (wie Landing v4).
 * Reduced Motion: Die Hero-Tafeln schweben sonst dauerhaft (Referenz) und
 * gelten für Playwright nie als „stabil“ — so ist der Ablauf deterministisch
 * und der Reduced-Motion-Pfad gleich mitgeprüft.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

test.describe('/unternehmen', () => {
  test('lädt, öffnet den Produkt-Dialog per Klick und schließt mit Esc', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/unternehmen');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/RealSync Dynamics/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const tile = page.getByTestId('product-tile-voice');
    await tile.click();
    const dialog = page.getByRole('dialog', { name: 'Produkte im Detail' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tablist', { name: 'Produkte' }).getByRole('tab')).toHaveCount(3);

    // Fokusfalle in beide Richtungen: Die Voice-Tafel öffnet nicht den ersten
    // Produkt-Tab, davor liegen also Tabs mit tabIndex=-1 (Regression).
    const box = dialog.locator('.pm-box');
    for (const key of ['Shift+Tab', 'Tab'] as const) {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(key);
        expect(await box.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(tile).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('Governance-Tafel springt zum Abschnitt Governance OS', async ({ page }) => {
    await page.goto('/unternehmen');
    await page.getByTestId('product-tile-governance').click();
    await expect(page.getByRole('heading', { level: 2, name: /KI einsetzen/ })).toBeInViewport();
  });

  test('Rechtslinks im Footer zeigen auf die bestehenden Routen', async ({ page }) => {
    await page.goto('/unternehmen');
    const legal = page.getByRole('navigation', { name: 'Rechtliches' });
    for (const [name, href] of [
      ['Impressum', '/impressum'],
      ['Datenschutz', '/datenschutz'],
      ['AGB', '/agb'],
      ['Widerruf', '/widerruf'],
      ['AVV', '/legal/avv'],
      ['Sub-Prozessoren', '/legal/sub-processors'],
    ] as const) {
      await expect(legal.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
