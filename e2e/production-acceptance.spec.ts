import { test, expect, type Page, type Response } from '@playwright/test';

/**
 * Produktions-Akzeptanztest — der Kundenpfad im echten Browser.
 */

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

  test('gdpr-audit liefert einen Bericht statt HTTP 500', async ({ request }) => {
    const resp = await request.post(
      'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/gdpr-audit',
      {
        data: { url: 'https://example.com', email: 'e2e@realsyncdynamics.example' },
        timeout: 120_000,
        failOnStatusCode: false,
      },
    );
    expect(resp.status(), `gdpr-audit antwortet ${resp.status()}: ${(await resp.text()).slice(0, 200)}`).toBe(200);
    const bericht = await resp.json();
    expect(bericht, 'Bericht ohne Score — der Audit hat nichts bewertet').toHaveProperty('score');
    expect(bericht, 'Antwort ohne audit_id — die Report-E-Mail kann nicht ausgeloest werden')
      .toHaveProperty('audit_id');
  });
});

test('/app/dashboard leitet Nicht-Angemeldete zum Login', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: /Magic-Link senden/i })).toBeVisible();
});

test('kein Vortaeuschen von Kennzahlen ohne Anmeldung', async ({ page }) => {
  await page.goto('/app/evidence');
  await page.waitForTimeout(3_000);
  const text = await page.locator('#root').innerText();
  const zeigtZahlen = /1\.247|1\.198/.test(text);
  const alsDemoGekennzeichnet = /demo[- ]?modus|vorschau|beispieldaten/i.test(text);
  const istAngemeldet = !/NICHT ANGEMELDET/i.test(text);
  expect(
    zeigtZahlen && !istAngemeldet && !alsDemoGekennzeichnet,
    'Evidence Vault zeigt Kennzahlen ohne Anmeldung und ohne Demo-Kennzeichnung',
  ).toBe(false);
});

test.describe('Demo-Tour', () => {
  test('Demo-Dashboard rendert und weist sich als Demo aus', async ({ page }) => {
    await page.goto('/demo-tour/dashboard');
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    const text = await page.locator('#root').innerText();
    expect(text, 'Demo-Dashboard ohne Demo-Kennzeichnung').toMatch(/Demo[- ]?Modus/i);
    expect(text, 'Demo-Dashboard rendert keine Kennzahlen').toMatch(/Governance Score/i);
  });

  test('/demo-app fuehrt Nicht-Angemeldete zum Login', async ({ page }) => {
    await page.goto('/demo-app');
    await expect(page).toHaveURL(/\/demo-login/);
  });
});

test.describe('Kauf-Trichter', () => {
  test('Plan-Schaltflaeche auf /pricing fuehrt in den Checkout', async ({ page }) => {
    await page.goto('/pricing');
    await dismissConsent(page);
    const kaufen = page.getByRole('button', { name: /14 Tage kostenlos testen/i }).first();
    await expect(kaufen, 'Keine Kauf-Schaltflaeche auf der Preisseite').toBeVisible();
    await expect(kaufen).toBeEnabled();
    await kaufen.click();
    await expect(page, 'Kauf-Schaltflaeche loest keine Navigation aus').toHaveURL(/\/checkout\//);
  });

  test('Checkout verlangt Anmeldung und verspricht die Rueckkehr', async ({ page }) => {
    await page.goto('/checkout/starter');
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    const text = await page.locator('#root').innerText();
    expect(text, 'Checkout ohne Anmeldegate').toMatch(/Anmelden|Login|Magic-Link/i);
    expect(text, 'Checkout verspricht keine Rueckkehr nach dem Login').toMatch(/wieder hier|automatisch/i);
  });
});

test('kein Seitenaufruf erzeugt einen 5xx im Hintergrund', async ({ page }) => {
  const failures = collectFailures(page);
  await page.goto('/');
  await page.waitForTimeout(5_000);
  const serverfehler = failures.filter((f) => f.status >= 500);
  expect(
    serverfehler,
    `Serverfehler beim Seitenaufruf: ${serverfehler.map((f) => `${f.status} ${f.url}`).join(', ')}`,
  ).toEqual([]);
});

test('CSP erlaubt die Skripte, die die Seite selbst laedt', async ({ page }) => {
  const blockiert: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) blockiert.push(m.text());
  });
  await page.goto('/');
  await page.waitForTimeout(5_000);
  expect(blockiert, `Von der CSP blockierte Skripte:\n${blockiert.join('\n')}`).toEqual([]);
});

test('Sicherheitsheader sind gesetzt', async ({ request }) => {
  const resp = await request.get(BASE);
  const h = resp.headers();
  expect(h['content-security-policy'], 'CSP-Header fehlt').toBeTruthy();
  expect(h['strict-transport-security'], 'HSTS-Header fehlt').toBeTruthy();
  expect(h['x-content-type-options']).toBe('nosniff');
});

test.describe('Mobil (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Haupt-CTA ist erreichbar und die Seite scrollt nicht seitwaerts', async ({ page }) => {
    await page.goto('/');
    await dismissConsent(page);
    await expect(page.getByPlaceholder(/Ihre Website/i).first()).toBeVisible();
    const ueberstand = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(ueberstand, 'Seite laeuft waagerecht ueber').toBeLessThanOrEqual(1);
  });
});
