#!/usr/bin/env node
/**
 * Rebase des aktuellen Branch auf origin/main.
 *
 *   npm run sync:main
 *   npm run sync:main -- --push
 *
 * Kein force-push ohne --push. --push nutzt --force-with-lease.
 * Bei Konflikten: Playbook, Exit 1, Rebase bleibt offen zum Lösen.
 */

import { execSync, spawnSync } from 'node:child_process';
import { classifyPath, playbookFor } from './lib/merge-playbook.mjs';

const args = new Set(process.argv.slice(2));
const wantPush = args.has('--push');
const abortRebase = args.has('--abort');

function run(command, commandArgs, opts = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    ...opts,
  });
  return result;
}

function gitCapture(gitArgs) {
  return execSync(`git ${gitArgs}`, { encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

try {
  gitCapture('rev-parse --is-inside-work-tree');
} catch {
  fail('Kein Git-Repository.');
}

const branch = gitCapture('rev-parse --abbrev-ref HEAD');
if (branch === 'main' || branch === 'master') {
  fail(`Auf ${branch} — sync:main ist nur für Feature-Branches.`);
}

if (abortRebase) {
  const abort = run('git', ['rebase', '--abort']);
  process.exit(abort.status ?? 1);
}

const dirty = run('git', ['status', '--porcelain'], { capture: true });
if (dirty.stdout && dirty.stdout.trim()) {
  fail('Working tree ist nicht sauber. Committen oder stashen, dann erneut `npm run sync:main`.');
}

console.log(`▶ fetch origin/main`);
const fetch = run('git', ['fetch', 'origin', 'main']);
if (fetch.status !== 0) fail('git fetch origin main fehlgeschlagen.');

const aheadBehind = gitCapture('rev-list --left-right --count origin/main...HEAD');
console.log(`▶ ${branch} vs origin/main (behind/ahead): ${aheadBehind.replace('\t', '/')}`);

console.log(`▶ rebase origin/main`);
const rebase = run('git', ['rebase', 'origin/main']);
if (rebase.status !== 0) {
  let unmerged = [];
  try {
    const out = gitCapture('diff --name-only --diff-filter=U');
    unmerged = out ? out.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    unmerged = [];
  }
  console.error('');
  console.error('✗ Rebase hat Konflikte. Nicht im GitHub-Web-Editor lösen.');
  console.error('  1. Datei nach Playbook mergen');
  console.error('  2. git add <datei>');
  console.error('  3. git rebase --continue');
  console.error('  4. npm run lint && npm test');
  console.error('  5. npm run sync:main -- --push');
  console.error('  Abbruch: npm run sync:main -- --abort');
  console.error('');
  for (const file of unmerged) {
    const kind = classifyPath(file);
    console.error(`── ${file} [${kind}]`);
    console.error(playbookFor(kind));
    console.error('');
  }
  process.exit(1);
}

console.log('✓ rebase sauber');
console.log('▶ nächster Schritt: npm run lint && npm test');

if (wantPush) {
  console.log(`▶ git push --force-with-lease origin ${branch}`);
  const push = run('git', ['push', '--force-with-lease', 'origin', branch]);
  if (push.status !== 0) fail('Push fehlgeschlagen. Remote hat sich geändert — erneut sync:main.');
  console.log('✓ Branch aktualisiert');
} else {
  console.log('Push bewusst ausgelassen. Nach Tests: npm run sync:main -- --push');
}
