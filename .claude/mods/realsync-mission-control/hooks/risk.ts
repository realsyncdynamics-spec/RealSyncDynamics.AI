// Welche Aktionen als riskant gelten. Reine Funktionen ohne `$`, damit sie
// direkt testbar sind. `hold` hält die Aktion an und verlangt eine Freigabe
// im Dialog, `warn` protokolliert nur.

export type RiskKind =
  | 'rm'
  | 'rm-plain'
  | 'find-delete'
  | 'git-reset'
  | 'git-clean'
  | 'git-discard'
  | 'git-history'
  | 'git-push-force'
  | 'git-push-main'
  | 'git-branch'
  | 'git-merge'
  | 'git-rebase'
  | 'gh-merge'
  | 'gh-write'
  | 'db'
  | 'supabase'
  | 'env'
  | 'deploy'
  | 'mcp'
  | 'migration-file'
  | 'deploy-config'

export type Risk = {
  kind: RiskKind
  category: string
  label: string
  severity: 'hold' | 'warn'
  targets?: string[]
  args?: string[]
  dir?: string
}

const SPLIT = /&&|\|\||;|\||\n/
const PREFIXES = new Set(['command', 'exec', 'env', 'nohup', 'time', 'then', 'do', 'else', '!', 'npx', 'bunx', 'pnpx'])
const SUDO_VALUE_OPTIONS = new Set(['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-T', '-U'])
const MAIN = /^(main|master)$/
const ENV_FILE = /(^|[\\/])\.env(\.[\w.-]+)?$/
const ENV_HARMLESS = /\.(example|sample|template|dist)$/
const TEMP = /^(\/tmp\/|\/var\/tmp\/|\$TMPDIR|\$\{TMPDIR\})/

