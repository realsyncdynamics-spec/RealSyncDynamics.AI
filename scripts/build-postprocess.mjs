// scripts/build-postprocess.mjs — Post-Build-Schritt fuer die Vite-SPA.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARUM DIESES SCRIPT EXISTIERT
// ─────────────────────────────────────────────────────────────────────────────
// Bis 2026-08 lief der Prerender ausschliesslich als Step in
// .github/workflows/deploy-cloudflare-pages.yml. Dessen `deploy`-Job wird
// aber uebersprungen, solange CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
// nicht als Repo-Secrets gesetzt sind — das prerenderte `dist/` landete
// dadurch nur als GitHub-Actions-Artefakt und wurde verworfen.
//
// Live deployt Cloudflares native Git-Integration mit ihrem EIGENEN
// Build-Command (`npm run build`). Der enthielt keinen Prerender. Folge:
// jede Route lieferte denselben leeren SPA-Shell (`<div id="root"></div>`),
// ohne H1, ohne Text, mit identischem <title>. Crawler die kein JS
// ausfuehren (Seobility, LinkedIn, Slack, archive.org) sahen eine leere
// Seite — Score 56 %.
//
// Fix: Der Post-Build haengt jetzt an `npm run build` selbst. Damit greift
// er unabhaengig davon, welcher Deploy-Pfad gerade baut (Cloudflare
// Git-Integration, GitHub Actions, VPS).
//
// ─────────────────────────────────────────────────────────────────────────────
// ROBUSTHEITS-VERTRAG
// ─────────────────────────────────────────────────────────────────────────────
// Dieses Script darf den Build NIEMALS zum Scheitern bringen. Ein
// fehlgeschlagener Prerender (kein Chromium im Build-Image, Timeout, OOM)
// wuerde sonst den kompletten Deploy blockieren — schlechter als eine
// nicht-prerenderte Seite. Darum: alle Fehler werden laut geloggt, der
// Exit-Code bleibt 0.
//
// Ausnahme: PRERENDER_STRICT=1 laesst Fehler durchschlagen (fuer CI-Checks,
// die eine Regression aktiv erkennen sollen).
//
// Env-Flags:
//   SKIP_PRERENDER=1    — ueberspringt Prerender + Chromium-Install komplett
//                         (gesetzt in ci.yml / e2e.yml: dort ist der
//                         Prerender reine Wartezeit)
//   PRERENDER_STRICT=1  — Fehler fuehren zu Exit 1
//   SKIP_SPA_FALLBACK=1 — ueberspringt das Auffuellen der Route-Ordner

