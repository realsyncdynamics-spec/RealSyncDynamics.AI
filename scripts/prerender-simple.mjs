// Einfaches Prerender ohne Playwright — nutzt den Dev-Server mit fetch
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SITEMAP = join(DIST, 'sitemap.xml');
const BASE_URL = process.env.PRERENDER_BASE_URL || 'http://localhost:3000';

const ROUTES = [
  '/trust',
  '/pilot-readiness',
  '/legal/impressum',
  '/legal/sub-processors',
];

async function renderRoute(route) {
  const url = BASE_URL + route;
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: { 'user-agent': 'prerender-simple' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function writeRoute(route, html) {
  const cleanRoute = route === '/' ? '' : route.replace(/\/$/, '');
  const target = cleanRoute === ''
    ? join(DIST, 'index.html')
    : join(DIST, cleanRoute, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
  console.log(`Wrote ${target}`);
}

async function main() {
  for (const route of ROUTES) {
    try {
      const html = await renderRoute(route);
      await writeRoute(route, html);
    } catch (err) {
      console.error(`FAILED ${route}: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
