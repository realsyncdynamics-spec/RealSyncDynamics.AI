// Sammler — holen GitHub-Daten über einen budgetierten Client und bauen daraus
// einen RoutineReport. Gemeinsam genutzt von den Routinen (GitHub Actions) und
// der Live-Ansicht im Command Center (Edge Function `ai-os-control`).

import type { GithubClient } from './github.ts';
import {
  describeFailedJobs,
  latestPerWorkflow,
  summarizeChecks,
  summarizePulls,
  weeklyStats,
  worstHealth,
  type CheckSummary,
  type FailedRun,
  type GhCheckRun,
  type GhJob,
  type GhPull,
  type GhWorkflowRun,
  type Health,
  type RoutineReport,
} from './reports.ts';

/** Workflows, deren letzter Lauf auf main die Sicherheits-/Infrastrukturlage beschreibt. */
export const GUARD_WORKFLOWS: ReadonlyArray<{ file: string; label: string }> = [
  { file: 'codeql.yml', label: 'CodeQL' },
  { file: 'migration-drift.yml', label: 'Migration-Drift' },
  { file: 'edge-function-drift.yml', label: 'Edge-Function-Drift' },
  { file: 'function-acl-drift.yml', label: 'Function-ACL-Drift' },
  { file: 'entitlement-drift.yml', label: 'Entitlement-Drift' },
  { file: 'cron-health.yml', label: 'Cron-Health' },
  { file: 'deploy-cloudflare-pages.yml', label: 'Deploy Cloudflare Pages' },
  { file: 'deploy.yml', label: 'Deploy Supabase' },
];

const isoDaysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const dateOnly = (iso: string) => iso.slice(0, 10);

async function listOpenPulls(client: GithubClient): Promise<GhPull[]> {
  return client.get<GhPull[]>('/pulls?state=open&per_page=100&sort=created&direction=desc');
}

async function checksFor(client: GithubClient, sha: string): Promise<CheckSummary> {
  const res = await client.get<{ check_runs: GhCheckRun[] }>(`/commits/${sha}/check-runs?per_page=100`);
  return summarizeChecks(res.check_runs ?? []);
}

export async function collectGithubStatus(
  client: GithubClient,
  now: Date,
  opts: { maxCheckLookups: number },
): Promise<RoutineReport> {
  const pulls = await listOpenPulls(client);
  const checksBySha: Record<string, CheckSummary> = {};
  const toCheck = pulls.slice(0, Math.max(0, opts.maxCheckLookups));
  for (const p of toCheck) checksBySha[p.head.sha] = await checksFor(client, p.head.sha);
  const rows = summarizePulls(pulls, checksBySha, now);

  const since = dateOnly(isoDaysAgo(now, 1));
  const runs = await client.get<{ workflow_runs: GhWorkflowRun[] }>(
    `/actions/runs?branch=main&per_page=100&created=%3E%3D${since}`,
  );
  const mainLatest = latestPerWorkflow(runs.workflow_runs ?? []);

  const failingPulls = rows.filter((r) => r.checks?.health === 'fail' && !r.draft);
  const mainFailing = mainLatest.filter((w) => w.health === 'fail');
  const health: Health = worstHealth([
    mainFailing.length > 0 ? 'fail' : 'ok',
    failingPulls.length > 0 ? 'warn' : 'ok',
  ]);

  return {
    routine: 'daily-github-status',
    title: 'GitHub-Status',
    generatedAt: now.toISOString(),
    health,
    apiCalls: client.calls(),
    sections: [
      {
        heading: `main — letzte Läufe je Workflow (seit ${since})`,
        table: {
          head: ['Workflow', 'Ergebnis', 'Zeit'],
          rows: mainLatest.map((w) => [w.workflow, w.conclusion ?? w.status ?? '—', w.createdAt]),
        },
        empty: 'Keine Läufe auf main im Zeitraum.',
      },
      {
        heading: `Offene Pull Requests (${rows.length}, davon ${rows.filter((r) => r.draft).length} Entwürfe)`,
        table: {
          head: ['PR', 'Titel', 'Entwurf', 'Alter (Tage)', 'Checks'],
          rows: rows.map((r) => [
            `#${r.number}`,
            r.title,
            r.draft ? 'ja' : 'nein',
            String(r.ageDays),
            r.checks ? `${r.checks.passed}/${r.checks.total} ok${r.checks.failed.length ? `, rot: ${r.checks.failed.join(', ')}` : ''}` : 'nicht geprüft (Budget)',
          ]),
        },
        empty: 'Keine offenen Pull Requests.',
      },
    ],
    data: { pulls: rows, mainLatest, uncheckedPulls: Math.max(0, pulls.length - toCheck.length) },
  };
}

