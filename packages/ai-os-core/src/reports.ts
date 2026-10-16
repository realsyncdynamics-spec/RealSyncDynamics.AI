// Berichtslogik — reine Funktionen über GitHub-API-Antworten und Repo-Dateien.
//
// Dieselben Funktionen nutzen die Routine-Skripte (scripts/ai-os/routine.mjs)
// und die Edge Function `ai-os-control` für die Live-Ansicht. Eine Zahl im
// Command Center und im Routinebericht entsteht also aus demselben Code.
//
// Datenschutz: Berichte enthalten PR-Nummern, Titel, Workflow- und Jobnamen —
// keine Autoren, keine E-Mail-Adressen, keine Log-Inhalte.

export interface GhLabel { name: string }
export interface GhPull {
  number: number;
  title: string;
  draft?: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
  head: { sha: string; ref: string };
  labels?: GhLabel[];
}
export interface GhCheckRun { name: string; status: string; conclusion: string | null }
export interface GhWorkflowRun {
  id: number;
  name: string | null;
  path?: string;
  head_branch: string | null;
  event: string;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}
export interface GhJob {
  name: string;
  conclusion: string | null;
  steps?: Array<{ name: string; conclusion: string | null }>;
}

export type Health = 'ok' | 'warn' | 'fail' | 'unknown';

export interface CheckSummary {
  total: number;
  passed: number;
  failed: string[];
  pending: number;
  health: Health;
}

const FAILED = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);

export function summarizeChecks(runs: readonly GhCheckRun[]): CheckSummary {
  let passed = 0;
  let pending = 0;
  const failed: string[] = [];
  for (const r of runs) {
    if (r.status !== 'completed') pending += 1;
    else if (r.conclusion && FAILED.has(r.conclusion)) failed.push(r.name);
    else passed += 1;
  }
  const health: Health = runs.length === 0 ? 'unknown' : failed.length > 0 ? 'fail' : pending > 0 ? 'warn' : 'ok';
  return { total: runs.length, passed, failed: [...new Set(failed)].sort(), pending, health };
}

export function isSecurityPull(pull: Pick<GhPull, 'title' | 'labels'>): boolean {
  const title = pull.title.toLowerCase();
  if (/^(fix|feat|chore)\(security\)/.test(title) || title.includes('security') || title.includes('sicherheit')) return true;
  return (pull.labels ?? []).some((l) => /security|sicherheit/i.test(l.name));
}

export function ageInDays(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

export interface PullRow {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  ageDays: number;
  idleDays: number;
  security: boolean;
  checks: CheckSummary | null;
}

export function summarizePulls(
  pulls: readonly GhPull[],
  checksBySha: Readonly<Record<string, CheckSummary>>,
  now: Date,
): PullRow[] {
  return pulls
    .map((p) => ({
      number: p.number,
      title: p.title,
      url: p.html_url,
      draft: !!p.draft,
      ageDays: ageInDays(p.created_at, now),
      idleDays: ageInDays(p.updated_at, now),
      security: isSecurityPull(p),
      checks: checksBySha[p.head.sha] ?? null,
    }))
    .sort((a, b) => b.number - a.number);
}

export interface WorkflowLatest {
  workflow: string;
  path: string;
  status: string | null;
  conclusion: string | null;
  createdAt: string;
  url: string;
  health: Health;
}

export function runHealth(run: Pick<GhWorkflowRun, 'status' | 'conclusion'>): Health {
  if (run.status !== 'completed') return 'warn';
  if (run.conclusion === 'success' || run.conclusion === 'skipped' || run.conclusion === 'neutral') return 'ok';
  if (run.conclusion && FAILED.has(run.conclusion)) return 'fail';
  return 'unknown';
}

/** Neuester Lauf je Workflow (Eingabe beliebig sortiert). */
export function latestPerWorkflow(runs: readonly GhWorkflowRun[]): WorkflowLatest[] {
  const byWorkflow = new Map<string, GhWorkflowRun>();
  for (const r of runs) {
    const key = r.path ?? r.name ?? String(r.id);
    const prev = byWorkflow.get(key);
    if (!prev || Date.parse(r.created_at) > Date.parse(prev.created_at)) byWorkflow.set(key, r);
  }
  return [...byWorkflow.values()]
    .map((r) => ({
      workflow: r.name ?? r.path ?? String(r.id),
      path: r.path ?? '',
      status: r.status,
      conclusion: r.conclusion,
      createdAt: r.created_at,
      url: r.html_url,
      health: runHealth(r),
    }))
    .sort((a, b) => a.workflow.localeCompare(b.workflow));
}

export interface FailedRun {
  id: number;
  workflow: string;
  createdAt: string;
  url: string;
  failedJobs: Array<{ job: string; steps: string[] }>;
}

export function describeFailedJobs(jobs: readonly GhJob[]): Array<{ job: string; steps: string[] }> {
  return jobs
    .filter((j) => j.conclusion && FAILED.has(j.conclusion))
    .map((j) => ({
      job: j.name,
      steps: (j.steps ?? []).filter((s) => s.conclusion && FAILED.has(s.conclusion)).map((s) => s.name),
    }));
}

export interface WeeklyStats {
  merged: number;
  opened: number;
  mainRuns: number;
  mainRunsSucceeded: number;
  /** null, wenn keine abgeschlossenen Läufe — keine erfundene Quote. */
  mainSuccessRate: number | null;
}

export function weeklyStats(
  closedPulls: readonly GhPull[],
  openedPulls: readonly GhPull[],
  mainRuns: readonly GhWorkflowRun[],
  since: Date,
): WeeklyStats {
  const after = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= since.getTime();
  const merged = closedPulls.filter((p) => after(p.merged_at)).length;
  const opened = openedPulls.filter((p) => after(p.created_at)).length;
  const completed = mainRuns.filter((r) => r.status === 'completed' && after(r.created_at));
  const ok = completed.filter((r) => r.conclusion === 'success').length;
  return {
    merged,
    opened,
    mainRuns: completed.length,
    mainRunsSucceeded: ok,
    mainSuccessRate: completed.length === 0 ? null : Math.round((ok / completed.length) * 1000) / 10,
  };
}

// ── Repo-Prüfungen (ohne API) ─────────────────────────────────────────────

export interface ClaimItem { id: string; name: string; status: string; evidence: readonly string[] }
export interface ClaimGap { id: string; name: string; missing: string[] }

/** Beleg ohne Anker: `src/a.ts#evidence-export` → `src/a.ts`. */
export function evidencePath(evidence: string): string {
  return evidence.split('#')[0].trim();
}

/** Nur Belege, die wie Repo-Pfade aussehen, werden geprüft (keine PR-Verweise). */
export function looksLikeRepoPath(evidence: string): boolean {
  const path = evidencePath(evidence);
  return /^[A-Za-z0-9_.\-/[\]]+\.[A-Za-z0-9]+$/.test(path) && path.includes('/');
}

export function findClaimGaps(items: readonly ClaimItem[], fileExists: (p: string) => boolean): ClaimGap[] {
  const gaps: ClaimGap[] = [];
  for (const item of items) {
    if (item.status !== 'live') continue;
    const paths = [...new Set(item.evidence.filter(looksLikeRepoPath).map(evidencePath))];
    const missing = paths.filter((p) => !fileExists(p));
    if (paths.length === 0) gaps.push({ id: item.id, name: item.name, missing: ['(kein Dateibeleg)'] });
    else if (missing.length > 0) gaps.push({ id: item.id, name: item.name, missing });
  }
  return gaps;
}

export interface NoteMeta {
  title?: string;
  owner?: string;
  reviewed?: string;
  status?: string;
}

/** Minimaler YAML-Frontmatter-Leser (nur `key: value`-Zeilen). */
export function parseFrontmatter(text: string): { meta: NoteMeta; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta: meta as NoteMeta, body: text.slice(m[0].length) };
}

