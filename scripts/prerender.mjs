// scripts/prerender.mjs — Static HTML pre-rendering fuer die Vite-SPA.
//
// Timeouts (Defaults, Env-override):
//   PRERENDER_GOTO_MS        10000  Navigation bis DOMContentLoaded
//   PRERENDER_HYDRATE_MS      3500  #root / title / kurzer networkidle
//   PRERENDER_PREVIEW_MS     10000  vite preview ready
//   PRERENDER_MAX_MS        360000  Gesamtlauf (Watchdog)
//   PRERENDER_CONCURRENCY        6
//   PRERENDER_PRIORITY_MIN     0.6
//   PRERENDER_TIMEOUT           Alias fuer GOTO_MS (Rueckwaertskompatibel)
//
// networkidle auf der vollen 15s-Goto-Zeit war der teuerste Pfad.

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SITEMAP = join(DIST, 'sitemap.xml');

const PORT = parseInt(process.env.PRERENDER_PORT ?? '4173', 10);
const BASE_URL = `http://localhost:${PORT}`;
const GOTO_MS = parseInt(process.env.PRERENDER_GOTO_MS ?? process.env.PRERENDER_TIMEOUT ?? '10000', 10);
const HYDRATE_MS = parseInt(process.env.PRERENDER_HYDRATE_MS ?? '3500', 10);
const PREVIEW_MS = parseInt(process.env.PRERENDER_PREVIEW_MS ?? '10000', 10);
const CONCURRENCY = parseInt(process.env.PRERENDER_CONCURRENCY ?? '6', 10);
const PRIORITY_MIN = parseFloat(process.env.PRERENDER_PRIORITY_MIN ?? '0.6');
const MAX_MS = parseInt(process.env.PRERENDER_MAX_MS ?? '360000', 10);

if (process.env.SKIP_PRERENDER === '1') {
  console.log('[prerender] SKIP_PRERENDER=1 — exit 0 without work');
  process.exit(0);
}

async function loadRoutes() {
  let xml;
  try {
    xml = await readFile(SITEMAP, 'utf8');
  } catch {
    console.error(`[prerender] FATAL: ${SITEMAP} nicht gefunden. Run vite build first.`);
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

let activePreview = null;

function killPreview(signal) {
  const proc = activePreview;
  if (!proc?.pid) return;
  activePreview = null;
  try { process.kill(-proc.pid, signal); } catch {
    try { proc.kill(signal); } catch { /* already gone */ }
  }
}

async function startPreviewServer() {
  console.log(`[prerender] starting vite preview on port ${PORT}...`);
  const proc = spawn('npx', ['vite', 'preview', `--port=${PORT}`, '--host=127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  activePreview = proc;
  proc.stdout.on('data', (d) => process.stdout.write(`[vite-preview] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[vite-preview] ${d}`));

  const deadline = Date.now() + PREVIEW_MS;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE_URL + '/');
      if (r.ok) {
        console.log(`[prerender] vite preview ready after ${PREVIEW_MS - (deadline - Date.now())}ms`);
        return proc;
      }
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  killPreview('SIGKILL');
  throw new Error(`vite preview did not respond within ${PREVIEW_MS}ms`);
}

async function stripRuntimeOnlyState(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-reveal-root]')) {
      el.removeAttribute('data-reveal-root');
    }
    for (const el of document.querySelectorAll('[data-reveal]')) {
      el.classList.remove('is-revealed');
      el.style.removeProperty('--reveal-delay');
      if (el.getAttribute('style') === '') el.removeAttribute('style');
    }
  });
}

async function renderRoute(browser, route) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
    await page.waitForSelector('#root', { state: 'attached', timeout: HYDRATE_MS }).catch(() => {});
    await page.waitForFunction(
      () => {
        const root = document.querySelector('#root');
        return Boolean(root && root.childElementCount > 0 && (document.title || '').length > 0);
      },
      { timeout: HYDRATE_MS },
    ).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: HYDRATE_MS }).catch(() => {});
    await stripRuntimeOnlyState(page);
    return await page.content();
  } finally {
    await context.close();
  }
}

