// scripts/prerender.mjs — Static HTML pre-rendering für die Vite-SPA.
//
// Problem: Vite-SPA liefert allen Crawlern denselben dist/index.html-Shell.
// LinkedIn-, Slack-, Archive-, RSS-, älteren Bot-Preview sehen nichts vom
// eigentlichen Content. Auch GoogleBot rendert JS, aber das Indexing-Budget
// ist endlich — pre-rendered Pages ranken besser.
//
// Lösung: Nach `vite build` rendert dieses Script eine Auswahl von Routes
// via Headless-Chromium und schreibt den vollständig hydrierten HTML-State
// als `dist/<route>/index.html`. Der Vercel/nginx-Server liefert dann pro
// Route die korrekte HTML statt den SPA-Shell.
//
// Usage:
//   npm run build              # vite build (unverändert)
//   npm run prerender          # NACH build, rendert top-routes
//   npm run build:full         # vite build && prerender
//
// Skipping in CI? `SKIP_PRERENDER=1 npm run prerender` exit 0 ohne work.

import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Setup-Fehler (kein Browser, Preview-Server startet nicht) sind kategorisch
// anders als einzelne Route-Fehler: sie liefern 0 prerenderte Seiten. Getrennt
// markiert, damit main() sie gezielt behandeln kann.
class SetupError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'SetupError';
    this.cause = cause;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SITEMAP = join(DIST, 'sitemap.xml');

const PORT = parseInt(process.env.PRERENDER_PORT ?? '4173', 10);
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = parseInt(process.env.PRERENDER_TIMEOUT ?? '15000', 10);
const CONCURRENCY = parseInt(process.env.PRERENDER_CONCURRENCY ?? '4', 10);
const PRIORITY_MIN = parseFloat(process.env.PRERENDER_PRIORITY_MIN ?? '0.6');

if (process.env.SKIP_PRERENDER === '1') {
  console.log('[prerender] SKIP_PRERENDER=1 — exit 0 without work');
  process.exit(0);
}

// ─── Routes aus sitemap.xml laden + auf Priority-Schwelle filtern ───────────
async function loadRoutes() {
  let xml;
  try {
    xml = await readFile(SITEMAP, 'utf8');
  } catch {
    console.error(`[prerender] FATAL: ${SITEMAP} nicht gefunden. Run \`vite build\` first.`);
    process.exit(2);
  }

  const entries = [];
  const urlBlocks = xml.matchAll(/<url>([\s\S]*?)<\/url>/g);
  for (const block of urlBlocks) {
    const loc = /<loc>(.*?)<\/loc>/.exec(block[1])?.[1];
    const prio = parseFloat(/<priority>(.*?)<\/priority>/.exec(block[1])?.[1] ?? '0.5');
    if (!loc) continue;
    const route = new URL(loc).pathname;
    if (prio >= PRIORITY_MIN) entries.push({ route, prio });
  }
  entries.sort((a, b) => b.prio - a.prio);
  return entries;
}

// ─── Vite preview server starten + auf "ready" warten ───────────────────────
async function startPreviewServer() {
  console.log(`[prerender] starting vite preview on port ${PORT}...`);
  const proc = spawn('npx', ['vite', 'preview', `--port=${PORT}`, '--host=127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (d) => process.stdout.write(`[vite-preview] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[vite-preview] ${d}`));

  // Wait for server to respond
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE_URL + '/');
      if (r.ok) {
        console.log(`[prerender] vite preview ready after ${15000 - (deadline - Date.now())}ms`);
        return proc;
      }
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new SetupError('vite preview did not respond within 15s');
}

// ─── Chromium starten, bei Bedarf nachinstallieren ──────────────────────────
// Der Prerender laeuft nicht nur in CI (wo `npx playwright install` explizit
// als eigener Step steht), sondern auch im Cloudflare-Pages-Build, wenn dort
// `npm run build:full` als Build-Befehl konfiguriert ist. In dem Image ist der
// Chromium-Download nicht garantiert vorhanden — deshalb ein einmaliger
// Install-Versuch, bevor wir aufgeben.
async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (first) {
    console.warn(`[prerender] chromium launch failed (${first.message.split('\n')[0]}) — trying \`playwright install chromium\` once...`);
    const install = spawnSync('npx', ['playwright', 'install', 'chromium'], {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 300_000,
    });
    if (install.status !== 0) {
      throw new SetupError('chromium not available and automatic install failed', first);
    }
    try {
      return await chromium.launch({ headless: true });
    } catch (second) {
      throw new SetupError('chromium still not launchable after install', second);
    }
  }
}

