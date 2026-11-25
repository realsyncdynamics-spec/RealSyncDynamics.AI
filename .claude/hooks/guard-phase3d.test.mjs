// Tests Phase 3d: VIO-Schreibgrenze und Sperre externer Voice-Dienste.
// Aufruf: node .claude/hooks/guard-phase3d.test.mjs (aus dem Repo-Root).
// Nur Mocks: Die Hooks bekommen nachgebildete Hook-Eingaben; kein Test öffnet eine Netzwerkverbindung.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = (f) => fileURLToPath(new URL(`./${f}`, import.meta.url));
const BASH = dir('guard-bash.mjs'); const WRITE = dir('guard-write-scope.mjs'); const NET = dir('guard-network.mjs');

// Nachgebautes Repo mit Symlink aus apps/agent-runtime heraus (Umgehungsversuch)
const repo = mkdtempSync(join(tmpdir(), 'guard3d-'));
mkdirSync(join(repo, 'apps/agent-runtime/src'), { recursive: true });
mkdirSync(join(repo, 'src'), { recursive: true });
symlinkSync(join(repo, 'src'), join(repo, 'apps/agent-runtime/ausgang'));

const env = { ...process.env, CLAUDE_PROJECT_DIR: repo };
const run = (hook, payload, args = []) =>
  spawnSync('node', [hook, ...args], { input: typeof payload === 'string' ? payload : JSON.stringify(payload), cwd: repo, env }).status;

