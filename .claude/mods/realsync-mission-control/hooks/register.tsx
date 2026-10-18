// RealSync Mission Control: zeigt, woran Claude arbeitet, und hält riskante
// Aktionen bis zu einer ausdrücklichen Freigabe an.
//
// Erfasst wird nur, was die Engine tatsächlich meldet: Werkzeugaufrufe
// (tool.call), Agenten ($.agent.list, turn.complete), Kontext
// ($.session.usage), Git (git-Befehle) und GitHub (gh-CLI). Fehlt eine Quelle,
// zeigt das Pane „nicht verfügbar“ statt eines Schätzwerts.
//
// Helfer, die `$` nehmen, stehen auf oberster Ebene, und `$.noun.method` ist
// wörtlich geschrieben: so liest der Validator, was das Modul aufruft.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, RenderChildren } from 'claude-code'

import type {
  McAgent,
  McAgentStatus,
  McCheck,
  McDiff,
  McFile,
  McGit,
  McGithub,
  McReading,
  McSafetyEvent,
  McTask,
  McTurn,
  McView,
} from '../types'
import {
  ago,
  ciState,
  CRITICAL_PERCENT,
  duration,
  hints,
  isBlocked,
  parseChecks,
  parseIssues,
  parseMergeable,
  parsePrs,
  parseReviews,
  parseStatus,
  phases,
  relative,
  short,
  sparkline,
  tokens,
  WARN_PERCENT,
} from './derive'
import type { Hint, PhaseState } from './derive'
import { checkKind, classifyCommand, classifyTool, touchesGit } from './risk'
import type { Risk } from './risk'

type Engine = EngineInterface

const PANE = 'mission-control'
const RUN = 'Einmal ausführen'
const CANCEL = 'Abbrechen'
const LIST_MAX = 8
const QUESTION_MARK = '⛔ Mission Control hält an'

const agents = atom({ plugin: 'realsync-mission-control', key: 'agents' } as const, [])
const tasks = atom({ plugin: 'realsync-mission-control', key: 'tasks' } as const, [])
const files = atom({ plugin: 'realsync-mission-control', key: 'files' } as const, [])
const readings = atom({ plugin: 'realsync-mission-control', key: 'readings' } as const, [])
const checks = atom({ plugin: 'realsync-mission-control', key: 'checks' } as const, [])
const git = atom({ plugin: 'realsync-mission-control', key: 'git' } as const, null)
const github = atom({ plugin: 'realsync-mission-control', key: 'github' } as const, null)
const safety = atom({ plugin: 'realsync-mission-control', key: 'safety' } as const, [])
const turn = atom({ plugin: 'realsync-mission-control', key: 'turn' } as const, null)
const view = atom({ plugin: 'realsync-mission-control', key: 'view' } as const, 'overview')
const diff = atom({ plugin: 'realsync-mission-control', key: 'diff' } as const, null)

// RealSync-Farbwelt (Dark Mode).
const C = {
  bg: '#080B0F',
  panel: '#0D1218',
  card: '#121922',
  line: '#18212B',
  accent: '#22D3EE',
  fg: '#E2E8F0',
  dim: '#7C8A9A',
  ok: '#34D399',
  warn: '#FBBF24',
  bad: '#F87171',
}

const VIEWS: Array<[McView, string, string]> = [
  ['overview', 'Übersicht', '1'],
  ['agents', 'Agenten', '2'],
  ['files', 'Dateien', '3'],
  ['context', 'Kontext', '4'],
  ['github', 'GitHub & CI', '5'],
  ['safety', 'Sicherheit', '6'],
]

