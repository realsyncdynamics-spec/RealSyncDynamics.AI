import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Aufruf: node .claude/hooks/guard-bash.test.mjs  (aus dem Repo-Root, auf einem Feature-Branch)
const HOOK = fileURLToPath(new URL('./guard-bash.mjs', import.meta.url));
const P = 'git ' + 'push';
const F = '--for' + 'ce';
const cases = [
  // Pflichtfälle aus Phase 2
  [`${P} origin main`, 2], [`${P} origin HEAD:main`, 2], [`${P} ${F} origin feature/x`, 2],
  [`${P} origin +feature/x`, 2], ['gh pr merge 1', 2], ['supabase db push', 2], ['wrangler deploy', 2],
  ['wrangler pages deploy dist', 2], ['stripe customers list', 2], ['rm -rf .', 2],
  [`${P} origin feature/x`, 0], [`${P} origin feature/main-fix`, 0], ['rm -rf node_modules', 0],
  ['npm test', 0], ['git status', 0],
  // Umgehungen aus dem Bericht
  [`git -C . push origin main`.replace('push', 'push'), 2], [`${P} origin refs/heads/main`, 2],
  // Fehlalarme aus dem Bericht
  ['grep -rn stripe src/', 0], ['rg "wrangler deploy" docs/', 0], ['git commit -m "doc: supabase db push erklaert"', 0],
  ['echo "stripe customers list"', 0],
  // weitere Umgehungen
  [`cd repo && ${P} origin main`, 2], [`bash -c "${P} origin main"`, 2], [`sh -c 'stripe customers list'`, 2],
  ['npx wrangler deploy', 2], ['npx -y wrangler pages deploy dist', 2], ['pnpm dlx wrangler deploy', 2],
  ['FOO=1 stripe balance retrieve', 2], ['sudo rm -rf /', 2], [`env ${P} -f origin x`, 2],
  [`${P} -uf origin x`, 2], [`${P} origin HEAD:refs/heads/master`, 2], [`${P} origin --delete feature/x`, 2],
  ['gh api repos/o/r/pulls/3/merge -X PUT', 2], ['gh release create v1', 2], ['gh workflow run deploy.yml', 2],
  ['echo $(stripe balance retrieve)', 2], ['/usr/local/bin/stripe login', 2], ['git -c core.x=y push origin main', 2],
  ['supabase migration new add_table', 0], ['supabase start', 0], ['wrangler dev', 0], ['gh pr create --draft', 0],
  ['gh pr view 3', 0], [`${P} -u origin chore/chief-setup`, 0], ['git log --oneline | head', 0],
  ['ls; git status && npm run lint', 0], ['echo "unterminated', 2],
];
let fail = 0;
for (const [cmd, want] of cases) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { command: cmd } }), cwd: process.cwd() });
  const ok = r.status === want; if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', r.status, cmd);
}
for (const bad of ['kein json', '{}']) {
  const r = spawnSync('node', [HOOK], { input: bad, cwd: process.cwd() });
  const ok = r.status === 2; if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', r.status, `Eingabe: ${bad}`);
}
console.log(fail ? `${fail} FEHLER` : `ALLE ${cases.length + 2} OK`);
