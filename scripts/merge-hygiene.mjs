#!/usr/bin/env node
/**
 * Merge-Hygiene gegen origin/main und (optional) offene Geschwister-PRs.
 *
 * Exit 2 = harter Blocker (Migration gegen main kollidiert oder bestehende
 * Migration wurde editiert). Exit 1 = Warnungen ohne Blocker. Exit 0 = sauber.
 *
 * CI setzt GITHUB_REPOSITORY, GH_TOKEN, PR_NUMBER für Geschwister-Scan.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOT_FILES, isHotPath } from './lib/merge-playbook.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseRef = process.env.MERGE_HYGIENE_BASE || 'origin/main';

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

function ensureBase() {
  try {
    git(`rev-parse --verify ${baseRef}`);
  } catch {
    try {
      git('fetch origin main');
    } catch (error) {
      console.error(`Base ${baseRef} nicht verfügbar: ${error.message}`);
      process.exit(2);
    }
  }
}

function changedFiles() {
  try {
    const out = git(`diff --name-only ${baseRef}...HEAD`);
    return out ? out.split(/\r?\n/).filter(Boolean) : [];
  } catch (error) {
    console.error(`Drei-Punkt-Diff gegen ${baseRef} fehlgeschlagen: ${error.message}`);
    process.exit(2);
  }
}

function migrationTimestamp(filename) {
  const match = path.basename(filename).match(/^(\d{14})_/);
  return match ? match[1] : null;
}

function migrationsOnMain() {
  try {
    const out = git(`ls-tree --name-only ${baseRef} supabase/migrations`);
    return new Set(out ? out.split(/\r?\n/).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function timestampsOnMain() {
  const map = new Map();
  for (const file of migrationsOnMain()) {
    const ts = migrationTimestamp(file);
    if (ts) map.set(ts, file);
  }
  return map;
}

async function githubJson(url) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token || !process.env.GITHUB_REPOSITORY) return null;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'realsync-merge-hygiene',
    },
  });
  if (!response.ok) {
    console.warn(`GitHub API ${response.status} ${url}`);
    return null;
  }
  return response.json();
}

async function siblingOverlaps(localFiles) {
  const repo = process.env.GITHUB_REPOSITORY;
  const self = Number(process.env.PR_NUMBER || 0);
  if (!repo) return [];

  const pulls = [];
  let page = 1;
  while (page <= 5) {
    const batch = await githubJson(
      `https://api.github.com/repos/${repo}/pulls?state=open&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    pulls.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  const overlaps = [];
  const localSet = new Set(localFiles);
  for (const pull of pulls) {
    if (pull.number === self) continue;
    const files = await githubJson(
      `https://api.github.com/repos/${repo}/pulls/${pull.number}/files?per_page=100`,
    );
    if (!Array.isArray(files)) continue;
    const shared = files.map((f) => f.filename).filter((name) => localSet.has(name));
    if (shared.length === 0) continue;
    overlaps.push({
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      files: shared,
      hot: shared.filter(isHotPath),
    });
  }
  return overlaps;
}

ensureBase();

const files = changedFiles();
const blockers = [];
const warnings = [];

const onMain = migrationsOnMain();
const addedMigrations = files.filter(
  (f) => f.startsWith('supabase/migrations/') && f.endsWith('.sql'),
);

for (const file of addedMigrations) {
  if (onMain.has(file)) {
    const dirty = git(`diff --name-only ${baseRef} -- ${file}`);
    if (dirty) {
      blockers.push(
        `Bestehende Migration geändert: ${file}. Append-only — neue Migration schreiben, außer PR-Titel enthält [hotfix].`,
      );
    }
  }
}

const localTs = new Map();
for (const file of addedMigrations) {
  if (onMain.has(file)) continue;
  const ts = migrationTimestamp(file);
  if (!ts) {
    blockers.push(`Migrationsname ohne YYYYMMDDHHMMSS: ${file}`);
    continue;
  }
  if (localTs.has(ts)) {
    blockers.push(`Doppelter Timestamp im PR: ${localTs.get(ts)} und ${file}`);
  }
  localTs.set(ts, file);
}

const mainFiles = timestampsOnMain();
for (const [ts, file] of localTs) {
  const existing = mainFiles.get(ts);
  if (existing && existing !== file) {
    blockers.push(
      `Timestamp ${ts} existiert auf main als ${existing}. Neu: ${file}. → npm run migrate:rename -- ${file}`,
    );
  }
}

if (files.includes('package.json') && !files.includes('package-lock.json')) {
  warnings.push('package.json geändert, package-lock.json nicht. `npm install` und Lockfile mitcommitten.');
}

const hotTouched = files.filter(isHotPath);
if (hotTouched.length) {
  warnings.push(`Hot-Files in diesem Branch: ${hotTouched.join(', ')}`);
}

const overlaps = await siblingOverlaps(files);
const hotOverlaps = overlaps.filter((o) => o.hot.length > 0);
for (const overlap of hotOverlaps) {
  warnings.push(
    `Hot-File-Kollision mit #${overlap.number} (${overlap.title}): ${overlap.hot.join(', ')}`,
  );
}

const report = {
  base: baseRef,
  files: files.length,
  hotTouched,
  blockers,
  warnings,
  siblingOverlaps: overlaps,
  knownHotFiles: HOT_FILES,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Merge-Hygiene gegen ${baseRef} — ${files.length} Dateien`);
  if (hotTouched.length) {
    console.log(`Hot-Files: ${hotTouched.join(', ')}`);
  }
  if (overlaps.length) {
    console.log('Überlappung mit offenen PRs:');
    for (const overlap of overlaps) {
      const mark = overlap.hot.length ? 'HOT' : 'ok';
      console.log(`  [${mark}] #${overlap.number} ${overlap.files.join(', ')}`);
    }
  }
  for (const warning of warnings) console.log(`⚠️  ${warning}`);
  for (const blocker of blockers) console.log(`❌ ${blocker}`);
  if (!blockers.length && !warnings.length) console.log('✅ keine Hygiene-Befunde');
}

if (blockers.length) process.exit(2);
if (warnings.length && process.argv.includes('--strict')) process.exit(1);
process.exit(0);