export const register: Register = (on, options) => {
  // Modulvariablen: nur Zeitgeber, die ein Reload ohnehin neu anlegt.
  let gitTimer: { cancel: () => void } | undefined
  let agentTick: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'mission-control', description: 'RealSync Mission Control öffnen (optional: agenten, dateien, kontext, github, sicherheit)' })
    await $.command.register({ name: 'mc-status', description: 'RealSync Mission Control: Status als Text' })
    await refreshGit($)
    await takeReading($, undefined)
    await refreshGithub($, repoOf(options))
    agentTick = $.clock.every(4000, () => pollAgents($))
    $.clock.every(5 * 60 * 1000, () => refreshGithub($, repoOf(options)))
    await refreshStatusLine($)
    return started
  })

  on('command.run', { command: 'mission-control' }, async ($, e) => {
    const wanted = viewFromArg(e.args)
    if (wanted !== null) await update($, view, () => wanted)
    const opened = await $.ui.open({ id: PANE, title: 'Mission Control' })
    return {
      text: opened.isPlaced
        ? 'Mission Control geöffnet.'
        : 'Mission Control kann hier nicht als Pane angezeigt werden. /mc-status zeigt den Stand als Text.',
    }
  })

  on('command.run', { command: 'mc-status' }, async $ => {
    return { text: await statusText($) }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.isMeta !== true && e.command === undefined && e.text.trim() !== '') {
      const now = await $.clock.now()
      const fresh: McTurn = { prompt: short(e.text, 160), startedAt: now, reads: 0, edits: 0 }
      await update($, turn, () => fresh)
    }
    return next(e)
  })

  // Ein tool.call-Hook für alles: zuerst F. Safety Control (Freigabe), dann
  // A–C, die Erfassung von Agenten, Aufgaben, Dateien und Prüfungen.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as Record<string, unknown>
    // Die Erfassung darf einen Aufruf nie verhindern: ihre Fehler werden geschluckt.
    const track = async () => {
      const filePath = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : undefined
      let at = 0
      let existed = true
      let placeholder: string | undefined
      try {
        at = await $.clock.now()
        existed = tool === 'Write' && filePath !== undefined ? await $.fs.exists(filePath) : true
        placeholder = tool === 'Agent' ? `tu:${String(e.tool_use_id ?? at)}` : undefined
        await before(placeholder, at)
      } catch {
        // weiter ohne Erfassung
      }
      const ran = await next(e)
      try {
        await after(ran, filePath, at, existed, placeholder)
      } catch {
        // weiter ohne Erfassung
      }
      return ran
    }
    const before = async (placeholder: string | undefined, at: number) => {
      if (placeholder !== undefined) {
        const agent: McAgent = {
          id: placeholder,
          description: short(String(input.description ?? 'Subagent'), 80),
          type: String(input.subagent_type ?? 'general-purpose'),
          status: 'running',
          startedAt: at,
          tools: 0,
          isBackground: input.run_in_background !== false,
        }
        await update($, agents, list => [...list, agent].slice(-40))
      }
      if (e.agentId !== undefined) {
        const agentId = e.agentId
        await update($, agents, list => list.map(a => (a.id === agentId ? { ...a, tools: a.tools + 1, lastTool: tool } : a)))
      }
    }
    const after = async (ran: Awaited<ReturnType<typeof next>>, filePath: string | undefined, at: number, existed: boolean, placeholder: string | undefined) => {
      const isOk = ran.deny === undefined && ran.isError !== true

      if (placeholder !== undefined) {
        await settleAgent($, placeholder, ran.deny === undefined ? ran.result : undefined, isOk)
      }
      if (ran.deny !== undefined) {
        return
      }
      if (/^(Read|Grep|Glob|WebFetch|WebSearch|NotebookRead)$/.test(tool)) {
        await update($, turn, t => (t === null ? t : { ...t, reads: t.reads + 1 }))
      }
      if (filePath !== undefined && isOk && /^(Read|Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
        const isEdit = tool !== 'Read'
        await touchFile($, filePath, at, isEdit, isEdit && !existed, false)
        if (isEdit) {
          await update($, turn, t => (t === null ? t : { ...t, edits: t.edits + 1 }))
          gitTimer?.cancel()
          gitTimer = $.clock.after(1500, () => refreshGit($))
        }
      }
      if (tool === 'Bash') {
        const command = String(input.command ?? '')
        const kind = checkKind(command)
        if (kind !== null) {
          const check: McCheck = { command: short(command, 200), kind, isOk, at }
          await update($, checks, list => [...list, check].slice(-50))
        }
        const risk = classifyCommand(command)
        if (isOk && risk !== null && risk.kind === 'rm') {
          const cwd = await $.session.cwd()
          for (const target of (risk.targets ?? []).filter(t => !/[*?[]/.test(t))) {
            await touchFile($, absolute(cwd, risk.dir, target), at, false, false, true)
          }
        }
        if (touchesGit(command) || (risk !== null && risk.kind === 'rm')) {
          gitTimer?.cancel()
          gitTimer = $.clock.after(800, () => refreshGit($))
        }
        if (/\bgit\s+push\b|\bgh\s+pr\b/.test(command)) {
          $.clock.after(3000, () => refreshGithub($, repoOf(options)))
        }
      }
      if (tool === 'TaskCreate' && isOk) {
        const made = (ran.result as { task?: { id: string; subject: string } } | undefined)?.task
        if (made !== undefined) {
          const task: McTask = { id: made.id, subject: made.subject, status: 'pending', blockedBy: [], source: 'task' }
          await update($, tasks, list => [...list.filter(t => t.id !== task.id), task])
        }
      }
      if (tool === 'TaskUpdate' && isOk) {
        const id = String(input.taskId ?? '')
        const status = input.status as string | undefined
        const blockers = Array.isArray(input.addBlockedBy) ? (input.addBlockedBy as string[]) : []
        await update($, tasks, list =>
          status === 'deleted'
            ? list.filter(t => t.id !== id)
            : list.map(t =>
                t.id === id
                  ? {
                      ...t,
                      subject: typeof input.subject === 'string' ? input.subject : t.subject,
                      status: status === 'pending' || status === 'in_progress' || status === 'completed' ? status : t.status,
                      blockedBy: [...new Set([...t.blockedBy, ...blockers])],
                    }
                  : t,
              ),
        )
      }
      if (tool === 'TodoWrite' && isOk && Array.isArray(input.todos)) {
        const todos = (input.todos as Array<{ content: string; status: McTask['status'] }>).map(
          (todo, i): McTask => ({ id: `todo:${i}`, subject: todo.content, status: todo.status, blockedBy: [], source: 'todo' }),
        )
        await update($, tasks, list => [...list.filter(t => t.source !== 'todo'), ...todos])
      }
      await refreshStatusLine($)
    }
    const risk = tool === 'Bash' ? classifyCommand(String(input.command ?? '')) : classifyTool(tool, input)
    if (risk === null) {
      return track()
    }
    const cwd = await $.session.cwd()
    const impact = await measure($, risk, cwd, input)
    const severity = impact.severity ?? risk.severity
    const now = await $.clock.now()
    const event: McSafetyEvent = {
      id: `${now}-${String(e.tool_use_id ?? '').slice(-6)}`,
      at: now,
      tool,
      command: tool === 'Bash' ? short(String(input.command ?? ''), 300) : tool,
      category: risk.category,
      label: risk.label,
      summary: impact.summary,
      lines: impact.lines,
      decision: 'protokolliert',
    }
    if (impact.isQuiet === true) {
      return track() // gewöhnlicher Push oder Merge auf einem Feature-Branch
    }
    if (severity === 'warn' || options.safety === 'aus') {
      await logSafety($, event)
      $.ui.toast(`Mission Control: ${risk.category} – ${short(impact.summary, 80)}`)
      return track()
    }
    await logSafety($, { ...event, decision: 'wartet' })
    if (await approve($, question(event, impact.more))) {
      await setDecision($, event.id, 'freigegeben')
      return track()
    }
    await setDecision($, event.id, 'abgebrochen')
    return {
      deny: `RealSync Mission Control hat diese Aktion angehalten und nicht ausgeführt (${risk.category}: ${risk.label}). Auswirkung: ${impact.summary}. Die Freigabe wurde nicht erteilt. Nicht erneut versuchen, außer der Nutzer verlangt es ausdrücklich.`,
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'RealSync Mission Control: Die Sicherheitsprüfung ist fehlgeschlagen, deshalb wurde die Aktion nicht ausgeführt.' },
  )


  // Eine Freigabefrage von Mission Control, die der Dialog nach Inaktivität
  // selbst aufgelöst hat, ist keine Freigabe: $.ui.ask lehnt dann ab.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const ran = await next(e)
    const isOurs = e.questions.some(q => q.question.startsWith(QUESTION_MARK))
    const result = ran.result as { afkTimeoutMs?: number } | undefined
    return isOurs && result?.afkTimeoutMs !== undefined ? { deny: 'Freigabe nach Inaktivität automatisch aufgelöst: nicht erteilt.' } : ran
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'RealSync Mission Control: Freigabeprüfung fehlgeschlagen.' }))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) {
      const agentId = e.agentId
      const at = await $.clock.now()
      const status: McAgentStatus = e.reason === 'error' ? 'failed' : e.isAborted ? 'killed' : 'completed'
      await update($, agents, list => list.map(a => (a.id === agentId && !a.endedAt ? { ...a, status, endedAt: at } : a)))
      await refreshStatusLine($)
      return done
    }
    await takeReading($, e.usage)
    await refreshGit($)
    await refreshStatusLine($)
    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const t = $.ui.resolve(e)
    const width = e.props.bodyColumns
    const now = await $.clock.now()
    const s = {
      agents: await read($, agents),
      tasks: await read($, tasks),
      files: await read($, files),
      readings: await read($, readings),
      checks: await read($, checks),
      git: await read($, git),
      github: await read($, github),
      safety: await read($, safety),
      turn: await read($, turn),
      view: await read($, view),
      diff: await read($, diff),
      cwd: await $.session.cwd(),
    }
    return drawPane($, t, s, width, now, repoOf(options))
  })

  void agentTick
}

// ---- Zustand fortschreiben -------------------------------------------------

async function settleAgent($: Engine, placeholder: string, result: unknown, isOk: boolean) {
  const r = (result ?? {}) as { agentId?: string; status?: string; totalToolUseCount?: number; totalDurationMs?: number }
  const at = await $.clock.now()
  await update($, agents, list => {
    if (!isOk && r.agentId === undefined) {
      return list.map(a => (a.id === placeholder ? { ...a, status: 'failed' as const, endedAt: at } : a))
    }
    return list.map(a => {
      if (a.id !== placeholder) return a
      const id = r.agentId ?? a.id
      if (r.status === 'completed') {
        return { ...a, id, status: 'completed' as const, endedAt: at, tools: Math.max(a.tools, r.totalToolUseCount ?? 0), isBackground: false }
      }
      return { ...a, id }
    })
  })
}

