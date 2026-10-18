// Reine Ableitungen aus dem erfassten Zustand: Workflow-Phasen, Hinweise,
// Parser für git und gh, Formatierung. Keine `$`-Aufrufe, keine Schätzwerte.

import type {
  McAgent,
  McChange,
  McCheck,
  McGit,
  McGithub,
  McIssue,
  McPr,
  McPrCheck,
  McReading,
  McSafetyEvent,
  McTask,
  McTurn,
} from '../types'

export type PhaseState = 'erledigt' | 'läuft' | 'offen' | 'blockiert' | 'fehlgeschlagen' | 'unbekannt'
export type Phase = { name: string; state: PhaseState; evidence: string }
export type HintLevel = 'kritisch' | 'warnung' | 'info'
export type Hint = { level: HintLevel; text: string }

export const WARN_PERCENT = 70
export const CRITICAL_PERCENT = 85

/** Der letzte Lauf je Prüfungsart seit `since`. */
export function latestChecks(checks: readonly McCheck[], since: number): McCheck[] {
  const byKind = new Map<string, McCheck>()
  for (const check of checks) {
    if (check.at >= since) byKind.set(check.kind, check)
  }
  return [...byKind.values()]
}

/** Aufgabe → Analyse → Implementierung → Test → Review → Freigabe, je mit Beleg. */
export function phases(turn: McTurn | null, checks: readonly McCheck[], github: McGithub | null): Phase[] {
  if (turn === null) {
    return [{ name: 'Aufgabe', state: 'offen', evidence: 'Noch kein Auftrag in dieser Sitzung erfasst' }]
  }
  const ran = latestChecks(checks, turn.startedAt)
  const failed = ran.filter(c => !c.isOk)
  const test: Phase =
    failed.length > 0
      ? { name: 'Test', state: 'fehlgeschlagen', evidence: failed.map(c => `${c.kind} ✗`).join(', ') }
      : ran.length > 0
        ? { name: 'Test', state: 'erledigt', evidence: ran.map(c => `${c.kind} ✓`).join(', ') }
        : { name: 'Test', state: 'offen', evidence: turn.edits > 0 ? 'Keine Prüfung seit den Änderungen' : 'Noch keine Prüfung ausgeführt' }
  return [
    { name: 'Aufgabe', state: 'erledigt', evidence: turn.prompt },
    turn.reads > 0
      ? { name: 'Analyse', state: 'erledigt', evidence: `${turn.reads} Lese-/Suchzugriffe` }
      : { name: 'Analyse', state: 'offen', evidence: 'Noch keine Lesezugriffe' },
    turn.edits > 0
      ? { name: 'Implementierung', state: 'erledigt', evidence: `${turn.edits} Dateiänderungen` }
      : { name: 'Implementierung', state: 'offen', evidence: 'Noch keine Dateiänderungen' },
    test,
    reviewPhase(github),
    releasePhase(github),
  ]
}

function reviewPhase(github: McGithub | null): Phase {
  if (github === null || !github.isOk) {
    return { name: 'Review', state: 'unbekannt', evidence: 'GitHub-Status nicht verfügbar' }
  }
  const pr = github.current
  if (pr === null) {
    return { name: 'Review', state: 'offen', evidence: 'Kein offener PR für diesen Branch' }
  }
  if (pr.review === 'APPROVED') return { name: 'Review', state: 'erledigt', evidence: `PR #${pr.number} freigegeben` }
  if (pr.review === 'CHANGES_REQUESTED') return { name: 'Review', state: 'blockiert', evidence: `PR #${pr.number}: Änderungen angefordert` }
  return { name: 'Review', state: 'läuft', evidence: `PR #${pr.number}${pr.isDraft ? ' (Entwurf)' : ''} wartet auf Review` }
}

function releasePhase(github: McGithub | null): Phase {
  const pr = github?.isOk ? github.current : null
  if (pr && pr.review === 'APPROVED' && ciState(pr) === 'grün' && pr.mergeable !== 'CONFLICTING') {
    return { name: 'Freigabe', state: 'läuft', evidence: 'Bereit – Merge und Deploy nur nach separater Freigabe' }
  }
  return { name: 'Freigabe', state: 'offen', evidence: 'Merge und Deploy brauchen eine separate Freigabe' }
}

export type CiState = 'grün' | 'rot' | 'läuft' | 'keine Checks'

