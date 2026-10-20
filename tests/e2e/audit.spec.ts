import { test, expect } from '@playwright/test';
import { testDomains } from '../fixtures/test-domains';

test.describe('[GOV] DSGVO-Audit-Seite', () => {
  test('[GOV-001] Audit-Seite lädt und Domain-Eingabe ist vorhanden', async ({ page }) => {
    await page.goto('/audit', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: /Ihr KI-Bestand in vier Fragen/i }),
    ).toBeVisible();

    // Handoff v2: Schritt 1 fragt Unternehmen + Domain; geprüft wird das Domain-Feld.
    const input = page.locator('input[name="domain"]').first();
    await expect(input).toBeVisible();
  });

  test('[GOV-002] Audit-Scan startet nach Schritt 1 (Netz gemockt)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const sent = await mockScanBackend(page);

    await page.goto('/audit', { waitUntil: 'domcontentloaded' });
    await dismissConsentBanner(page);
    await page.locator('input[name="domain"]').fill(testDomains.safe);
    await page.locator('input[name="email"]').fill(SYNTHETIC_EMAIL);
    await page.getByTestId('audit-start').click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ url: `https://${testDomains.safe}`, email: SYNTHETIC_EMAIL, marketing_consent: false });
    expect(sent[0]!.company_website).toBeUndefined();
    await expect(page.getByTestId('audit-next')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('[GOV] DSGVO-Audit mobil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('[GOV-003] Formular ist mobil bedienbar und zeigt das Ergebnis', async ({ page }) => {
    const sent = await mockScanBackend(page);
    await page.goto('/audit', { waitUntil: 'domcontentloaded' });
    await dismissConsentBanner(page);

    // Keine horizontale Scrollleiste auf Telefonbreite.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.locator('input[name="domain"]').tap();
    await page.locator('input[name="domain"]').fill(`https://www.${testDomains.safe}/kontakt`);
    await page.locator('input[name="email"]').fill(SYNTHETIC_EMAIL);
    await expect(page.getByTestId('audit-privacy-notice')).toBeVisible();
    // Der Start-Button liegt vollständig im Bild — ein zu langer Text in der
    // Aktionszeile schob den Stepper vorher seitlich aus dem Viewport.
    const start = page.getByTestId('audit-start');
    await start.scrollIntoViewIfNeeded();
    const box = await start.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
    expect(await page.evaluate(() => {
      const main = document.querySelector('.rs-audit__main');
      return main ? main.scrollWidth - main.clientWidth : 0;
    })).toBeLessThanOrEqual(1);
    await start.tap();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.url).toBe(`https://${testDomains.safe}`);

    await page.getByTestId('audit-next').tap();
    await page.getByTestId('audit-next').tap();
    await page.getByRole('radio', { name: 'Agentur' }).tap();
    await page.getByTestId('audit-reveal').tap();
    await expect(page.getByTestId('audit-score-ring')).toBeVisible();
  });
});

/**
 * Das Cookie-Banner liegt fixiert über dem unteren Bildrand und damit über
 * dem Start-Button, bis eine Entscheidung fällt — so ist es gewollt. Der Test
 * trifft sie wie ein Besucher: alles ablehnen.
 */
async function dismissConsentBanner(page: import('@playwright/test').Page): Promise<void> {
  const reject = page.getByTestId('consent-reject-all');
  // Das Banner erscheint nach dem ersten Rendern; kurz darauf warten.
  if (await reject.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) {
    await reject.click();
    await expect(reject).toBeHidden();
  }
}

/** Synthetische Testadresse — nie eine echte Person. */
const SYNTHETIC_EMAIL = 'e2e-lead@example.com';

/**
 * Fängt gdpr-audit und Tracking ab. E2E läuft auch gegen echte Umgebungen
 * (TEST_BASE_URL); ein echter Aufruf würde dort einen Lead anlegen.
 */
async function mockScanBackend(page: import('@playwright/test').Page): Promise<Array<Record<string, unknown>>> {
  const sent: Array<Record<string, unknown>> = [];
  // Die Functions liegen auf einer anderen Origin — ohne diese Header verwirft
  // der Browser die gemockte Antwort bei der CORS-Prüfung.
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
  await page.route('**/functions/v1/gdpr-audit', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    sent.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        ok: true,
        audit_id: '00000000-0000-4000-8000-000000000001',
        domain: testDomains.safe,
        score: 72,
        severity: 'medium',
        issues: [],
        fetched: true,
        fetched_status: 200,
        fetch_error: null,
      }),
    });
  });
  await page.route('**/functions/v1/marketing-event', (route) => route.fulfill({ status: 200, headers: cors, body: '{"ok":true}' }));
  await page.route('**/functions/v1/audit-report-email**', (route) => route.fulfill({ status: 200, headers: cors, body: '{"ok":true}' }));
  return sent;
}