async function writeRoute(route, html) {
  const cleanRoute = route === '/' ? '' : route.replace(/\/$/, '');
  const target = cleanRoute === '' ? join(DIST, 'index.html') : join(DIST, `${cleanRoute}.html`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

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

async function ensurePlaywrightBrowsers() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    console.log('[prerender] ✓ Playwright Chromium ready');
  } catch (e) {
    console.log(`[prerender] Chromium nicht startbar (${e instanceof Error ? e.message.split('\n')[0] : e}) — versuche Installation...`);
    const variants = [
      ['playwright', 'install', 'chromium'],
      ['playwright', 'install', '--with-deps', 'chromium'],
    ];
    const errors = [];
    for (const args of variants) {
      const label = args.includes('--with-deps') ? 'mit --with-deps' : 'ohne --with-deps';
      const code = await new Promise((resolve) => {
        const proc = spawn('npx', args, { stdio: ['ignore', 'inherit', 'inherit'] });
        proc.on('close', resolve);
        proc.on('error', () => resolve(-1));
      });
      if (code !== 0) { errors.push(`${label}: exit ${code}`); continue; }
      try {
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        console.log(`[prerender] ✓ Chromium installiert (${label})`);
        return;
      } catch (launchErr) {
        errors.push(`${label}: Launch scheiterte (${launchErr instanceof Error ? launchErr.message.split('\n')[0] : launchErr})`);
      }
    }
    throw new Error(`Chromium nicht verfuegbar — ${errors.join(' | ')}`);
  }
}

async function writeStatus(fields) {
  const sanitize = (s) => String(s ?? '').split('\n')[0].replaceAll(ROOT, '.').slice(0, 300);
  const payload = { ...fields, at: new Date().toISOString() };
  if (payload.reason) payload.reason = sanitize(payload.reason);
  try {
    await mkdir(DIST, { recursive: true });
    await writeFile(join(DIST, 'prerender-status.json'), JSON.stringify(payload, null, 2), 'utf8');
  } catch { /* diagnose only */ }
}

async function main() {
  try { await access(join(DIST, 'index.html')); }
  catch {
    console.error(`[prerender] FATAL: ${DIST}/index.html missing — run vite build first`);
    await writeStatus({ ok: false, rendered: 0, reason: 'dist/index.html fehlt — vite build lief nicht' });
    process.exit(2);
  }

  await ensurePlaywrightBrowsers();
  const routes = await loadRoutes();
  console.log(`[prerender] ${routes.length} routes (priority >= ${PRIORITY_MIN})`);
  console.log(`[prerender] timeouts goto=${GOTO_MS}ms hydrate=${HYDRATE_MS}ms preview=${PREVIEW_MS}ms max=${MAX_MS}ms concurrency=${CONCURRENCY}`);

  await startPreviewServer();
  let stats = { done: 0, failed: 0, skipped: 0 };
  try {
    const browser = await chromium.launch({ headless: true });
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
    killPreview('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[prerender] done: ${stats.done} rendered, ${stats.failed} failed, ${stats.skipped} skipped`);
  await writeStatus({
    ok: stats.failed === 0,
    rendered: stats.done,
    failed: stats.failed,
    skipped: stats.skipped,
    timeouts: { gotoMs: GOTO_MS, hydrateMs: HYDRATE_MS, previewMs: PREVIEW_MS, maxMs: MAX_MS, concurrency: CONCURRENCY },
  });
  if (stats.failed > 0 && process.env.PRERENDER_STRICT === '1') process.exit(1);
}

const watchdog = setTimeout(() => {
  console.error(`[prerender] ABBRUCH: ${MAX_MS}ms Zeitlimit ueberschritten (PRERENDER_MAX_MS).`);
  killPreview('SIGKILL');
  process.exit(process.env.PRERENDER_STRICT === '1' ? 1 : 0);
}, MAX_MS);
watchdog.unref();

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error('[prerender] FATAL:', e);
    await writeStatus({ ok: false, rendered: 0, reason: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  });