export async function collectCiFailures(
  client: GithubClient,
  now: Date,
  opts: { days: number; maxRuns: number },
): Promise<RoutineReport> {
  const since = dateOnly(isoDaysAgo(now, opts.days));
  const res = await client.get<{ workflow_runs: GhWorkflowRun[] }>(
    `/actions/runs?branch=main&status=failure&per_page=50&created=%3E%3D${since}`,
  );
  const runs = (res.workflow_runs ?? []).slice(0, opts.maxRuns);
  const failed: FailedRun[] = [];
  for (const run of runs) {
    const jobs = await client.get<{ jobs: GhJob[] }>(`/actions/runs/${run.id}/jobs?per_page=100`);
    failed.push({
      id: run.id,
      workflow: run.name ?? run.path ?? String(run.id),
      createdAt: run.created_at,
      url: run.html_url,
      failedJobs: describeFailedJobs(jobs.jobs ?? []),
    });
  }
  // Ist der neueste Lauf je Workflow inzwischen grün, ist der Fehler behoben.
  const latest = await client.get<{ workflow_runs: GhWorkflowRun[] }>(
    `/actions/runs?branch=main&per_page=100&created=%3E%3D${since}`,
  );
  const stillRed = latestPerWorkflow(latest.workflow_runs ?? []).filter((w) => w.health === 'fail');
  return {
    routine: 'ci-failure-analysis',
    title: 'CI-Fehleranalyse (main)',
    generatedAt: now.toISOString(),
    health: stillRed.length > 0 ? 'fail' : failed.length > 0 ? 'warn' : 'ok',
    apiCalls: client.calls(),
    sections: [
      {
        heading: 'Aktuell rot (neuester Lauf je Workflow)',
        lines: stillRed.map((w) => `${w.workflow} — ${w.conclusion} — ${w.url}`),
        empty: 'Kein Workflow ist auf main aktuell rot.',
      },
      {
        heading: `Fehlgeschlagene Läufe seit ${since} (max. ${opts.maxRuns})`,
        table: {
          head: ['Workflow', 'Zeit', 'Fehlgeschlagene Jobs › Schritte', 'Lauf'],
          rows: failed.map((f) => [
            f.workflow,
            f.createdAt,
            f.failedJobs.map((j) => `${j.job}${j.steps.length ? ` › ${j.steps.join(', ')}` : ''}`).join('; ') || '—',
            f.url,
          ]),
        },
        empty: 'Keine fehlgeschlagenen Läufe im Zeitraum.',
      },
    ],
    data: { failed, stillRed },
  };
}

