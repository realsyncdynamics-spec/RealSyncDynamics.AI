// scripts/verify-prerender.mjs — Regressions-Wächter für die SEO-Sichtbarkeit.
//
// Prüft das gebaute `dist/` auf genau den Fehler, der die Live-Site im
// August 2026 auf Seobility 56 % gedrückt hat: jede Route lieferte
// denselben leeren SPA-Shell (`<div id="root"></div>`) — kein H1, kein
// Text, identischer <title> auf allen URLs.
//
// Der Check ist absichtlich grob. Er misst keine SEO-Qualität, sondern
// beantwortet eine einzige Frage: *Steht der Content im HTML, bevor JS
// läuft?* Genau das sehen Crawler ohne JS-Rendering.
//
// Usage:
//   npm run build && npm run verify:prerender
//   VERIFY_MIN_ROUTES=20 npm run verify:prerender
//
// Exit 1, wenn der Shell-Zustand zurück ist. Exit 0 sonst.

import { readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
// VERIFY_DIST erlaubt es, den Check gegen ein beliebiges Verzeichnis zu
// fahren — genutzt von test/seo/verifyPrerender.test.ts mit Fixtures.
const DIST = process.env.VERIFY_DIST ? resolve(process.env.VERIFY_DIST) : join(ROOT, 'dist');

// Wie viele prerenderte Routen wir mindestens erwarten. prerender.mjs
// rendert alles mit sitemap-priority >= 0.6 (aktuell 76 Routen) — die
// Schwelle liegt bewusst darunter, damit ein einzelner Render-Timeout den
// Check nicht rot macht.
const MIN_ROUTES = parseInt(process.env.VERIFY_MIN_ROUTES ?? '20', 10);

// Ab wann gilt eine Seite als "hat echten Text"?
// Gemessen am 2026-08-02-Build: der reine SPA-Shell kommt auf ~419 Zeichen
// (noscript-Hinweis + Meta-Reste), eine prerenderte Landing-Page auf
// 7.000+. Die Schwelle liegt bewusst deutlich ueber dem Shell-Wert, damit
// "Shell mit ein bisschen Boilerplate" nicht als Content durchgeht.
const MIN_TEXT_CHARS = parseInt(process.env.VERIFY_MIN_TEXT_CHARS ?? '1500', 10);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Sichtbaren Text grob schätzen: Tags raus, script/style-Inhalte raus. */
function visibleTextLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function firstH1(html) {
  return /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? null;
}

function title(html) {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
}

/**
 * Alle HTML-Seiten in dist/ einsammeln — ohne fs.glob (Node-agnostisch).
 *
 * Erfasst beide Layouts: das flache `<route>.html` (aktuell, siehe
 * prerender.mjs → writeRoute) und `<route>/index.html` (Alt-Layout, falls
 * noch Reste eines frueheren Builds herumliegen).
 *
 * 404.html bleibt aussen vor: das IST bewusst der SPA-Shell und wuerde den
 * Content-Check sonst faelschlich rot faerben.
 */
async function collectPages(dir, base = '') {
  const { readdir } = await import('node:fs/promises');
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'assets' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectPages(full, `${base}/${entry.name}`)));
    } else if (entry.name === '404.html') {
      continue;
    } else if (entry.name === 'index.html') {
      out.push({ route: base || '/', file: full });
    } else if (entry.name.endsWith('.html')) {
      out.push({ route: `${base}/${entry.name.replace(/\.html$/, '')}`, file: full });
    }
  }
  return out;
}

