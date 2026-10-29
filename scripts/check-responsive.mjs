#!/usr/bin/env node
/**
 * WP8a — Viewport-Smoke-Messung (keine UI-Änderung)
 *
 * Misst je Route × Viewport:
 *   - Horizontaler Overflow (welches Element)
 *   - Tap-Ziele < 24 px (Breite oder Höhe)
 *   - Inputs mit Schriftgröße < 16 px (löst iOS-Zoom aus)
 *   - three.js-Network-Requests
 *
 * Exit 0 immer — CI: continue-on-error, nur Advisory-Warnung.
 *
 * Nutzung:
 *   BASE_URL=https://realsyncdynamics-ai.pages.dev node scripts/check-responsive.mjs
 *   node scripts/check-responsive.mjs   # → verwendet pages.dev
 */

import { chromium } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL ?? 'https://realsyncdynamics-ai.pages.dev').replace(/\/$/, '');
const COMMIT    = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
const TIMEOUT   = 20_000;

const VIEWPORTS = [
  { width: 360,  height: 800,  label: '360'  },
  { width: 390,  height: 844,  label: '390'  },
  { width: 768,  height: 1024, label: '768'  },
  { width: 1024, height: 768,  label: '1024' },
  { width: 1440, height: 900,  label: '1440' },
];

// (?)-Pfad aufgelöst: Agent-Register = /app/ai-systems/agents (App.tsx:901)
const ROUTES = [
  { path: '/',                      label: 'Startseite'     },
  { path: '/audit',                  label: 'Audit'          },
  { path: '/pricing',                label: 'Pricing'        },
  { path: '/login',                  label: 'Login'          },
  { path: '/welcome',                label: 'Welcome'        },
  { path: '/app/activation',         label: 'App-Activation' },
  { path: '/app/dashboard',          label: 'App-Dashboard'  },
  { path: '/app/ai-systems/agents',  label: 'Agent-Register' },
];

function pad(s, w) {
  const str = String(s ?? '');
  return str.length >= w ? str.slice(0, w - 1) + '…' : str + ' '.repeat(w - str.length);
}

async function probe(browser, route, vp) {
  const isMobile = vp.width <= 430;
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    userAgent: isMobile
      ? 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36'
      : undefined,
  });
  const page = await ctx.newPage();

  const threejsRequests = [];
  page.on('request', req => {
    const u = req.url();
    // vendor-viz = Vite-Chunk für three/@react-three/postprocessing (Production-Build)
    if (u.includes('/three') || u.includes('three.module') || u.endsWith('.glb') || u.endsWith('.gltf') || u.includes('vendor-viz')) {
      threejsRequests.push(u.replace(BASE_URL, '').slice(0, 60));
    }
  });

  let loadOk = false;
  try {
    const resp = await page.goto(BASE_URL + route.path, {
      waitUntil: 'load',
      timeout: TIMEOUT,
    });
    loadOk = (resp?.status() ?? 0) < 400;
    // Warten auf React-Hydration / Lazy-Komponenten (networkidle mit Fallback)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  } catch {
    await ctx.close();
    return { loadOk: false, overflow: [], tapTargets: [], smallInputs: [], threejsRequests: [] };
  }

  const [overflow, tapTargets, smallInputs] = await Promise.all([
    page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      if (sw <= vw + 1) return [];
      const found = [];
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2 && r.width > 8) {
          const tag  = el.tagName.toLowerCase();
          const cls  = typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/)[0] : '';
          found.push(tag + cls);
          if (found.length >= 3) break;
        }
      }
      return found;
    }),

    page.evaluate(() => {
      const sel = 'a, button, [role="button"], input[type="submit"], input[type="button"], label[for]';
      const found = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)) {
          found.push({
            tag:  el.tagName.toLowerCase(),
            text: (el.textContent ?? '').trim().slice(0, 20),
            w:    Math.round(r.width),
            h:    Math.round(r.height),
          });
          if (found.length >= 3) break;
        }
      }
      return found;
    }),

    page.evaluate(() => {
      const found = [];
      for (const el of document.querySelectorAll('input:not([type="hidden"]), textarea, select')) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 16) {
          found.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type') ?? '', fs: Math.round(fs * 10) / 10 });
          if (found.length >= 3) break;
        }
      }
      return found;
    }),
  ]).catch(() => [[], [], []]);

  await ctx.close();
  return { loadOk, overflow, tapTargets, smallInputs, threejsRequests };
}

async function main() {
  console.log('WP8a — Responsive Viewport-Messung');
  console.log(`Basis: ${BASE_URL}  Commit: ${COMMIT}`);
  console.log(`Zeit:  ${new Date().toISOString()}\n`);
  console.log(pad('Route', 18) + pad('VP', 7) + pad('Status', 9) + 'Befunde');
  console.log('─'.repeat(80));

  let browser;
  const findings = [];

  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        let result;
        try {
          result = await probe(browser, route, vp);
        } catch (e) {
          result = { loadOk: false, overflow: [], tapTargets: [], smallInputs: [], threejsRequests: [] };
        }

        const issues = [];
        if (!result.loadOk) {
          issues.push('LOAD-FEHLER');
        } else {
          if (result.overflow.length)     issues.push(`Overflow(${result.overflow.join(', ')})`);
          if (result.tapTargets.length)   issues.push(`Tap<24px(${result.tapTargets.map(t => `${t.tag}:${t.w}×${t.h}`).join(', ')})`);
          if (result.smallInputs.length)  issues.push(`Input<16px(${result.smallInputs.map(i => `${i.tag}:${i.fs}px`).join(', ')})`);
          if (result.threejsRequests.length) issues.push(`three.js(${result.threejsRequests.length})`);
        }

        const status = issues.length ? 'BEFUND' : 'OK';
        console.log(
          pad(route.label, 18) +
          pad(vp.label + 'px', 7) +
          pad(status, 9) +
          issues.join(' | '),
        );

        if (issues.length) {
          findings.push({ route: route.label, path: route.path, viewport: vp.label, issues });
        }
      }
    }
  } finally {
    await browser?.close();
  }

  console.log('\n' + '─'.repeat(80));
  if (findings.length === 0) {
    console.log('Keine Befunde. Alle Routen × Viewports unauffällig.');
  } else {
    console.log(`${findings.length} Befund(e) — advisory (exit 0, nicht blockierend):\n`);
    // Markdown-Tabelle für PR-Text
    console.log('| Route | Viewport | Befunde |');
    console.log('|-------|----------|---------|');
    for (const f of findings) {
      console.log(`| ${f.route} (${f.path}) | ${f.viewport}px | ${f.issues.join('<br>')} |`);
    }
  }

  console.log('\nHinweis: Lighthouse-Messung (LCP/CLS/INP) für / und /audit manuell gegen');
  console.log('pages.dev durchführen und Werte im PR-Text ergänzen (Commit: ' + COMMIT + ').');
  console.log('\ncheck:responsive abgeschlossen — exit 0 (advisory).');
  // Immer exit 0
}

main().catch(e => {
  console.error('check:responsive: Fehler (exit 0 — advisory):', e?.message ?? e);
  process.exit(0);
});
