import { describe, expect, it } from 'vitest';

import { classifyColumn, buildDataProfilingPlan } from '../../src/lib/skills/dataExploration';
import {
  classifyDeficiency, recommendSampleSize,
} from '../../src/lib/skills/financeAuditSupport';
import {
  buildDsarChecklist, buildDpaReviewChecklist,
} from '../../src/lib/skills/legalCompliance';
import {
  classifyClauseDeviation, buildRedlineReviewPlan,
} from '../../src/lib/skills/legalContractReview';
import {
  calculateConversionRate, calculateCtr, calculateRoas, prioritizeOptimization,
} from '../../src/lib/skills/marketingPerformanceAnalytics';
import { buildCallPrepOutline } from '../../src/lib/skills/salesCallPrep';
import { buildOutreachResearchPlan } from '../../src/lib/skills/salesDraftOutreach';

describe('dataExploration', () => {
  it('classifies numeric, datetime, id, categorical columns', () => {
    expect(classifyColumn('amount', [10, 20, 30]).type).toBe('numeric');
    expect(classifyColumn('signup', ['2026-01-01', '2026-02-02']).type).toBe('datetime');
    expect(classifyColumn('user_id', ['u1', 'u2']).type).toBe('id');
    expect(classifyColumn('plan', ['pro', 'free', 'pro', 'free']).type).toBe('categorical');
  });
  it('buildDataProfilingPlan emits the no-raw-sensitive-data guardrail', () => {
    const plan = buildDataProfilingPlan([{ name: 'amount', type: 'numeric', reason: 'ok' }]);
    expect(plan.guardrails.join(' ')).toMatch(/Rohdaten/i);
  });
});

describe('financeAuditSupport', () => {
  it('classifies a high-magnitude high-likelihood finding as material_weakness', () => {
    const r = classifyDeficiency({ likelihood: 'high', magnitude: 'high' });
    expect(r.classification).toBe('material_weakness');
    expect(r.reviewRequired).toBe(true);
  });
  it('recommendSampleSize returns a non-negative size with a caveat', () => {
    const r = recommendSampleSize('monthly', 'high');
    expect(r.size).toBeGreaterThan(0);
    expect(r.caveat).toMatch(/Audit/i);
  });
  it('rejects unknown frequency', () => {
    // @ts-expect-error invalid
    expect(() => recommendSampleSize('bogus', 'high')).toThrow();
  });
});

describe('legalCompliance', () => {
  it('GDPR DSAR checklist contains 30-day SLA + disclaimer', () => {
    const c = buildDsarChecklist('gdpr');
    expect(c.items.some((i) => /30 Tage/.test(i.title))).toBe(true);
    expect(c.disclaimer).toMatch(/keine Rechtsberatung/i);
  });
  it('DPA review checklist has audit + transfers items', () => {
    const c = buildDpaReviewChecklist();
    expect(c.items.find((i) => i.id === 'transfers')).toBeDefined();
    expect(c.items.find((i) => i.id === 'audit')).toBeDefined();
  });
});

describe('legalContractReview', () => {
  it('material deviation requires review', () => {
    expect(classifyClauseDeviation('material').reviewRequired).toBe(true);
    expect(classifyClauseDeviation('cosmetic').reviewRequired).toBe(false);
  });
  it('redline plan disclaims legal advice', () => {
    const r = buildRedlineReviewPlan('dpa', 'customer');
    expect(r.disclaimer).toMatch(/keine Rechtsberatung/i);
    expect(r.steps.length).toBeGreaterThan(0);
  });
});

describe('marketingPerformanceAnalytics', () => {
  it('CR / CTR / ROAS happy path', () => {
    expect(calculateConversionRate(50, 1000)).toBe(5);
    expect(calculateCtr(20, 200)).toBe(10);
    expect(calculateRoas(2000, 500)).toBe(4);
  });
  it('safe on zero denominators', () => {
    expect(calculateConversionRate(10, 0)).toBe(0);
    expect(calculateCtr(10, 0)).toBe(0);
    expect(calculateRoas(10, 0)).toBe(0);
  });
  it('prioritizes high-impact / low-effort first', () => {
    const ranked = prioritizeOptimization([
      { id: 'low', hypothesis: 'l', impactScore: 0.2, effortScore: 0.9, confidence: 0.4 },
      { id: 'high', hypothesis: 'h', impactScore: 0.9, effortScore: 0.2, confidence: 0.8 },
    ]);
    expect(ranked[0]!.id).toBe('high');
  });
});

describe('sales skills', () => {
  it('callPrepOutline returns agenda and red flags with no-fabrication guardrail', () => {
    const o = buildCallPrepOutline('Acme GmbH', 'discovery');
    expect(o.agenda.length).toBeGreaterThan(0);
    expect(o.guardrail).toMatch(/erfundenen/i);
  });
  it('outreach research plan is review-required and forbids auto-send', () => {
    const p = buildOutreachResearchPlan({ company: 'Acme' });
    expect(p.reviewRequired).toBe(true);
    expect(p.guardrails.join(' ')).toMatch(/automatische Versendung/i);
  });
});
