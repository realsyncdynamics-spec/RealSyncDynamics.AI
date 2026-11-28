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
import { findClaim, isException } from './lib/claim-match.mjs';

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

/** Einzeln begründete Ausnahmen { file, text, reason } aus LANDING_CLAIM_EXCEPTIONS. */
function extractExceptions(src) {
  const block = src.match(/export const LANDING_CLAIM_EXCEPTIONS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) return [];
  return [...block[1].matchAll(/file:\s*'([^']+)',\s*text:\s*'([^']+)',\s*reason:\s*'([^']+)'/g)].map((m) => ({ file: m[1], text: m[2], reason: m[3], used: 0 }));
}

const FORBIDDEN = extractForbiddenClaims(registrySrc);
const EXCEPTIONS = extractExceptions(registrySrc);
const NON_LIVE = extractNonLiveItems(registrySrc);

const SCOPE_DIRS = [
  join(root, 'src/pages'),
  join(root, 'src/components/landing'),
  join(root, 'src/config'),
  join(root, 'src/i18n'),
];

const EXTRA_FILES = [
  join(root, 'src/features/billing/PricingPage.tsx'),
  // AP-0.8: öffentliche Fallback-Seite und Social-Banner tragen ebenfalls Aussagen.
  join(root, 'index.html'),
  join(root, 'public/brand/linkedin-banner-1584x396.svg'),
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

// Beta-Texte aus der Konfiguration landen direkt in Hero und Ribbon.
const SCOPE_FILES = [join(root, 'src/config/beta.ts')];

const files = [
  ...SCOPE_DIRS.flatMap((d) => {
    try {
      return walk(d);
    } catch {
      return [];
    }
  }),
  ...EXTRA_FILES,
  ...SCOPE_FILES,
];

let failed = false;

// AP-0.8: normalisierter Abgleich, siehe scripts/lib/claim-match.mjs
for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(root, file);
  const lines = src.split(/\r?\n/);
  for (const phrase of FORBIDDEN) {
    lines.forEach((line, n) => {
      if (findClaim(line, phrase)) {
        const ex = isException(rel, line, EXCEPTIONS);
        if (ex) {
          ex.used++;
          return;
        }
        console.error(`::error file=${rel},line=${n + 1}::Forbidden live claim "${phrase}"`);
        failed = true;
      }
    });
  }
}

// Veraltete Ausnahmen fallen auf, statt still liegen zu bleiben.
for (const ex of EXCEPTIONS) {
  if (!ex.used) {
    console.error(`::error file=src/product/implementation-status.ts::Ausnahme ohne Treffer (veraltet): ${ex.file} – "${ex.text}"`);
    failed = true;
  }
}

// Channel tools / platform cards must not label non-live registry names as PRODUCT
// without Preview / Coming Soon / IN VORBEREITUNG in the same file.
for (const item of NON_LIVE) {
  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
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
  `✓ Landing claims OK (${FORBIDDEN.length} forbidden phrases, ${EXCEPTIONS.length} documented exceptions, ${NON_LIVE.length} non-live items checked).`,
);
