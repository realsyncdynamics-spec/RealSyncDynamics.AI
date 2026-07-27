import { test, expect } from '@playwright/test';

/**
 * Cookie-Consent: Reject-Equivalence (Befund #3, findings-2026-05-14.md).
 *
 * DSGVO Art. 7 III + TTDSG §25 verlangen, dass „Ablehnen" UI-gleichwertig
 * zu „Akzeptieren" ist. „Volumen" interpretieren wir hier als
 * Bounding-Box-Fläche; Farb-Differenzierung bleibt erlaubt, solange beide
 * Buttons gleich sichtbar, gleich groß und nicht hinter Mehr-Klick versteckt sind.
 */

test.describe('CookieConsent — Reject-Equivalence', () => {
  test.beforeEach(async ({ context }) => {
    // Banner-Storage zurücksetzen, damit das Banner garantiert rendert.
    await context.clearCookies();
  });

  test('Accept und Reject sind beide auf erster Ebene sichtbar', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByTestId('consent-accept-all');
    const reject = page.getByTestId('consent-reject-all');

    await expect(accept).toBeVisible();
    await expect(reject).toBeVisible();
  });

  test('Bounding-Box-Volumen Accept ≈ Reject (±10 %)', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByTestId('consent-accept-all');
    const reject = page.getByTestId('consent-reject-all');

    const acceptBox = await accept.boundingBox();
    const rejectBox = await reject.boundingBox();

    expect(acceptBox).not.toBeNull();
    expect(rejectBox).not.toBeNull();
    if (!acceptBox || !rejectBox) return;

    const acceptArea = acceptBox.width * acceptBox.height;
    const rejectArea = rejectBox.width * rejectBox.height;
    const ratio = Math.min(acceptArea, rejectArea) / Math.max(acceptArea, rejectArea);

    expect(ratio).toBeGreaterThanOrEqual(0.9);
    expect(acceptBox.height).toBeCloseTo(rejectBox.height, 0);
  });

  test('Beide Buttons haben identischen font-weight und font-size', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByTestId('consent-accept-all');
    const reject = page.getByTestId('consent-reject-all');

    const acceptStyle = await accept.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { fontWeight: cs.fontWeight, fontSize: cs.fontSize };
    });
    const rejectStyle = await reject.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { fontWeight: cs.fontWeight, fontSize: cs.fontSize };
    });

    expect(acceptStyle.fontWeight).toBe(rejectStyle.fontWeight);
    expect(acceptStyle.fontSize).toBe(rejectStyle.fontSize);
  });

  test('Reject ist nicht hinter Mehr-Klick versteckt', async ({ page }) => {
    await page.goto('/');
    // „Einstellungen"-Toggle darf NICHT nötig sein, um Reject zu erreichen.
    const reject = page.getByTestId('consent-reject-all');
    await expect(reject).toBeVisible();
    // Direkt klickbar, ohne erst „Einstellungen" zu öffnen.
    await reject.click();
    // Banner verschwindet nach Click.
    await expect(reject).not.toBeVisible();
  });
});

/**
 * Consent-Gating im Browser gemessen (COMPLIANCE_AUDIT_2026-07.md, offener
 * Punkt „Laufzeit-Verifikation").
 *
 * Die 17 Unit-Tests in test/consent-pixels.test.ts prüfen die Logik von
 * `pixels.ts` isoliert. Sie können aber nicht zeigen, dass im echten Browser
 * tatsächlich kein Drittanbieter kontaktiert wird — genau das misst dieser
 * Block, indem er die Netzwerk-Requests der Seite mitschneidet.
 *
 * ACHTUNG — dieser Test validiert sich selbst:
 *   `pixels.ts` lädt die Pixel nur, wenn die zugehörigen IDs als
 *   `VITE_*_PIXEL_ID` / `VITE_GA4_MEASUREMENT_ID` im Build gesetzt sind. Sind
 *   sie es nicht (in CI derzeit der Fall), feuert auch NACH einer Einwilligung
 *   kein einziger Tracker — und „vor der Einwilligung: 0 Requests" wäre trivial
 *   erfüllt, selbst wenn das Gating komplett kaputt wäre.
 *   Deshalb wird zuerst der Positivfall gemessen. Bleibt er bei 0, hat die
 *   Umgebung keine Pixel konfiguriert und der Test SKIPPT, statt eine
 *   Zusicherung vorzutäuschen, die er nicht geprüft hat.
 */
