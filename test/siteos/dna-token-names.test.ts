import { describe, expect, it } from 'vitest';
import tokens from '../../src/app/theme/tokens.json';
import { SEMANTIC_TOKEN_NAMES } from '../../packages/siteos-core/src/render/semantic-token-names';
import { DOCUMENTED_TOKEN_GAPS } from '../../packages/siteos-core/src/render/dna-adapter';

function semanticNames(input: unknown): string[] {
  const names: string[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== 'object') return;
    if ('$value' in node) {
      names.push(path.join('/'));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      walk(child, [...path, key]);
    }
  };
  walk((input as { semantic?: unknown }).semantic, []);
  return names;
}

describe('semantische Token-Namen', () => {
  it('entspricht tokens.json und erfindet keinen Namen', () => {
    expect([...SEMANTIC_TOKEN_NAMES]).toEqual(semanticNames(tokens));
    expect(SEMANTIC_TOKEN_NAMES).toHaveLength(114);
  });

  it('dokumentiert die Lücken, ohne einen Token-Namen dafür anzulegen', () => {
    const names = new Set<string>(SEMANTIC_TOKEN_NAMES);
    expect(names.has('layout/screen-tablet')).toBe(false);
    expect(names.has('type/weight/regular')).toBe(false);
    expect(names.has('color/status/error')).toBe(false);
    expect(DOCUMENTED_TOKEN_GAPS.map((gap) => gap.id)).toEqual([
      'layout-tablet',
      'type-weight-regular',
      'status-error',
      'overlay-opacity',
      'disabled',
      'space-6',
      'type-size-16-32',
      'text-accent-unset',
    ]);
  });
});
