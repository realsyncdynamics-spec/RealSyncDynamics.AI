#!/usr/bin/env node
/**
 * Edge-Function Inventory (read-only)
 *
 * Diffs supabase/functions/* (repo) against the live project (Management API).
 * Used by P0 Track 2 (Deploy-Manifest) to keep an accurate gap list without
 * relying on manual counting.
 *
 * Usage:
 *   node scripts/edge-function-inventory.mjs
 *   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_ID=ebljyceifhnlzhjfyxup \
 *     node scripts/edge-function-inventory.mjs
 *
 * Exit 0 always (informational). Does not mutate anything.
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');

function repoFunctions() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => {
      if (name.startsWith('_')) return false;
      const p = join(FUNCTIONS_DIR, name);
      return statSync(p).isDirectory() && existsSync(join(p, 'index.ts'));
    })
    .sort();
}

async function liveFunctions() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_ID;
  if (!token || !ref) return null;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Management-API ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return (data || []).map((f) => f.slug ?? f.name).filter(Boolean).sort();
}

const repo = repoFunctions();
console.log(`Repo functions (with index.ts): ${repo.length}`);

const live = await liveFunctions();
if (live === null) {
  console.log('Live list skipped (set SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID for full diff).');
  console.log('First 20 repo slugs:', repo.slice(0, 20).join(', '), repo.length > 20 ? '…' : '');
  process.exit(0);
}

const repoSet = new Set(repo);
const liveSet = new Set(live);

const missing = repo.filter((s) => !liveSet.has(s)); // in repo, not live
const orphans = live.filter((s) => !repoSet.has(s)); // live, not in repo
const both = repo.filter((s) => liveSet.has(s));

console.log(`Live functions:              ${live.length}`);
console.log(`Present in both:             ${both.length}`);
console.log(`Missing (repo → need deploy): ${missing.length}`);
console.log(`Orphans (live → need delete): ${orphans.length}`);
console.log('');

if (orphans.length) {
  console.log('ORPHANS (live but not in repo):');
  orphans.forEach((s) => console.log(`  - ${s}`));
  console.log('');
}

if (missing.length) {
  console.log('MISSING (first 40):');
  missing.slice(0, 40).forEach((s) => console.log(`  - ${s}`));
  if (missing.length > 40) console.log(`  … +${missing.length - 40} more`);
}
