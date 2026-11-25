// .claude/hooks/guard-bash.mjs – PreToolUse-Hook für Bash (v3, 25.11.2026)
// Prüft jedes Teilkommando anhand des Befehlsworts, nicht anhand von Freitext.
// Exit 2 = blockiert (Meldung geht an Claude). Fail-closed bei unlesbarer Eingabe.
// v3 (Phase 3d): Zerlegung in lib/shell.mjs, Sperre externer Voice-Dienste, VIO-Allowlist.
import { execSync } from 'node:child_process';
import { split, strip } from './lib/shell.mjs';
import { BLOCKED_VOICE_CLIS, findBlockedHost } from './lib/voice-hosts.mjs';
import { checkWritePath, scopeFor } from './lib/vio-scope.mjs';

const block = (why, cmd) => {
  console.error(`BLOCKIERT (${why}) – Freigabe nur durch Dominik. Befehl: ${cmd}`);
  process.exit(2);
};

const isMainRef = (r) => /^(\+)?((HEAD|[^:]*):)?(refs\/heads\/)?(main|master)$/.test(r);

function checkGit(args, raw) {
  // globale Optionen vor dem Unterbefehl überspringen (-C pfad, -c k=v, --git-dir=...)
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    if (['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(args[i])) i += 2; else i++;
  }
  if (args[i] !== 'push') return;
  const rest = args.slice(i + 1);
  const opts = rest.filter((a) => a.startsWith('-'));
  const refs = rest.filter((a) => !a.startsWith('-'));
  if (opts.some((o) => /^(--force|--force-with-lease|--force-if-includes|--all|--mirror|--delete|--prune|-[a-zA-Z]*[fd])/.test(o)))
    block('Force-/Massen-/Lösch-Push', raw);
  if (refs.slice(1).some((r) => r.startsWith('+'))) block('Force-Push (+refspec)', raw);
  if (refs.slice(1).some(isMainRef)) block('Push auf main/master', raw);
  if (refs.length <= 1) {
    try {
      const b = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (b === 'main' || b === 'master' || b === 'HEAD') block('Push vom Branch main/master', raw);
    } catch { block('Branch nicht bestimmbar', raw); }
  }
}

// ── Externe Voice-Dienste (gilt für jede Sitzung) ────────────────────────────
const NET_TOOLS = new Set(['curl', 'wget', 'http', 'https', 'xh', 'httpie', 'nc', 'ncat', 'netcat', 'socat', 'telnet',
  'openssl', 'aria2c', 'lynx', 'w3m', 'links', 'websocat', 'wscat', 'grpcurl']);
// Inline-Code von Interpretern: Kommando → Optionen, nach denen Code folgt
const INLINE = { node: ['-e', '--eval', '-p', '--print'], python: ['-c'], python3: ['-c'], deno: ['eval'], bun: ['-e', '--eval', 'eval'],
  perl: ['-e', '-E'], ruby: ['-e'], php: ['-r'], pwsh: ['-c', '-Command'] };
// Reine Textwerkzeuge: Nennung eines Hosts ist hier kein Aufruf (grep, Commit-Text, Doku-Ausgabe)
const TEXT_TOOLS = new Set(['grep', 'rg', 'ag', 'ack', 'echo', 'printf', 'cat', 'less', 'head', 'tail', 'wc', 'sed', 'awk',
  'git', 'jq', 'sort', 'uniq', 'cut', 'tr', 'diff', 'ls', 'find', 'test', '[']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

function checkVoice(base, a, words, raw) {
  if (BLOCKED_VOICE_CLIS.has(base)) block(`Voice-/Telefonie-CLI „${base}“`, raw);
  const all = [...a, ...(words.redirs ?? []).map((r) => r.target)];
  if (NET_TOOLS.has(base)) {
    const host = all.map(findBlockedHost).find(Boolean);
    if (host) block(`externer Voice-Dienst ${host}`, raw);
    if (all.some((x) => /^\$|^[a-z][a-z0-9+.-]*:\/\/[^\s]*\$/i.test(x))) block('Netzwerkziel nicht statisch prüfbar', raw);
    return;
  }
  if (INLINE[base]) {
    const i = a.findIndex((x) => INLINE[base].includes(x));
    if (i >= 0) { const host = findBlockedHost(a.slice(i + 1).join(' ')); if (host) block(`externer Voice-Dienst ${host} (Inline-Code)`, raw); }
  }
  // Shell liest Skript von stdin (echo … | sh): ganze Zeile prüfen
  if (SHELLS.has(base) && !a.includes('-c') && a.filter((x) => !x.startsWith('-')).length === 0) {
    const host = findBlockedHost(raw); if (host) block(`externer Voice-Dienst ${host} (Skript über stdin)`, raw);
  }
  if (!TEXT_TOOLS.has(base)) {
    const host = all.map(findBlockedHost).find(Boolean);
    if (host) block(`externer Voice-Dienst ${host}`, raw);
  }
}

// ── VIO: Bash nur per Allowlist, Schreiben nur in apps/agent-runtime/ ────────
const VIO_READ_ONLY = new Set(['ls', 'cat', 'head', 'tail', 'wc', 'grep', 'rg', 'pwd', 'true', 'false', 'diff', 'cmp', 'comm',
  'sort', 'uniq', 'cut', 'tr', 'file', 'stat', 'tree', 'which', 'basename', 'dirname', 'realpath', 'echo', 'printf', 'jq',
  'test', '[', 'date']);
const VIO_GIT = new Set(['status', 'diff', 'log', 'show', 'blame', 'ls-files', 'grep', 'rev-parse', 'merge-base', 'branch']);
const FIND_WRITES = new Set(['-exec', '-execdir', '-ok', '-okdir', '-delete', '-fprint', '-fprint0', '-fprintf', '-fls']);

function vioCommandAllowed(base, a) {
  if (VIO_READ_ONLY.has(base)) return true;
  if (base === 'find') return !a.some((x) => FIND_WRITES.has(x));
  if (base === 'sed') {
    if (a.some((x) => /^-[a-zA-Z]*i|^--in-place/.test(x))) return false;
    return !a.some((x) => !x.startsWith('-') && /(^|[;{}\s\d$/])[wWe](\s|$|;)/.test(x)); // w/W-Schreib- und e-Ausführbefehl
  }
  if (base === 'git') {
    if (a[0]?.startsWith('-')) return false; // keine globalen Optionen (-C, -c)
    if (!VIO_GIT.has(a[0])) return false;
    if (a.some((x) => x.startsWith('--output') || x === '--ext-diff')) return false;
    if (a[0] === 'branch') return a.slice(1).every((x) => ['--show-current', '-a', '-r', '--list', '-v', '-vv'].includes(x));
    return true;
  }
  if (base === 'npm') {
    // nur: npm --prefix apps/agent-runtime (test | run test|typecheck|build) [-- …]
    let rest = a;
    if (rest[0] === '--prefix' && rest[1] === 'apps/agent-runtime') rest = rest.slice(2);
    else if (rest[0] === '--prefix=apps/agent-runtime') rest = rest.slice(1);
    else return false;
    const tail = rest.indexOf('--') >= 0 ? rest.slice(0, rest.indexOf('--')) : rest;
    if (tail.length === 1 && tail[0] === 'test') return true;
    return tail.length === 2 && tail[0] === 'run' && ['test', 'typecheck', 'build'].includes(tail[1]);
  }
  if (base === 'node') return a.length === 1 && ['--version', '-v'].includes(a[0]);
  return false;
}

function checkVio(base, words, a, raw, ctx) {
  if (!vioCommandAllowed(base, a)) block(`VIO: „${base}${a[0] ? ` ${a[0]}` : ''}“ nicht in der Allowlist (vio.md „Bash“)`, raw);
  for (const r of words.redirs ?? []) {
    if (r.op.endsWith('&') || r.op.startsWith('<')) continue; // fd-Duplikat, Eingabe
    const why = checkWritePath(r.target, ctx);
    if (why) block(`VIO-Schreibgrenze: ${why}`, raw);
  }
}

function checkCmd(words, raw, depth, ctx) {
  const redirs = words.redirs;
  words = strip(words); words.redirs = redirs;
  if (!words.length) {
    if (ctx.vio) for (const r of redirs ?? []) { if (!r.op.endsWith('&') && !r.op.startsWith('<')) { const why = checkWritePath(r.target, ctx); if (why) block(`VIO-Schreibgrenze: ${why}`, raw); } }
    return;
  }
  const [cmd, ...a] = words;
  const base = cmd.split('/').pop();
  const sub = a.filter((x) => !x.startsWith('-'));

  if (SHELLS.has(base) && a.includes('-c')) {
    if (ctx.vio) block('VIO: verschachtelte Shell', raw);
    const inner = a[a.indexOf('-c') + 1];
    if (inner !== undefined) return checkLine(inner, raw, depth + 1, ctx);
  }
  if (base === 'eval') {
    if (ctx.vio) block('VIO: eval', raw);
    return checkLine(a.join(' '), raw, depth + 1, ctx);
  }

  checkVoice(base, a, words, raw);
  if (ctx.vio) checkVio(base, words, a, raw, ctx);

  if (base === 'git') return checkGit(a, raw);
  if (base === 'gh') {
    if (sub[0] === 'pr' && sub[1] === 'merge') block('PR-Merge', raw);
    if (sub[0] === 'api' && a.some((x) => /\/(merges?|pulls\/\d+\/merge)\b/.test(x))) block('Merge über API', raw);
    if (sub[0] === 'release' && ['create', 'delete', 'edit'].includes(sub[1])) block('GitHub-Release', raw);
    if (sub[0] === 'workflow' && sub[1] === 'run') block('Workflow-Start', raw);
  }
  if (base === 'supabase') {
    const s = sub.join(' ');
    if (/^(db (push|reset)|migration (up|repair)|functions deploy|secrets set)/.test(s)) block('Supabase-Produktion', raw);
  }
  if (base === 'wrangler' && (sub[0] === 'deploy' || (sub[0] === 'pages' && sub[1] === 'deploy') || sub[0] === 'publish'))
    block('Cloudflare-Deploy', raw);
  if (base === 'stripe') block('Stripe-CLI', raw);
  if (base === 'rm' && a.some((x) => /^-[a-zA-Z]*r/.test(x)) && sub.some((x) => ['/', '~', '.', '..', '*', '/*', '~/'].includes(x)))
    block('Rekursives Löschen von Root/Home/Repo', raw);
}

function checkLine(line, raw, depth, ctx) {
  if (depth > 3) block('zu tief verschachtelt', raw);
  const cmds = split(line);
  if (cmds === null) block('Befehl nicht sicher prüfbar', raw);
  for (const w of cmds) checkCmd(w, raw, depth, ctx);
}

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { block('Hook-Eingabe unlesbar', '<ungültiges JSON>'); }
  const cmd = data?.tool_input?.command;
  if (typeof cmd !== 'string') block('Hook-Eingabe ohne Befehl', String(cmd));
  const scope = scopeFor(data.agent_type);
  const ctx = { vio: Boolean(scope), scope, cwd: typeof data.cwd === 'string' ? data.cwd : process.cwd() };
  checkLine(cmd, cmd, 0, ctx);
  process.exit(0);
});