async function pollAgents($: Engine) {
  const known = await read($, agents)
  if (!known.some(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting')) {
    return
  }
  const live = await $.agent.list()
  let isChanged = false
  const next = known.map(a => {
    const info = live.find(l => l.id === a.id)
    if (info === undefined || info.status === a.status) return a
    isChanged = true
    return { ...a, status: info.status, description: a.description || info.description }
  })
  if (isChanged) {
    await update($, agents, () => next)
    await refreshStatusLine($)
  }
}

async function touchFile($: Engine, path: string, at: number, isEdit: boolean, isCreated: boolean, isDeleted: boolean) {
  await update($, files, list => {
    const found = list.find(f => f.path === path)
    const base: McFile = found ?? { path, reads: 0, edits: 0, isCreated: false, isDeleted: false, lastAt: at }
    const next: McFile = {
      ...base,
      reads: base.reads + (isEdit || isDeleted ? 0 : 1),
      edits: base.edits + (isEdit ? 1 : 0),
      isCreated: base.isCreated || isCreated,
      isDeleted: isDeleted ? true : isEdit ? false : base.isDeleted,
      lastAt: at,
    }
    return [...list.filter(f => f.path !== path), next].slice(-200)
  })
}

async function takeReading($: Engine, usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } | undefined) {
  try {
    const now = await $.clock.now()
    const { context, cost } = await $.session.usage()
    if (context.tokens === undefined || context.tokens === 0 || context.window === 0) {
      return
    }
    const reading: McReading = {
      at: now,
      tokens: context.tokens,
      window: context.window,
      percent: Math.round(context.percent ?? (context.tokens / context.window) * 100),
      costUsd: cost?.usd,
      input: usage?.input_tokens,
      output: usage?.output_tokens,
      cacheRead: usage?.cache_read_input_tokens,
      cacheWrite: usage?.cache_creation_input_tokens,
    }
    await update($, readings, list => [...list, reading].slice(-30))
    if (reading.percent >= CRITICAL_PERCENT) {
      $.ui.toast(`Kontext ${reading.percent} %: Arbeitsstand sichern, dann /compact`)
    }
  } catch {
    // Keine Messung in diesem Zug; die letzte bleibt stehen.
  }
}

async function runGit($: Engine, args: string[], cwd?: string) {
  return $.process.run(['git', ...args], { cwd, timeoutMs: 15000 })
}

async function refreshGit($: Engine) {
  const at = await $.clock.now()
  let next: McGit
  try {
    const status = await runGit($, ['status', '--porcelain=v1', '-b'])
    if (status.exitCode !== 0) {
      next = { at, isOk: false, error: status.stderr.trim().split('\n')[0] ?? 'git status fehlgeschlagen', changes: [] }
    } else {
      const head = await runGit($, ['log', '-1', '--format=%h %s'])
      next = { at, isOk: true, head: head.stdout.trim(), ...parseStatus(status.stdout) }
    }
  } catch (error) {
    next = { at, isOk: false, error: String((error as Error)?.message ?? error).slice(0, 120), changes: [] }
  }
  await update($, git, () => next)
}

async function gh($: Engine, args: string[]) {
  return $.process.run(['gh', ...args], { timeoutMs: 20000 })
}

async function refreshGithub($: Engine, repo: string) {
  const at = await $.clock.now()
  const failed = (error: string): McGithub => ({ at, isOk: false, error, repo, current: null, open: [], p0: null, p1: null })
  const api = async (path: string) => {
    const run = await gh($, ['api', '-H', 'Accept: application/vnd.github+json', `repos/${repo}/${path}`])
    if (run.exitCode !== 0) {
      throw new Error(run.stderr.trim().split('\n').find(l => l.trim() !== '') ?? `gh beendet mit ${run.exitCode}`)
    }
    return run.stdout
  }
  let next: McGithub
  try {
    const open = parsePrs(await api('pulls?state=open&per_page=50'))
    const branch = (await read($, git))?.branch
    const found = open.find(pr => pr.branch === branch)
    const current = found === undefined ? null : {
      ...found,
      mergeable: parseMergeable(await api(`pulls/${found.number}`)),
      review: parseReviews(await api(`pulls/${found.number}/reviews?per_page=100`)),
      checks: parseChecks(await api(`commits/${found.sha}/check-runs?per_page=100`), await api(`commits/${found.sha}/status`)),
    }
    const labels = (JSON.parse(await api('labels?per_page=100')) as Array<{ name: string }>).map(l => l.name)
    const issues = async (label: string) => (labels.includes(label) ? parseIssues(await api(`issues?state=open&labels=${label}&per_page=30`)) : null)
    next = {
      at,
      isOk: true,
      repo,
      current,
      open: open.map(pr => (current !== null && pr.number === current.number ? current : pr)),
      p0: await issues('P0'),
      p1: await issues('P1'),
    }
  } catch (error) {
    const text = String((error as Error)?.message ?? error)
    next = failed(/ENOENT|not found|cannot start|No such file/i.test(text) && !/HTTP/.test(text) ? 'gh-CLI nicht installiert' : text.slice(0, 160))
  }
  await update($, github, () => next)
  await refreshStatusLine($)
}

async function logSafety($: Engine, event: McSafetyEvent) {
  await update($, safety, list => [...list, event].slice(-40))
  await refreshStatusLine($)
}

async function setDecision($: Engine, id: string, decision: McSafetyEvent['decision']) {
  await update($, safety, list => list.map(s => (s.id === id ? { ...s, decision } : s)))
  await refreshStatusLine($)
}

