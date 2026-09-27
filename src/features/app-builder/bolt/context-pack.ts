/**
 * Bounded project context for follow-up prompts.
 * Never dumps the whole tree. Budget is character-based.
 */

import type { Diagnostic } from './diagnostics';

export interface ContextFile {
  path: string;
  content: string;
}

export interface ContextPackInput {
  prompt: string;
  files: ContextFile[];
  diagnostics?: Diagnostic[];
  lastChange?: string;
  riskClass?: string;
  budgetChars?: number;
}

export interface ContextPack {
  tree: string[];
  files: ContextFile[];
  omitted: string[];
  diagnostics: string[];
  lastChange?: string;
  riskClass?: string;
  chars: number;
}

const DEFAULT_BUDGET = 12_000;

const PRIORITY = (path: string): number => {
  if (path === 'index.html' || path.endsWith('/index.html')) return 0;
  if (path.endsWith('.html')) return 1;
  if (path.endsWith('.css')) return 2;
  if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.tsx')) return 3;
  return 4;
};

export function packProjectContext(input: ContextPackInput): ContextPack {
  const budget = input.budgetChars ?? DEFAULT_BUDGET;
  const tree = input.files.map((f) => f.path).sort();
  const diagPaths = new Set((input.diagnostics ?? []).filter((d) => d.severity === 'error').map((d) => d.path));
  const mentioned = new Set(
    tree.filter((p) => input.prompt.toLowerCase().includes(p.toLowerCase().split('/').pop() ?? p)),
  );

  const ranked = [...input.files].sort((a, b) => {
    const da = diagPaths.has(a.path) ? -1 : 0;
    const db = diagPaths.has(b.path) ? -1 : 0;
    if (da !== db) return da - db;
    const ma = mentioned.has(a.path) ? -1 : 0;
    const mb = mentioned.has(b.path) ? -1 : 0;
    if (ma !== mb) return ma - mb;
    const pa = PRIORITY(a.path) - PRIORITY(b.path);
    if (pa !== 0) return pa;
    return a.path.localeCompare(b.path);
  });

  const selected: ContextFile[] = [];
  const omitted: string[] = [];
  let chars = 0;
  for (const f of ranked) {
    const slice = f.content.length > 4_000 ? `${f.content.slice(0, 4_000)}\n/* … truncated ${f.path} */` : f.content;
    if (chars + slice.length > budget && selected.length > 0) {
      omitted.push(f.path);
      continue;
    }
    selected.push({ path: f.path, content: slice });
    chars += slice.length;
  }

  return {
    tree,
    files: selected,
    omitted,
    diagnostics: (input.diagnostics ?? []).slice(0, 12).map((d) => `${d.severity} ${d.path}: ${d.message}`),
    lastChange: input.lastChange,
    riskClass: input.riskClass,
    chars,
  };
}

export function formatContextPack(pack: ContextPack, prompt: string, repair?: string): string {
  const head = [
    repair ? `Korrekturauftrag:\n${repair}` : `Auftrag:\n${prompt}`,
    pack.riskClass ? `Risikoklasse: ${pack.riskClass}` : '',
    pack.lastChange ? `Letzte Änderung: ${pack.lastChange}` : '',
    pack.diagnostics.length ? `Diagnostics:\n${pack.diagnostics.join('\n')}` : '',
    `Dateibaum (${pack.tree.length}): ${pack.tree.join(', ') || '(leer)'}`,
    pack.omitted.length ? `Nicht im Kontext (Budget): ${pack.omitted.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const body = pack.files.map((f) => `// FILE ${f.path}\n${f.content}`).join('\n\n');
  return `${head}\n\n${body || '(leeres Projekt)'}`.slice(0, 24_000);
}
