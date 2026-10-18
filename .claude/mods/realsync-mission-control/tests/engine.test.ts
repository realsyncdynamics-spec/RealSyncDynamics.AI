import { describe, expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'realsync-mission-control'

type Answer = 'Abbrechen' | 'Einmal ausführen' | 'afk' | 'dismiss'

/** Die Welt unter dem Plugin: ein Repo unter /repo, git-Antworten, ein Dialog. */
type Extra = { statusLines?: string[]; ghError?: string; gh?: Record<string, unknown> }

function world(on: On, answer: Answer, log: string[], failing?: RegExp, extra: Extra = {}) {
  mock.clock(on, { now: 1_000_000 })
  on('session.cwd', () => ({ value: '/repo' }))
  on('ui.status', ($, e) => {
    extra.statusLines?.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    log.push(`toast ${String((e as { text?: string }).text ?? '')}`)
    return { value: undefined }
  })
  on('fs.exists', () => ({ value: false }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [] } }) as never)
  on('process.run', ($, e) => {
    const argv = e.argv.join(' ')
    log.push(`run ${argv}`)
    const path = e.argv[0] === 'gh' ? (e.argv.at(-1) ?? '').replace(/^repos\/[^/]+\/[^/]+\//, '') : ''
    const canned = extra.gh?.[path]
    if (canned !== undefined) return { value: { exitCode: 0, stdout: JSON.stringify(canned), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (extra.ghError !== undefined && e.argv[0] === 'gh') return { value: { exitCode: 1, stdout: '', stderr: extra.ghError, isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv.startsWith('git status --porcelain=v1 -b')) return { value: { exitCode: 0, stdout: '## feature...origin/feature [ahead 1]\n M src/App.tsx\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv.startsWith('git status --porcelain')) return { value: { exitCode: 0, stdout: ' M src/App.tsx\nM  src/index.css\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv.startsWith('git rev-parse --abbrev-ref')) return { value: { exitCode: 0, stdout: 'feature\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv.startsWith('git log -1')) return { value: { exitCode: 0, stdout: 'abc123 Letzter Commit\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv.startsWith('git ls-files')) return { value: { exitCode: 0, stdout: argv.includes('--others') ? '' : 'src/components/A.tsx\nsrc/components/B.tsx\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    return { value: { exitCode: 1, stdout: '', stderr: 'nicht gemockt', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = (e as unknown as { questions: Array<{ question: string }> }).questions[0]?.question ?? ''
    log.push(`ask ${q}`)
    if (answer === 'dismiss') return { deny: 'geschlossen' }
    const result = { questions: [], answers: { [q]: answer === 'afk' ? 'Einmal ausführen' : answer }, ...(answer === 'afk' ? { afkTimeoutMs: 60000 } : {}) }
    return { result } as never
  })
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    const command = String((e as unknown as { command: string }).command)
    log.push(`BASH ${command}`)
    return (failing?.test(command) ? { result: { stdout: '', stderr: 'error', interrupted: false }, isError: true } : { result: { stdout: '', stderr: '', interrupted: false } }) as never
  })
  on('tool.call', { tool: 'Edit' }, () => ({ result: { filePath: '/repo/src/App.tsx' } }) as never)
}

const PANE_PROPS = { title: 'Mission Control', isFocused: false, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} }

async function pane($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop' | 'mobile' = 'terminal', columns = 140) {
  return $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'mission-control', props: { ...PANE_PROPS, bodyColumns: columns } } as never)
}

describe('Safety Control', () => {
  test('git reset --hard: Abbrechen verhindert die Ausführung und zeigt betroffene Dateien', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log)
    const ran = await $.tool.call({ tool: 'Bash', command: 'git reset --hard' } as never)
    expect(log.some(l => l.startsWith('BASH'))).toBe(false)
    const asked = log.find(l => l.startsWith('ask ')) ?? ''
    expect(asked).toContain('Git-Verlust')
    expect(asked).toContain('src/App.tsx')
    expect(JSON.stringify(ran)).toContain('nicht ausgeführt')
    const ui = await pane($)
    await ui.press({ key: 'tab-safety' })
    expect(await ui.find({ text: /abgebrochen/ })).toBeDefined()
  })

  test('rm -rf: nur „Einmal ausführen“ gibt frei', async ($, on) => {
    const log: string[] = []
    world(on, 'Einmal ausführen', log)
    await $.tool.call({ tool: 'Bash', command: 'rm -rf src/components' } as never)
    expect(log).toContain('BASH rm -rf src/components')
    expect(log.find(l => l.startsWith('ask ')) ?? '').toContain('löscht 2 versionierte')
    const ui = await pane($)
    await ui.press({ key: 'tab-safety' })
    expect(await ui.find({ text: /freigegeben/ })).toBeDefined()
  })

  test('automatisch aufgelöster Dialog (AFK) gibt nicht frei', async ($, on) => {
    const log: string[] = []
    world(on, 'afk', log)
    await $.tool.call({ tool: 'Bash', command: 'git push --force' } as never)
    expect(log.some(l => l.startsWith('BASH'))).toBe(false)
  })

  test('geschlossener Dialog gibt nicht frei', async ($, on) => {
    const log: string[] = []
    world(on, 'dismiss', log)
    await $.tool.call({ tool: 'Bash', command: 'supabase db push' } as never)
    expect(log.some(l => l.startsWith('BASH'))).toBe(false)
  })

  test('harmlose Befehle laufen ohne Rückfrage', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log)
    await $.tool.call({ tool: 'Bash', command: 'git status' } as never)
    expect(log).toContain('BASH git status')
    expect(log.some(l => l.startsWith('ask '))).toBe(false)
  })

  test('safety=aus protokolliert nur', { options: { safety: 'aus' } }, async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log)
    await $.tool.call({ tool: 'Bash', command: 'git reset --hard' } as never)
    expect(log).toContain('BASH git reset --hard')
    expect(log.some(l => l.startsWith('ask '))).toBe(false)
    const ui = await pane($)
    await ui.press({ key: 'tab-safety' })
    expect(await ui.find({ text: /protokolliert/ })).toBeDefined()
  })
})