export interface NoteIssue { path: string; problem: string }

export const KNOWLEDGE_REVIEW_DAYS = 90;

export function checkKnowledgeNotes(
  notes: ReadonlyArray<{ path: string; content: string }>,
  now: Date,
): NoteIssue[] {
  const issues: NoteIssue[] = [];
  for (const n of notes) {
    const { meta } = parseFrontmatter(n.content);
    if (!meta.title) issues.push({ path: n.path, problem: 'Frontmatter `title` fehlt' });
    if (!meta.owner) issues.push({ path: n.path, problem: 'Frontmatter `owner` fehlt' });
    if (!meta.reviewed || Number.isNaN(Date.parse(meta.reviewed))) {
      issues.push({ path: n.path, problem: 'Frontmatter `reviewed` fehlt oder ist kein Datum' });
    } else if (ageInDays(meta.reviewed, now) > KNOWLEDGE_REVIEW_DAYS) {
      issues.push({ path: n.path, problem: `zuletzt geprüft vor mehr als ${KNOWLEDGE_REVIEW_DAYS} Tagen (${meta.reviewed})` });
    }
  }
  return issues;
}

// ── Markdown-Ausgabe ──────────────────────────────────────────────────────

export interface ReportSection {
  heading: string;
  lines?: string[];
  table?: { head: string[]; rows: string[][] };
  empty?: string;
}

export interface RoutineReport {
  routine: string;
  title: string;
  generatedAt: string;
  health: Health;
  apiCalls: number;
  sections: ReportSection[];
  data: Record<string, unknown>;
}

const HEALTH_LABEL: Record<Health, string> = {
  ok: '🟢 in Ordnung',
  warn: '🟡 Hinweise',
  fail: '🔴 Handlungsbedarf',
  unknown: '⚪ ohne Daten',
};

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function renderMarkdown(report: RoutineReport): string {
  const out: string[] = [
    `## ${report.title}`,
    '',
    `Status: **${HEALTH_LABEL[report.health]}** · erzeugt ${report.generatedAt} · GitHub-API-Aufrufe: ${report.apiCalls}`,
    '',
  ];
  for (const s of report.sections) {
    out.push(`### ${s.heading}`, '');
    const hasTable = !!s.table && s.table.rows.length > 0;
    const hasLines = !!s.lines && s.lines.length > 0;
    if (!hasTable && !hasLines) out.push(s.empty ?? 'Keine Einträge.', '');
    if (hasLines) out.push(...s.lines!.map((l) => `- ${l}`), '');
    if (hasTable) {
      out.push(`| ${s.table!.head.map(cell).join(' | ')} |`, `|${s.table!.head.map(() => '---').join('|')}|`);
      for (const r of s.table!.rows) out.push(`| ${r.map(cell).join(' | ')} |`);
      out.push('');
    }
  }
  return out.join('\n');
}

export function worstHealth(values: readonly Health[]): Health {
  if (values.includes('fail')) return 'fail';
  if (values.includes('warn')) return 'warn';
  if (values.includes('ok')) return 'ok';
  return 'unknown';
}