import { spawnSync } from 'node:child_process';
import { mkdir, readFile, copyFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const STRICT = process.env.PRERENDER_STRICT === '1';

/**
 * App-Routen, die bewusst NICHT in der sitemap.xml stehen (auth-gated,
 * noindex) — sie brauchen trotzdem eine eigene index.html, damit ein
 * Direktaufruf / Reload nicht auf dem Origin 404 laeuft, falls der
 * `_redirects`-Catch-All mal nicht greift.
 *
 * Bewusst gepflegt statt aus dem Router generiert: der Router kennt
 * Wildcards und Param-Routen, die sich nicht in Ordner uebersetzen lassen.
 */
const APP_ROUTES = [
  '/os', '/os/pricing',
  '/app', '/app/websites', '/app/ai-systems', '/app/automations', '/app/risks',
  '/app/compliance', '/app/evidence', '/app/monitoring',
  '/app/team', '/app/settings', '/app/company', '/assistant',
  '/dashboard', '/command-center',
  '/governance', '/governance/admin', '/governance/agents',
  '/governance/incidents', '/governance/dpias', '/governance/dsr',
  '/governance/vendors', '/governance/reports', '/governance/auditor',
  '/governance/admin-log', '/governance/approvals', '/governance/scans',
  '/evidence', '/monitoring', '/runtime',
  '/settings', '/settings/team', '/settings/security',
  '/settings/account', '/settings/ai-residency', '/settings/api-keys',
  '/billing/usage', '/tenant/invites',
  '/checkout/starter', '/checkout/growth', '/checkout/agency',
  '/checkout/enterprise', '/checkout/scale',
  '/checkout/starter_yearly', '/checkout/growth_yearly',
  '/checkout/agency_yearly', '/checkout/enterprise_yearly',
  '/checkout/scale_yearly',
];

function log(msg) {
  console.log(`[post-build] ${msg}`);
}

function warn(msg) {
  console.warn(`[post-build] WARN: ${msg}`);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chromium fuer Playwright bereitstellen — falls noetig.
 *
 * In CI laeuft der Build im Playwright-Container
 * (mcr.microsoft.com/playwright:v1.59.1-noble, siehe
 * .github/workflows/deploy-cloudflare-pages.yml): dort sind Chromium und
 * alle System-Libs bereits im Image, und diese Funktion ist ein No-Op.
 *
 * Der Install-Zweig existiert nur noch fuer gemanagte Build-Images, die
 * wir NICHT containerisieren koennen — allen voran Cloudflares
 * Pages-Git-Integration, die den Live-Deploy faehrt. Dort gibt es kein
 * root/apt, darum bewusst OHNE `--with-deps`: das greift, wenn die
 * System-Libs schon da sind, und scheitert sonst geraeuschvoll aber
 * folgenlos (der Prerender faellt dann auf "skip" zurueck).
 */
async function ensureChromium() {
  // Ist bereits ein Chromium-Binary da? Playwright weiss selbst, wo es
  // sucht (inkl. PLAYWRIGHT_BROWSERS_PATH) — also fragen statt raten.
  try {
    const { chromium } = await import('playwright');
    const bin = chromium.executablePath();
    if (bin && (await exists(bin))) {
      log(`chromium already provisioned (${bin}) — no install needed`);
      return true;
    }
  } catch {
    // playwright nicht aufloesbar oder kein Binary registriert → Install versuchen
  }

  log('chromium not found — attempting install (non-container build image)...');
  const res = spawnSync('npx', ['--yes', 'playwright', 'install', 'chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    // Auf gemanagten Build-Images kann der Download haengen — hart deckeln,
    // damit der Build nicht ins globale Timeout laeuft.
    timeout: 5 * 60 * 1000,
  });
  if (res.status !== 0) {
    warn(`chromium install exited with ${res.status ?? 'timeout/signal'} — prerender may be skipped`);
    return false;
  }
  return true;
}

function runPrerender() {
  const res = spawnSync('node', [join('scripts', 'prerender.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    timeout: 15 * 60 * 1000,
  });
  return res.status === 0;
}

/**
 * Routen aus der sitemap.xml ziehen — dieselbe Quelle, aus der auch
 * prerender.mjs seine Kandidaten nimmt. Single Source of Truth.
 */
async function sitemapRoutes() {
  // Nach `vite build` liegt die sitemap in dist/; public/ ist der Fallback,
  // falls der Post-Build mal ohne vorherigen Copy-Step laeuft.
  for (const candidate of [join(DIST, 'sitemap.xml'), join(ROOT, 'public', 'sitemap.xml')]) {
    if (!(await exists(candidate))) continue;
    const xml = await readFile(candidate, 'utf8');
    const routes = new Set();
    for (const m of xml.matchAll(/<loc>\s*https?:\/\/[^/]+([^<\s]*)\s*<\/loc>/g)) {
      const path = m[1].replace(/\/$/, '');
      if (path) routes.add(path);
    }
    return routes;
  }
  warn('sitemap.xml not found — spa-fallback covers APP_ROUTES only');
  return new Set();
}

/**
 * Fuer jede Route einen Ordner mit index.html anlegen. Bereits
 * prerenderte Dateien werden NICHT ueberschrieben — die enthalten den
 * echten Content und sind genau das, was wir schuetzen wollen.
 */
async function fillSpaFallback() {
  const src = join(DIST, 'index.html');
  const routes = [...new Set([...(await sitemapRoutes()), ...APP_ROUTES])].sort();

  let filled = 0;
  let keptPrerendered = 0;
  for (const route of routes) {
    const dest = join(DIST, route, 'index.html');
    if (await exists(dest)) {
      keptPrerendered++;
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    filled++;
  }

  // 404.html: Cloudflare Pages liefert die bei Not-Found aus. SPA-Shell
  // rein, damit der Client-Router die Route noch aufloesen kann.
  await copyFile(src, join(DIST, '404.html'));

  log(`spa-fallback: ${filled} filled · ${keptPrerendered} kept-prerendered`);
}

async function main() {
  if (!(await exists(join(DIST, 'index.html')))) {
    warn(`${DIST}/index.html missing — run \`vite build\` first. Nothing to do.`);
    return STRICT ? 1 : 0;
  }

  let prerendered = false;

  if (process.env.SKIP_PRERENDER === '1') {
    log('SKIP_PRERENDER=1 — prerender skipped by request');
  } else {
    await ensureChromium();
    prerendered = runPrerender();
    if (!prerendered) {
      warn(
        'prerender did not complete — dist/ ships as a plain SPA shell. ' +
        'Crawlers without JS will see no content. Check the log above.'
      );
      if (STRICT) return 1;
    }
  }

  if (process.env.SKIP_SPA_FALLBACK !== '1') {
    await fillSpaFallback();
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    // Auch hier: der Build darf nicht sterben.
    warn(`unexpected failure: ${e instanceof Error ? e.stack : String(e)}`);
    process.exit(STRICT ? 1 : 0);
  });
