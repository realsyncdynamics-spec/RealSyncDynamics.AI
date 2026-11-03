// Isolated QA for the effective published /unternehmen route (no deployment).
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

assert.ok(existsSync('dist/unternehmen/index.html'), 'Static company route missing from Vite build');
const built = readFileSync('dist/unternehmen/index.html', 'utf8');
assert.ok(built.includes('Sechs Schritte der Voice-Agent-Einrichtung'), 'Built static page is not the canonical six-step entry');
assert.ok(!built.includes('Ihr Agent in vier Schritten'), 'Obsolete wizard in built HTML');
const host = process.env.VOICE_PREVIEW_URL || 'http://127.0.0.1:4173';
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1280, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(host + '/unternehmen/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response?.status(), 200, label + ' /unternehmen/ HTTP');
    assert.match(await page.title(), /RealSync/i);
    assert.equal(await page.locator('.htile[data-open="1"]').count(), 1, 'Voice product tile present');
    await page.locator('.htile[data-open="1"]').click();
    assert.equal(await page.locator('#pm.open').count(), 1, 'product modal opens');
    await page.locator('#pm .pm-pane.on .pgnav button', { hasText: 'Einrichten' }).click();
    const entry = page.locator('#voice-entry-canonical');
    assert.equal(await entry.locator('ol[aria-label="Sechs Schritte der Voice-Agent-Einrichtung"] li').count(), 6);
    assert.equal(await entry.locator('input,select,textarea,[data-next],[data-prev]').count(), 0, 'no second setup wizard');
    assert.match(await entry.locator('.note').innerText(), /keine Live-Freischaltung/);
    const link = entry.getByRole('link', { name: 'Zum vollständigen 6-Schritte-Onboarding' });
    assert.equal(await link.getAttribute('href'), 'https://voice.realsyncdynamicsai.de/onboarding.html');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match(await link.getAttribute('rel') || '', /noopener/);
    const widthExcess = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(widthExcess <= 3, label + ' horizontal overflow: ' + widthExcess);
    await page.screenshot({ path: 'screenshots/combined-company-' + label + '.png', fullPage: true });
    assert.deepEqual(errors, [], label + ' page errors');
    const route = await page.goto(host + '/unternehmen', { waitUntil: 'domcontentloaded' });
    assert.equal(route?.status(), 200, label + ' /unternehmen HTTP');
    assert.ok((await page.content()).includes('Sechs Schritte der Voice-Agent-Einrichtung'), label + ' /unternehmen route divergence');
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Combined company landing preview: mobile + desktop PASS');
