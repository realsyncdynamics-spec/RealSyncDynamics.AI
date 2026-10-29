#!/usr/bin/env node
// AI-OS-Routinen — Einstiegspunkt für die Workflows `.github/workflows/ai-os-*.yml`.
//
//   node scripts/ai-os/routine.mjs <command>
//
// Commands: github-status · ci-failures · weekly-report · security-infra ·
//           claims-evidence · docs-control
//
// Läuft in GitHub Actions (Node ≥ 22, Type-Stripping für packages/ai-os-core).
// Liest GITHUB_TOKEN und GITHUB_REPOSITORY aus der Umgebung, schreibt die
// Job-Summary nach $GITHUB_STEP_SUMMARY und den Bericht nach
// ai-os-report/ai-os-report.json (Upload als Artefakt im Workflow).
//
// Grenzen je Routine: packages/ai-os-core/src/routines.ts (`limits`).
// Exit-Codes: 0 = Bericht erzeugt (auch bei Befunden), 1 = Routine selbst
// fehlgeschlagen (Konfiguration, API, Budget). Befunde färben den Bericht,
// nicht den Lauf — sonst wäre „rot" doppeldeutig.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const core = await import('../../packages/ai-os-core/src/index.ts');

const COMMANDS = {
  'github-status': 'daily-github-status',
  'ci-failures': 'ci-failure-analysis',
  'weekly-report': 'weekly-dev-report',
  'security-infra': 'security-infra-check',
  'claims-evidence': 'claims-evidence-check',
  'docs-control': 'docs-control',
};

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function githubClient(routine) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) fail('GITHUB_TOKEN und GITHUB_REPOSITORY müssen gesetzt sein.');
  return core.createGithubClient({
    token,
    repo,
    maxCalls: routine.limits.maxApiCalls,
    maxAttempts: routine.limits.maxAttempts,
  });
}

const exists = (p) => existsSync(join(ROOT, p));

function walkMarkdown(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    const full = join(abs, name);
    if (statSync(full).isDirectory()) out.push(...walkMarkdown(relative(ROOT, full)));
    else if (name.endsWith('.md')) out.push(relative(ROOT, full));
  }
  return out;
}

async function claimsEvidence(now) {
  const { IMPLEMENTATION_ITEMS, IMPLEMENTATION_MEASURED_AT } = await import('../../src/product/implementation-status.ts');
  const gaps = core.findClaimGaps(IMPLEMENTATION_ITEMS, exists);
  const live = IMPLEMENTATION_ITEMS.filter((i) => i.status === 'live').length;
  const measuredAge = core.ageInDays(IMPLEMENTATION_MEASURED_AT, now);
  return {
    routine: 'claims-evidence-check',
    title: 'Implementierungsrisiken: live-Aussagen ohne Beleg',
    generatedAt: now.toISOString(),
    health: gaps.length > 0 ? 'fail' : measuredAge > 30 ? 'warn' : 'ok',
    apiCalls: 0,
    sections: [
      {
        heading: 'Übersicht',
        lines: [
          `Einträge mit Status live: ${live}`,
          `Zuletzt vermessen: ${IMPLEMENTATION_MEASURED_AT} (vor ${measuredAge} Tagen)`,
        ],
      },
      {
        heading: `live ohne vorhandene Belegdatei (${gaps.length})`,
        table: { head: ['ID', 'Name', 'Fehlende Belege'], rows: gaps.map((g) => [g.id, g.name, g.missing.join(', ')]) },
        empty: 'Jeder live-Eintrag verweist auf mindestens eine vorhandene Datei.',
      },
    ],
    data: { gaps, live, measuredAt: IMPLEMENTATION_MEASURED_AT },
  };
}

function docsControl(now) {
  const registryErrors = core.validateRegistry(exists);
  const notes = walkMarkdown('docs/ai-os').map((p) => ({ path: p, content: readFileSync(join(ROOT, p), 'utf8') }));
  const noteIssues = core.checkKnowledgeNotes(notes, now);
  const secretHits = notes
    .map((n) => ({ path: n.path, hits: core.findSecretLikeContent(n.content) }))
    .filter((n) => n.hits.length > 0);
  const budget = spawnSync(process.execPath, ['scripts/check-context-budget.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const budgetOk = budget.status === 0;
  const budgetTail = `${budget.stdout ?? ''}${budget.stderr ?? ''}`.trim().split('\n').slice(-6);
  const health = core.worstHealth([
    registryErrors.length || secretHits.length || !budgetOk ? 'fail' : 'ok',
    noteIssues.length ? 'warn' : 'ok',
  ]);
  return {
    routine: 'docs-control',
    title: 'Dokumentationskontrolle',
    generatedAt: now.toISOString(),
    health,
    apiCalls: 0,
    sections: [
      { heading: `Kontextbudget (npm run check:context): ${budgetOk ? 'grün' : 'ROT'}`, lines: budgetTail },
      { heading: `AI-OS-Register (${registryErrors.length} Fehler)`, lines: registryErrors, empty: 'Register konsistent: Skills, Workflows, Agenten und Aktionen passen zusammen.' },
      {
        heading: `Wissensnotizen docs/ai-os (${notes.length} Dateien, ${noteIssues.length} Hinweise)`,
        table: { head: ['Datei', 'Hinweis'], rows: noteIssues.map((i) => [i.path, i.problem]) },
        empty: 'Alle Notizen haben title, owner und ein aktuelles Prüfdatum.',
      },
      {
        heading: 'Zugangsdaten-Muster in Notizen',
        lines: secretHits.map((s) => `${s.path}: ${s.hits.join(', ')}`),
        empty: 'Keine Treffer.',
      },
    ],
    data: { registryErrors, noteIssues, secretHits: secretHits.map((s) => s.path), budgetOk },
  };
}

async function main() {
  const command = process.argv[2];
  const routineId = COMMANDS[command];
  if (!routineId) fail(`Unbekannter Befehl "${command ?? ''}". Erlaubt: ${Object.keys(COMMANDS).join(', ')}`);
  const routine = core.getRoutine(routineId);
  if (!routine) fail(`Routine ${routineId} fehlt im Register.`);
  const now = new Date();

  let report;
  switch (command) {
    case 'github-status':
      report = await core.collectGithubStatus(githubClient(routine), now, { maxCheckLookups: routine.limits.maxApiCalls - 5 });
      break;
    case 'ci-failures':
      report = await core.collectCiFailures(githubClient(routine), now, { days: 3, maxRuns: 10 });
      break;
    case 'weekly-report':
      report = await core.collectWeekly(githubClient(routine), now);
      break;
    case 'security-infra':
      report = await core.collectSecurityInfra(githubClient(routine), now);
      break;
    case 'claims-evidence':
      report = await claimsEvidence(now);
      break;
    case 'docs-control':
      report = docsControl(now);
      break;
  }

  const markdown = core.renderMarkdown(report);
  const outDir = join(ROOT, 'ai-os-report');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'ai-os-report.json'),
    JSON.stringify({ ...report, limits: routine.limits, runId: process.env.GITHUB_RUN_ID ?? null }, null, 2),
  );
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  else console.log(markdown);
  console.log(`[ai-os] ${routine.id}: health=${report.health} apiCalls=${report.apiCalls}/${routine.limits.maxApiCalls}`);
}

main().catch((e) => fail(`${e?.name ?? 'Error'}: ${e?.message ?? e}`));