export function isEnvFile(path: string): boolean {
  const clean = path.replace(/^['"]|['"]$/g, '')
  return ENV_FILE.test(clean) && !ENV_HARMLESS.test(clean)
}

/** Zerlegt ein Segment in Wörter und beachtet Anführungszeichen. */
export function tokenize(text: string): string[] {
  const words: string[] = []
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    words.push(m[1] ?? m[2] ?? m[3] ?? '')
  }
  return words
}

function joinDir(dir: string | undefined, arg: string | undefined): string | undefined {
  if (arg === undefined) {
    return dir
  }
  if (arg.startsWith('/') || arg.startsWith('~') || /^[A-Za-z]:[\\/]/.test(arg)) {
    return arg
  }
  return dir ? `${dir}/${arg}` : arg
}

function stripPrefixes(words: string[]): string[] {
  const out = [...words]
  const isAssign = (w: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)
  while (out.length > 0 && isAssign(out[0] ?? '')) out.shift()
  if (out[0] === 'sudo') {
    out.shift()
    while (out.length > 0 && (out[0] ?? '').startsWith('-')) {
      const option = out.shift() ?? ''
      if (SUDO_VALUE_OPTIONS.has(option)) out.shift()
    }
  }
  while (out.length > 0 && (PREFIXES.has(out[0] ?? '') || isAssign(out[0] ?? ''))) out.shift()
  return out
}

/** Das erste riskante Segment eines Shell-Befehls, oder null. */
export function classifyCommand(command: string): Risk | null {
  let dir: string | undefined
  let warned: Risk | null = null
  for (const raw of command.split(SPLIT)) {
    const segment = raw.trim().replace(/^[({]+\s*/, '').replace(/\s*[)}]+$/, '')
    if (segment === '') continue
    const redirect = envRedirect(segment)
    if (redirect !== null) return { ...redirect, dir }
    const words = stripPrefixes(tokenize(segment))
    const [first, ...args] = words
    if (first === undefined) continue
    const cmd = first.replace(/^\\/, '').replace(/^.*\//, '')
    if (cmd === 'cd' || cmd === 'pushd') {
      dir = joinDir(dir, args[0])
      continue
    }
    const risk = classifyWords(cmd, args, segment)
    if (risk === null) continue
    const located = { ...risk, dir: risk.dir ?? dir }
    if (located.severity === 'hold') return located
    warned = warned ?? located
  }
  return warned
}

function envRedirect(segment: string): Risk | null {
  const re = /(?:\d?>>?|\btee\b(?:\s+-a)?)\s*(['"]?)([^\s'"]+)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(segment)) !== null) {
    const target = m[2] ?? ''
    if (isEnvFile(target)) {
      return { kind: 'env', category: 'Umgebungsvariablen', label: `schreibt in ${target}`, severity: 'hold', targets: [target] }
    }
  }
  return null
}

function classifyWords(cmd: string, args: string[], segment: string): Risk | null {
  const joined = args.join(' ')
  if (cmd === 'rm') {
    const flags = args.filter(a => a.startsWith('-') && a !== '-')
    const targets = args.filter(a => !a.startsWith('-') || a === '-')
    if (targets.length > 0 && targets.every(t => TEMP.test(t))) return null
    const isRecursive = flags.some(f => f === '--recursive' || (/^-[^-]/.test(f) && /[rR]/.test(f)))
    const isForce = flags.some(f => f === '--force' || (/^-[^-]/.test(f) && f.includes('f')))
    if (isRecursive || isForce) {
      return { kind: 'rm', category: 'Löschen', label: `rm ${flags.join(' ')}`.trim(), severity: 'hold', targets }
    }
    if (targets.some(isEnvFile)) {
      return { kind: 'env', category: 'Umgebungsvariablen', label: 'löscht eine .env-Datei', severity: 'hold', targets }
    }
    return { kind: 'rm-plain', category: 'Löschen', label: 'rm', severity: 'hold', targets }
  }
  if (cmd === 'find' && (args.includes('-delete') || /-exec\s+rm\b/.test(joined))) {
    return { kind: 'find-delete', category: 'Löschen', label: 'find … -delete', severity: 'hold', args }
  }
  if ((cmd === 'cp' || cmd === 'mv' || cmd === 'ln') && args.length > 0 && isEnvFile(args[args.length - 1] ?? '')) {
    return { kind: 'env', category: 'Umgebungsvariablen', label: `${cmd} überschreibt ${args[args.length - 1]}`, severity: 'hold', targets: [args[args.length - 1] ?? ''] }
  }
  if (cmd === 'sed' && args.some(a => a === '-i' || a.startsWith('-i')) && args.some(isEnvFile)) {
    return { kind: 'env', category: 'Umgebungsvariablen', label: 'sed -i in einer .env-Datei', severity: 'hold', targets: args.filter(isEnvFile) }
  }
  if (cmd === 'git') return classifyGit(args)
  if (cmd === 'gh') return classifyGh(args)
  if (cmd === 'supabase') return classifySupabase(args)
  if (cmd === 'psql' || cmd === 'pg_restore' || cmd === 'dropdb') {
    return { kind: 'db', category: 'Datenbank', label: cmd, severity: 'hold', args }
  }
  if (cmd === 'wrangler') return classifyWrangler(args)
  if (cmd === 'vercel' || cmd === 'netlify' || cmd === 'firebase' || cmd === 'flyctl' || cmd === 'fly' || cmd === 'railway') {
    const sub = args.find(a => !a.startsWith('-'))
    if (cmd === 'vercel' && sub === 'env') {
      return { kind: 'env', category: 'Umgebungsvariablen', label: `vercel env ${args[1] ?? ''}`.trim(), severity: 'hold', args }
    }
    if (sub === undefined || /^(deploy|up|promote|rollback|publish|alias)$/.test(sub)) {
      return { kind: 'deploy', category: 'Deployment', label: `${cmd} ${sub ?? ''}`.trim(), severity: 'hold', args }
    }
    return null
  }
  if ((cmd === 'npm' || cmd === 'pnpm' || cmd === 'yarn' || cmd === 'bun') && args.length > 0) {
    if (args[0] === 'publish') {
      return { kind: 'deploy', category: 'Deployment', label: `${cmd} publish`, severity: 'hold', args }
    }
    const script = args[0] === 'run' || args[0] === 'run-script' ? args[1] : args[0]
    if (script !== undefined && /^(deploy|release|publish)([:._-]|$)/.test(script)) {
      return { kind: 'deploy', category: 'Deployment', label: `${cmd} run ${script}`, severity: 'hold', args }
    }
    if (script !== undefined && /^(db|migrat|supabase)/.test(script) && /(push|reset|migrat|deploy|apply|up\b|seed)/.test(script) && !/^migrate:rename$/.test(script)) {
      return { kind: 'db', category: 'Datenbank', label: `${cmd} run ${script}`, severity: 'hold', args }
    }
    if (script !== undefined && /^stripe[:._-]/.test(script)) {
      return { kind: 'mcp', category: 'Externe Aktion', label: `${cmd} run ${script} (Stripe-Katalog)`, severity: 'hold', args }
    }
    return null
  }
  if (cmd === 'prisma' && args[0] === 'migrate' && args[1] !== 'status' && args[1] !== 'diff') {
    return { kind: 'db', category: 'Datenbank', label: `prisma migrate ${args[1] ?? ''}`.trim(), severity: 'hold', args }
  }
  if (cmd === 'drizzle-kit' && /^(push|migrate|drop)/.test(args[0] ?? '')) {
    return { kind: 'db', category: 'Datenbank', label: `drizzle-kit ${args[0]}`, severity: 'hold', args }
  }
  if (cmd === 'docker' && args[0] === 'push') {
    return { kind: 'deploy', category: 'Deployment', label: 'docker push', severity: 'hold', args }
  }
  if (/\bdb:migrate(?!:status\b)/.test(segment) || /\bmanage\.py\s+migrate\b/.test(segment) || /\balembic\s+upgrade\b/.test(segment)) {
    return { kind: 'db', category: 'Datenbank', label: 'Migration', severity: 'hold', args }
  }
  return null
}

function classifyGit(all: string[]): Risk | null {
  let dir: string | undefined
  let i = 0
  while (i < all.length && (all[i] ?? '').startsWith('-')) {
    if (all[i] === '-C' && i + 1 < all.length) {
      dir = joinDir(dir, all[i + 1])
      i += 2
    } else if (all[i] === '-c' && i + 1 < all.length) {
      i += 2
    } else {
      i += 1
    }
  }
  const sub = all[i]
  const args = all.slice(i + 1)
  const has = (...flags: string[]) => args.some(a => flags.includes(a))
  const base = { args, dir }
  switch (sub) {
    case 'reset':
      return has('--hard', '--merge', '--keep')
        ? { ...base, kind: 'git-reset', category: 'Git-Verlust', label: `git reset ${args.find(a => a.startsWith('--')) ?? '--hard'}`, severity: 'hold' }
        : null
    case 'clean':
      return has('-n', '--dry-run')
        ? null
        : { ...base, kind: 'git-clean', category: 'Git-Verlust', label: 'git clean', severity: 'hold' }
    case 'checkout':
    case 'restore': {
      if (sub === 'checkout' && (has('-B') || args.some(a => /^-[a-zA-Z]*B/.test(a)))) {
        return { ...base, kind: 'git-branch', category: 'Branch', label: 'git checkout -B (setzt Branch zurück)', severity: 'hold' }
      }
      const isStagedOnly = sub === 'restore' && has('--staged', '-S') && !has('--worktree', '-W')
      const discards = has('.', '--', '-f', '--force', ':/') || sub === 'restore'
      return discards && !isStagedOnly
        ? { ...base, kind: 'git-discard', category: 'Git-Verlust', label: `git ${sub} ${args.join(' ')}`.trim(), severity: 'hold' }
        : null
    }
    case 'switch':
      return has('-C', '--force-create', '-f', '--discard-changes')
        ? { ...base, kind: 'git-branch', category: 'Branch', label: `git switch ${args.join(' ')}`.trim(), severity: 'hold' }
        : null
    case 'stash':
      return args[0] === 'drop' || args[0] === 'clear'
        ? { ...base, kind: 'git-discard', category: 'Git-Verlust', label: `git stash ${args[0]}`, severity: 'hold' }
        : null
    case 'filter-branch':
    case 'filter-repo':
      return { ...base, kind: 'git-history', category: 'Git-Verlust', label: `git ${sub}`, severity: 'hold' }
    case 'update-ref':
      return has('-d') ? { ...base, kind: 'git-history', category: 'Git-Verlust', label: 'git update-ref -d', severity: 'hold' } : null
    case 'reflog':
      return args[0] === 'expire' || args[0] === 'delete'
        ? { ...base, kind: 'git-history', category: 'Git-Verlust', label: `git reflog ${args[0]}`, severity: 'hold' }
        : null
    case 'branch':
      return args.some(a => /^-[a-zA-Z]*[DdMmf]/.test(a) || a === '--delete' || a === '--move' || a === '--force')
        ? { ...base, kind: 'git-branch', category: 'Branch', label: `git branch ${args.join(' ')}`.trim(), severity: 'hold' }
        : null
    case 'push': {
      const positional = args.filter(a => !a.startsWith('-'))
      if (args.some(a => a === '--force' || a === '-f' || a.startsWith('--force-with-lease') || a === '--force-if-includes' || /^-[a-zA-Z]*f/.test(a)) || positional.some(a => a.startsWith('+'))) {
        return { ...base, kind: 'git-push-force', category: 'Force-Push', label: 'git push --force', severity: 'hold' }
      }
      if (has('--delete', '-d') || positional.slice(1).some(a => a.startsWith(':'))) {
        return { ...base, kind: 'git-branch', category: 'Branch', label: 'git push --delete', severity: 'hold' }
      }
      const targets = positional.slice(1).map(a => a.split(':').pop() ?? a).map(a => a.replace(/^refs\/heads\//, ''))
      if (targets.some(t => MAIN.test(t)) || has('--all', '--mirror')) {
        return { ...base, kind: 'git-push-main', category: 'Merge', label: 'git push auf main', severity: 'hold' }
      }
      // Ohne Ziel pusht git den aktuellen Branch: ob das main ist, klärt die Messung.
      return positional.length <= 1 || targets.includes('HEAD') ? { ...base, kind: 'git-push-main', category: 'Merge', label: 'git push (aktueller Branch)', severity: 'warn' } : null
    }
    case 'merge':
      return has('--abort') ? null : { ...base, kind: 'git-merge', category: 'Merge', label: `git merge ${args.join(' ')}`.trim(), severity: 'warn' }
    case 'rebase':
      return has('--abort', '--continue', '--skip') ? null : { ...base, kind: 'git-rebase', category: 'Branch', label: `git rebase ${args.join(' ')}`.trim(), severity: 'warn' }
    case 'rm':
      return has('--cached') ? null : { ...base, kind: 'rm', category: 'Löschen', label: 'git rm', severity: 'hold', targets: args.filter(a => !a.startsWith('-')) }
    default:
      return null
  }
}

function classifyGh(args: string[]): Risk | null {
  const [area, action] = args
  if (area === 'pr' && action === 'merge') {
    return { kind: 'gh-merge', category: 'Merge', label: 'gh pr merge', severity: 'hold', args }
  }
  if (area === 'repo' && (action === 'delete' || action === 'archive' || action === 'rename')) {
    return { kind: 'gh-write', category: 'Löschen', label: `gh repo ${action}`, severity: 'hold', args }
  }
  if ((area === 'secret' || area === 'variable') && action !== 'list') {
    return { kind: 'env', category: 'Umgebungsvariablen', label: `gh ${area} ${action ?? ''}`.trim(), severity: 'hold', args }
  }
  if (area === 'workflow' && action === 'run') {
    return { kind: 'deploy', category: 'Deployment', label: 'gh workflow run', severity: 'hold', args }
  }
  if (area === 'release' && (action === 'create' || action === 'delete')) {
    return { kind: 'deploy', category: 'Deployment', label: `gh release ${action}`, severity: 'hold', args }
  }
  if (area === 'api') {
    const method = args.find((a, i) => args[i - 1] === '-X' || args[i - 1] === '--method') ?? args.find(a => /^(-X|--method=)/.test(a))?.replace(/^(-X|--method=)/, '')
    if (method !== undefined && /^(DELETE|PUT|PATCH|POST)$/i.test(method)) {
      return { kind: 'gh-write', category: 'GitHub-Schreibzugriff', label: `gh api ${method.toUpperCase()}`, severity: 'hold', args }
    }
  }
  return null
}

function classifySupabase(args: string[]): Risk | null {
  const positional = args.filter(a => !a.startsWith('-'))
  const [area, action] = positional
  const label = `supabase ${positional.slice(0, 2).join(' ')}`.trim()
  if (area === 'db' && (action === 'push' || action === 'reset' || action === 'remote')) {
    return { kind: 'supabase', category: 'Supabase-Produktiv', label, severity: 'hold', args }
  }
  if (area === 'migration' && (action === 'up' || action === 'repair' || action === 'squash' || action === 'down')) {
    return { kind: 'supabase', category: 'Datenbank', label, severity: 'hold', args }
  }
  if (area === 'functions' && (action === 'deploy' || action === 'delete')) {
    return { kind: 'deploy', category: 'Deployment', label, severity: 'hold', args }
  }
  if (area === 'secrets' && action !== 'list') {
    return { kind: 'env', category: 'Umgebungsvariablen', label, severity: 'hold', args }
  }
  if ((area === 'projects' || area === 'branches' || area === 'orgs') && (action === 'delete' || action === 'create' || action === 'pause')) {
    return { kind: 'supabase', category: 'Supabase-Produktiv', label, severity: 'hold', args }
  }
  if (area === 'link' || area === 'unlink') {
    return { kind: 'supabase', category: 'Supabase-Produktiv', label, severity: 'warn', args }
  }
  return null
}

function classifyWrangler(args: string[]): Risk | null {
  const positional = args.filter(a => !a.startsWith('-'))
  const [area, action] = positional
  const label = `wrangler ${positional.slice(0, 2).join(' ')}`.trim()
  if (area === 'deploy' || area === 'publish' || area === 'rollback' || area === 'delete') {
    return { kind: 'deploy', category: 'Deployment', label, severity: 'hold', args }
  }
  const isWrite = (word: string | undefined) => word === 'delete' || word === 'create' || word === 'upload'
  if ((area === 'pages' || area === 'versions') && (action === 'deploy' || action === 'publish' || ((action === 'deployment' || action === 'project') && isWrite(positional[2])))) {
    return { kind: 'deploy', category: 'Deployment', label, severity: 'hold', args }
  }
  if (area === 'secret' || (area === 'pages' && action === 'secret')) {
    return positional.includes('list') ? null : { kind: 'env', category: 'Umgebungsvariablen', label, severity: 'hold', args }
  }
  if ((area === 'd1' || area === 'kv' || area === 'r2') && args.includes('--remote') && !positional.includes('list')) {
    return { kind: 'db', category: 'Datenbank', label: `${label} --remote`, severity: 'hold', args }
  }
  if (area === 'd1' && action === 'migrations' && positional[2] === 'apply') {
    return { kind: 'db', category: 'Datenbank', label: 'wrangler d1 migrations apply', severity: 'hold', args }
  }
  return null
}

const READ_SQL = /^\s*(select|with|explain|show|table|values)\b/i
const WRITE_SQL = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|comment|merge|upsert|vacuum|reindex|copy|call|do)\b/i

/** Nur-lesendes SQL: eine Anweisung, beginnt lesend, ohne schreibendes Schlüsselwort. */
export function isReadOnlySql(query: string): boolean {
  const body = query.trim().replace(/;\s*$/, '')
  return READ_SQL.test(body) && !body.includes(';') && !WRITE_SQL.test(body)
}

const MCP_READ = /__(get|list|search|count|aggregate|read|filter|query_logs|describe|find|fetch|show|help|whoami|tool_guidance)/
const MCP_RISKY = /(deploy|publish|promote|rollback|merge|delete|drop|reset|migrat|secret|_env|pause|restore|alias|trigger|firewall|transfer|rebase)/

/** Riskante Datei- und MCP-Werkzeugaufrufe, oder null. */
export function classifyTool(tool: string, input: Record<string, unknown>): Risk | null {
  const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : undefined
  if (path !== undefined && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
    if (isEnvFile(path)) {
      return { kind: 'env', category: 'Umgebungsvariablen', label: `${tool} ${path}`, severity: 'hold', targets: [path] }
    }
    if (/(^|\/)supabase\/migrations\//.test(path)) {
      return { kind: 'migration-file', category: 'Datenbank', label: `${tool} Migration`, severity: 'warn', targets: [path] }
    }
    if (/(^|\/)(wrangler\.(toml|jsonc?)|\.github\/workflows\/[^/]+)$/.test(path)) {
      return { kind: 'deploy-config', category: 'Deployment', label: `${tool} Deploy-Konfiguration`, severity: 'warn', targets: [path] }
    }
    return null
  }
  if (!tool.startsWith('mcp__')) {
    return null
  }
  const name = tool.toLowerCase()
  const short = tool.replace(/^mcp__/, '')
  if (/__execute_sql$/.test(name) || /__d1_database_query$/.test(name) || /__query_database$/.test(name)) {
    const query = String(input.query ?? input.sql ?? '')
    return isReadOnlySql(query) ? null : { kind: 'db', category: 'Datenbank', label: short, severity: 'hold', args: [query.slice(0, 160)] }
  }
  if (/__apply_migration$/.test(name)) {
    return { kind: 'db', category: 'Supabase-Produktiv', label: short, severity: 'hold', args: [String(input.name ?? '')] }
  }
  if (/__(create_or_update_file|push_files)$/.test(name)) {
    const branch = String(input.branch ?? '')
    return branch === '' || MAIN.test(branch)
      ? { kind: 'git-push-main', category: 'Merge', label: `${short} auf ${branch || 'Default-Branch'}`, severity: 'hold' }
      : null
  }
  if (/__(merge_pull_request|enable_pr_auto_merge)$/.test(name)) {
    return { kind: 'gh-merge', category: 'Merge', label: short, severity: 'hold' }
  }
  if (MCP_READ.test(name)) {
    return null
  }
  if (/^mcp__vercel__/.test(name) || /^mcp__cloudflare/.test(name)) {
    return { kind: 'deploy', category: 'Deployment', label: short, severity: 'hold' }
  }
  if (MCP_RISKY.test(name)) {
    return { kind: 'mcp', category: 'Externe Aktion', label: short, severity: 'hold' }
  }
  return null
}

const CHECKS: Array<[RegExp, 'test' | 'build' | 'lint' | 'typecheck']> = [
  [/\b(vitest|jest|playwright\s+test|mocha|pytest|deno\s+test|node\s+--test|(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|(npm|pnpm|yarn|bun)\s+run\s+test[:\w-]*)/, 'test'],
  [/\b(tsc\b|(npm|pnpm|yarn|bun)\s+run\s+(typecheck|type-check|check:types|tsc)\b)/, 'typecheck'],
  [/\b(eslint|biome\s+(check|lint)|(npm|pnpm|yarn|bun)\s+run\s+lint[:\w-]*)/, 'lint'],
  [/\b((npm|pnpm|yarn|bun)\s+run\s+build[:\w-]*|vite\s+build)\b/, 'build'],
]

/** Welche Prüfung ein Bash-Befehl ausführt, oder null. */
export function checkKind(command: string): 'test' | 'build' | 'lint' | 'typecheck' | null {
  for (const [re, kind] of CHECKS) {
    if (re.test(command)) return kind
  }
  return null
}

/** Ob ein Bash-Befehl den Git-Stand verändern kann (dann wird neu gelesen). */
export function touchesGit(command: string): boolean {
  return /\bgit\s+(add|commit|checkout|switch|reset|merge|rebase|pull|push|stash|restore|rm|mv|cherry-pick|revert|fetch|branch|clean|tag)\b/.test(command) || /\bgh\s+pr\b/.test(command)
}
