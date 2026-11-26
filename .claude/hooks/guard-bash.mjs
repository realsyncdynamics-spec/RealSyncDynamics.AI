// .claude/hooks/guard-bash.mjs – PreToolUse-Hook für Bash (v2, 25.11.2026)
// Prüft jedes Teilkommando anhand des Befehlsworts, nicht anhand von Freitext.
// Exit 2 = blockiert (Meldung geht an Claude). Fail-closed bei unlesbarer Eingabe.
import { execSync } from 'node:child_process';

const block = (why, cmd) => {
  console.error(`BLOCKIERT (${why}) – Freigabe nur durch Dominik. Befehl: ${cmd}`);
  process.exit(2);
};

// Zerlegt eine Shell-Zeile in Teilkommandos (; && || | & Zeilenumbruch) und Wörter, beachtet Quotes.
function split(line) {
  const cmds = []; let words = []; let w = ''; let q = null; let has = false;
  const endWord = () => { if (has) words.push(w); w = ''; has = false; };
  const endCmd = () => { endWord(); if (words.length) cmds.push(words); words = []; };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
      else if (ch === '\\' && q === '"' && i + 1 < line.length) w += line[++i];
      else w += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { q = ch; has = true; continue; }
    if (ch === '\\' && i + 1 < line.length) { w += line[++i]; has = true; continue; }
    if (ch === ' ' || ch === '\t') { endWord(); continue; }
    if (ch === '\n' || ch === ';' || ch === '|' || ch === '&') { endCmd(); continue; }
    if (ch === '(' || ch === ')' || ch === '`') { endCmd(); continue; }
    if (ch === '$' && line[i + 1] === '(') { endCmd(); i++; continue; }
    w += ch; has = true;
  }
  if (q) return null; // offene Anführungszeichen -> nicht sicher prüfbar
  endCmd();
  return cmds;
}

const WRAPPERS = new Set(['sudo', 'env', 'command', 'exec', 'nohup', 'time', 'xargs', 'nice']);
const RUNNERS = { npx: 1, bunx: 1, pnpx: 1 }; // npx <tool> ...
const isMainRef = (r) => /^(\+)?((HEAD|[^:]*):)?(refs\/heads\/)?(main|master)$/.test(r);

function strip(words) {
  let i = 0;
  while (i < words.length) {
    const t = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { i++; continue; }          // VAR=wert
    if (WRAPPERS.has(t)) { i++; while (words[i]?.startsWith('-')) i++; continue; }
    break;
  }
  words = words.slice(i);
  if (RUNNERS[words[0]]) { words = words.slice(1); while (words[0]?.startsWith('-')) words = words.slice(1); }
  if ((words[0] === 'pnpm' || words[0] === 'yarn') && words[1] === 'dlx') words = words.slice(2);
  return words;
}

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

function checkCmd(words, raw, depth = 0) {
  words = strip(words);
  if (!words.length) return;
  const [cmd, ...a] = words;
  const base = cmd.split('/').pop();
  const sub = a.filter((x) => !x.startsWith('-'));

  if ((base === 'bash' || base === 'sh' || base === 'zsh') && a.includes('-c')) {
    const inner = a[a.indexOf('-c') + 1];
    if (inner !== undefined) return checkLine(inner, raw, depth + 1);
  }
  if (base === 'eval') return checkLine(a.join(' '), raw, depth + 1);

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

function checkLine(line, raw, depth = 0) {
  if (depth > 3) block('zu tief verschachtelt', raw);
  const cmds = split(line);
  if (cmds === null) block('Befehl nicht sicher prüfbar', raw);
  for (const w of cmds) checkCmd(w, raw, depth);
}

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let cmd;
  try { cmd = JSON.parse(input)?.tool_input?.command; } catch { block('Hook-Eingabe unlesbar', '<ungültiges JSON>'); }
  if (typeof cmd !== 'string') block('Hook-Eingabe ohne Befehl', String(cmd));
  checkLine(cmd, cmd);
  process.exit(0);
});
