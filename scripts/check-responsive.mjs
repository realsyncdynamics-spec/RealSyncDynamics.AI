// WP8a — Responsive-Messung (keine UI-Änderung). Misst je Route × Viewport:
//   1. horizontalen Overflow (documentElement.scrollWidth > innerWidth) samt Verursacher-Elementen
//   2. Tap-Ziele < 24×24 px (WCAG 2.2, 2.5.8 AA; Inline-Textlinks ausgenommen)
//   3. Eingabefelder mit < 16 px Schrift (iOS-Auto-Zoom)
//   4. three.js-/3D-Asset-Requests (Akzeptanzkriterium: keine auf Mobile < 768 px)
//
// Zielserver: TEST_BASE_URL (Default http://127.0.0.1:4173, vorher `npm run build`
// + `npx vite preview`). App-Routen brauchen E2E_TEST_EMAIL/E2E_TEST_PASSWORD —
// ohne Credentials werden sie als ÜBERSPRUNGEN ausgewiesen, nie still weggelassen.
//
// Exit-Code: 0 (Warnstufe, PLAN §4 WP8a). Blockierend nur für Routen in
// scripts/responsive-blocking-routes.json — die Liste füllen 8b–8d nach dem Fix.
// Report: Markdown-Tabelle auf stdout + JSON unter --out (Default responsive-report.json).

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

// createRequire statt ESM-Import: löst Playwright auch über NODE_PATH auf
// (Cloud-Container ohne Repo-node_modules), in CI ganz normal über ./node_modules.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const OUT_FILE = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'responsive-report.json';
const BLOCKING_FILE = path.join('scripts', 'responsive-blocking-routes.json');

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const PUBLIC_ROUTES = ['/', '/audit', '/pricing', '/login', '/welcome'];
// Agent-Register laut App.tsx: /app/ai-systems/agents (AgentRegistryView)
const APP_ROUTES = ['/app/activation', '/app/dashboard', '/app/ai-systems/agents'];

const THREE_RE = /three(?:[./-]|\.module)|troika|\.glb(?:\?|$)|\.gltf(?:\?|$)|draco|ktx2|basis_transcoder/i;
const MOBILE_MAX = 767;

function blockingRoutes() {
  if (!existsSync(BLOCKING_FILE)) return [];
  try { return JSON.parse(readFileSync(BLOCKING_FILE, 'utf8')).routes ?? []; } catch { return []; }
}

async function serverReachable(url) {
  try { const res = await fetch(url, { method: 'HEAD' }); return res.ok || res.status < 500; } catch { return false; }
}

// Startet `vite preview`, wenn lokal nichts läuft (CI startet den Server selbst).
async function ensureServer() {
  if (await serverReachable(BASE_URL)) return null;
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(BASE_URL)) {
    console.error(`FEHLER: ${BASE_URL} nicht erreichbar.`);
    process.exit(2);
  }
  const child = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    stdio: 'ignore', detached: false,
  });
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await serverReachable(BASE_URL)) return child;
  }
  console.error('FEHLER: Preview-Server kam nicht hoch. Erst `npm run build` ausführen?');
  child.kill();
  process.exit(2);
}

// Best-effort-Login über die /login-Maske (gleiche Credentials wie e2e/demo-auth.spec.ts).
async function loginStorageState(browser) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) return { state: null, reason: 'kein Test-Login (E2E_TEST_EMAIL/E2E_TEST_PASSWORD fehlen)' };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('input[type="email"]').first().fill(email, { timeout: 10_000 });
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/app\//, { timeout: 20_000 });
    const state = await ctx.storageState();
    await ctx.close();
    return { state, reason: null };
  } catch (e) {
    await ctx.close();
    return { state: null, reason: `Login fehlgeschlagen: ${e instanceof Error ? e.message.split('\n')[0] : e}` };
  }
}

