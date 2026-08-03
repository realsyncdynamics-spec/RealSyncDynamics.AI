// scripts/prerender.mjs — Static HTML pre-rendering für die Vite-SPA.
//
// Problem: Vite-SPA liefert allen Crawlern denselben dist/index.html-Shell.
// LinkedIn-, Slack-, Archive-, RSS-, älteren Bot-Preview sehen nichts vom
// eigentlichen Content. Auch GoogleBot rendert JS, aber das Indexing-Budget
// ist endlich — pre-rendered Pages ranken besser.
//
// Lösung: Nach `vite build` rendert dieses Script eine Auswahl von Routes
// via Headless-Chromium und schreibt den vollständig hydrierten HTML-State
// als `dist/<route>.html`. Der Cloudflare-Pages-/nginx-Server liefert dann pro
// Route die korrekte HTML statt den SPA-Shell.
//
// Usage:
//   npm run build              # vite build (unverändert)
//   npm run prerender          # NACH build, rendert top-routes
//   npm run build:full         # vite build && prerender
//
// Skipping in CI? `SKIP_PRERENDER=1 npm run prerender` exit 0 ohne work.

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
const TIMEOUT = parseInt(process.env.PRERENDER_TIMEOUT ?? '15000', 10);
// 6 statt 4: seit die Schwelle alle 105 Sitemap-Routen erfasst (vorher 78)
// ist der Prerender der laengste Build-Schritt. Hoeher als 6 lohnt nicht —
// die Cloudflare-Pages-Build-Sandbox hat wenig RAM, und jede Chromium-
// Context kostet dort spuerbar.
const CONCURRENCY = parseInt(process.env.PRERENDER_CONCURRENCY ?? '6', 10);
// Schwelle 0.4 = alles, was in der sitemap.xml steht (niedrigste vergebene
// Priority). Bewusst so: die Sitemap enthaelt ausschliesslich URLs, die
// indexiert werden sollen — eine davon NICHT zu prerendern heisst, sie einem
// Crawler ohne JS als leeren Shell auszuliefern. Die frueheren 0.6 liessen
// 27 der 105 Sitemap-URLs ohne Inhalt zurueck.
// Fuer schnelle lokale Builds weiterhin ueberschreibbar:
//   PRERENDER_PRIORITY_MIN=0.8 npm run build
const PRIORITY_MIN = parseFloat(process.env.PRERENDER_PRIORITY_MIN ?? '0.4');
// Wall-Clock-Obergrenze fuer den GESAMTEN Lauf. Wichtig fuer die Cloudflare-
// Pages-Build-Sandbox: dort kann der Chromium-Download haengen statt sauber
// zu scheitern, und ein Hang wuerde den kompletten Deploy ins Timeout ziehen.
// Ein Fehler ist tolerierbar (Build laeuft ohne Prerender weiter), ein Hang nicht.
//
// 15 min statt 8: mit allen 105 Sitemap-Routen liegt ein gesunder Lauf lokal
// bei ~5,5 min. 8 min waeren auf einem langsameren Build-Runner ein
// Fehlalarm gewesen — der Watchdog haette einen funktionierenden Prerender
// abgeschossen und die Seite ohne Inhalt ausgeliefert. Cloudflare Pages
// bricht Builds erst nach 20 min ab, der Puffer bleibt also erhalten.
const MAX_MS = parseInt(process.env.PRERENDER_MAX_MS ?? '900000', 10);

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

// Referenz auf den laufenden vite-preview-Prozess, damit der Watchdog ihn
// beim harten Abbruch mit beenden kann (das `finally` in main() laeuft dann
// nicht mehr).
let activePreview = null;

// `npx vite preview` startet vite als ENKELPROZESS von npx. Ein kill() auf das
// npx-Handle laesst vite laufen — es haelt Port 4173 und damit potenziell den
// Build-Container. Deshalb spawnen wir in einer eigenen Prozessgruppe
// (detached) und signalisieren die GRUPPE via negativer PID.
function killPreview(signal) {
  const proc = activePreview;
  if (!proc?.pid) return;
  activePreview = null;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    // Gruppe schon weg — Einzelprozess als Rueckfallebene versuchen.
    try { proc.kill(signal); } catch { /* bereits beendet */ }
  }
}