async function refreshStatusLine($: Engine) {
  const g = await read($, git)
  const gh = await read($, github)
  const r = (await read($, readings)).at(-1)
  const active = (await read($, agents)).filter(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting').length
  const pending = (await read($, safety)).filter(s => s.decision === 'wartet').length
  const ci = gh?.isOk ? (gh.current ? `CI ${ciState(gh.current)}` : 'kein PR') : 'CI n. v.'
  const parts = [
    '◆ Mission Control',
    g?.isOk ? `⎇ ${g.branch ?? '?'}${g.changes.length ? ` ±${g.changes.length}` : ''}` : 'Git n. v.',
    `Agenten ${active}`,
    r ? `Kontext ${r.percent} %` : 'Kontext –',
    ci,
  ]
  if (pending > 0) parts.push(`⛔ ${pending} Freigabe`)
  $.ui.status(parts.join(' │ '))
}

// ---- Auswirkungen messen ---------------------------------------------------

type Impact = { summary: string; lines: string[]; more?: number; severity?: 'hold' | 'warn'; isQuiet?: true }

function absolute(cwd: string, dir: string | undefined, path: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path
  const base = dir === undefined ? cwd : dir.startsWith('/') || /^[A-Za-z]:[\\/]/.test(dir) ? dir : `${cwd}/${dir}`
  return `${base}/${path}`.replace(/\/\.\//g, '/')
}

function capped(lines: string[]): Pick<Impact, 'lines' | 'more'> {
  return { lines: lines.slice(0, LIST_MAX), more: Math.max(0, lines.length - LIST_MAX) }
}

async function measure($: Engine, risk: Risk, cwd: string, input: Record<string, unknown>): Promise<Impact> {
  const dir = risk.dir === undefined ? cwd : absolute(cwd, undefined, risk.dir)
  try {
    switch (risk.kind) {
      case 'rm':
      case 'rm-plain': {
        const targets = risk.targets ?? []
        if (targets.length === 0) return { summary: 'rm ohne Pfade', lines: [] }
        const tracked = await runGit($, ['ls-files', '--', ...targets], dir)
        const loose = await runGit($, ['ls-files', '--others', '--exclude-standard', '--', ...targets], dir)
        if (tracked.exitCode !== 0) {
          return { summary: `löscht ${targets.join(' ')} (Umfang nicht ermittelbar)`, lines: targets }
        }
        const kept = tracked.stdout.split('\n').filter(l => l !== '')
        const untracked = loose.stdout.split('\n').filter(l => l !== '')
        if (risk.kind === 'rm-plain' && kept.length === 0) {
          return { summary: `löscht ${untracked.length || targets.length} nicht versionierte Datei(en)`, lines: untracked.slice(0, LIST_MAX), severity: 'warn' }
        }
        return {
          summary: `löscht ${kept.length} versionierte und ${untracked.length} nicht versionierte Dateien`,
          ...capped([...kept, ...untracked.map(u => `${u} (nicht versioniert – nicht wiederherstellbar)`)]),
        }
      }
      case 'git-reset':
      case 'git-discard': {
        const status = await runGit($, ['status', '--porcelain'], dir)
        const rows = status.stdout.split('\n').filter(l => l.length > 3 && !l.startsWith('??'))
        return {
          summary: rows.length === 0 ? 'verwirft nichts: keine uncommitteten Änderungen' : `verwirft uncommittete Änderungen in ${rows.length} Datei(en) – nicht wiederherstellbar`,
          ...capped(rows.map(l => `${l.slice(0, 2)} ${l.slice(3)}`)),
        }
      }
      case 'git-clean': {
        const flags = (risk.args ?? []).flatMap(a => (/^-[a-zA-Z]+$/.test(a) ? [a.replace(/[finq]/g, '')].filter(f => f !== '-') : []))
        const paths = (risk.args ?? []).filter(a => !a.startsWith('-'))
        const dry = await runGit($, ['clean', '-n', ...flags, '--', ...paths], dir)
        const gone = dry.stdout.split('\n').filter(l => l.startsWith('Would remove ')).map(l => l.slice(13))
        return { summary: `entfernt ${gone.length} nicht versionierte Pfade – nicht wiederherstellbar`, ...capped(gone) }
      }
      case 'git-push-force': {
        const branch = (await runGit($, ['rev-parse', '--abbrev-ref', 'HEAD'], dir)).stdout.trim()
        const positional = (risk.args ?? []).filter(a => !a.startsWith('-'))
        const remote = positional[0] ?? 'origin'
        const target = (positional[1] ?? branch).replace(/^\+/, '').split(':').pop() || branch
        const log = await runGit($, ['log', '--oneline', '--no-decorate', `HEAD..${remote}/${target}`], dir)
        const dropped = log.exitCode === 0 ? log.stdout.split('\n').filter(l => l !== '') : []
        const isMain = /^(main|master)$/.test(target)
        return {
          summary: `überschreibt ${remote}/${target}${isMain ? ' (Hauptbranch!)' : ''}: ${log.exitCode === 0 ? `${dropped.length} Commit(s) gehen verloren` : 'verlorene Commits nicht ermittelbar (kein lokaler Stand)'}`,
          ...capped(dropped),
        }
      }
      case 'git-push-main':
      case 'git-merge': {
        if (risk.kind === 'git-push-main' && risk.severity === 'hold' && !risk.label.includes('aktueller')) {
          return { summary: 'pusht direkt auf main/master (laut CLAUDE.md verboten)', lines: [] }
        }
        const branch = (await runGit($, ['rev-parse', '--abbrev-ref', 'HEAD'], dir)).stdout.trim()
        const isMain = /^(main|master)$/.test(branch)
        if (risk.kind === 'git-merge') {
          return isMain
            ? { summary: 'Merge direkt auf main/master', lines: [], severity: 'hold' }
            : { summary: `Merge in ${branch}`, lines: [], severity: 'warn', isQuiet: true }
        }
        return isMain
          ? { summary: 'pusht den aktuellen Branch main/master direkt', lines: [], severity: 'hold' }
          : { summary: `pusht ${branch}`, lines: [], severity: 'warn', isQuiet: true }
      }
      case 'git-branch':
      case 'git-rebase':
      case 'git-history': {
        const branch = (await runGit($, ['rev-parse', '--abbrev-ref', 'HEAD'], dir)).stdout.trim()
        return { summary: `${risk.label} (aktueller Branch: ${branch || '?'})`, lines: (risk.args ?? []).filter(a => !a.startsWith('-')).slice(0, LIST_MAX) }
      }
      case 'supabase':
      case 'db':
      case 'migration-file': {
        const ref = (await $.fs.exists(`${cwd}/supabase/.temp/project-ref`)) ? (await $.fs.read(`${cwd}/supabase/.temp/project-ref`)).trim() : ''
        const target = ref !== '' ? `verknüpftes Supabase-Projekt ${ref}` : 'Ziel-Datenbank nicht lokal ermittelbar – Produktiv möglich'
        const lines = [...(risk.targets ?? []), ...(risk.args ?? []).filter(a => a !== '')].map(l => short(l, 120))
        return { summary: `${risk.label}: ${target}`, lines: lines.slice(0, LIST_MAX) }
      }
      case 'env': {
        const targets = risk.targets ?? (risk.args ?? []).filter(a => !a.startsWith('-')).slice(0, 3)
        return { summary: `ändert Umgebungsvariablen/Secrets (${risk.label}); Werte werden nicht angezeigt`, lines: targets }
      }
      case 'deploy':
      case 'deploy-config': {
        const branch = (await runGit($, ['rev-parse', '--abbrev-ref', 'HEAD'], dir)).stdout.trim()
        const head = (await runGit($, ['log', '-1', '--format=%h %s'], dir)).stdout.trim()
        const dirty = (await runGit($, ['status', '--porcelain'], dir)).stdout.split('\n').filter(l => l !== '').length
        return {
          summary: `${risk.label}: Stand ${branch || '?'} @ ${short(head, 50)}${dirty ? `, ${dirty} uncommittete Änderungen` : ''}`,
          lines: (risk.targets ?? []).slice(0, LIST_MAX),
        }
      }
      case 'gh-merge':
      case 'gh-write':
      case 'mcp':
      case 'find-delete':
      default: {
        const keys = ['owner', 'repo', 'pullNumber', 'project_id', 'projectId', 'name', 'branch', 'path', 'query']
        const lines = keys.filter(k => input[k] !== undefined && input[k] !== '').map(k => `${k}: ${short(String(input[k]), 100)}`)
        return { summary: `${risk.category}: ${risk.label}`, lines: [...lines, ...(risk.args ?? []).slice(0, 4)].slice(0, LIST_MAX) }
      }
    }
  } catch (error) {
    return { summary: `${risk.label} (Auswirkung nicht messbar: ${short(String((error as Error)?.message ?? error), 80)})`, lines: [] }
  }
}

/**
 * Fragt die Person im Dialog von Claude Code. Nur die ausdrücklich gewählte
 * Option „Einmal ausführen“ gibt frei; geschlossen, ohne Antwort, frei
 * getippt oder nach Inaktivität automatisch aufgelöst (siehe den
 * AskUserQuestion-Hook) heißt: nicht ausführen.
 */
async function approve($: Engine, text: string): Promise<boolean> {
  try {
    return (await $.ui.ask(text, { options: [CANCEL, RUN], header: 'Freigabe' })) === RUN
  } catch {
    return false
  }
}

function question(event: McSafetyEvent, more: number | undefined): string {
  const affected = event.lines.length > 0 ? `\nBetroffen:\n${event.lines.map(l => `  • ${l}`).join('\n')}${more ? `\n  + ${more} weitere` : ''}` : ''
  return `${QUESTION_MARK} – ${event.category}\nAktion: ${short(event.command, 200)}\nAuswirkung: ${event.summary}${affected}\n\nSoll diese Aktion einmalig ausgeführt werden?`
}

// ---- Hilfen ---------------------------------------------------------------

function repoOf(options: PluginOptions): string {
  const repo = options.repo
  return typeof repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : 'realsyncdynamics-spec/RealSyncDynamics.AI'
}

function viewFromArg(arg: string): McView | null {
  const a = arg.trim().toLowerCase()
  if (a === '') return null
  if (a.startsWith('agent')) return 'agents'
  if (a.startsWith('datei') || a.startsWith('file')) return 'files'
  if (a.startsWith('kontext') || a.startsWith('context') || a.startsWith('token')) return 'context'
  if (a.startsWith('git') || a.startsWith('ci')) return 'github'
  if (a.startsWith('sicher') || a.startsWith('safety')) return 'safety'
  return 'overview'
}

async function loadDiff($: Engine, path: string): Promise<McDiff> {
  const cwd = await $.session.cwd()
  const shown = relative(path, cwd)
  const cut = (text: string) => {
    const at = text.indexOf('@@')
    return (at >= 0 ? text.slice(at) : text).slice(0, 60000)
  }
  const working = await runGit($, ['diff', 'HEAD', '--', path])
  if (working.exitCode === 0 && working.stdout.trim() !== '') {
    return { path: shown, source: cut(working.stdout), note: 'Arbeitsstand gegenüber HEAD (nicht committet)' }
  }
  const isTracked = (await runGit($, ['ls-files', '--error-unmatch', '--', path])).exitCode === 0
  if (!isTracked && (await $.fs.exists(path))) {
    const fresh = await runGit($, ['diff', '--no-index', '--', '/dev/null', path])
    return { path: shown, source: cut(fresh.stdout), note: 'Neue, noch nicht versionierte Datei' }
  }
  const last = await runGit($, ['log', '-1', '-p', '--format=', '--', path])
  if (last.exitCode === 0 && last.stdout.trim() !== '') {
    return { path: shown, source: cut(last.stdout), note: 'Keine offenen Änderungen – Diff des letzten Commits dieser Datei' }
  }
  return { path: shown, source: '', note: 'Kein Unterschied ermittelbar (unverändert, gelöscht oder außerhalb des Repos)' }
}

async function statusText($: Engine): Promise<string> {
  const g = await read($, git)
  const gh = await read($, github)
  const r = (await read($, readings)).at(-1)
  const ag = await read($, agents)
  const ts = await read($, tasks)
  const now = await $.clock.now()
  const all = hints({ readings: await read($, readings), checks: await read($, checks), git: g, github: gh, tasks: ts, agents: ag, safety: await read($, safety), turn: await read($, turn) })
  const ph = phases(await read($, turn), await read($, checks), gh)
  const lines = [
    '## RealSync Mission Control',
    `- Branch: ${g?.isOk ? `${g.branch} (${g.changes.length} lokale Änderungen, letzter Commit ${g.head})` : `Status nicht verfügbar (${g?.error ?? 'nicht gelesen'})`}`,
    `- Kontext: ${r ? `${r.percent} % (${tokens(r.tokens)} / ${tokens(r.window)})` : 'noch keine Messung'}`,
    `- Agenten: ${ag.length === 0 ? 'keine' : ag.map(a => `${a.description} [${a.status}, ${duration((a.endedAt ?? now) - a.startedAt)}]`).join('; ')}`,
    `- Aufgaben: ${ts.length === 0 ? 'keine erfasst' : `${ts.filter(t => t.status === 'completed').length} von ${ts.length} erledigt`}`,
    `- GitHub: ${gh?.isOk ? (gh.current ? `PR #${gh.current.number}, CI ${ciState(gh.current)}, Review ${gh.current.review || 'offen'}` : `kein PR für den Branch, ${gh.open.length >= 50 ? "mind. 50" : gh.open.length} offene PRs`) : `Status nicht verfügbar (${gh?.error ?? 'nicht abgefragt'})`}`,
    '',
    '**Ablauf:** ' + ph.map(p => `${p.name} ${phaseMark(p.state)}`).join(' → '),
    '',
    ...(all.length === 0 ? ['Keine Warnungen.'] : all.map(hint => `- ${hint.level.toUpperCase()}: ${hint.text}`)),
  ]
  return lines.join('\n')
}

function phaseMark(state: PhaseState): string {
  return { erledigt: '✓', läuft: '◐', offen: '○', blockiert: '⛔', fehlgeschlagen: '✗', unbekannt: '?' }[state]
}

function phaseColor(state: PhaseState): string {
  return { erledigt: C.ok, läuft: C.accent, offen: C.dim, blockiert: C.bad, fehlgeschlagen: C.bad, unbekannt: C.dim }[state]
}

function hintColor(level: Hint['level']): string {
  return level === 'kritisch' ? C.bad : level === 'warnung' ? C.warn : C.dim
}

function statusColor(status: McAgentStatus): string {
  if (status === 'completed') return C.ok
  if (status === 'failed' || status === 'killed') return C.bad
  if (status === 'running' || status === 'pending' || status === 'waiting') return C.accent
  return C.dim
}

function fileMark(f: McFile, code: string | undefined): [string, string] {
  if (f.isDeleted || code?.includes('D')) return ['gelöscht', C.bad]
  if (code === '??' || f.isCreated) return ['neu', C.ok]
  if (code !== undefined && code.trim() !== '') return ['geändert', C.warn]
  if (f.edits > 0) return ['bearbeitet', C.accent]
  return ['gelesen', C.dim]
}

// ---- Zeichnen ---------------------------------------------------------------

type Snapshot = {
  agents: McAgent[]
  tasks: McTask[]
  files: McFile[]
  readings: McReading[]
  checks: McCheck[]
  git: McGit | null
  github: McGithub | null
  safety: McSafetyEvent[]
  turn: McTurn | null
  view: McView
  diff: McDiff
  cwd: string
}

type Table = ReturnType<Engine['ui']['resolve']>

function drawPane($: Engine, t: Table, s: Snapshot, width: number, now: number, repo: string) {
  const { Box, Text, Button } = t
  const wide = width >= 100
  const go = (to: McView) => () => update($, view, () => to)
  const all = hints({ readings: s.readings, checks: s.checks, git: s.git, github: s.github, tasks: s.tasks, agents: s.agents, safety: s.safety, turn: s.turn })
  const reading = s.readings.at(-1)
  const active = s.agents.filter(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting').length
  const pr = s.github?.isOk ? s.github.current : null
  const ci = s.github?.isOk ? (pr ? ciState(pr) : 'kein PR') : 'n. v.'
  const ciColor = ci === 'grün' ? C.ok : ci === 'rot' ? C.bad : ci === 'läuft' ? C.accent : C.dim
  const ctxColor = reading === undefined ? C.dim : reading.percent >= CRITICAL_PERCENT ? C.bad : reading.percent >= WARN_PERCENT ? C.warn : C.ok

  const header = (
    <Box key="header" borderStyle="round" borderColor={C.accent} paddingX={1} flexDirection={wide ? 'row' : 'column'} columnGap={2} backgroundColor={C.panel}>
      <Text color={C.accent} weight="bold">◆ RealSync Mission Control</Text>
      <Text color={C.fg}>
        <Text color={C.dim}>Projekt </Text>
        {repo.split('/')[1] ?? repo}
      </Text>
      <Text color={C.fg}>
        <Text color={C.dim}>Branch </Text>
        {s.git?.isOk ? `${s.git.branch ?? '?'}${s.git.changes.length ? ` ±${s.git.changes.length}` : ''}` : 'n. v.'}
      </Text>
      <Text color={C.fg}>
        <Text color={C.dim}>Agenten </Text>
        {String(active)}
      </Text>
      <Text color={ctxColor}>
        <Text color={C.dim}>Kontext </Text>
        {reading ? `${reading.percent} %` : '–'}
      </Text>
      <Text color={ciColor}>
        <Text color={C.dim}>CI </Text>
        {ci}
      </Text>
    </Box>
  )

  const tabs = (
    <Box key="tabs" flexDirection="row" flexWrap="wrap" columnGap={1}>
      {VIEWS.map(([id, label, hotkey]) => (
        <Button key={`tab-${id}`} label={s.view === id ? `▸${label}` : label} hotkey={hotkey} plain variant={s.view === id ? 'primary' : 'secondary'} onPress={go(id)} />
      ))}
      <Button key="refresh" label="Aktualisieren" hotkey="r" plain onPress={() => refreshAll($, repo)} />
    </Box>
  )

  const body =
    s.view === 'agents'
      ? drawAgents(t, s, now, 40)
      : s.view === 'files'
        ? drawFiles($, t, s, now, 40)
        : s.view === 'context'
          ? drawContext(t, s, now)
          : s.view === 'github'
            ? drawGithub(t, s, now)
            : s.view === 'safety'
              ? drawSafety(t, s, now)
              : s.view === 'diff'
                ? drawDiff($, t, s)
                : (
                    <Box key="overview" flexDirection={wide ? 'row' : 'column'} columnGap={2}>
                      <Box key="main" flexDirection="column" flexGrow={1} width={wide ? '58%' : undefined}>
                        {drawTask(t, s)}
                      </Box>
                      <Box key="side" flexDirection="column" flexGrow={1}>
                        {drawAgents(t, s, now, 4)}
                        {drawFiles($, t, s, now, 6)}
                      </Box>
                    </Box>
                  )

  const footer = (
    <Box key="footer" flexDirection="column" borderStyle="round" borderColor={all.some(hint => hint.level === 'kritisch') ? C.bad : C.line} paddingX={1}>
      <Text color={C.accent} weight="bold">Warnungen, Blocker, nächste Schritte</Text>
      {all.length === 0 && <Text color={C.dim}>Keine Warnungen aus den erfassten Daten.</Text>}
      {all.slice(0, 6).map((hint, i) => (
        <Text key={`hint-${i}`} color={hintColor(hint.level)} wrap="wrap">
          {hint.level === 'kritisch' ? '⛔ ' : hint.level === 'warnung' ? '⚠ ' : '› '}
          {hint.text}
        </Text>
      ))}
      {all.length > 6 && <Text color={C.dim}>+ {all.length - 6} weitere</Text>}
    </Box>
  )

  return (
    <Box flexDirection="column" backgroundColor={C.bg} rowGap={1}>
      {header}
      {tabs}
      {body}
      {footer}
    </Box>
  )
}

function card(t: Table, key: string, title: string, children: RenderChildren[]) {
  const { Box, Text } = t
  return (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={C.line} paddingX={1} backgroundColor={C.card}>
      <Text color={C.accent} weight="bold">{title}</Text>
      {children}
    </Box>
  )
}

function drawTask(t: Table, s: Snapshot) {
  const { Text } = t
  const ph = phases(s.turn, s.checks, s.github)
  const done = s.tasks.filter(x => x.status === 'completed').length
  const current = s.tasks.find(x => x.status === 'in_progress')
  const order: Record<McTask['status'], number> = { in_progress: 0, pending: 1, completed: 2 }
  const sorted = [...s.tasks].sort((a, b) => order[a.status] - order[b.status])
  return card(t, 'task', 'Aktive Aufgabe & tatsächlicher Fortschritt', [
    <Text key="goal" color={C.fg} wrap="wrap">
      <Text color={C.dim}>Auftrag: </Text>
      {s.turn?.prompt ?? 'noch keiner erfasst'}
    </Text>,
    current !== undefined && (
      <Text key="now" color={C.accent} wrap="wrap">
        <Text color={C.dim}>Läuft: </Text>
        {current.subject}
      </Text>
    ),
    <Text key="flow" color={C.dim}>
      Ablauf
    </Text>,
    ...ph.map(p => (
      <Text key={`phase-${p.name}`} color={phaseColor(p.state)} wrap="truncate-end">
        {phaseMark(p.state)} {p.name.padEnd(16)}
        <Text color={C.dim}>{p.evidence}</Text>
      </Text>
    )),
    <Text key="tasks-head" color={C.dim}>
      {s.tasks.length === 0 ? 'Teilaufgaben: keine erfasst (Claude hat keine Aufgabenliste angelegt)' : `Teilaufgaben: ${done} von ${s.tasks.length} erledigt`}
    </Text>,
    ...sorted.slice(0, 14).map(x => {
      const blocked = isBlocked(x, s.tasks)
      const mark = blocked ? '⛔' : x.status === 'completed' ? '✓' : x.status === 'in_progress' ? '◐' : '○'
      const color = blocked ? C.bad : x.status === 'completed' ? C.ok : x.status === 'in_progress' ? C.accent : C.fg
      return (
        <Text key={`task-${x.id}`} color={color} wrap="truncate-end">
          {mark} {x.subject}
          {blocked ? ' (blockiert)' : ''}
        </Text>
      )
    }),
    sorted.length > 14 && (
      <Text key="tasks-more" color={C.dim}>
        + {sorted.length - 14} weitere
      </Text>
    ),
  ])
}

function drawAgents(t: Table, s: Snapshot, now: number, max: number) {
  const { Text } = t
  const list = [...s.agents].reverse().slice(0, max)
  return card(t, `agents-${max}`, `Agenten (${s.agents.filter(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting').length} aktiv)`, [
    list.length === 0 && (
      <Text key="none" color={C.dim}>
        Keine Subagenten in dieser Sitzung.
      </Text>
    ),
    ...list.map(a => (
      <Text key={`agent-${a.id}`} color={C.fg} wrap="truncate-end">
        <Text color={statusColor(a.status)}>● {a.status.padEnd(9)}</Text> {a.description}
        <Text color={C.dim}>
          {' '}
          · {a.type} · {duration((a.endedAt ?? now) - a.startedAt)}
          {a.tools > 0 ? ` · ${a.tools} Tools` : ''}
          {a.lastTool && !a.endedAt ? ` · zuletzt ${a.lastTool}` : ''}
        </Text>
      </Text>
    )),
  ])
}

function drawFiles($: Engine, t: Table, s: Snapshot, now: number, max: number) {
  const { Text, Button, Box } = t
  const codes = new Map((s.git?.changes ?? []).map(c => [`${s.cwd}/${c.path}`, c.code]))
  const list = [...s.files].sort((a, b) => b.lastAt - a.lastAt).slice(0, max)
  const untracked = (s.git?.changes ?? []).filter(c => !s.files.some(f => f.path === `${s.cwd}/${c.path}`))
  const open = (path: string) => async () => {
    const loaded = await loadDiff($, path)
    await update($, diff, () => loaded)
    await update($, view, () => 'diff')
  }
  return card(t, `files-${max}`, `Dateiaktivität (${s.files.filter(f => f.edits > 0).length} bearbeitet, ${s.files.filter(f => f.edits === 0 && !f.isDeleted).length} nur gelesen)`, [
    list.length === 0 && (
      <Text key="none" color={C.dim}>
        Noch keine Dateizugriffe erfasst.
      </Text>
    ),
    ...list.map(f => {
      const [label, color] = fileMark(f, codes.get(f.path))
      return (
        <Box key={`file-${f.path}`} flexDirection="row" columnGap={1}>
          <Text color={color}>{label.padEnd(10)}</Text>
          <Text color={C.fg} wrap="truncate-end">
            {relative(f.path, s.cwd)}
          </Text>
          <Text color={C.dim}>{ago(now, f.lastAt)}</Text>
          {(f.edits > 0 || codes.has(f.path)) && <Button key={`diff-${f.path}`} label="Diff" plain onPress={open(f.path)} />}
        </Box>
      )
    }),
    max > 10 && untracked.length > 0 && (
      <Text key="other-head" color={C.dim}>
        Weitere lokale Änderungen laut git status (nicht von Claude in dieser Sitzung):
      </Text>
    ),
    ...(max > 10
      ? untracked.slice(0, 12).map(c => (
          <Box key={`git-${c.path}`} flexDirection="row" columnGap={1}>
            <Text color={C.warn}>{c.code.padEnd(10)}</Text>
            <Text color={C.fg} wrap="truncate-end">
              {c.path}
            </Text>
            <Button key={`gdiff-${c.path}`} label="Diff" plain onPress={open(`${s.cwd}/${c.path}`)} />
          </Box>
        ))
      : []),
    max > 10 && (
      <Text key="replay" color={C.dim}>
        Schrittweises Nachspielen der Änderungen: /replay (Replay Theater, falls installiert).
      </Text>
    ),
  ])
}

function drawDiff($: Engine, t: Table, s: Snapshot) {
  const { Text, Code, Button } = t
  const d = s.diff
  return card(t, 'diff', d === null ? 'Diff' : `Diff · ${d.path}`, [
    <Button key="back" label="← Zurück zu Dateien" plain onPress={() => update($, view, () => 'files')} />,
    d?.note !== undefined && (
      <Text key="note" color={C.dim}>
        {d.note}
      </Text>
    ),
    d !== null && d.source !== '' && <Code key="code" source={d.source} format="diff" path={d.path} wrap="truncate-end" />,
  ])
}

function drawContext(t: Table, s: Snapshot, now: number) {
  const { Text } = t
  const r = s.readings.at(-1)
  if (r === undefined) {
    return card(t, 'context', 'Kontext & Tokens', [
      <Text key="none" color={C.dim}>
        Noch keine Messung: Werte kommen nach dem ersten Zug aus $.session.usage().
      </Text>,
    ])
  }
  const prev = s.readings.at(-2)
  const color = r.percent >= CRITICAL_PERCENT ? C.bad : r.percent >= WARN_PERCENT ? C.warn : C.ok
  const hasCache = r.cacheRead !== undefined || r.cacheWrite !== undefined
  return card(t, 'context', 'Kontext & Tokens', [
    <Text key="fill" color={color} weight="bold">
      {r.percent} % belegt · {tokens(r.tokens)} von {tokens(r.window)} Tokens · frei {tokens(Math.max(0, r.window - r.tokens))}
    </Text>,
    <Text key="spark" color={C.accent}>
      {sparkline(s.readings)}
      <Text color={C.dim}>
        {'  '}letzte {s.readings.length} Züge{prev ? ` · Δ ${r.tokens - prev.tokens >= 0 ? '+' : ''}${tokens(r.tokens - prev.tokens)}` : ''} · gemessen {ago(now, r.at)}
      </Text>
    </Text>,
    hasCache ? (
      <Text key="cache" color={C.fg}>
        <Text color={C.dim}>Letzter Zug: </Text>
        Eingabe {tokens(r.input ?? 0)} · Ausgabe {tokens(r.output ?? 0)} · Cache gelesen {tokens(r.cacheRead ?? 0)} · Cache geschrieben {tokens(r.cacheWrite ?? 0)}
      </Text>
    ) : (
      <Text key="cache" color={C.dim}>
        Cache-Metriken: für diesen Zug nicht gemeldet.
      </Text>
    ),
    <Text key="ttl" color={C.dim}>
      Cache-Restlaufzeit: von der Engine nicht gemeldet, daher nicht angezeigt.
    </Text>,
    r.costUsd !== undefined && (
      <Text key="cost" color={C.fg}>
        <Text color={C.dim}>Kosten bisher: </Text>${r.costUsd.toFixed(2)}
      </Text>
    ),
    <Text key="advice" color={color} wrap="wrap">
      {r.percent >= CRITICAL_PERCENT
        ? 'Empfehlung: Arbeitsstand dokumentieren (Commit/PR-Notiz), dann /compact oder neue Sitzung beginnen.'
        : r.percent >= WARN_PERCENT
          ? 'Empfehlung: /compact erwägen, bevor große Dateien gelesen werden.'
          : 'Kontext im grünen Bereich.'}
    </Text>,
  ])
}

function drawGithub(t: Table, s: Snapshot, now: number) {
  const { Text } = t
  const g = s.git
  const gh = s.github
  const localLines = g?.isOk
    ? [
        <Text key="branch" color={C.fg}>
          <Text color={C.dim}>Branch </Text>
          {g.branch}
          {g.upstream ? <Text color={C.dim}> → {g.upstream}</Text> : <Text color={C.warn}> (kein Upstream)</Text>}
          {g.ahead ? <Text color={C.warn}> ↑{g.ahead}</Text> : ''}
          {g.behind ? <Text color={C.bad}> ↓{g.behind}</Text> : ''}
        </Text>,
        <Text key="head" color={C.fg} wrap="truncate-end">
          <Text color={C.dim}>Letzter Commit </Text>
          {g.head}
        </Text>,
        <Text key="changes" color={g.changes.length ? C.warn : C.ok}>
          {g.changes.length ? `${g.changes.length} lokale Änderungen (nicht committet)` : 'Arbeitsverzeichnis sauber'}
          <Text color={C.dim}> · gelesen {ago(now, g.at)}</Text>
        </Text>,
      ]
    : [
        <Text key="na" color={C.dim}>
          Git: Status nicht verfügbar{g?.error ? ` (${g.error})` : ''}
        </Text>,
      ]
  const testRuns = [...s.checks].reverse().slice(0, 4)
  const remote =
    gh === null
      ? [<Text key="pending" color={C.dim}>GitHub: noch nicht abgefragt.</Text>]
      : !gh.isOk
        ? [
            <Text key="na" color={C.warn} wrap="wrap">
              GitHub: Status nicht verfügbar ({gh.error})
            </Text>,
            <Text key="why" color={C.dim} wrap="wrap">
              Abfrage über die gh-CLI ({gh.repo}); ohne Anmeldung (gh auth login) bleiben PR-, CI- und Review-Daten leer.
            </Text>,
          ]
        : [
            gh.current === null ? (
              <Text key="cur" color={C.dim}>
                Kein offener PR für {g?.branch ?? 'diesen Branch'}.
              </Text>
            ) : (
              <Text key="cur" color={C.fg} wrap="wrap">
                <Text color={C.accent}>PR #{gh.current.number}</Text> {gh.current.title}
                <Text color={C.dim}>
                  {' '}
                  · {gh.current.isDraft ? 'Entwurf · ' : ''}Merge {gh.current.mergeable.toLowerCase()} · Review {gh.current.review || 'offen'} · CI {ciState(gh.current)}
                </Text>
              </Text>
            ),
            ...(gh.current?.checks ?? []).slice(0, 10).map(c => (
              <Text key={`check-${c.name}`} color={/SUCCESS|NEUTRAL|SKIPPED/.test(c.state) ? C.ok : /FAIL|ERROR|TIMED|CANCEL|ACTION/.test(c.state) ? C.bad : C.accent} wrap="truncate-end">
                {'  '}
                {c.state.toLowerCase().padEnd(12)} {c.name}
              </Text>
            )),
            <Text key="open" color={C.dim}>
              Offene PRs: {gh.open.length >= 50 ? "mind. 50" : gh.open.length} · blockiert (aktueller PR: Konflikt, CI, Review; andere laut Label conflicts/needs-rebase):
            </Text>,
            ...gh.open
              .filter(pr => pr.mergeable === 'CONFLICTING' || ciState(pr) === 'rot' || pr.review === 'CHANGES_REQUESTED' || pr.labels.some(l => l === 'conflicts' || l === 'needs-rebase'))
              .slice(0, 8)
              .map(pr => (
                <Text key={`pr-${pr.number}`} color={C.bad} wrap="truncate-end">
                  {'  '}#{pr.number} {pr.title}
                  <Text color={C.dim}>
                    {' '}
                    · {[pr.mergeable === 'CONFLICTING' ? 'Konflikt' : '', ciState(pr) === 'rot' ? 'CI rot' : '', pr.review === 'CHANGES_REQUESTED' ? 'Änderungen angefordert' : '', ...pr.labels.filter(l => l === 'conflicts' || l === 'needs-rebase').map(l => `Label ${l}`)].filter(Boolean).join(', ')}
                  </Text>
                </Text>
              )),
            ...gh.open
              .filter(pr => /dashboard/i.test(`${pr.title} ${pr.branch}`) || pr.labels.includes('dashboard'))
              .slice(0, 5)
              .map(pr => (
                <Text key={`dash-${pr.number}`} color={C.warn} wrap="truncate-end">
                  {'  '}Überschneidung prüfen: #{pr.number} {pr.title}
                </Text>
              )),
            <Text key="prio" color={C.fg} wrap="wrap">
              <Text color={C.dim}>P0: </Text>
              {gh.p0 === null ? 'nicht bestimmbar' : gh.p0.length === 0 ? 'keine' : gh.p0.map(i => `#${i.number}`).join(', ')}
              <Text color={C.dim}> · P1: </Text>
              {gh.p1 === null ? 'nicht bestimmbar' : gh.p1.length === 0 ? 'keine' : gh.p1.map(i => `#${i.number}`).join(', ')}
              <Text color={C.dim}> · abgefragt {ago(now, gh.at)}</Text>
            </Text>,
          ]
  return card(t, 'github', 'Git, GitHub & CI', [
    ...localLines,
    <Text key="tests-head" color={C.dim}>
      Lokale Prüfungen dieser Sitzung (aus tatsächlichen Bash-Ergebnissen):
    </Text>,
    testRuns.length === 0 && (
      <Text key="tests-none" color={C.dim}>
        {'  '}keine ausgeführt
      </Text>
    ),
    ...testRuns.map((c, i) => (
      <Text key={`run-${i}`} color={c.isOk ? C.ok : C.bad} wrap="truncate-end">
        {'  '}
        {c.isOk ? '✓' : '✗'} {c.kind.padEnd(9)} {c.command}
        <Text color={C.dim}> · {ago(now, c.at)}</Text>
      </Text>
    )),
    ...remote,
  ])
}

function drawSafety(t: Table, s: Snapshot, now: number) {
  const { Text } = t
  const list = [...s.safety].reverse().slice(0, 12)
  const color = (d: McSafetyEvent['decision']) => (d === 'freigegeben' ? C.warn : d === 'abgebrochen' ? C.ok : d === 'wartet' ? C.bad : C.dim)
  return card(t, 'safety', 'Safety Control', [
    <Text key="rule" color={C.dim} wrap="wrap">
      Riskante Aktionen (Löschen, git reset --hard, Force-Push, Branch-Änderungen, Migrationen, Supabase, .env/Secrets, Deployments, Merges) werden angehalten und brauchen eine Freigabe im Dialog. Die Claude-Code-Berechtigungsregeln gelten zusätzlich weiter.
    </Text>,
    list.length === 0 && (
      <Text key="none" color={C.dim}>
        Bisher keine riskante Aktion in dieser Sitzung.
      </Text>
    ),
    ...list.map(ev => (
      <Text key={`ev-${ev.id}`} color={C.fg} wrap="wrap">
        <Text color={color(ev.decision)}>{ev.decision.padEnd(13)}</Text>
        <Text color={C.accent}>{ev.category}</Text> · {short(ev.command, 70)}
        <Text color={C.dim}>
          {' '}
          → {ev.summary} · {ago(now, ev.at)}
        </Text>
      </Text>
    )),
  ])
}

async function refreshAll($: Engine, repo: string) {
  await refreshGit($)
  await refreshGithub($, repo)
  await takeReading($, undefined)
  await refreshStatusLine($)
}
