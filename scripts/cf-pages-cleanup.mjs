// scripts/cf-pages-cleanup.mjs
// Host-spezifischer Post-Build-Schritt für Cloudflare Pages.
//
// Problem (Befund R4): Auf Cloudflare Pages werden SPA-Deep-Links (z. B. /pricing)
// mit HTTP 404 beantwortet, weil das mitgelieferte `dist/404.html` (GitHub-Pages-
// Shim) den `_redirects`-Catch-all (`/*  /index.html  200`) aushebelt. Cloudflare
// serviert dann die 404-Seite statt den 200-SPA-Rewrite.
//
// Fix: Im **Cloudflare-Pages-Build** (Cloudflare setzt `CF_PAGES=1`) wird `dist/404.html`
// entfernt, damit `_redirects` greift und Deep-Links HTTP 200 + index.html liefern.
// In allen anderen Builds (GitHub Pages, lokal, CI) bleibt `404.html` unberührt —
// GitHub Pages benötigt es für seinen eigenen SPA-Fallback.
//
// npm ruft diesen Schritt automatisch als `postbuild`-Lifecycle nach `build` auf.

import { existsSync, rmSync } from 'node:fs';

const target = new URL('../dist/404.html', import.meta.url);

if (process.env.CF_PAGES) {
  if (existsSync(target)) {
    rmSync(target);
    console.log('[cf-pages-cleanup] CF_PAGES erkannt → dist/404.html entfernt; _redirects-SPA-Fallback (200) aktiv.');
  } else {
    console.log('[cf-pages-cleanup] CF_PAGES erkannt, aber dist/404.html nicht vorhanden — nichts zu tun.');
  }
} else {
  console.log('[cf-pages-cleanup] kein CF_PAGES — 404.html bleibt erhalten (GitHub Pages).');
}