// ─── Vite preview server starten + auf "ready" warten ───────────────────────
async function startPreviewServer() {
  console.log(`[prerender] starting vite preview on port ${PORT}...`);
  const proc = spawn('npx', ['vite', 'preview', `--port=${PORT}`, '--host=127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // eigene Prozessgruppe — siehe killPreview()
  });
  // SOFORT registrieren — nicht erst wenn der Server antwortet. Zwischen Spawn
  // und "ready" liegen bis zu 15s; feuert der Watchdog in diesem Fenster, waere
  // das Child sonst verwaist und wuerde Port 4173 im Build-Container halten.
  activePreview = proc;
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
  killPreview('SIGKILL');
  throw new Error('vite preview did not respond within 15s');
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

// ─── Write HTML to dist/<route>.html ─────────────────────────────────────────
//
// Flaches `<route>.html` statt `<route>/index.html` — das ist kein
// Geschmacksdetail, sondern entscheidet ueber den HTTP-Status der
// Sitemap-URLs. Am Cloudflare-Pages-Preview von PR #947 gemessen:
//
//   dist/pricing/index.html → GET /pricing antwortet 308 auf /pricing/
//                             (Pages normalisiert Directory-Indizes).
//                             Sitemap und <link rel=canonical> zeigen aber
//                             auf /pricing OHNE Slash — damit waere jede
//                             der 105 Sitemap-URLs eine Weiterleitung, und
//                             das Canonical der Zielseite zeigte zurueck.
//   dist/pricing.html       → GET /pricing liefert direkt 200.
//
// Verifiziert: mit flachem Layout 105/105 Sitemap-URLs mit 200 und Content,
// 0 Redirects. nginx (VPS/Docker/Traefik) deckt beide Layouts ab, seit
// `$uri.html` in den try_files-Ketten steht.
async function writeRoute(route, html) {
  const cleanRoute = route === '/' ? '' : route.replace(/\/$/, '');
  const target = cleanRoute === ''
    ? join(DIST, 'index.html')
    : join(DIST, `${cleanRoute}.html`);
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

// ─── Ensure Playwright browsers are installed ───────────────────────────────
async function ensurePlaywrightBrowsers() {
  try {
    const { chromium } = await import('playwright');
    // Try to launch to detect if chromium exists
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    console.log(`[prerender] ✓ Playwright Chromium ready`);
  } catch (e) {
    console.log(`[prerender] Chromium nicht startbar (${e instanceof Error ? e.message.split('\n')[0] : e}) — versuche Installation...`);
    // `--with-deps` ruft intern apt-get und braucht damit root. In der
    // Cloudflare-Pages-Build-Sandbox laeuft der Build NICHT als root, dort
    // scheitert die Variante immer. Deshalb zuerst ohne --with-deps (holt nur
    // den Browser-Download, keine System-Pakete) und erst danach mit.
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
      if (code !== 0) {
        errors.push(`${label}: exit ${code}`);
        continue;
      }
      // Installation meldet Erfolg — aber erst ein echter Launch beweist es.
      try {
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        console.log(`[prerender] ✓ Chromium installiert (${label})`);
        return;
      } catch (launchErr) {
        errors.push(`${label}: installiert, Launch scheiterte (${launchErr instanceof Error ? launchErr.message.split('\n')[0] : launchErr})`);
      }
    }
    throw new Error(`Chromium nicht verfuegbar — ${errors.join(' | ')}`);
  }
}

// ─── Build-Status als Datei ablegen ─────────────────────────────────────────
// Die Cloudflare-Pages-Build-Logs sind nur im Dashboard einsehbar. Damit ohne
// Dashboard-Zugriff nachvollziehbar bleibt, ob ein Deploy prerendert wurde,
// legen wir das Ergebnis in dist/ ab — es wird mitdeployt und ist danach unter
// /prerender-status.json abrufbar.
// Bewusst nur Status + Kurzgrund: keine Stacktraces, keine absoluten Pfade.
async function writeStatus(fields) {
  const sanitize = (s) => String(s ?? '')
    .split('\n')[0]
    .replaceAll(ROOT, '.')
    .replace(/\/[^\s:]*\/(node_modules|\.cache)\/\S*/g, '<pfad>')
    .slice(0, 300);
  const payload = { ...fields, at: new Date().toISOString() };
  if (payload.reason) payload.reason = sanitize(payload.reason);
  try {
    await mkdir(DIST, { recursive: true });
    await writeFile(join(DIST, 'prerender-status.json'), JSON.stringify(payload, null, 2), 'utf8');
  } catch { /* Status ist Diagnose, nie ein Grund den Build zu kippen */ }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Sanity: dist/index.html muss existieren
  try { await access(join(DIST, 'index.html')); }
  catch {
    console.error(`[prerender] FATAL: ${DIST}/index.html missing — run vite build first`);
    await writeStatus({ ok: false, rendered: 0, reason: 'dist/index.html fehlt — vite build lief nicht' });
    process.exit(2);
  }

  await ensurePlaywrightBrowsers();

  const routes = await loadRoutes();
  console.log(`[prerender] ${routes.length} routes (priority >= ${PRIORITY_MIN}) to render`);

  const previewProc = await startPreviewServer();

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
  await writeStatus({ ok: stats.failed === 0, rendered: stats.done, failed: stats.failed, skipped: stats.skipped });
  if (stats.failed > 0 && process.env.PRERENDER_STRICT === '1') {
    process.exit(1);
  }
}

// Watchdog: haerteste Absicherung gegen einen Hang. Laeuft als unref'ter Timer
// (blockiert den Event-Loop nicht) und beendet den Prozess hart, falls MAX_MS
// ueberschritten wird — inkl. vite-preview-Child, das sonst weiterlaufen wuerde.
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
