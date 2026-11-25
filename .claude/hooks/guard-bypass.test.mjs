// Negativtests: Umgehungen des Bash-Hooks (Senior-Review 25.11.2026, P0 #2416).
// Aufruf: node .claude/hooks/guard-bypass.test.mjs (aus dem Repo-Root)
// Jede Umgehung muss blockiert werden (Exit 2); Alltagsbefehle laufen durch (Exit 0).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./guard-bash.mjs', import.meta.url));
// Befehlstexte zusammengesetzt, damit dieser Test nicht selbst vom Hook getroffen wird.
const P = 'git ' + 'push';
const PU = 'pu' + 'sh';
const M = 'ma' + 'in';
const MERGE = 'mer' + 'ge';

const dir = mkdtempSync(join(tmpdir(), 'guard-bypass-'));
const evil = join(dir, 'deploy.sh');
const benign = join(dir, 'check.sh');
writeFileSync(evil, `#!/bin/sh\necho start\n${P} origin ${M}\n`);
writeFileSync(benign, '#!/bin/sh\nls -la\nnpm test\n');

const cases = [
  // ── Umgehungen: müssen blockiert werden ──────────────────────────────────
  [`X=${PU}; git $X origin ${M}`, 2, 'git-Unterbefehl aus Variable'],
  [`$(echo git) ${PU} origin ${M}`, 2, 'Befehlswort aus $( )'],
  ['`echo git` ' + `${PU} origin ${M}`, 2, 'Befehlswort aus Backticks'],
  [`G=git; $G ${PU} origin ${M}`, 2, 'Befehlswort als Variable'],
  [`echo ${M} | xargs ${P} origin`, 2, 'git push mit Ziel aus xargs'],
  [`echo 1 | xargs gh pr ${MERGE}`, 2, 'gh mit Argumenten aus xargs'],
  [`git -c alias.p=${PU} p origin ${M}`, 2, 'git-Alias per -c'],
  [`git config alias.p ${PU}`, 2, 'git-Alias anlegen'],
  [`node -e "require('child_process').execSync('${P} origin ${M}')"`, 2, 'node -e startet Prozess'],
  [`python3 -c "import os; os.system('gh pr ${MERGE} 1')"`, 2, 'python -c startet Prozess'],
  ['perl -e \'print `ls`\'', 2, 'perl-Backticks'],
  [`curl -X PUT https://api.github.com/repos/o/r/pulls/1/${MERGE}`, 2, 'Merge über HTTP'],
  ['curl -s https://api.supabase.com/v1/projects', 2, 'Supabase-Management-API'],
  ['wget https://api.cloudflare.com/client/v4/accounts', 2, 'Cloudflare-API'],
  [`echo "${P} origin ${M}" | bash`, 2, 'Shell liest aus Pipe'],
  [`bash ${evil}`, 2, 'Skriptdatei mit Push'],
  [`bash < ${evil}`, 2, 'Skript über Umleitung'],
  [`source ${evil}`, 2, 'source mit Push'],
  [`. ${evil}`, 2, 'Punkt-Befehl mit Push'],
  ['bash ./gibt-es-nicht.sh', 2, 'nicht lesbares Skript (fail-closed)'],
  [`f(){ git "$@"; }; f ${PU} origin ${M}`, 2, 'Funktion mit $@'],
  [`bash -lc "${P} origin ${M}"`, 2, 'kombinierte Option -lc'],
  [`if true; then ${P} origin ${M}; fi`, 2, 'Push in if/then'],
  [`gh $SUB ${MERGE} 1`, 2, 'gh-Unterbefehl aus Variable'],
  [`supabase $DB push`, 2, 'supabase-Unterbefehl aus Variable'],

  // ── Alltagsbefehle: dürfen nicht blockiert werden ────────────────────────
  ['ls $(pwd)/src', 0, 'Substitution als Argument'],
  ['echo "$(date) fertig"', 0, 'Substitution in Anführungszeichen'],
  ['node -e "console.log(require(\'./package.json\').version)"', 0, 'node -e ohne Prozess'],
  ['node -e "console.log(`x`)"', 0, 'Template-String in node -e'],
  ['python3 -c "import json; print(json.dumps({}))"', 0, 'python -c ohne Prozess'],
  ['git log --format=%H -1', 0, 'git log'],
  ['git diff $BASE...HEAD', 0, 'git diff mit Variable im Bereich'],
  ['bash -lc "npm test"', 0, 'bash -lc harmlos'],
  [`bash ${benign}`, 0, 'harmloses Skript'],
  ['for f in *.ts; do wc -l "$f"; done', 0, 'for-Schleife'],
  ['if git diff --quiet; then echo sauber; fi', 0, 'if mit git diff'],
  ['curl -s https://api.github.com/repos/o/r', 0, 'GitHub-API lesend'],
  [`${P} origin feature/x`, 0, 'Push auf Feature-Branch'],
  ['(cd apps && npm test)', 0, 'Subshell'],
  ['npm run lint 2>&1 | tail -5', 0, 'Pipe nach tail'],
  ['git config user.name', 0, 'git config ohne Alias'],
];

let fail = 0;
for (const [cmd, want, why] of cases) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { command: cmd } }), cwd: process.cwd() });
  const ok = r.status === want;
  if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', r.status, `${why}: ${cmd.replace(/\n/g, '\\n')}`);
}
rmSync(dir, { recursive: true, force: true });
console.log(fail ? `${fail} FEHLER` : `ALLE ${cases.length} OK`);
process.exit(fail ? 1 : 0);