describe('Erfassung', () => {
  test('Edit, Tests und Aufgaben werden aus echten Ergebnissen erfasst', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log)
    on('tool.call', { tool: 'TaskCreate' }, () => ({ result: { task: { id: '1', subject: 'Mod bauen' } } }) as never)
    on('tool.call', { tool: 'TaskUpdate' }, () => ({ result: { success: true, taskId: '1', updatedFields: ['status'] } }) as never)
    on('tool.call', { tool: 'Read' }, () => ({ result: {} }) as never)
    await $.tool.call({ tool: 'Read', file_path: '/repo/src/index.css' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/repo/src/App.tsx', old_string: 'a', new_string: 'b' } as never)
    await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
    await $.tool.call({ tool: 'TaskCreate', subject: 'Mod bauen', description: 'x' } as never)
    await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as never)
    const ui = await pane($)
    expect(await ui.find({ text: /Teilaufgaben: 1 von 1 erledigt/ })).toBeDefined()
    expect(await ui.find({ text: /✓ Mod bauen/ })).toBeDefined()
    expect(await ui.find({ text: /1 bearbeitet, 1 nur gelesen/ })).toBeDefined()
    await ui.press({ key: 'tab-github' })
    expect(await ui.find({ text: /✓ test/ })).toBeDefined()
  })

  test('ein fehlschlagender Build zählt als fehlgeschlagen', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log, /build/)
    await $.tool.call({ tool: 'Bash', command: 'npm run build' } as never)
    const ui = await pane($)
    await ui.press({ key: 'tab-github' })
    expect(await ui.find({ text: /✗ build/ })).toBeDefined()
    await ui.press({ key: 'tab-overview' })
    expect(await ui.find({ text: /Letzte Prüfung fehlgeschlagen \(build\)/ })).toBeDefined()
  })
})

describe('Pane', () => {
  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    test(`zeichnet Kopfzeile, Ablauf und Warnungen (${surface})`, async ($, on) => {
      const log: string[] = []
      world(on, 'Abbrechen', log)
      await $.tool.call({ tool: 'Edit', file_path: '/repo/src/App.tsx', old_string: 'a', new_string: 'b' } as never)
      for (const columns of [140, 60]) {
        const ui = await pane($, surface, columns)
        expect(await ui.find({ text: /RealSync Mission Control/ })).toBeDefined()
        expect(await ui.find({ text: /Kontext/ })).toBeDefined()
        expect(await ui.find({ text: /Ablauf/ })).toBeDefined()
        expect(await ui.find({ text: /Warnungen, Blocker/ })).toBeDefined()
        await ui.press({ key: 'tab-files' })
        expect(await ui.find({ text: /src\/App\.tsx/ })).toBeDefined()
        await ui.press({ key: 'tab-safety' })
        expect(await ui.find({ text: /Safety Control/ })).toBeDefined()
        await ui.press({ key: 'tab-overview' })
        await ui.unmount()
      }
    })
  }
})

