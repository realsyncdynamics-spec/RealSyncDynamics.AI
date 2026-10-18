import { describe, expect, test } from 'claude-code/testing'

import { ciState, hints, parseChecks, parseIssues, parseMergeable, parsePrs, parseReviews, parseStatus, phases } from '../hooks/derive'
import { checkKind, classifyCommand, classifyTool, isReadOnlySql } from '../hooks/risk'

const HOLD: Array<[string, string]> = [
  ['rm -rf src/components', 'Löschen'],
  ['cd src && rm -r pages', 'Löschen'],
  ['rm src/App.tsx', 'Löschen'],
  ['find . -name "*.ts" -delete', 'Löschen'],
  ['git rm src/old.ts', 'Löschen'],
  ['git reset --hard origin/main', 'Git-Verlust'],
  ['git clean -fd', 'Git-Verlust'],
  ['git checkout -- .', 'Git-Verlust'],
  ['git restore src/App.tsx', 'Git-Verlust'],
  ['git stash drop', 'Git-Verlust'],
  ['git push --force origin feature', 'Force-Push'],
  ['git push -f', 'Force-Push'],
  ['git push --force-with-lease', 'Force-Push'],
  ['git push origin +feature', 'Force-Push'],
  ['git push origin main', 'Merge'],
  ['git push origin HEAD:main', 'Merge'],
  ['git branch -D feature', 'Branch'],
  ['git push origin --delete feature', 'Branch'],
  ['git checkout -B main', 'Branch'],
  ['gh pr merge 42 --squash', 'Merge'],
  ['supabase db push', 'Supabase-Produktiv'],
  ['npx supabase db reset --linked', 'Supabase-Produktiv'],
  ['supabase functions deploy siteos', 'Deployment'],
  ['supabase secrets set KEY=1', 'Umgebungsvariablen'],
  ['psql "$DATABASE_URL" -c "delete from users"', 'Datenbank'],
  ['npx wrangler pages deploy dist', 'Deployment'],
  ['wrangler deploy', 'Deployment'],
  ['wrangler secret put STRIPE_KEY', 'Umgebungsvariablen'],
  ['npm run release:merge', 'Deployment'],
  ['npm run stripe:sync', 'Externe Aktion'],
  ['echo "X=1" > .env', 'Umgebungsvariablen'],
  ['echo "X=1" >> .env.local', 'Umgebungsvariablen'],
  ['cp .env.example .env', 'Umgebungsvariablen'],
  ['vercel --prod', 'Deployment'],
  ['gh secret set TOKEN', 'Umgebungsvariablen'],
  ['gh api -X DELETE repos/o/r/git/refs/heads/x', 'GitHub-Schreibzugriff'],
  ['prisma migrate deploy', 'Datenbank'],
]

const PASS = [
  'ls -la',
  'git status',
  'git diff HEAD',
  'git checkout feature',
  'git checkout -b neu',
  'git push -u origin claude/realsync-mission-control-jizmxs',
  'git clean -n',
  'git restore --staged src/App.tsx',
  'npm run build',
  'npm test',
  'rm -rf /tmp/claude-0/scratch',
  'supabase db diff',
  'cat .env.example',
  'wrangler pages deployment list',
  'gh pr list --json number',
  'npm run migrate:rename',
]

describe('classifyCommand', () => {
  for (const [command, category] of HOLD) {
    test(`hält an: ${command}`, () => {
      const risk = classifyCommand(command)
      expect(risk?.severity).toBe('hold')
      expect(risk?.category).toBe(category)
    })
  }
  for (const command of PASS) {
    test(`lässt durch: ${command}`, () => {
      expect(classifyCommand(command)).toBeNull()
    })
  }
  test('git push ohne Ziel wird nur gemessen, nicht pauschal angehalten', () => {
    expect(classifyCommand('git push')?.severity).toBe('warn')
  })
  test('git merge wird gemessen (hart nur auf main)', () => {
    expect(classifyCommand('git merge origin/main')?.severity).toBe('warn')
  })
  test('cd verschiebt das Verzeichnis für rm', () => {
    expect(classifyCommand('cd src && rm -rf pages')?.dir).toBe('src')
  })
})

