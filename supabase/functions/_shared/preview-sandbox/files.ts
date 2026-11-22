// Prüfung der Projektdateien, bevor sie eine Sandbox erreichen (Spike).
//
// Generierter Code ist nicht vertrauenswürdig. Die Sandbox isoliert die
// Ausführung; diese Prüfung begrenzt zusätzlich, WAS hineinkommt:
//   * nur relative, normale Pfade (kein `..`, kein absoluter Pfad)
//   * keine Dateien, die Zugangsdaten oder Registry-Umleitungen tragen
//     (.env*, .npmrc, .yarnrc*, .git/, node_modules/)
//   * Größen wie code-persist (80 Dateien, 200 KB je Datei, 1,5 MB gesamt)
//   * package.json: nur Registry-Versionen (kein git+, file:, link:, http:),
//     begrenzte Anzahl Abhängigkeiten; Install läuft mit --ignore-scripts.

import type { DevServerSpec, SandboxFile } from './types.ts';

export const MAX_FILES = 80;
export const MAX_FILE_BYTES = 200_000;
export const MAX_PROJECT_BYTES = 1_500_000;
export const MAX_DEPENDENCIES = 40;

/** Fester Startbefehl. KI-erzeugte Shell-Befehle werden nie ausgeführt. */
export const DEV_SERVER: Readonly<DevServerSpec> = Object.freeze({
  port: 5173,
  install: Object.freeze(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund']),
  // --cors: Die Vorschau läuft im iframe mit opaker Origin (kein
  // allow-same-origin). Module-Skripte laden dann im CORS-Modus.
  command: Object.freeze(['npx', 'vite', '--host', '0.0.0.0', '--port', '5173', '--strictPort', '--cors']),
});

/** Ausgehend nur npm-Registry — sofern der Anbieter eine Allowlist kann. */
export const EGRESS_ALLOWLIST: readonly string[] = Object.freeze(['registry.npmjs.org']);

const BLOCKED_SEGMENT = /^(?:\.git|node_modules)$/;
const BLOCKED_FILE = /^(?:\.env(?:\..*)?|\.npmrc|\.yarnrc(?:\.yml)?|\.pnpmfile\.cjs|bunfig\.toml)$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9._@+-]+$/;
const REGISTRY_SPEC = /^(?:[~^]|>=?|<=?|=)?\s*\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$|^\*$|^latest$/;

export type FileCheck = { ok: true; files: SandboxFile[] } | { ok: false; message: string };

export function normalizePath(raw: string): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const p = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return null;
  const parts = p.split('/');
  for (const part of parts) {
    if (!part || part === '.' || part === '..') return null;
    if (!SAFE_SEGMENT.test(part)) return null;
    if (BLOCKED_SEGMENT.test(part)) return null;
  }
  if (BLOCKED_FILE.test(parts[parts.length - 1])) return null;
  return parts.join('/');
}

export function checkProjectFiles(files: Record<string, unknown>): FileCheck {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return { ok: false, message: 'files must be an object' };
  }
  const entries = Object.entries(files);
  if (entries.length === 0) return { ok: false, message: 'no files' };
  if (entries.length > MAX_FILES) return { ok: false, message: `too many files (${entries.length})` };
  const out: SandboxFile[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const [rawPath, content] of entries) {
    const path = normalizePath(rawPath);
    if (!path) return { ok: false, message: `path not allowed: ${rawPath}` };
    if (seen.has(path)) return { ok: false, message: `duplicate path: ${path}` };
    if (typeof content !== 'string') return { ok: false, message: `invalid content for ${path}` };
    if (content.length > MAX_FILE_BYTES) return { ok: false, message: `file too large: ${path}` };
    total += content.length;
    seen.add(path);
    out.push({ path, content });
  }
  if (total > MAX_PROJECT_BYTES) return { ok: false, message: 'project too large' };
  return { ok: true, files: out };
}

/** Zusätzlich für den Start: muss ein Vite-Projekt mit sauberer package.json sein. */
export function checkViteProject(files: SandboxFile[]): { ok: true } | { ok: false; message: string } {
  const pkgFile = files.find((f) => f.path === 'package.json');
  if (!pkgFile) return { ok: false, message: 'package.json missing' };
  if (!files.some((f) => f.path === 'index.html')) return { ok: false, message: 'index.html missing' };
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgFile.content) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'package.json is not valid JSON' };
  }
  const deps = {
    ...(asRecord(pkg.dependencies) ?? {}),
    ...(asRecord(pkg.devDependencies) ?? {}),
  };
  const names = Object.keys(deps);
  if (!names.includes('vite')) return { ok: false, message: 'vite must be a dependency' };
  if (names.length > MAX_DEPENDENCIES) return { ok: false, message: `too many dependencies (${names.length})` };
  for (const [name, spec] of Object.entries(deps)) {
    if (typeof spec !== 'string' || !REGISTRY_SPEC.test(spec.trim())) {
      return { ok: false, message: `dependency ${name} must use a plain registry version` };
    }
  }
  for (const key of ['bundleDependencies', 'bundledDependencies', 'workspaces', 'overrides', 'resolutions']) {
    if (key in pkg) return { ok: false, message: `package.json field not allowed: ${key}` };
  }
  return { ok: true };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
