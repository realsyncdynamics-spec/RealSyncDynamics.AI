/**
 * Read-only preflight for automatic Supabase Edge Function updates.
 *
 * Deploying a new slug against an at-capacity project returns HTTP 402.
 * A source directory is NOT proof of a deployed function. Refuse to deploy
 * unless every selected slug already exists as ACTIVE in the live inventory.
 *
 * Usage: node scripts/ops/check-live-edge-scope.mjs TARGETS_TXT LIVE_JSON
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function liveEntries(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.functions)) return json.functions;
  if (Array.isArray(json?.result)) return json.result;
  throw new Error('Invalid Supabase function-list response; expected an array of functions');
}

export function requireExistingActiveFunctions(targets, liveJson) {
  if (!Array.isArray(targets) || !targets.every(x => typeof x === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(x))) {
    throw new Error('Invalid target list');
  }
  const entries = liveEntries(liveJson);
  const live = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.slug !== 'string' || typeof entry.status !== 'string') {
      throw new Error('Incomplete live function inventory: cannot verify status and slug');
    }
    live.set(entry.slug, entry.status);
  }

  for (const slug of targets) {
    const status = live.get(slug);
    if (status !== 'ACTIVE') {
      throw new Error('Function ' + slug + ' is ' + (status || 'NOT_DEPLOYED') +
        '; new slot / inactive version requires separate capacity and production approval');
    }
  }
  return targets.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) {
      throw new Error('Usage: node scripts/ops/check-live-edge-scope.mjs TARGETS_TXT LIVE_JSON');
    }
    const targets = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean);
    const live = JSON.parse(readFileSync(process.argv[3], 'utf8'));
    const checked = requireExistingActiveFunctions(targets, live);
    process.stderr.write('[edge-preflight] verified ' + checked + ' existing ACTIVE target(s)\n');
  } catch (e) {
    process.stderr.write('[edge-preflight] BLOCKED: ' + (e instanceof Error ? e.message : String(e)) + '\n');
    process.exitCode = 1;
  }
}
