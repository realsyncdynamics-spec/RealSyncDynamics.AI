#!/usr/bin/env node
/**
 * Landing claim hygiene — extends CTA Enforcement style.
 *
 * Fails if public landing surfaces assert unqualified “complete / vollständig”
 * live promises. Reads forbidden phrases + non-live item names from
 * src/product/implementation-status.ts (SSoT).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const registryPath = join(root, 'src/product/implementation-status.ts');
const registrySrc = readFileSync(registryPath, 'utf8');

/** Pull string literals from LANDING_FORBIDDEN_LIVE_CLAIMS array. */
function extractForbiddenClaims(src) {
  const block = src.match(
    /export const LANDING_FORBIDDEN_LIVE_CLAIMS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  if (!block) {
    console.error('::error::LANDING_FORBIDDEN_LIVE_CLAIMS missing in implementation-status.ts');
    process.exit(2);
  }
  return [...block[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]);
}

/** Non-live items: { id, name, status } from IMPLEMENTATION_ITEMS. */
function extractNonLiveItems(src) {
  const items = [];
  const itemRe =
    /\{\s*id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?status:\s*'(live|preview|coming-soon)'/g;
  let m;
  while ((m = itemRe.exec(src))) {
    if (m[3] !== 'live') items.push({ id: m[1], name: m[2], status: m[3] });
  }
  return items;
}

const FORBIDDEN = extractForbiddenClaims(registrySrc);
const NON_LIVE = extractNonLiveItems(registrySrc);

const SCOPE_DIRS = [
  join(root, 'src/pages'),
  join(root, 'src/components/landing'),
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const files = SCOPE_DIRS.flatMap((d) => {
  try {
    return walk(d);
  } catch {
    return [];
  }
});

let failed = false;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  for (const phrase of FORBIDDEN) {
    if (src.includes(phrase)) {
      console.error(`::error file=${rel}::Forbidden live claim "${phrase}"`);
      failed = true;
    }
  }
}

// Channel tools / platform cards must not label non-live registry names as PRODUCT
// without Preview / Coming Soon / IN VORBEREITUNG in the same file.
for (const item of NON_LIVE) {
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes(item.name)) continue;
    const rel = relative(root, file);
    if (rel.includes('LandingRoadmapSection')) continue;
    const hasHonesty =
      /PREVIEW|COMING SOON|IN VORBEREITUNG|Coming Soon|status:\s*'preview'|status:\s*'coming-soon'|isImplementationLive|getImplementation/.test(
        src,
      );
    if (!hasHonesty && /\bPRODUCT\b/.test(src)) {
      console.error(
        `::error file=${rel}::Non-live "${item.name}" (${item.status}) near PRODUCT without Preview badge`,
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('');
  console.error('Landing claims must match src/product/implementation-status.ts.');
  process.exit(1);
}

console.log(
  `✓ Landing claims OK (${FORBIDDEN.length} forbidden phrases, ${NON_LIVE.length} non-live items checked).`,
);