// ─── Render single route ─────────────────────────────────────────────────────
async function renderRoute(browser, route) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  try {
    const url = BASE_URL + route;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    // Wait for React hydration + lazy components to finish
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT }).catch(() => { /* tolerant */ });

    // Canonical wird vom SEOHead-Component aus src/config/seo.ts gesetzt
    // (auch fuer Alias-Routes auf die Primary-URL). Hier nicht ueberschreiben.

    const html = await page.content();
    return html;
  } finally {
    await context.close();
  }
}

// ─── Write HTML to dist/<route>/index.html ───────────────────────────────────
async function writeRoute(route, html) {
  const cleanRoute = route === '/' ? '' : route.replace(/\/$/, '');
  const target = cleanRoute === ''
    ? join(DIST, 'index.html')
    : join(DIST, cleanRoute, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

// ─── Concurrency-Pool ────────────────────────────────────────────────────────
async function runWithPool(items, worker, concurrency) {
  const queue = [...items];
  const stats = { done: 0, failed: 0, skipped: 0 };
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const result = await worker(item);
        if (result === 'skipped') stats.skipped++;
        else stats.done++;
      } catch (e) {
        stats.failed++;
        console.error(`[prerender] FAIL ${item.route}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }));
  return stats;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Sanity: dist/index.html muss existieren
  try { await access(join(DIST, 'index.html')); }
  catch {
    console.error(`[prerender] FATAL: ${DIST}/index.html missing — run vite build first`);
    process.exit(2);
  }

  const routes = await loadRoutes();
  console.log(`[prerender] ${routes.length} routes (priority >= ${PRIORITY_MIN}) to render`);

  const previewProc = await startPreviewServer();

  let stats = { done: 0, failed: 0, skipped: 0 };
  try {
    const browser = await launchBrowser();
    try {
      stats = await runWithPool(routes, async (item) => {
        const html = await renderRoute(browser, item.route);
        await writeRoute(item.route, html);
        console.log(`[prerender] ✓ ${item.route} (priority ${item.prio})`);
      }, CONCURRENCY);
    } finally {
      await browser.close();
    }
  } finally {
    previewProc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[prerender] done: ${stats.done} rendered, ${stats.failed} failed, ${stats.skipped} skipped`);
  if (stats.failed > 0 && process.env.PRERENDER_STRICT === '1') {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // Ein gescheiterter Prerender darf den Deploy NICHT abbrechen: das Ergebnis
    // waere eine komplett nicht deploybare Site statt einer Site ohne
    // pre-rendertes HTML. Ohne Prerender faellt Cloudflare ueber die
    // `/*  /index.html  200`-Regel in public/_redirects auf die SPA-Shell
    // zurueck — schlechter fuer Crawler, aber funktionsfaehig.
    //
    // In CI (PRERENDER_STRICT=1) gilt das Gegenteil: dort SOLL ein fehlender
    // Browser hart auffallen, sonst verliert man den Prerender unbemerkt.
    if (e instanceof SetupError) {
      console.error(`[prerender] SETUP FAILED: ${e.message}`);
      if (e.cause) console.error(`[prerender]   cause: ${e.cause.message?.split('\n')[0]}`);
      if (process.env.PRERENDER_STRICT === '1') {
        console.error('[prerender] PRERENDER_STRICT=1 — treating as fatal');
        process.exit(1);
      }
      console.warn('[prerender] WARNUNG: 0 Seiten pre-rendert. Der Build laeuft weiter,');
      console.warn('[prerender] aber Crawler ohne JS-Ausfuehrung sehen nur die SPA-Shell.');
      process.exit(0);
    }
    console.error('[prerender] FATAL:', e);
    process.exit(1);
  });