describe('Agenten, Statuszeile, GitHub', () => {
  test('Subagent: Start, Werkzeuge und Ende kommen aus echten Ereignissen', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log)
    on('tool.call', { tool: 'Agent' }, () => ({ result: { status: 'async_launched', agentId: 'a1', description: 'Repo durchsuchen', prompt: 'p', outputFile: '/tmp/o' } }) as never)
    on('tool.call', { tool: 'Grep' }, () => ({ result: {} }) as never)
    on('turn.complete', () => ({ text: '' }) as never)
    await $.tool.call({ tool: 'Agent', description: 'Repo durchsuchen', prompt: 'p', subagent_type: 'Explore' } as never)
    await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'a1' } as never)
    let ui = await pane($)
    await ui.press({ key: 'tab-agents' })
    expect(await ui.find({ text: /running/ })).toBeDefined()
    expect(await ui.find({ text: /Explore · .* · 1 Tools · zuletzt Grep/ })).toBeDefined()
    await ui.unmount()
    await $.turn.complete({ answer: '', durationMs: 5, isAborted: false, turnId: 't', agentId: 'a1', reason: 'answer' } as never)
    ui = await pane($)
    await ui.press({ key: 'tab-agents' })
    expect(await ui.find({ text: /completed/ })).toBeDefined()
  })

  test('Statuszeile zeigt Branch, Kontext und Freigaben', async ($, on) => {
    const log: string[] = []
    const lines: string[] = []
    world(on, 'Abbrechen', log, undefined, { statusLines: lines })
    on('tool.call', { tool: 'Read' }, () => ({ result: {} }) as never)
    await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' } as never)
    expect(lines.at(-1) ?? '').toContain('◆ Mission Control')
    expect(lines.at(-1) ?? '').toContain('Agenten 0')
  })

  test('GitHub nicht erreichbar: ausdrücklich „Status nicht verfügbar“', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log, undefined, { ghError: 'gh auth login required' })
    const ui = await pane($)
    await ui.press({ key: 'tab-github' })
    await ui.press({ key: 'refresh' })
    expect(await ui.find({ text: /GitHub: Status nicht verfügbar \(gh auth login required\)/ })).toBeDefined()
    expect(await ui.find({ text: /Branch feature/ })).toBeDefined()
  })

  test('/mc-status liefert den Stand als Text', async ($, on) => {
    const log: string[] = []
    world(on, 'Abbrechen', log)
    const out = await $.command.run({ command: 'mc-status', args: '' } as never)
    expect(JSON.stringify(out)).toContain('RealSync Mission Control')
    expect(JSON.stringify(out)).toContain('Ablauf')
  })
})

test('GitHub-REST: aktueller PR mit Konflikt und rotem CI, P0-Issue, Dashboard-Überschneidung', async ($, on) => {
  const log: string[] = []
  world(on, 'Abbrechen', log, undefined, {
    gh: {
      'pulls?state=open&per_page=50': [
        { number: 12, title: 'Mission Control', draft: true, html_url: 'u', head: { ref: 'feature', sha: 'abc' }, labels: [] },
        { number: 9, title: 'Dashboard-Ausbau', draft: false, html_url: 'u', head: { ref: 'dash', sha: 'def' }, labels: [{ name: 'needs-rebase' }] },
      ],
      'pulls/12': { mergeable: false, mergeable_state: 'dirty' },
      'pulls/12/reviews?per_page=100': [],
      'commits/abc/check-runs?per_page=100': { check_runs: [{ name: 'unit-tests', status: 'completed', conclusion: 'failure' }] },
      'commits/abc/status': { statuses: [] },
      'labels?per_page=100': [{ name: 'P0' }],
      'issues?state=open&labels=P0&per_page=30': [{ number: 77, title: 'Login kaputt' }],
    },
  })
  const ui = await pane($)
  await ui.press({ key: 'tab-github' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ text: /PR #12/ })).toBeDefined()
  expect(await ui.find({ text: /failure\s+unit-tests/ })).toBeDefined()
  expect(await ui.find({ text: /#9 Dashboard-Ausbau/ })).toBeDefined()
  expect(await ui.find({ text: /Überschneidung prüfen: #9/ })).toBeDefined()
  expect(await ui.find({ text: /#77/ })).toBeDefined()
  expect(await ui.find({ text: /P1: nicht bestimmbar/ })).toBeDefined()
  await ui.press({ key: 'tab-overview' })
  expect(await ui.find({ text: /Merge-Konflikte: npm run sync:main/ })).toBeDefined()
  expect(await ui.find({ text: /CI rot auf PR #12: unit-tests/ })).toBeDefined()
})

test('git push und git merge auf einem Feature-Branch laufen still durch', async ($, on) => {
  const log: string[] = []
  world(on, 'Abbrechen', log)
  await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
  await $.tool.call({ tool: 'Bash', command: 'git merge origin/main' } as never)
  expect(log).toContain('BASH git push')
  expect(log).toContain('BASH git merge origin/main')
  expect(log.some(l => l.startsWith('ask ') || l.startsWith('toast '))).toBe(false)
})