export function ciState(pr: McPr): CiState {
  if (pr.checks.length === 0) return 'keine Checks'
  if (pr.checks.some(c => /^(FAILURE|ERROR|TIMED_OUT|CANCELLED|ACTION_REQUIRED|STARTUP_FAILURE)$/.test(c.state))) return 'rot'
  if (pr.checks.some(c => /^(PENDING|QUEUED|IN_PROGRESS|EXPECTED|WAITING|REQUESTED)$/.test(c.state))) return 'läuft'
  return 'grün'
}

export function failingChecks(pr: McPr): string[] {
  return pr.checks.filter(c => /^(FAILURE|ERROR|TIMED_OUT|CANCELLED|ACTION_REQUIRED|STARTUP_FAILURE)$/.test(c.state)).map(c => c.name)
}

/** Ob eine Aufgabe auf eine noch nicht erledigte Aufgabe wartet. */
export function isBlocked(task: McTask, tasks: readonly McTask[]): boolean {
  return task.status !== 'completed' && task.blockedBy.some(id => tasks.find(t => t.id === id)?.status !== 'completed')
}

export type Inputs = {
  readings: readonly McReading[]
  checks: readonly McCheck[]
  git: McGit | null
  github: McGithub | null
  tasks: readonly McTask[]
  agents: readonly McAgent[]
  safety: readonly McSafetyEvent[]
  turn: McTurn | null
}

/** Warnungen, Blocker und empfohlene nächste Schritte, nur aus erfassten Daten. */
export function hints(i: Inputs): Hint[] {
  const out: Hint[] = []
  for (const event of i.safety.filter(s => s.decision === 'wartet')) {
    out.push({ level: 'kritisch', text: `Freigabe ausstehend: ${event.label} (${event.category})` })
  }
  const reading = i.readings[i.readings.length - 1]
  if (reading !== undefined && reading.percent >= CRITICAL_PERCENT) {
    out.push({ level: 'kritisch', text: `Kontext ${reading.percent} %: Arbeitsstand dokumentieren, dann /compact oder neue Sitzung` })
  } else if (reading !== undefined && reading.percent >= WARN_PERCENT) {
    out.push({ level: 'warnung', text: `Kontext ${reading.percent} %: /compact erwägen` })
  }
  for (const check of latestChecks(i.checks, 0).filter(c => !c.isOk)) {
    out.push({ level: 'kritisch', text: `Letzte Prüfung fehlgeschlagen (${check.kind}): ${short(check.command, 60)}` })
  }
  const pr = i.github?.isOk ? i.github.current : null
  if (pr) {
    if (pr.mergeable === 'CONFLICTING') out.push({ level: 'kritisch', text: `PR #${pr.number} hat Merge-Konflikte: npm run sync:main` })
    const failing = failingChecks(pr)
    if (failing.length > 0) out.push({ level: 'kritisch', text: `CI rot auf PR #${pr.number}: ${failing.slice(0, 3).join(', ')}` })
    if (pr.review === 'CHANGES_REQUESTED') out.push({ level: 'warnung', text: `PR #${pr.number}: Review fordert Änderungen` })
  }
  for (const task of i.tasks.filter(t => isBlocked(t, i.tasks))) {
    out.push({ level: 'warnung', text: `Blockiert: ${short(task.subject, 60)}` })
  }
  for (const agent of i.agents.filter(a => a.status === 'failed' || a.status === 'killed')) {
    out.push({ level: 'warnung', text: `Agent ${agent.status === 'failed' ? 'fehlgeschlagen' : 'abgebrochen'}: ${short(agent.description, 50)}` })
  }
  if (i.git?.isOk) {
    const lastEdit = i.turn !== null && i.turn.edits > 0 ? i.turn.startedAt : null
    if (i.git.changes.length > 0 && lastEdit !== null && latestChecks(i.checks, lastEdit).length === 0) {
      out.push({ level: 'info', text: `${i.git.changes.length} lokale Änderungen ohne anschließende Prüfung: npm test / npm run build` })
    }
    if ((i.git.behind ?? 0) > 0) out.push({ level: 'warnung', text: `Branch liegt ${i.git.behind} Commits hinter ${i.git.upstream}` })
    if ((i.git.ahead ?? 0) > 0) out.push({ level: 'info', text: `${i.git.ahead} Commits noch nicht gepusht` })
  } else if (i.git !== null) {
    out.push({ level: 'info', text: `Git-Status nicht verfügbar: ${short(i.git.error ?? '', 60)}` })
  }
  if (i.github !== null && !i.github.isOk) {
    out.push({ level: 'info', text: `GitHub-Status nicht verfügbar: ${short(i.github.error ?? '', 70)}` })
  }
  return out
}

