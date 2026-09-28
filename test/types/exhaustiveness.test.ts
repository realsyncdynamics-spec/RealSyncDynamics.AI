/**
 * Compiler-as-change-sensor: catalog maps, boundary parse, AI result tag.
 * No Auth rewrite. No wholesale string→PlanId replacement.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ENTITLEMENT_KEYS, PLAN_ORDER, type EntitlementKey, type PlanId } from '../../shared/pricing';
import { entitlementLabel, ENTITLEMENT_LABELS } from '../../src/core/access/entitlementLabels';
import { assertNever } from '../../src/lib/assertNever';
import { parsePlanId } from '../../src/lib/parsePlanId';

describe('assertNever', () => {
  it('is the leftover sink of a completed PlanId-shaped switch', () => {
    type Bit = 'a' | 'b';
    function label(bit: Bit): string {
      switch (bit) {
        case 'a':
          return 'A';
        case 'b':
          return 'B';
        default:
          return assertNever(bit, 'Bit');
      }
    }
    expect(label('a')).toBe('A');
    expect(label('b')).toBe('B');
  });
});

describe('catalog exhaustiveness', () => {
  it('ENTITLEMENT_LABELS covers every EntitlementKey', () => {
    const missing = ENTITLEMENT_KEYS.filter((k) => !(k in ENTITLEMENT_LABELS));
    expect(missing, `unlabeled keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('ENTITLEMENT_LABELS has no extra keys', () => {
    const catalog = new Set<string>(ENTITLEMENT_KEYS);
    const extra = Object.keys(ENTITLEMENT_LABELS).filter((k) => !catalog.has(k));
    expect(extra).toEqual([]);
  });

  it('entitlementLabel falls back to the raw key outside the catalog', () => {
    expect(entitlementLabel('not.a.real.key')).toBe('not.a.real.key');
  });

  it('known keys resolve to a non-empty label', () => {
    const sample: EntitlementKey[] = ['siteos.builder', 'siteos.publish', 'limit.sites'];
    for (const key of sample) {
      expect(entitlementLabel(key).length).toBeGreaterThan(0);
    }
  });
});

describe('parsePlanId — untrusted boundary only', () => {
  it('accepts every ladder PlanId plus governance_launch', () => {
    for (const id of PLAN_ORDER) {
      expect(parsePlanId(id)).toBe(id);
    }
    expect(parsePlanId('governance_launch')).toBe('governance_launch');
  });

  it('rejects scale and free_audit — those are PlanKey aliases, not PlanId', () => {
    expect(parsePlanId('scale')).toBeNull();
    expect(parsePlanId('free_audit')).toBeNull();
    expect(parsePlanId('starter_yearly')).toBeNull();
    expect(parsePlanId('')).toBeNull();
    expect(parsePlanId(null)).toBeNull();
  });

  it('narrows a trusted PlanId for core use', () => {
    const parsed = parsePlanId('starter');
    const id: PlanId | null = parsed;
    expect(id).toBe('starter');
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
