// .claude/hooks/guard-network.mjs – PreToolUse-Hook für WebFetch und MCP-Werkzeuge (Phase 3d, 25.11.2026)
// Sperrt nicht freigegebene externe Voice-/Telefonie-Dienste (lib/voice-hosts.mjs) auf den Wegen neben Bash:
//   1. WebFetch auf einen gesperrten Host
//   2. jedes Werkzeug eines MCP-Servers dieser Anbieter (z. B. mcp__ElevenLabs__*)
//   3. URL-/Code-Felder anderer MCP-Werkzeuge (Browser, Crawler, Sandbox), die einen gesperrten Host nennen
// Bash deckt guard-bash.mjs ab. Exit 2 = blockiert. Fail-closed bei unlesbarer Eingabe.
import { blockedUrlHost, blockedVoiceMcpServer, findBlockedHost } from './lib/voice-hosts.mjs';

const block = (why, tool) => {
  console.error(`BLOCKIERT (externer Voice-Dienst: ${why}) – kostenpflichtig, nur nach Einzelfreigabe von Dominik. Werkzeug: ${tool}`);
  process.exit(2);
};

const URL_KEYS = /^(url|urls|uri|href|link|links|endpoint|host|hostname|target|start_?url|site|domain|base_?url|webhook_?url)$/i;
const CODE_KEYS = /^(code|script|command|cmd|js|javascript|python|source|expression)$/i;

// Sammelt Treffer in URL- und Code-Feldern, beliebig tief verschachtelt.
function scan(value, key, depth = 0) {
  if (depth > 8 || value == null) return null;
  if (typeof value === 'string') {
    if (key && URL_KEYS.test(key)) return blockedUrlHost(value);
    if (key && CODE_KEYS.test(key)) return findBlockedHost(value);
    return null;
  }
  if (Array.isArray(value)) {
    for (const v of value) { const h = scan(v, key, depth + 1); if (h) return h; }
    return null;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { const h = scan(v, k, depth + 1); if (h) return h; }
  }
  return null;
}

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { block('Hook-Eingabe unlesbar', '<ungültiges JSON>'); }
  const tool = data?.tool_name;
  if (typeof tool !== 'string') block('Hook-Eingabe ohne Werkzeugname', String(tool));
  const ti = data.tool_input ?? {};
  if (tool === 'WebFetch') {
    if (typeof ti.url !== 'string') block('WebFetch ohne URL', tool);
    const host = blockedUrlHost(ti.url);
    if (host) block(host, tool);
    process.exit(0);
  }
  if (tool.startsWith('mcp__')) {
    const server = blockedVoiceMcpServer(tool);
    if (server) block(`MCP-Server ${server}`, tool);
    const host = scan(ti);
    if (host) block(host, tool);
  }
  process.exit(0);
});
