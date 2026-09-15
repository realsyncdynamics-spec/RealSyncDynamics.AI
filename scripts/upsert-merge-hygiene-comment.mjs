#!/usr/bin/env node
/**
 * Aktualisiert den einzelnen Merge-Hygiene-Kommentar am PR.
 * Erwartet hygiene.json in RUNNER_TEMP oder als erstes Argument.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { COMMENT_MARKER } from './lib/merge-playbook.mjs';

const reportPath = process.argv[2] || `${process.env.RUNNER_TEMP}/hygiene.json`;
const repo = process.env.GITHUB_REPOSITORY;
const pr = process.env.PR_NUMBER;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!repo || !pr || !token) {
  console.log('Kein PR-Kontext — Kommentar übersprungen.');
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const lines = [
  COMMENT_MARKER,
  '## Merge-Hygiene',
  '',
  `Gegen \`${report.base}\` · ${report.files} Dateien.`,
  '',
];

if (report.hotTouched.length) {
  lines.push('**Hot-Files in diesem PR**');
  for (const file of report.hotTouched) lines.push(`- \`${file}\``);
  lines.push('');
}

if (report.siblingOverlaps.length) {
  lines.push(
    '**Überlappung mit offenen PRs** — den älteren PR zuerst mergen, danach `npm run sync:main`.',
  );
  for (const overlap of report.siblingOverlaps) {
    const tag = overlap.hot.length ? 'hot' : 'overlap';
    lines.push(
      `- [${tag}] #${overlap.number} — ${overlap.files.map((f) => `\`${f}\``).join(', ')}`,
    );
  }
  lines.push('');
}

if (report.blockers.length) {
  lines.push('**Blocker**');
  for (const blocker of report.blockers) lines.push(`- ${blocker}`);
  lines.push('');
}

if (report.warnings.length) {
  lines.push('**Hinweise**');
  for (const warning of report.warnings) lines.push(`- ${warning}`);
  lines.push('');
}

if (!report.blockers.length && !report.warnings.length) {
  lines.push('Keine Hygiene-Befunde gegen `main` und keine Hot-File-Kollision.');
  lines.push('');
}

lines.push('Playbook: [`docs/MERGE_CONFLICT_CONCEPT.md`](../blob/main/docs/MERGE_CONFLICT_CONCEPT.md) · Sync: `npm run sync:main`');
const body = lines.join('\n');
const bodyFile = `${process.env.RUNNER_TEMP || '.'}/merge-hygiene-comment.md`;
writeFileSync(bodyFile, body);

const env = { ...process.env, GH_TOKEN: token };
const list = spawnSync('gh', ['api', `repos/${repo}/issues/${pr}/comments`], {
  encoding: 'utf8',
  env,
});

let commentId = '';
if (list.status === 0) {
  const comments = JSON.parse(list.stdout || '[]');
  const found = comments.find((c) => String(c.body || '').includes(COMMENT_MARKER));
  if (found) commentId = String(found.id);
}

if (commentId) {
  const payloadFile = `${process.env.RUNNER_TEMP || '.'}/merge-hygiene-comment.json`;
  writeFileSync(payloadFile, JSON.stringify({ body }));
  const patched = spawnSync(
    'gh',
    ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${commentId}`, '--input', payloadFile],
    { stdio: 'inherit', env },
  );
  if (patched.status !== 0) process.exit(patched.status ?? 1);
} else {
  const created = spawnSync(
    'gh',
    ['pr', 'comment', pr, '--repo', repo, '--body-file', bodyFile],
    { stdio: 'inherit', env },
  );
  if (created.status !== 0) process.exit(created.status ?? 1);
}

const hasHot = report.siblingOverlaps.some((o) => o.hot.length);
const labelArgs = hasHot
  ? ['pr', 'edit', pr, '--repo', repo, '--add-label', 'hot-file']
  : ['pr', 'edit', pr, '--repo', repo, '--remove-label', 'hot-file'];
spawnSync('gh', labelArgs, { stdio: 'inherit', env });
