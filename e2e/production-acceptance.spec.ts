import { test, expect, type Page, type Response } from '@playwright/test';

const PROD = 'https://realsyncdynamicsai.de';
const BASE = process.env.E2E_BASE_URL ?? process.env.TEST_BASE_URL ?? PROD;

test.skip(
  BASE.includes('localhost') || BASE.includes('127.0.0.1'),
  'Produktions-Akzeptanztest — benoetigt eine deployte Umgebung (E2E_BASE_URL setzen).',
);

test.describe.configure({ mode: 'parallel' });

async function dismissConsent(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: 'Alles akzeptieren' }).first();
  if ((await accept.count()) > 0 && (await accept.isVisible())) {
    await accept.click();
    await page.waitForTimeout(300);
  }
}

function collectFailures(page: Page): { status: number; url: string }[] {
  const failures: { status: number; url: string }[] = [];
  page.on('response', (r: Response) => {
    if (r.status() >= 400) failures.push({ status: r.status(), url: r.url() });
  });
  return failures;
}

const KUNDENPFAD = [
  '/', '/audit', '/pricing', '/governance', '/evidence-vault', '/ai-act',
  '/features', '/contact-sales', '/faq', '/legal/impressum', '/legal/privacy',
];

for (const pfad of KUNDENPFAD) {
  test(`${pfad} rendert Inhalt statt Weissbild`, async ({ page }) => {
    const resp = await page.goto(pfad, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), `${pfad} liefert keinen 2xx-Status`).toBeLessThan(400);
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    const text = await page.locator('#root').innerText();
    expect(text.trim().length, `${pfad} rendert praktisch keinen Text`).toBeGreaterThan(200);
  });
}

test.describe('Scan-Trichter', () => {
  test('Hero-Formular uebergibt die Domain an /audit', async ({ page }) => {
    await page.goto('/');
    await dismissConsent(page);
    const feld = page.getByPlaceholder(/Ihre Website/i).first();
    await expect(feld, 'Kein Domain-Feld im Hero — der Haupt-CTA fehlt').toBeVisible();
    await feld.fill('example.com');
    await page.getByRole('button', { name: /Kostenlosen Governance Scan starten/i }).first().click();
    await expect(page).toHaveURL(/\/audit\?domain=example\.com/);
  });

  test('/audit uebernimmt ?domain= in das sichtbare Eingabefeld', async ({ page }) => {
    await page.goto('/audit?domain=example.com');
    await dismissConsent(page);
    const sichtbaresFeld = page.locator('input[type="text"]:visible').first();
    await expect(sichtbaresFeld).toHaveValue('example.com');
  });
});
