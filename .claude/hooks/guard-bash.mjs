// .claude/hooks/guard-bash.mjs – PreToolUse-Hook für Bash.
// Blockiert produktionsrelevante Befehle. Exit 2 = Befehl wird blockiert, Meldung geht an Claude.
import { execSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(raw)?.tool_input?.command ?? ''; } catch { process.exit(0); }
  const c = ' ' + cmd.replace(/\s+/g, ' ').trim() + ' ';

  const rules = [
    [/\bgit push\b.*[\s:](main|master)(\s|$)/, 'Push auf main/master'],
    [/\bgit push\b.*\s(--force|--force-with-lease|-f|--all|--mirror|--delete|-d)\b/, 'Force-/Massen-/Lösch-Push'],
    [/\bgit push\b.*\s\+\S+/, 'Force-Push (+refspec)'],
    [/\bgh pr merge\b/, 'PR-Merge'],
    [/\bgh api\b.*\/merges?\b/, 'Merge über API'],
    [/\bsupabase (db (push|reset)|migration (up|repair)|functions deploy)\b/, 'Supabase-Produktion'],
    [/\bwrangler (pages )?deploy\b/, 'Cloudflare-Deploy'],
    [/\bstripe\s/, 'Stripe-CLI'],
    [/\brm -[rf]+\s+(\/|~|\.)\s/, 'Rekursives Löschen von Root/Home/Repo'],
  ];
  for (const [re, label] of rules) {
    if (re.test(c)) {
      console.error(`BLOCKIERT (${label}) – Freigabe nur durch Dominik. Befehl: ${cmd}`);
      process.exit(2);
    }
  }

  // "git push" ohne Ziel, während main/master ausgecheckt ist
  if (/\bgit push\b/.test(c)) {
    try {
      const b = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (b === 'main' || b === 'master') {
        console.error('BLOCKIERT: Push vom Branch main/master – Freigabe nur durch Dominik.');
        process.exit(2);
      }
    } catch {}
  }
  process.exit(0);
});