export async function collectWeekly(client: GithubClient, now: Date): Promise<RoutineReport> {
  const sinceDate = new Date(now.getTime() - 7 * 86_400_000);
  const closed = await client.get<GhPull[]>('/pulls?state=closed&sort=updated&direction=desc&per_page=100');
  const all = await client.get<GhPull[]>('/pulls?state=all&sort=created&direction=desc&per_page=100');
  const runs = await client.get<{ workflow_runs: GhWorkflowRun[] }>(
    `/actions/runs?branch=main&per_page=100&created=%3E%3D${dateOnly(sinceDate.toISOString())}`,
  );
  const stats = weeklyStats(closed, all, runs.workflow_runs ?? [], sinceDate);
  const merged = closed
    .filter((p) => p.merged_at && Date.parse(p.merged_at) >= sinceDate.getTime())
    .sort((a, b) => Date.parse(b.merged_at!) - Date.parse(a.merged_at!));
  return {
    routine: 'weekly-dev-report',
    title: 'Wöchentlicher Entwicklungsbericht',
    generatedAt: now.toISOString(),
    health: stats.mainSuccessRate === null ? 'unknown' : stats.mainSuccessRate < 80 ? 'warn' : 'ok',
    apiCalls: client.calls(),
    sections: [
      {
        heading: 'Kennzahlen (7 Tage)',
        lines: [
          `Gemergte PRs: ${stats.merged}`,
          `Neue PRs: ${stats.opened}`,
          `Abgeschlossene Workflow-Läufe auf main: ${stats.mainRuns}`,
          `Davon erfolgreich: ${stats.mainRunsSucceeded}${stats.mainSuccessRate === null ? '' : ` (${stats.mainSuccessRate} %)`}`,
        ],
      },
      {
        heading: 'Gemergt',
        lines: merged.map((p) => `#${p.number} ${p.title}`),
        empty: 'Keine gemergten PRs im Zeitraum.',
      },
    ],
    data: { stats, merged: merged.map((p) => ({ number: p.number, title: p.title, mergedAt: p.merged_at })) },
  };
}

export async function collectSecurityInfra(client: GithubClient, now: Date): Promise<RoutineReport> {
  const guards: Array<{ label: string; file: string; health: Health; conclusion: string; createdAt: string; url: string }> = [];
  for (const g of GUARD_WORKFLOWS) {
    try {
      const res = await client.get<{ workflow_runs: GhWorkflowRun[] }>(
        `/actions/workflows/${g.file}/runs?branch=main&per_page=1`,
      );
      const latest = latestPerWorkflow(res.workflow_runs ?? [])[0];
      guards.push(latest
        ? { label: g.label, file: g.file, health: latest.health, conclusion: latest.conclusion ?? latest.status ?? '—', createdAt: latest.createdAt, url: latest.url }
        : { label: g.label, file: g.file, health: 'unknown', conclusion: 'kein Lauf auf main', createdAt: '—', url: '' });
    } catch (e) {
      if ((e as Error).name === 'GithubBudgetExceeded') throw e;
      guards.push({ label: g.label, file: g.file, health: 'unknown', conclusion: 'nicht abrufbar', createdAt: '—', url: '' });
    }
  }
  const pulls = summarizePulls(await listOpenPulls(client), {}, now).filter((p) => p.security);
  const health = worstHealth([
    ...guards.map((g) => g.health),
    pulls.some((p) => p.ageDays > 7) ? 'warn' : 'ok',
  ]);
  return {
    routine: 'security-infra-check',
    title: 'Sicherheits- und Infrastrukturprüfung',
    generatedAt: now.toISOString(),
    health,
    apiCalls: client.calls(),
    sections: [
      {
        heading: 'Guards und Deploys — letzter Lauf auf main',
        table: { head: ['Prüfung', 'Ergebnis', 'Zeit'], rows: guards.map((g) => [g.label, g.conclusion, g.createdAt]) },
      },
      {
        heading: `Offene Sicherheits-PRs (${pulls.length})`,
        lines: pulls.map((p) => `#${p.number} ${p.title} — offen seit ${p.ageDays} Tagen${p.draft ? ' (Entwurf)' : ''}`),
        empty: 'Keine offenen PRs mit Sicherheitsbezug.',
      },
    ],
    data: { guards, securityPulls: pulls },
  };
}
