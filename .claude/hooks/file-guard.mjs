#!/usr/bin/env node
/**
 * File-Guard — technische Änderungskontrolle für Agenten (REA, RENDER).
 *
 * PreToolUse-Hook für Edit, Write, MultiEdit und NotebookEdit. Liest das
 * Hook-JSON von stdin, prüft den Zielpfad gegen .claude/hooks/file-guard.json
 * und blockiert mit Exit-Code 2 (Grund auf stderr, Claude sieht ihn).
 *
 * Regeln:
 *   1. deny gewinnt immer (Backend, Migrationen, Auth, Billing/Stripe,
 *      Preise, Workflows, Produktionskonfiguration, der Guard selbst).
 *   2. Pfad im Repo, aber auf keinem allow-Muster → blockiert.
 *   3. Pfad außerhalb des Repos (z. B. /tmp) → erlaubt, ist keine Repo-Änderung.
 *   4. Kaputtes Hook-JSON oder fehlende Konfiguration → blockiert (fail-closed).
 *
 * Nicht abgedeckt: Schreiben über Bash (sed -i, >, mv). Das fangen
 * CODEOWNERS, merge-hygiene und der menschliche Merge ab.
 */

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Glob → RegExp. Unterstützt `**`, `*`, `?`. Pfade immer mit `/`. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` = beliebig viele Verzeichnisse (auch keins), `**` am Ende = alles
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(path, globs) {
  return globs.find((g) => globToRegExp(g).test(path)) ?? null;
}

/**
 * @returns {{ allowed: boolean, reason: string, path: string }}
 */
export function evaluate(filePath, projectDir, cfg) {
  if (!filePath || typeof filePath !== 'string') {
    return { allowed: false, reason: 'kein Zielpfad im Hook-Aufruf', path: '' };
  }
  const abs = isAbsolute(filePath) ? resolve(filePath) : resolve(projectDir, filePath);
  const rel = relative(resolve(projectDir), abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    return { allowed: true, reason: 'außerhalb des Repos', path: abs };
  }
  const path = rel.split(sep).join('/');

  const denied = matchesAny(path, cfg.deny ?? []);
  if (denied) {
    return { allowed: false, reason: `geschützter Pfad (deny: ${denied})`, path };
  }
  const ok = matchesAny(path, cfg.allow ?? []);
  if (!ok) {
    return { allowed: false, reason: 'nicht in der Allowlist', path };
  }
  return { allowed: true, reason: `erlaubt (allow: ${ok})`, path };
}

export function loadConfig(file = join(HERE, 'file-guard.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function block(msg) {
  process.stderr.write(
    `File-Guard: ${msg}\n` +
      'Änderungen an Backend, Migrationen, Auth, RLS, Billing/Stripe, Preisen, ' +
      'Workflows und Produktionskonfiguration brauchen eine Einzelfreigabe von Dominik. ' +
      'Nicht umgehen (auch nicht per Bash) — stoppen und eskalieren.\n',
  );
  process.exit(2);
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    block('Hook-Eingabe nicht lesbar (fail-closed).');
  }
  let cfg;
  try {
    cfg = loadConfig();
  } catch {
    block('file-guard.json fehlt oder ist ungültig (fail-closed).');
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const ti = input.tool_input ?? {};
  const target = ti.file_path ?? ti.notebook_path;
  const res = evaluate(target, projectDir, cfg);
  if (!res.allowed) block(`${res.path || '(leer)'} — ${res.reason}.`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