async function measure(page, viewportWidth) {
  return page.evaluate((vw) => {
    const sel = (el) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 80);
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none';
    };

    const doc = document.documentElement;
    const overflowPx = Math.max(0, doc.scrollWidth - vw);
    const overflowEls = [];
    if (overflowPx > 1) {
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && el.children.length < 30) {
          overflowEls.push({ sel: sel(el), right: Math.round(r.right) });
        }
      }
      overflowEls.sort((a, b) => b.right - a.right);
    }

    const tapTargets = [];
    const candidates = document.querySelectorAll(
      'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea',
    );
    for (const el of candidates) {
      if (!visible(el)) continue;
      // WCAG 2.5.8 nimmt Inline-Links im Fließtext aus.
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) {
        tapTargets.push({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }

    const smallInputs = [];
    for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      if (!visible(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) smallInputs.push({ sel: sel(el), fontPx: Math.round(fs * 10) / 10 });
    }

    return {
      overflowPx,
      overflowEls: overflowEls.slice(0, 3),
      tapTargetCount: tapTargets.length,
      tapTargets: tapTargets.slice(0, 5),
      smallInputCount: smallInputs.length,
      smallInputs: smallInputs.slice(0, 5),
    };
  }, viewportWidth);
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const { state: authState, reason: skipReason } = await loginStorageState(browser);

  const results = [];
  const skipped = [];

  const routes = [
    ...PUBLIC_ROUTES.map((r) => ({ route: r, auth: false })),
    ...APP_ROUTES.map((r) => ({ route: r, auth: true })),
  ];

  for (const { route, auth } of routes) {
    if (auth && !authState) { skipped.push({ route, reason: skipReason }); continue; }
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: vp, ...(auth ? { storageState: authState } : {}) });
      const page = await ctx.newPage();
      const threeRequests = [];
      page.on('request', (req) => { if (THREE_RE.test(req.url())) threeRequests.push(req.url()); });
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
        await page.waitForTimeout(800);
        const m = await measure(page, vp.width);
        results.push({
          route, viewport: vp.width, ...m,
          threeRequests: [...new Set(threeRequests)].slice(0, 5),
          threeOnMobile: vp.width <= MOBILE_MAX && threeRequests.length > 0,
        });
      } catch (e) {
        results.push({ route, viewport: vp.width, error: e instanceof Error ? e.message.split('\n')[0] : String(e) });
      } finally {
        await ctx.close();
      }
    }
  }

  await browser.close();
  server?.kill();

  const findings = results.filter((r) =>
    r.error || r.overflowPx > 1 || r.tapTargetCount > 0 || r.smallInputCount > 0 || r.threeOnMobile,
  );

  // Markdown-Tabelle (für den PR-Text)
  console.log(`\n## check:responsive — ${BASE_URL} · ${new Date().toISOString().slice(0, 10)}\n`);
  console.log('| Route | Viewport | Overflow | Tap<24px | Input<16px | three.js mobil | Hinweis |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of results) {
    if (r.error) { console.log(`| \`${r.route}\` | ${r.viewport} | — | — | — | — | FEHLER: ${r.error} |`); continue; }
    const of = r.overflowPx > 1 ? `**+${r.overflowPx}px** (${r.overflowEls.map((e) => e.sel).join(', ') || '—'})` : '0';
    const three = r.threeOnMobile ? `**ja** (${r.threeRequests.length})` : (r.threeRequests.length ? `nein (Desktop: ${r.threeRequests.length})` : 'nein');
    const tap = r.tapTargetCount ? `**${r.tapTargetCount}** (${r.tapTargets.map((t) => `${t.sel} ${t.w}×${t.h}`).join('; ')})` : '0';
    const inp = r.smallInputCount ? `**${r.smallInputCount}** (${r.smallInputs.map((i) => `${i.sel} ${i.fontPx}px`).join('; ')})` : '0';
    console.log(`| \`${r.route}\` | ${r.viewport} | ${of} | ${tap} | ${inp} | ${three} | |`);
  }
  for (const s of skipped) console.log(`| \`${s.route}\` | alle | — | — | — | — | ÜBERSPRUNGEN: ${s.reason} |`);

  writeFileSync(OUT_FILE, JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), results, skipped }, null, 2));
  console.log(`\nJSON-Report: ${OUT_FILE} · Befunde: ${findings.length} von ${results.length} Messpunkten.`);

  // Warnstufe: Exit 1 nur für Routen, die 8b–8d explizit auf blockierend gestellt haben.
  const blocking = blockingRoutes();
  const blockingHits = findings.filter((f) => blocking.includes(f.route));
  if (blockingHits.length > 0) {
    console.error(`\nBLOCKIEREND: ${blockingHits.length} Befund(e) auf fixierten Routen: ${[...new Set(blockingHits.map((f) => f.route))].join(', ')}`);
    process.exit(1);
  }
  if (findings.length > 0) console.log('Warnstufe (PLAN §4 WP8a): Befunde blockieren nicht.');
}

main().catch((e) => { console.error(e); process.exit(2); });