describe('classifyTool', () => {
  test('.env-Dateien sind geschützt, Beispiele nicht', () => {
    expect(classifyTool('Edit', { file_path: '/repo/.env.production' })?.severity).toBe('hold')
    expect(classifyTool('Write', { file_path: '/repo/.env' })?.category).toBe('Umgebungsvariablen')
    expect(classifyTool('Edit', { file_path: '/repo/.env.example' })).toBeNull()
    expect(classifyTool('Edit', { file_path: '/repo/src/App.tsx' })).toBeNull()
  })
  test('Migrationen und Workflows werden protokolliert', () => {
    expect(classifyTool('Write', { file_path: '/repo/supabase/migrations/20261018_x.sql' })?.severity).toBe('warn')
    expect(classifyTool('Edit', { file_path: '/repo/.github/workflows/deploy.yml' })?.category).toBe('Deployment')
  })
  test('Supabase-MCP: lesendes SQL frei, schreibendes angehalten', () => {
    expect(classifyTool('mcp__Supabase__execute_sql', { query: 'select count(*) from tenants' })).toBeNull()
    expect(classifyTool('mcp__Supabase__execute_sql', { query: 'delete from tenants' })?.severity).toBe('hold')
    expect(classifyTool('mcp__Supabase__execute_sql', { query: 'select 1; drop table x' })?.severity).toBe('hold')
    expect(classifyTool('mcp__Supabase__apply_migration', { name: 'x' })?.category).toBe('Supabase-Produktiv')
    expect(classifyTool('mcp__Supabase__list_tables', {})).toBeNull()
  })
  test('GitHub-MCP: Merge und Schreiben auf main angehalten', () => {
    expect(classifyTool('mcp__github__merge_pull_request', { pullNumber: 1 })?.category).toBe('Merge')
    expect(classifyTool('mcp__github__push_files', { branch: 'main' })?.severity).toBe('hold')
    expect(classifyTool('mcp__github__push_files', { branch: 'feature' })).toBeNull()
    expect(classifyTool('mcp__github__pull_request_read', {})).toBeNull()
  })
  test('Deploy-Werkzeuge anderer Dienste angehalten, Lesen frei', () => {
    expect(classifyTool('mcp__Vercel__create_deployment', {})?.severity).toBe('hold')
    expect(classifyTool('mcp__Vercel__get_deployment_file_contents', {})).toBeNull()
    expect(classifyTool('mcp__Lovable__deploy_project', {})?.severity).toBe('hold')
  })
  test('isReadOnlySql', () => {
    expect(isReadOnlySql('with a as (select 1) select * from a')).toBe(true)
    expect(isReadOnlySql('update t set x = 1')).toBe(false)
  })
})

describe('checkKind', () => {
  test('erkennt die Prüfungen des Repos', () => {
    expect(checkKind('npm test')).toBe('test')
    expect(checkKind('npx vitest run src/x.test.ts')).toBe('test')
    expect(checkKind('npm run build')).toBe('build')
    expect(checkKind('npm run lint')).toBe('lint')
    expect(checkKind('npx tsc --noEmit')).toBe('typecheck')
    expect(checkKind('git status')).toBeNull()
  })
})

describe('derive', () => {
  test('parseStatus liest Branch, Upstream und Abstand', () => {
    const s = parseStatus('## claude/x.y...origin/claude/x.y [ahead 2, behind 1]\n M src/App.tsx\n?? neu.ts\n')
    expect(s.branch).toBe('claude/x.y')
    expect(s.upstream).toBe('origin/claude/x.y')
    expect(s.ahead).toBe(2)
    expect(s.behind).toBe(1)
    expect(s.changes).toEqual([
      { code: ' M', path: 'src/App.tsx' },
      { code: '??', path: 'neu.ts' },
    ])
  })
  test('parsePrs, parseChecks, parseReviews und ciState', () => {
    const [pr] = parsePrs(JSON.stringify([{ number: 7, title: 't', draft: true, html_url: 'u', head: { ref: 'b', sha: 's' }, labels: [{ name: 'dashboard' }] }]))
    expect(pr).toMatchObject({ number: 7, branch: 'b', sha: 's', isDraft: true, labels: ['dashboard'], mergeable: 'UNKNOWN' })
    const checks = parseChecks(
      JSON.stringify({ check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }, { name: 'test', status: 'completed', conclusion: 'failure' }] }),
      JSON.stringify({ statuses: [{ context: 'cloudflare-pages', state: 'pending' }] }),
    )
    expect(checks.map(c => c.state)).toEqual(['SUCCESS', 'FAILURE', 'PENDING'])
    expect(pr === undefined ? '' : ciState({ ...pr, checks })).toBe('rot')
    expect(parseMergeable(JSON.stringify({ mergeable: false, mergeable_state: 'dirty' }))).toBe('CONFLICTING')
    expect(parseReviews(JSON.stringify([{ user: { login: 'a' }, state: 'CHANGES_REQUESTED' }, { user: { login: 'a' }, state: 'APPROVED' }]))).toBe('APPROVED')
    expect(parseReviews(JSON.stringify([{ user: { login: 'a' }, state: 'APPROVED' }, { user: { login: 'b' }, state: 'CHANGES_REQUESTED' }]))).toBe('CHANGES_REQUESTED')
    expect(parseIssues(JSON.stringify([{ number: 1, title: 'i' }, { number: 2, title: 'pr', pull_request: {} }]))).toEqual([{ number: 1, title: 'i' }])
  })
  test('phases leitet nur aus Belegen ab', () => {
    const turn = { prompt: 'Baue X', startedAt: 100, reads: 3, edits: 2 }
    const p = phases(turn, [{ command: 'npm run build', kind: 'build', isOk: false, at: 150 }], null)
    expect(p.map(x => x.state)).toEqual(['erledigt', 'erledigt', 'erledigt', 'fehlgeschlagen', 'unbekannt', 'offen'])
    expect(phases(null, [], null)[0]?.state).toBe('offen')
  })
  test('hints empfiehlt /compact ab 70 %, kritisch ab 85 %', () => {
    const base = { checks: [], git: null, github: null, tasks: [], agents: [], safety: [], turn: null }
    expect(hints({ ...base, readings: [{ at: 0, tokens: 72, window: 100, percent: 72 }] })[0]?.level).toBe('warnung')
    expect(hints({ ...base, readings: [{ at: 0, tokens: 90, window: 100, percent: 90 }] })[0]?.level).toBe('kritisch')
    expect(hints({ ...base, readings: [] })).toEqual([])
  })
})
