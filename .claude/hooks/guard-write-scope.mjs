// .claude/hooks/guard-write-scope.mjs – PreToolUse-Hook für Edit|Write|MultiEdit|NotebookEdit (Phase 3d, 25.11.2026)
// Setzt die Schreibgrenze je Subagent technisch durch (lib/vio-scope.mjs, heute: VIO → apps/agent-runtime/).
// Hauptsitzung (kein `agent_type`) und Agenten ohne Eintrag bleiben unberührt.
// Optional: `--agent <name>` erzwingt die Grenze unabhängig von `agent_type` (Einsatz im Frontmatter des Agenten).
// Exit 2 = blockiert. Fail-closed bei unlesbarer Eingabe oder fehlendem Pfad.
import { checkWritePath, scopeFor } from './lib/vio-scope.mjs';

const block = (why) => {
  console.error(`BLOCKIERT (Schreibgrenze: ${why}) – Änderung außerhalb der Grenze als Vorschlag an CHIEF melden.`);
  process.exit(2);
};

const forced = (() => { const i = process.argv.indexOf('--agent'); return i > 0 ? process.argv[i + 1] : null; })();

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { block('Hook-Eingabe unlesbar'); }
  if (!data || typeof data !== 'object') block('Hook-Eingabe unlesbar');
  const agent = forced ?? data.agent_type;
  const scope = scopeFor(agent);
  if (forced && !scope) block(`keine Schreibgrenze für „${forced}“ definiert`);
  if (!scope) process.exit(0);
  const ti = data.tool_input ?? {};
  const target = ti.file_path ?? ti.notebook_path ?? ti.path;
  const cwd = typeof data.cwd === 'string' ? data.cwd : process.cwd();
  const why = checkWritePath(target, { scope, cwd });
  if (why) block(`${agent}: ${why}`);
  process.exit(0);
});
