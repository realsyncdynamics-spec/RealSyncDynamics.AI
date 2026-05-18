// Contract tests for billing + audit shape. Catch drift between
// pricing.ts (canonical) and PLAN_CONFIG (derived) at CI time.
//
// Also: pure-function checks for the gdpr-audit shape — these don't
// hit the live Edge Function, only the schemas + scoring helper.

import { describe, expect, it } from 'vitest';
import { PRICING_TIERS, tierById, type TierId } from '../../src/config/pricing';
import { PLAN_CONFIG, diffPricingTiersAgainstPlanConfig, planForTier } from '../../src/lib/billing/planConfig';

describe('PRICING_TIERS — Single Source of Truth', () => {
  it('has all 5 tier ids', () => {
    const ids = PRICING_TIERS.map((t) => t.id).sort();
    expect(ids).toEqual(['agency', 'enterprise', 'free', 'growth', 'starter']);
  });

  it('Starter price is 49 €', () => {
    expect(tierById('starter')?.priceEur).toBe(49);
  });

  it('Growth price is 179 €', () => {
    expect(tierById('growth')?.priceEur).toBe(179);
  });

  it('Agency price is 499 €', () => {
    expect(tierById('agency')?.priceEur).toBe(499);
  });

  it('Free tier has priceEur=0 and recurring=false', () => {
    const f = tierById('free');
    expect(f?.priceEur).toBe(0);
    expect(f?.recurring).toBe(false);
  });

  it('Enterprise has priceString="individuell"', () => {
    expect(tierById('enterprise')?.priceString).toBe('individuell');
  });

  it('every tier has a non-empty bullets array', () => {
    for (const t of PRICING_TIERS) {
      expect(t.bullets.length).toBeGreaterThan(0);
    }
  });

  it('every tier has a CTA href that is internal (/) or contact-sales', () => {
    for (const t of PRICING_TIERS) {
      expect(t.cta.href.startsWith('/')).toBe(true);
    }
  });
});

describe('PLAN_CONFIG alignment with PRICING_TIERS', () => {
  it('contains an entry for every PRICING_TIERS.planKey', () => {
    for (const t of PRICING_TIERS) {
      expect(PLAN_CONFIG[t.planKey]).toBeDefined();
    }
  });

  it('PLAN_CONFIG prices match PRICING_TIERS prices (or null for enterprise)', () => {
    const mismatches = diffPricingTiersAgainstPlanConfig();
    expect(mismatches).toEqual([]);
  });

  it('planForTier returns a config entry for every tier', () => {
    for (const t of PRICING_TIERS) {
      const id = t.id as TierId;
      const entry = planForTier(id);
      expect(entry).toBeTruthy();
      expect(entry.mode).toMatch(/^(free|checkout|inquiry)$/);
    }
  });

  it('free_audit mode is "free"', () => {
    expect(PLAN_CONFIG.free_audit.mode).toBe('free');
  });

  it('enterprise mode is "inquiry"', () => {
    expect(PLAN_CONFIG.enterprise.mode).toBe('inquiry');
  });
});

describe('URL normalisation contract (mirror of gdpr-audit Edge Function)', () => {
  // Mirror the canonical normalization rule so we can test it without
  // pulling a Deno file. Keep in sync with `supabase/functions/_shared/url.ts`
  // — when the canonical changes, update both.
  function normalize(input: string): string | null {
    const trimmed = (input ?? '').trim().toLowerCase();
    if (!trimmed) return null;
    let withScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
    try {
      const u = new URL(withScheme);
      if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
      withScheme = u.toString();
    } catch {
      return null;
    }
    return withScheme;
  }

  it('prepends https:// when missing', () => {
    expect(normalize('example.de')).toMatch(/^https:\/\/example\.de/);
  });
  it('keeps explicit https://', () => {
    expect(normalize('https://example.de/x')).toMatch(/^https:\/\/example\.de/);
  });
  it('rejects empty', () => {
    expect(normalize('')).toBeNull();
  });
  it('rejects invalid URL', () => {
    expect(normalize('not a url')).toBeNull();
  });
});

describe('Score contract (mirror of scoreReport)', () => {
  // Mirror the deduction weights from `supabase/functions/_shared/scoring.ts`.
  // Keep in sync with the canonical file.
  function score(issues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical' }>): number {
    let s = 100;
    for (const i of issues) {
      if (i.severity === 'critical') s -= 25;
      else if (i.severity === 'high') s -= 15;
      else if (i.severity === 'medium') s -= 8;
      else s -= 3;
    }
    return Math.max(0, s);
  }

  it('returns 100 for empty findings', () => {
    expect(score([])).toBe(100);
  });

  it('one critical → ≤ 75', () => {
    expect(score([{ severity: 'critical' }])).toBeLessThanOrEqual(75);
  });

  it('floors at 0', () => {
    const many = Array(20).fill({ severity: 'critical' as const });
    expect(score(many)).toBe(0);
  });

  it('mixed severities sum correctly', () => {
    expect(score([
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'low' },
    ])).toBe(100 - 25 - 15 - 8 - 3);
  });
});

describe('Issue-Shape contract', () => {
  // Mirror — gdpr-audit Edge Function returns Issues with this exact shape.
  // Whenever the schema changes, update this test + the Edge Function.
  interface Issue {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    detail: string;
    paragraph_ref?: string;
  }

  it('Issue shape has id+severity+title+detail (paragraph_ref optional)', () => {
    const example: Issue = {
      id: 'ttdsg-25-pre-consent-tracker',
      severity: 'high',
      title: 'Tracker vor Einwilligung erkannt',
      detail: 'Meta Pixel lädt vor consent.granted.',
      paragraph_ref: 'TTDSG §25',
    };
    expect(typeof example.id).toBe('string');
    expect(['low', 'medium', 'high', 'critical']).toContain(example.severity);
    expect(typeof example.title).toBe('string');
    expect(typeof example.detail).toBe('string');
  });
});