async function main() {
  const indexPath = join(DIST, 'index.html');
  if (!(await exists(indexPath))) {
    console.error('[verify] FATAL: dist/index.html fehlt — erst `npm run build` laufen lassen.');
    return 2;
  }

  const failures = [];

  // ── Check 1: Die Startseite muss H1 + echten Text im HTML haben ──────────
  const home = await readFile(indexPath, 'utf8');
  const homeH1 = firstH1(home);
  const homeText = visibleTextLength(home);

  if (!homeH1) {
    failures.push('Startseite (dist/index.html) hat kein <h1> im HTML — SPA-Shell wird ausgeliefert.');
  }
  if (homeText < MIN_TEXT_CHARS) {
    failures.push(`Startseite hat nur ~${homeText} Zeichen sichtbaren Text (erwartet >= ${MIN_TEXT_CHARS}).`);
  }

  // ── Check 2: Genug Routen prerendert, nicht nur SPA-Fallback-Kopien ──────
  const pages = await collectPages(DIST);
  for (const p of pages) {
    const html = await readFile(p.file, 'utf8');
    p.textLen = visibleTextLength(html);
    p.title = title(html);
    p.h1 = firstH1(html);
  }
  const real = pages.filter((p) => p.textLen >= MIN_TEXT_CHARS);
  if (real.length < MIN_ROUTES) {
    failures.push(
      `Nur ${real.length} von ${pages.length} Routen haben Content im HTML ` +
      `(erwartet >= ${MIN_ROUTES}). Prerender ist vermutlich nicht gelaufen.`
    );
  }

  // ── Check 3: Titles dürfen nicht auf allen Routen identisch sein ─────────
  const uniqueTitles = new Set(real.map((p) => p.title).filter(Boolean));
  if (real.length > 5 && uniqueTitles.size < 3) {
    failures.push(
      `Alle prerenderten Routen teilen sich ${uniqueTitles.size} <title> — ` +
      'SEOHead hat beim Rendern nicht gegriffen.'
    );
  }

  // ── Check 4: Ueberschriften-Hierarchie ──────────────────────────────────
  // Genau ein h1 pro Seite, keine uebersprungenen Level (h2 → h4).
  // Seobility bewertet beides direkt ab. Vor dem Fix in diesem Branch:
  // 5 Seiten ohne h1, 82 Seiten mit Level-Sprung (fast alle durch ein
  // h4 im geteilten Footer-Shell).
  const noH1 = [];
  const manyH1 = [];
  const skips = [];
  for (const p of real) {
    const html = await readFile(p.file, 'utf8');
    const body = html.split('<body')[1] ?? html;
    const levels = [...body.matchAll(/<h([1-6])[^>]*>/g)].map((m) => Number(m[1]));
    if (levels.length === 0) continue;
    const h1s = levels.filter((l) => l === 1).length;
    if (h1s === 0) noH1.push(p.route);
    else if (h1s > 1) manyH1.push(`${p.route} (${h1s}×)`);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        skips.push(`${p.route} (h${levels[i - 1]}→h${levels[i]})`);
        break;
      }
    }
  }
  const list = (arr, max = 5) =>
    arr.slice(0, max).join(', ') + (arr.length > max ? `, … (+${arr.length - max})` : '');

  if (noH1.length > 0) failures.push(`${noH1.length} Seite(n) ohne <h1>: ${list(noH1)}`);
  if (manyH1.length > 0) failures.push(`${manyH1.length} Seite(n) mit mehreren <h1>: ${list(manyH1)}`);
  if (skips.length > 0) failures.push(`${skips.length} Seite(n) mit uebersprungenem Heading-Level: ${list(skips)}`);

  // ── Report ──────────────────────────────────────────────────────────────
  console.log(`[verify] ${pages.length} HTML-Dateien · ${real.length} mit Content · ${uniqueTitles.size} unterschiedliche Titles`);
  console.log(`[verify] Headings: ${noH1.length} ohne h1 · ${manyH1.length} mit mehreren h1 · ${skips.length} mit Level-Sprung`);
  console.log(`[verify] Startseite: H1=${homeH1 ? JSON.stringify(homeH1.slice(0, 60)) : 'KEINE'} · ~${homeText} Zeichen Text`);

  if (failures.length > 0) {
    console.error('\n[verify] FEHLGESCHLAGEN:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error(
      '\n  Hintergrund: Ohne Prerender liefert die SPA jedem Crawler ohne\n' +
      '  JS-Rendering eine leere Seite. Siehe scripts/build-postprocess.mjs.'
    );
    return 1;
  }

  console.log('[verify] OK — Content steht im ausgelieferten HTML.');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('[verify] FATAL:', e);
    process.exit(2);
  });