/** `git status --porcelain=v1 -b`, zerlegt. */
export function parseStatus(stdout: string): Pick<McGit, 'branch' | 'upstream' | 'ahead' | 'behind' | 'changes'> {
  const lines = stdout.split('\n').filter(l => l !== '')
  const head = lines[0]?.startsWith('## ') ? (lines.shift() ?? '').slice(3) : ''
  const m = /^(?:No commits yet on )?([^.\s]+(?:\.(?!\.)[^.\s]+)*)(?:\.\.\.(\S+))?(?: \[(.*)\])?/.exec(head)
  const info = m?.[3] ?? ''
  const changes: McChange[] = lines.map(l => ({ code: l.slice(0, 2), path: l.slice(3) }))
  return {
    branch: m?.[1],
    upstream: m?.[2],
    ahead: Number(/ahead (\d+)/.exec(info)?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(info)?.[1] ?? 0),
    changes,
  }
}

type RestPr = {
  number: number
  title: string
  draft: boolean
  html_url: string
  head: { ref: string; sha: string }
  labels?: Array<{ name: string }>
}

/** `gh api repos/{repo}/pulls` zu McPr; Merge-, Review- und CI-Stand kommen je PR dazu. */
export function parsePrs(stdout: string): McPr[] {
  return (JSON.parse(stdout) as RestPr[]).map(pr => ({
    number: pr.number,
    title: pr.title,
    branch: pr.head.ref,
    sha: pr.head.sha,
    isDraft: pr.draft,
    mergeable: 'UNKNOWN',
    review: '',
    url: pr.html_url,
    labels: (pr.labels ?? []).map(l => l.name),
    checks: [],
  }))
}

/** `gh api repos/{repo}/pulls/{n}`: Konflikte stehen in mergeable_state „dirty“. */
export function parseMergeable(stdout: string): string {
  const pr = JSON.parse(stdout) as { mergeable: boolean | null; mergeable_state?: string }
  if (pr.mergeable_state === 'dirty') return 'CONFLICTING'
  if (pr.mergeable === true) return 'MERGEABLE'
  return 'UNKNOWN'
}

/** Die jeweils letzte Bewertung je Person, wie GitHub sie zur Entscheidung zusammenfasst. */
export function parseReviews(stdout: string): string {
  const rows = JSON.parse(stdout) as Array<{ user?: { login?: string }; state: string }>
  const latest = new Map<string, string>()
  for (const r of rows) {
    if (r.state === 'COMMENTED') continue
    latest.set(r.user?.login ?? '?', r.state)
  }
  const states = [...latest.values()]
  if (states.includes('CHANGES_REQUESTED')) return 'CHANGES_REQUESTED'
  if (states.includes('APPROVED')) return 'APPROVED'
  return states.length > 0 ? 'REVIEW_REQUIRED' : ''
}

/** Check-Runs und Commit-Status eines Commits zu McPrCheck. */
export function parseChecks(checkRuns: string, statuses: string): McPrCheck[] {
  const runs = (JSON.parse(checkRuns) as { check_runs?: Array<{ name: string; status: string; conclusion: string | null }> }).check_runs ?? []
  const combined = (JSON.parse(statuses) as { statuses?: Array<{ context: string; state: string }> }).statuses ?? []
  return [
    ...runs.map(r => ({ name: r.name, state: (r.conclusion ?? r.status).toUpperCase() })),
    ...combined.map(c => ({ name: c.context, state: c.state.toUpperCase() })),
  ]
}

/** `gh api repos/{repo}/issues?labels=…`: ohne Pull Requests, die dort mitkommen. */
export function parseIssues(stdout: string): McIssue[] {
  return (JSON.parse(stdout) as Array<{ number: number; title: string; pull_request?: unknown }>)
    .filter(i => i.pull_request === undefined)
    .map(i => ({ number: i.number, title: i.title }))
}

/** Sichtbarer Dateiname: relativ zum Arbeitsverzeichnis, wo möglich. */
export function relative(path: string, cwd: string): string {
  const base = cwd.endsWith('/') ? cwd : `${cwd}/`
  return path.startsWith(base) ? path.slice(base.length) : path
}

export function short(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`
  return String(n)
}

export function ago(now: number, at: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `vor ${s} s`
  if (s < 3600) return `vor ${Math.round(s / 60)} min`
  return `vor ${Math.round(s / 3600)} h`
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
}

const BARS = '▁▂▃▄▅▆▇█'

/** Verlauf der Kontextfüllung als Balken, skaliert auf das Fenster. */
export function sparkline(readings: readonly McReading[]): string {
  return readings
    .map(r => BARS[Math.min(BARS.length - 1, Math.floor((r.percent / 100) * (BARS.length - 1)))] ?? '')
    .join('')
}
