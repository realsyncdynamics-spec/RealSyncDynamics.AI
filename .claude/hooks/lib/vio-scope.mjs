// .claude/hooks/lib/vio-scope.mjs – Schreibgrenzen je Subagent (Phase 3d, 25.11.2026)
// Quelle der Kennung: Feld `agent_type` im Hook-Input (gesetzt, wenn ein Subagent das Werkzeug aufruft,
// https://code.claude.com/docs/en/hooks.md). Hauptsitzung (CHIEF) hat kein `agent_type` und bleibt unberührt.
import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { execSync } from 'node:child_process';

// Agent → erlaubte Schreibwurzeln relativ zum Repo-Root. Nur verschärfen, nie lockern.
export const WRITE_SCOPES = {
  vio: ['apps/agent-runtime'],
};

// Innerhalb erlaubter Wurzeln trotzdem gesperrt: Schlüssel und Umgebungsdateien (vio.md „Kosten und externe Dienste“).
const SECRET_FILE = /(^|\/)\.env(\.(?!example$)[^/]*)?$|(^|\/)\.npmrc$|\.(pem|key|p12|pfx)$/i;

export function scopeFor(agentType) {
  if (typeof agentType !== 'string' || !agentType) return null;
  return WRITE_SCOPES[agentType.toLowerCase()] ?? null;
}

export function projectRoot(cwd) {
  if (process.env.CLAUDE_PROJECT_DIR) return realOf(process.env.CLAUDE_PROJECT_DIR);
  try {
    return realOf(execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { return null; }
}

// realpath des tiefsten existierenden Vorfahren + Rest, damit Symlinks aus der Grenze nicht herausführen.
function realOf(p) {
  let cur = resolve(p); const rest = [];
  while (!existsSync(cur)) {
    const up = dirname(cur);
    if (up === cur) break;
    rest.unshift(cur.slice(up.length + (up.endsWith(sep) ? 0 : 1)));
    cur = up;
  }
  let base = cur;
  try { base = realpathSync(cur); } catch { /* bleibt aufgelöst, nicht real */ }
  return rest.length ? resolve(base, ...rest) : base;
}

/**
 * Prüft einen Zielpfad gegen die Schreibgrenze. Rückgabe: null = erlaubt, sonst Begründung.
 * Fail-closed: fehlender Pfad, nicht bestimmbarer Repo-Root, Variablen/Tilde im Pfad.
 */
export function checkWritePath(target, { scope, cwd }) {
  if (typeof target !== 'string' || !target.trim()) return 'Zielpfad fehlt';
  if (target === '/dev/null') return null;
  if (/[$`~]/.test(target)) return `Zielpfad nicht statisch prüfbar: ${target}`;
  const root = projectRoot(cwd);
  if (!root) return 'Repo-Root nicht bestimmbar';
  const abs = realOf(isAbsolute(target) ? target : resolve(cwd || root, target));
  const rel = relative(root, abs).split(sep).join('/');
  if (rel.startsWith('..') || isAbsolute(rel)) return `außerhalb des Repos: ${abs}`;
  const inside = scope.some((s) => rel === s || rel.startsWith(`${s}/`));
  if (!inside) return `außerhalb von ${scope.join(', ')}/: ${rel || '.'}`;
  if (SECRET_FILE.test(rel)) return `Schlüssel-/Umgebungsdatei: ${rel}`;
  return null;
}
