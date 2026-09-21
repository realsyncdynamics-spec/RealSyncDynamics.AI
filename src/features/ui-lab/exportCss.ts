import { TOKENS } from './manifest';
import type { Draft, TokenDef } from './types';
import { emptyDraft } from './types';

export function changeCount(draft: Draft): number {
  return Object.values(draft).reduce((sum, values) => sum + Object.keys(values).length, 0);
}

export function updateToken(draft: Draft, def: TokenDef, value: string): Draft {
  const next = {
    ...draft,
    [def.scope]: { ...draft[def.scope] },
  };
  if (value === def.baseline) delete next[def.scope][def.key];
  else next[def.scope][def.key] = value;
  return next;
}

function block(selector: string, values: Record<string, string>): string {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return '';
  return `${selector} {\n${entries.map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}`;
}

export function exportCss(draft: Draft): string {
  if (!changeCount(draft)) {
    return '/* No changes to the current RealSync dashboard tokens. */\n';
  }

  const byBlock: Record<TokenDef['targetBlock'], Record<string, string>> = {
    '@theme': {},
    ':root': {},
    '.dark': {},
    '.dashboard-context': {},
  };

  for (const scope of ['shared', 'light', 'dark'] as const) {
    for (const [key, value] of Object.entries(draft[scope])) {
      const def = TOKENS.find((item) => item.key === key);
      if (!def) continue;
      byBlock[def.targetBlock][key] = value;
    }
  }

  const parts = [
    '/* RealSync UI Lab — merge into src/styles/context-themes.css',
    '   (.dashboard-context) or src/index.css @theme. Review before apply.',
    '   Do not apply to landing or SiteOS. Lab never writes source. */',
    block('@theme', byBlock['@theme']),
    block(':root', byBlock[':root']),
    block('.dark', byBlock['.dark']),
    block('.dashboard-context', byBlock['.dashboard-context']),
  ].filter(Boolean);

  return `${parts.join('\n\n')}\n`;
}

export function previewCss(draft: Draft): string {
  const values = {
    ...draft.shared,
    ...draft.light,
    ...draft.dark,
  };
  return block('.dashboard-context', values);
}

export { emptyDraft };