const TRACKER_RE = /google-analytics|googletagmanager|doubleclick|googleadservices|connect\.facebook|facebook\.com\/tr|analytics\.tiktok|snap\.licdn|px\.ads\.linkedin/i;
const CONSENT_STORAGE_KEY = 'realsync.cookie-consent.v1';

test.describe('CookieConsent — Netzwerkverhalten', () => {
  /**
   * Lädt „/" in einem frischen Kontext, führt optional eine Aktion aus und
   * gibt die kontaktierten Tracker-Hosts zurück.
   */
  async function trackerHosts(
    browser: import('@playwright/test').Browser,
    action?: (page: import('@playwright/test').Page) => Promise<void>,
  ): Promise<string[]> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const hits: string[] = [];
    page.on('request', (r) => {
      if (TRACKER_RE.test(r.url())) hits.push(new URL(r.url()).host);
    });

    // Tracker-Requests abbrechen, bevor sie das Netz erreichen. Gemessen wird
    // der Versuch — das `request`-Event feuert vor dem Routing, der Zähler oben
    // sieht ihn also weiterhin. So kontaktiert die CI nie wirklich Google, Meta
    // oder TikTok, und der Test hängt nicht an deren Erreichbarkeit.
    await page.route(TRACKER_RE, (route) => route.abort());

    await page.goto('/');
    // Sicherstellen, dass wirklich kein Consent aus einem früheren Lauf liegt.
    await page.evaluate((k) => localStorage.removeItem(k), CONSENT_STORAGE_KEY);
    await page.reload();

    if (action) {
      await action(page);
      // Den Injektionen Zeit geben, ihre Requests abzusetzen.
      await page.waitForTimeout(3000);
    }

    await context.close();
    return [...new Set(hits)];
  }

  test('vor der Einwilligung wird kein Drittanbieter kontaktiert', async ({ browser }) => {
    // Positivkontrolle zuerst: feuern die Pixel in dieser Umgebung überhaupt?
    const afterAccept = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-accept-all').click();
    });

    test.skip(
      afterAccept.length === 0,
      'Keine Pixel-IDs im Build gesetzt (VITE_*_PIXEL_ID / VITE_GA4_MEASUREMENT_ID) — '
        + 'auch nach Einwilligung feuert nichts. Ein "vor Consent: 0 Requests" waere hier '
        + 'ohne Aussage. Test uebersprungen statt falsche Sicherheit zu erzeugen.',
    );

    // Ab hier ist belegt, dass die Messung greift.
    const beforeConsent = await trackerHosts(browser);
    expect(
      beforeConsent,
      `Vor der Einwilligung wurden Drittanbieter kontaktiert: ${beforeConsent.join(', ')}`,
    ).toEqual([]);
  });

  test('nach „Alle ablehnen" bleibt es bei null Drittanbieter-Requests', async ({ browser }) => {
    const afterAccept = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-accept-all').click();
    });

    test.skip(
      afterAccept.length === 0,
      'Keine Pixel-IDs im Build gesetzt — Messung ohne Aussagekraft, siehe Test oben.',
    );

    const afterReject = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-reject-all').click();
    });
    expect(
      afterReject,
      `Nach Ablehnen wurden Drittanbieter kontaktiert: ${afterReject.join(', ')}`,
    ).toEqual([]);
  });
});
