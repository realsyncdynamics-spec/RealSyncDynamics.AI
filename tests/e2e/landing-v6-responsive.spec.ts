import { test, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Landing v6 (`/`) auf schmalen Handys bis Desktop.
 *
 * `scrollWidth` allein reicht nicht: Der Hero hat `overflow-x: clip` (für die
 * Europakarte) und die Sticky-Leiste ist `position: fixed` — beides versteckt
 * Überstand vor `scrollWidth`. Deshalb prüfen wir zusätzlich die Boxen der
 * sichtbaren Elemente gegen den Seitenrand (`--px`).
 */

const MOBILE = [
  { width: 320, height: 720 },
  { width: 344, height: 740 },
  { width: 360, height: 780 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];
const WIDER = [
  { width: 768, height: 1024, name: 'Tablet' },
  { width: 1024, height: 768, name: 'Desktop' },
  { width: 1440, height: 900, name: 'Desktop' },
];

const CONSENT_KEY = 'realsync.cookie-consent.v1';
const MODE_KEY = 'rsd-landing-mode';
const TOLERANCE = 0.5;
// Nur der Seitenkopf der Landing, nicht der des Chat-Assistenten.
const HEADER = '[data-testid="landing-v6"] header';

type Box = { left: number; right: number; top: number; bottom: number };

async function openLanding(page: Page, mode: 'gold' | 'light' = 'gold') {
  // Cookie-Banner würde den Hero verdecken; die Wahl ist hier nicht Thema.
  await page.addInitScript(
    ([consentKey, modeKey, m]) => {
      localStorage.setItem(
        consentKey,
        JSON.stringify({ version: 99, decided_at: new Date().toISOString(), necessary: true, analytics: false, marketing: false }),
      );
      localStorage.setItem(modeKey, m);
    },
    [CONSENT_KEY, MODE_KEY, mode] as const,
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('landing-v6')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

/** Grenzen der Inhaltsspalte des Seitenkopfs (Viewport minus `--px`). */
async function headerColumn(page: Page) {
  return page.locator(`${HEADER} > div`).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight) };
  });
}

/** Anzahl der Textzeilen eines Elements (Zeilenboxen der Textknoten, ohne Icons). */
async function lineCount(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const tops = new Set<number>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top));
    }
    return tops.size;
  });
}