const VIO = { agent_type: 'vio', cwd: repo };
const P = 'git ' + 'push';
const cases = [
  // ── A. VIO-Schreibgrenze für Edit/Write/NotebookEdit ──────────────────────
  ['VIO Write in Runtime', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: `${repo}/apps/agent-runtime/src/a.ts` } }, 0],
  ['VIO Edit relativ in Runtime', WRITE, { ...VIO, tool_name: 'Edit', tool_input: { file_path: 'apps/agent-runtime/src/a.ts' } }, 0],
  ['VIO Write neue Unterordner', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/neu/tief/x.ts' } }, 0],
  ['VIO Write in src/', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: `${repo}/src/App.tsx` } }, 2],
  ['VIO Write in .claude/', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: '.claude/settings.json' } }, 2],
  ['VIO Write ../ Ausbruch', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/../../etc/x' } }, 2],
  ['VIO Write Präfix-Trick', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime-evil/x.ts' } }, 2],
  ['VIO Write über Symlink', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/ausgang/App.tsx' } }, 2],
  ['VIO Write .env in Runtime', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/.env' } }, 2],
  ['VIO Write .env.local', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/.env.local' } }, 2],
  ['VIO Write .env.example erlaubt', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/.env.example' } }, 0],
  ['VIO Write absolut /tmp', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: '/tmp/x' } }, 2],
  ['VIO Write Tilde', WRITE, { ...VIO, tool_name: 'Write', tool_input: { file_path: '~/x' } }, 2],
  ['VIO NotebookEdit außerhalb', WRITE, { ...VIO, tool_name: 'NotebookEdit', tool_input: { notebook_path: 'docs/n.ipynb' } }, 2],
  ['VIO ohne Pfad', WRITE, { ...VIO, tool_name: 'Write', tool_input: {} }, 2],
  ['VIO Großschreibung agent_type', WRITE, { agent_type: 'VIO', cwd: repo, tool_name: 'Write', tool_input: { file_path: 'src/x' } }, 2],
  ['Hauptsitzung ohne agent_type', WRITE, { cwd: repo, tool_name: 'Write', tool_input: { file_path: 'src/App.tsx' } }, 0],
  ['REA nicht betroffen', WRITE, { agent_type: 'rea', cwd: repo, tool_name: 'Write', tool_input: { file_path: 'src/App.tsx' } }, 0],
  ['--agent vio erzwingt Grenze', WRITE, { cwd: repo, tool_name: 'Write', tool_input: { file_path: 'src/App.tsx' } }, 2, ['--agent', 'vio']],
  ['--agent unbekannt fail-closed', WRITE, { cwd: repo, tool_name: 'Write', tool_input: { file_path: 'apps/agent-runtime/a' } }, 2, ['--agent', 'xyz']],
  ['Write-Hook kein JSON', WRITE, 'kein json', 2],

  // ── B. VIO-Bash: Allowlist + Umleitungen ─────────────────────────────────
  ['VIO npm test Runtime', BASH, { ...VIO, tool_input: { command: 'npm --prefix apps/agent-runtime test' } }, 0],
  ['VIO npm run typecheck', BASH, { ...VIO, tool_input: { command: 'npm --prefix apps/agent-runtime run typecheck' } }, 0],
  ['VIO npm test mit Filter', BASH, { ...VIO, tool_input: { command: 'npm --prefix apps/agent-runtime test -- disclosure' } }, 0],
  ['VIO git diff | head', BASH, { ...VIO, tool_input: { command: 'git diff --stat | head -20' } }, 0],
  ['VIO rg mit 2>/dev/null', BASH, { ...VIO, tool_input: { command: 'rg -n notfall apps/agent-runtime 2>/dev/null' } }, 0],
  ['VIO ls 2>&1', BASH, { ...VIO, tool_input: { command: 'ls apps/agent-runtime 2>&1 | wc -l' } }, 0],
  ['VIO Umleitung in Runtime', BASH, { ...VIO, tool_input: { command: 'echo x > apps/agent-runtime/src/note.txt' } }, 0],
  ['VIO Umleitung nach src/', BASH, { ...VIO, tool_input: { command: 'echo x > src/App.tsx' } }, 2],
  ['VIO Anhängen außerhalb', BASH, { ...VIO, tool_input: { command: 'printf x >> docs/a.md' } }, 2],
  ['VIO &> außerhalb', BASH, { ...VIO, tool_input: { command: 'ls &> out.log' } }, 2],
  ['VIO tee', BASH, { ...VIO, tool_input: { command: 'echo x | tee src/a.ts' } }, 2],
  ['VIO cp', BASH, { ...VIO, tool_input: { command: 'cp apps/agent-runtime/a.ts src/a.ts' } }, 2],
  ['VIO mv', BASH, { ...VIO, tool_input: { command: 'mv a b' } }, 2],
  ['VIO sed -i', BASH, { ...VIO, tool_input: { command: "sed -i 's/a/b/' src/App.tsx" } }, 2],
  ['VIO sed w-Befehl', BASH, { ...VIO, tool_input: { command: "sed -n '1p w src/x' a.txt" } }, 2],
  ['VIO sed lesend', BASH, { ...VIO, tool_input: { command: "sed -n '1,20p' apps/agent-runtime/package.json" } }, 0],
  ['VIO find -delete', BASH, { ...VIO, tool_input: { command: 'find . -name x -delete' } }, 2],
  ['VIO cd', BASH, { ...VIO, tool_input: { command: 'cd apps/agent-runtime && npm test' } }, 2],
  ['VIO npm install', BASH, { ...VIO, tool_input: { command: 'npm --prefix apps/agent-runtime install' } }, 2],
  ['VIO npm anderes Paket', BASH, { ...VIO, tool_input: { command: 'npm --prefix . test' } }, 2],
  ['VIO node -e', BASH, { ...VIO, tool_input: { command: "node -e \"require('fs').writeFileSync('src/x','')\"" } }, 2],
  ['VIO python', BASH, { ...VIO, tool_input: { command: 'python3 x.py' } }, 2],
  ['VIO bash -c', BASH, { ...VIO, tool_input: { command: "bash -c 'ls'" } }, 2],
  ['VIO git commit', BASH, { ...VIO, tool_input: { command: 'git commit -m x' } }, 2],
  ['VIO git branch anlegen', BASH, { ...VIO, tool_input: { command: 'git branch neu' } }, 2],
  ['VIO git diff --output', BASH, { ...VIO, tool_input: { command: 'git diff --output=src/x' } }, 2],
  ['VIO git -C', BASH, { ...VIO, tool_input: { command: 'git -C .. status' } }, 2],
  ['VIO Umleitung mit Variable', BASH, { ...VIO, tool_input: { command: 'echo x > $HOME/a' } }, 2],
  ['VIO Umleitung über Symlink', BASH, { ...VIO, tool_input: { command: 'echo x > apps/agent-runtime/ausgang/a.ts' } }, 2],
  ['Hauptsitzung cp erlaubt', BASH, { cwd: repo, tool_input: { command: 'cp a b' } }, 0],

  // ── C. Voice-Dienste über Bash (jede Sitzung) ────────────────────────────
  ['curl ElevenLabs', BASH, { tool_input: { command: 'curl -s https://api.elevenlabs.io/v1/voices' } }, 2],
  ['curl ElevenLabs EU-Residency', BASH, { tool_input: { command: 'curl https://api.eu.residency.elevenlabs.io/v1/user' } }, 2],
  ['curl Twilio', BASH, { tool_input: { command: "curl -X POST 'https://api.twilio.com/2010-04-01/Accounts/AC1/Calls.json'" } }, 2],
  ['wget Twilio-Functions', BASH, { tool_input: { command: 'wget https://demo-1234.twil.io/call' } }, 2],
  ['curl Host in Anführungszeichen gestückelt', BASH, { tool_input: { command: 'curl "https://api.eleven"\'labs.io/v1\'' } }, 2],
  ['curl Großschreibung', BASH, { tool_input: { command: 'curl HTTPS://API.TWILIO.COM/x' } }, 2],
  ['curl Ziel als Variable', BASH, { tool_input: { command: 'curl $VOICE_URL' } }, 2],
  ['curl URL mit Variable', BASH, { tool_input: { command: 'curl https://$H/v1/text-to-speech' } }, 2],
  ['httpie Vapi', BASH, { tool_input: { command: 'http POST api.vapi.ai/call' } }, 2],
  ['nc Telnyx', BASH, { tool_input: { command: 'nc api.telnyx.com 443' } }, 2],
  ['twilio-CLI', BASH, { tool_input: { command: 'twilio api:core:calls:create --to +4930123' } }, 2],
  ['twilio-CLI über npx', BASH, { tool_input: { command: 'npx twilio-cli' } }, 0],
  ['twilio über npx', BASH, { tool_input: { command: 'npx -y twilio phone-numbers:list' } }, 2],
  ['elevenlabs-CLI über pnpm dlx', BASH, { tool_input: { command: 'pnpm dlx elevenlabs agents list' } }, 2],
  ['node -e fetch ElevenLabs', BASH, { tool_input: { command: "node -e \"fetch('https://api.elevenlabs.io/v1/voices')\"" } }, 2],
  ['python -c Twilio', BASH, { tool_input: { command: "python3 -c 'import urllib.request as u; u.urlopen(\"https://api.twilio.com\")'" } }, 2],
  ['bash -c curl', BASH, { tool_input: { command: "bash -c 'curl https://api.twilio.com'" } }, 2],
  ['$( ) curl', BASH, { tool_input: { command: 'echo $(curl -s https://api.elevenlabs.io/v1/user)' } }, 2],
  ['timeout als Wrapper', BASH, { tool_input: { command: 'timeout 5 curl https://api.twilio.com' } }, 2],
  ['echo | sh mit Host', BASH, { tool_input: { command: 'echo "curl https://api.twilio.com" | sh' } }, 2],
  ['unbekanntes Werkzeug mit Host', BASH, { tool_input: { command: './call.sh https://api.vapi.ai/call' } }, 2],
  ['git clone Twilio', BASH, { tool_input: { command: 'git clone https://github.com/twilio/twilio-node' } }, 0],
  ['curl Fremdhost erlaubt', BASH, { tool_input: { command: 'curl -s https://example.org/health' } }, 0],
  ['curl Ähnlicher Name erlaubt', BASH, { tool_input: { command: 'curl https://nottwilio.community/x' } }, 0],
  ['grep nach Host erlaubt', BASH, { tool_input: { command: 'grep -rn "api.elevenlabs.io" docs/' } }, 0],
  ['git commit mit Host im Text', BASH, { tool_input: { command: 'git commit -m "Sperre für api.twilio.com"' } }, 0],
  ['npm test erlaubt', BASH, { tool_input: { command: 'npm test -- test/voice' } }, 0],

  // ── D. WebFetch und MCP ─────────────────────────────────────────────────
  ['WebFetch ElevenLabs-Preisseite (ATLAS)', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://elevenlabs.io/pricing', prompt: 'x' } }, 0],
  ['WebFetch Twilio-Doku (ATLAS)', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://www.twilio.com/docs/voice', prompt: 'x' } }, 0],
  ['WebFetch ElevenLabs-API', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://api.elevenlabs.io/v1/voices', prompt: 'x' } }, 2],
  ['WebFetch ElevenLabs-Residency-API', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://api.eu.residency.elevenlabs.io/v1/user', prompt: 'x' } }, 2],
  ['WebFetch Twilio-API', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://api.twilio.com/2010-04-01', prompt: 'x' } }, 2],
  ['WebFetch Twilio-Voice-API', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://voice.twilio.com/v1/x', prompt: 'x' } }, 2],
  ['WebFetch Twilio-Function', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://demo-1234.twil.io/call', prompt: 'x' } }, 2],
  ['WebFetch www.api-Trick', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://www.api.twilio.com/x', prompt: 'x' } }, 2],
  ['WebFetch Zugangsdaten in URL', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://AC1:tok@www.twilio.com/x', prompt: 'x' } }, 2],
  ['WebFetch Großschreibung + Port', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://API.TWILIO.COM:443/x', prompt: 'x' } }, 2],
  ['WebFetch Userinfo-Trick', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://example.org@api.vapi.ai/x', prompt: 'x' } }, 2],
  ['WebFetch fremder Host', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://code.claude.com/docs/en/hooks.md', prompt: 'x' } }, 0],
  ['WebFetch Host als Pfad erlaubt', NET, { tool_name: 'WebFetch', tool_input: { url: 'https://example.org/vergleich/twilio.com', prompt: 'x' } }, 0],
  ['WebFetch ohne URL', NET, { tool_name: 'WebFetch', tool_input: {} }, 2],
  ['MCP ElevenLabs TTS', NET, { tool_name: 'mcp__ElevenLabs__creative_generate_speech', tool_input: { text: 'Hallo' } }, 2],
  ['MCP ElevenLabs Anruf', NET, { tool_name: 'mcp__ElevenLabs__agents_outbound_call', tool_input: { to_number: '+49' } }, 2],
  ['MCP Plugin-Server Twilio', NET, { tool_name: 'mcp__plugin_twilio_twilio__calls_create', tool_input: {} }, 2],
  ['MCP Twilio-Doku erlaubt', NET, { tool_name: 'mcp__plugin_twilio-developer-kit_twilio-docs__twilio__search', tool_input: { query: 'ConversationRelay' } }, 0],
  ['MCP Browser mit Voice-URL', NET, { tool_name: 'mcp__plugin_browser-use_browser-use__browser_exec', tool_input: { code: "await page.goto('https://api.elevenlabs.io')" } }, 2],
  ['MCP Crawler mit Voice-API-URL', NET, { tool_name: 'mcp__Tavily__tavily_extract', tool_input: { urls: ['https://example.org', 'https://api.vapi.ai/call'] } }, 2],
  ['MCP Crawler Preisseite erlaubt', NET, { tool_name: 'mcp__Tavily__tavily_extract', tool_input: { urls: ['https://www.twilio.com/de-de/pricing'] } }, 0],
  ['MCP Crawler fremde URL', NET, { tool_name: 'mcp__Tavily__tavily_extract', tool_input: { urls: ['https://example.org'] } }, 0],
  ['MCP GitHub Text mit Host erlaubt', NET, { tool_name: 'mcp__github__create_pull_request', tool_input: { body: 'Sperre api.twilio.com' } }, 0],
  ['Netz-Hook kein JSON', NET, 'kein json', 2],
  ['Netz-Hook ohne tool_name', NET, '{}', 2],
];

let fail = 0;
for (const [name, hook, payload, want, args] of cases) {
  const got = run(hook, payload, args);
  const ok = got === want; if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', got, name);
}
rmSync(repo, { recursive: true, force: true });
console.log(fail ? `${fail} FEHLER von ${cases.length}` : `ALLE ${cases.length} OK`);
process.exit(fail ? 1 : 0);
