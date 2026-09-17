/**
 * Compile-time exhaustiveness for catalog unions and the AI result tag.
 * If ENTITLEMENT_KEYS grows, Record<EntitlementKey, …> call sites must follow.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ENTITLEMENT_KEYS, type EntitlementKey } from '../../shared/pricing';
import { entitlementLabel } from '../../src/core/access/entitlementLabels';
import { assertNever } from '../../src/lib/assertNever';

describe('assertNever', () => {
  it('is unreachable for a completed PlanId-style switch', () => {
    type Bit = 'a' | 'b';
    function label(bit: Bit): string {
      switch (bit) {
        case 'a':
          return 'A';
        case 'b':
          return 'B';
        default:
          return assertNever(bit);
      }
    }
    expect(label('a')).toBe('A');
    expect(label('b')).toBe('B');
  });
});

describe('EntitlementKey catalog', () => {
  it('entitlementLabel never invents a second name for an unknown key', () => {
    expect(entitlementLabel('not.a.real.key')).toBe('not.a.real.key');
  });

  it('known keys resolve to a non-empty label', () => {
    const sample: EntitlementKey[] = ['siteos.builder', 'siteos.publish', 'limit.sites'];
    for (const key of sample) {
      expect(entitlementLabel(key).length).toBeGreaterThan(0);
    }
  });

  it('KEY_LABELS only names keys that exist in ENTITLEMENT_KEYS', () => {
    const src = readFileSync('src/core/access/entitlementLabels.ts', 'utf8');
    const named = [...src.matchAll(/'([a-z0-9_.]+)':\s*'/g)].map((m) => m[1]);
    const catalog = new Set<string>(ENTITLEMENT_KEYS);
    const unknown = named.filter((k) => !catalog.has(k));
    expect(unknown, `labels for keys outside SSoT: ${unknown.join(', ')}`).toEqual([]);
  });
});

describe('website-operations-agent AI result tag', () => {
  it('models success as a literal, not boolean + optionals', () => {
    const src = readFileSync('supabase/functions/website-operations-agent/index.ts', 'utf8');
    expect(src).toMatch(/success:\s*true/);
    expect(src).toMatch(/success:\s*false/);
    expect(src).toContain('website.success === false');
    expect(src).not.toMatch(/interface AIGenerationResult \{\s*success: boolean/);
  });
});