/** Rechtester/linkester Rand aller sichtbaren Elemente im Hero. */
async function heroExtent(page: Page) {
  return page.locator('#top').evaluate((top) => {
    let left = Infinity;
    let right = -Infinity;
    for (const el of top.querySelectorAll<HTMLElement>('*')) {
      if (el.classList.contains('lv6-map') || el.closest('[aria-hidden="true"].lv6-map')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
    return { left, right };
  });
}

function overlaps(a: Box, b: Box) {
  return a.left < b.right - TOLERANCE && b.left < a.right - TOLERANCE && a.top < b.bottom - TOLERANCE && b.top < a.bottom - TOLERANCE;
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} hat keine Box`).not.toBeNull();
  return { left: b!.x, right: b!.x + b!.width, top: b!.y, bottom: b!.y + b!.height };
}

async function attachShot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test.describe('Landing v6 — mobil 320–390 px', () => {
  for (const vp of MOBILE) {
    test(`${vp.width} px: Header, Hero-CTA und Ablauf ohne Überlauf`, async ({ page }, testInfo) => {
      await page.setViewportSize(vp);
      const errors = await openLanding(page);

      // Keine Dokument-Überbreite.
      const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(doc.sw).toBeLessThanOrEqual(doc.cw);

      // Kein sichtbares Hero-Element ragt aus dem Viewport.
      const hero = await heroExtent(page);
      expect(hero.left).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(hero.right).toBeLessThanOrEqual(vp.width + TOLERANCE);

      // Header: alle Bedienelemente in der Inhaltsspalte, nichts überlappt.
      const col = await headerColumn(page);
      const logo = page.locator(`${HEADER} a[href="#top"]`);
      const toggle = page.locator(`${HEADER} nav button`).first();
      const burger = page.locator(`${HEADER} [data-lv6-menu-trigger]`);
      await expect(logo).toBeVisible();
      await expect(toggle).toBeVisible();
      await expect(burger).toBeVisible();
      const parts = [
        await boxOf(page, `${HEADER} a[href="#top"]`),
        await boxOf(page, `${HEADER} nav button`),
        await boxOf(page, `${HEADER} [data-lv6-menu-trigger]`),
      ];
      for (const p of parts) {
        expect(p.left).toBeGreaterThanOrEqual(col.left - TOLERANCE);
        expect(p.right).toBeLessThanOrEqual(col.right + TOLERANCE);
      }
      expect(overlaps(parts[0], parts[1])).toBe(false);
      expect(overlaps(parts[1], parts[2])).toBe(false);

      // Logo vollständig (Box liegt oben in der Spalte) und einzeilig.
      expect(await lineCount(page, `${HEADER} a[href="#top"]`)).toBe(1);

      // Touch-Ziel des Menüs bleibt 44 × 44.
      const bb = await burger.boundingBox();
      expect(bb!.width).toBeGreaterThanOrEqual(44);
      expect(bb!.height).toBeGreaterThanOrEqual(44);

      // Hero-CTA: sichtbar, im Viewport, genau eine Textzeile, lesbar.
      const cta = page.getByTestId('hero-primary-cta');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveText('Kostenlosen Website-Check starten');
      const ctaBox = await boxOf(page, '[data-testid="hero-primary-cta"]');
      expect(ctaBox.left).toBeGreaterThanOrEqual(col.left - TOLERANCE);
      expect(ctaBox.right).toBeLessThanOrEqual(col.right + TOLERANCE);
      expect(ctaBox.bottom - ctaBox.top).toBeGreaterThanOrEqual(44);
      expect(await lineCount(page, '[data-testid="hero-primary-cta"]')).toBe(1);
      const ctaFont = await cta.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(ctaFont).toBeGreaterThanOrEqual(13);
      const ctaClip = await cta.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(ctaClip).toBeLessThanOrEqual(0);

      // Ablauf: vier Schritte sichtbar, im Viewport, Pfeil steht am eigenen
      // Schritt und Lesereihenfolge bleibt links→rechts, oben→unten.
      const steps = page.locator('ol[aria-label="Ablauf"] > li');
      await expect(steps).toHaveCount(4);
      const stepBoxes: Box[] = [];
      for (let i = 0; i < 4; i++) {
        await expect(steps.nth(i)).toBeVisible();
        const b = await steps.nth(i).boundingBox();
        stepBoxes.push({ left: b!.x, right: b!.x + b!.width, top: b!.y, bottom: b!.y + b!.height });
        expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width + TOLERANCE);
        const arrow = steps.nth(i).locator('span[aria-hidden="true"]');
        await expect(arrow).toHaveCount(i < 3 ? 1 : 0);
        if (i < 3) {
          const a = await arrow.boundingBox();
          expect(a!.y + a!.height / 2).toBeGreaterThan(b!.y);
          expect(a!.y + a!.height / 2).toBeLessThan(b!.y + b!.height);
          expect(a!.x + a!.width).toBeLessThanOrEqual(vp.width + TOLERANCE);
        }
      }
      for (let i = 1; i < 4; i++) {
        const prev = stepBoxes[i - 1];
        const cur = stepBoxes[i];
        const sameRow = Math.abs(cur.top - prev.top) < 2;
        expect(sameRow ? cur.left > prev.left : cur.top > prev.top).toBe(true);
        expect(overlaps(prev, cur)).toBe(false);
      }
      expect(overlaps(ctaBox, stepBoxes[3])).toBe(false);

      await attachShot(page, testInfo, `hero-${vp.width}px`);

      // Navigation: per Tastatur öffnen, Ziele erreichbar, Escape schließt.
      await burger.focus();
      await page.keyboard.press('Enter');
      const menu = page.locator('#lv6-menu');
      await expect(menu).toBeVisible();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await expect(menu.getByRole('link', { name: 'Preise' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Kostenlosen Website-Check starten' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();

      // Sticky-Leiste beim Scrollen: CTA vollständig im Viewport, einzeilig.
      await page.mouse.wheel(0, vp.height * 2);
      const sticky = page.locator('.lv6-sticky-cta');
      await expect(sticky).toBeVisible();
      const sb = await sticky.boundingBox();
      expect(sb!.x).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(sb!.x + sb!.width).toBeLessThanOrEqual(vp.width + TOLERANCE);
      expect(await lineCount(page, '.lv6-sticky-cta')).toBe(1);
      await attachShot(page, testInfo, `sticky-${vp.width}px`);

      expect(errors).toEqual([]);
    });
  }

  test('320 px: Hero-CTA führt zum Website-Check', async ({ page }) => {
    await page.setViewportSize(MOBILE[0]);
    await openLanding(page);
    const cta = page.getByTestId('hero-primary-cta');
    await expect(cta).toHaveAttribute('href', /^\/audit\b/);
    await cta.click();
    await expect(page).toHaveURL(/\/audit(\?|$)/);
  });

  test('320 px im hellen Modus: CTA einzeilig, kein Überlauf', async ({ page }, testInfo) => {
    await page.setViewportSize(MOBILE[0]);
    await openLanding(page, 'light');
    await expect(page.getByTestId('landing-v6')).toHaveAttribute('data-rs-theme', 'light');
    expect(await lineCount(page, '[data-testid="hero-primary-cta"]')).toBe(1);
    const hero = await heroExtent(page);
    expect(hero.right).toBeLessThanOrEqual(320 + TOLERANCE);
    await attachShot(page, testInfo, 'hero-320px-light');
  });
});

test.describe('Landing v6 — Tablet und Desktop', () => {
  for (const vp of WIDER) {
    test(`${vp.width} px (${vp.name}): Header und Hero-CTA unverändert, kein Überlauf`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const errors = await openLanding(page);
      const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(doc.sw).toBeLessThanOrEqual(doc.cw);
      const hero = await heroExtent(page);
      expect(hero.right).toBeLessThanOrEqual(vp.width + TOLERANCE);

      // Ab 390 px gelten die Design-Werte: Logo ≥ 19 px, CTA ≥ 15 px.
      const logoFont = await page.locator(`${HEADER} a[href="#top"]`).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(logoFont).toBeGreaterThanOrEqual(19);
      const cta = page.getByTestId('hero-primary-cta');
      const ctaFont = await cta.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(ctaFont).toBeGreaterThanOrEqual(15);
      expect(await lineCount(page, '[data-testid="hero-primary-cta"]')).toBe(1);

      const col = await headerColumn(page);
      const right = await page.locator(`${HEADER} > div`).evaluate((el) =>
        Math.max(...[...el.querySelectorAll('a, button')].filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect().right)),
      );
      expect(right).toBeLessThanOrEqual(col.right + TOLERANCE);

      if (vp.width >= 1180) {
        // Desktop-Navigation sichtbar und per Tab erreichbar.
        const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
        await expect(nav.getByRole('link', { name: 'Preise' })).toBeVisible();
        await page.locator(`${HEADER} a[href="#top"]`).focus();
        await page.keyboard.press('Tab');
        await expect(nav.getByRole('link', { name: 'Plattform' })).toBeFocused();
      }

      await attachShot(page, testInfo, `hero-${vp.width}px`);
      expect(errors).toEqual([]);
    });
  }

  test('1440 px im dunklen und hellen Modus ohne Überlauf', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const mode of ['gold', 'light'] as const) {
      await openLanding(page, mode);
      await expect(page.getByTestId('landing-v6')).toHaveAttribute('data-rs-theme', mode === 'light' ? 'light' : 'dark');
      const hero = await heroExtent(page);
      expect(hero.right).toBeLessThanOrEqual(1440 + TOLERANCE);
      expect(await lineCount(page, '[data-testid="hero-primary-cta"]')).toBe(1);
    }
  });

  test('Reflow bei 200 % Zoom (1280 px → 640 CSS-px): kein Überlauf', async ({ page }, testInfo) => {
    // 200 % Browser-Zoom auf 1280 px entspricht 640 CSS-Pixeln Viewport.
    await page.setViewportSize({ width: 640, height: 400 });
    const errors = await openLanding(page);
    const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(doc.sw).toBeLessThanOrEqual(doc.cw);
    const hero = await heroExtent(page);
    expect(hero.right).toBeLessThanOrEqual(640 + TOLERANCE);
    expect(await lineCount(page, '[data-testid="hero-primary-cta"]')).toBe(1);
    await expect(page.locator(`${HEADER} [data-lv6-menu-trigger]`)).toBeVisible();
    await attachShot(page, testInfo, 'reflow-640px');
    expect(errors).toEqual([]);
  });
});
