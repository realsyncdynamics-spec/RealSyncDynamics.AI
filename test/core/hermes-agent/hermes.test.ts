import { describe, it, expect, beforeEach } from 'vitest';
import {
  HermesAgent,
  __resetDefaultHermesForTests,
} from '../../../src/core/hermes-agent/hermes';
import {
  scoreFutureSignal, heuristicScore, opportunityBand,
} from '../../../src/core/hermes-agent/futureFishModel';

const TENANT = 't_test';

beforeEach(() => { __resetDefaultHermesForTests(); });

// ── FutureFishModel ───────────────────────────────────────────────

describe('FutureFishModel.scoreFutureSignal', () => {
  it('rounds to 2 decimals and clamps to [0,1]', () => {
    const s = scoreFutureSignal({
      novelty_score: 1, urgency_score: 1, monetization_score: 1,
      defensibility_score: 1, timing_score: 1, evidence_score: 1,
    });
    expect(s).toBe(1);

    const z = scoreFutureSignal({
      novelty_score: 0, urgency_score: 0, monetization_score: 0,
      defensibility_score: 0, timing_score: 0, evidence_score: 0,
    });
    expect(z).toBe(0);
  });

  it('weights urgency + monetization + timing above novelty', () => {
    const novelOnly = scoreFutureSignal({
      novelty_score: 1, urgency_score: 0, monetization_score: 0,
      defensibility_score: 0, timing_score: 0, evidence_score: 0,
    });
    const monetisable = scoreFutureSignal({
      novelty_score: 0, urgency_score: 1, monetization_score: 1,
      defensibility_score: 0, timing_score: 1, evidence_score: 0,
    });
    expect(monetisable).toBeGreaterThan(novelOnly);
  });
});

describe('heuristicScore', () => {
  it('regulatory + 3_months horizon produces high urgency + timing', () => {
    const s = heuristicScore({
      signal_type: 'regulatory',
      evidence: ['https://edpb.europa.eu/news/...'],
      description: 'EDPB enforcement deadline approaching for cross-border transfers; fines expected.',
      time_horizon: '3_months',
    });
    expect(s.urgency_score).toBeGreaterThan(0.7);
    expect(s.timing_score).toBeGreaterThan(0.7);
    expect(s.evidence_score).toBeGreaterThan(0.5);
  });

  it('weak signal with no evidence gets very low evidence_score', () => {
    const s = heuristicScore({
      signal_type: 'weak',
      evidence: [],
      description: 'A vague hint from a single Reddit thread.',
      time_horizon: '24_months',
    });
    expect(s.evidence_score).toBeLessThan(0.2);
    expect(s.timing_score).toBeLessThan(0.5);
  });
});

describe('opportunityBand', () => {
  it('maps aggregates to the three coarse bands', () => {
    expect(opportunityBand(0.85)).toBe('top');
    expect(opportunityBand(0.60)).toBe('watch');
    expect(opportunityBand(0.30)).toBe('background');
  });
});

// ── Knowledge ingestion + dedup ───────────────────────────────────

describe('HermesAgent.ingestKnowledge', () => {
  it('rejects facts without title or summary (no facts without sources)', async () => {
    const h = new HermesAgent();
    await expect(h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'x', source_type: 'other',
      title: '', summary: 's', topic: 't',
    } as never)).rejects.toThrow(/title and summary required/);
  });

  it('deduplicates by (source_url + title)', async () => {
    const h = new HermesAgent();
    const k1 = await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'https://example.com/a',
      source_type: 'eu_ai_act', title: 'EDPB ruling X', summary: 's', topic: 't',
    });
    const k2 = await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'https://example.com/a',
      source_type: 'eu_ai_act', title: 'EDPB ruling X', summary: 's', topic: 't',
    });
    expect(k2.id).toBe(k1.id);
    expect(h.listKnowledge({ tenant_id: TENANT })).toHaveLength(1);
  });

  it('allows the same title under a different source_url', async () => {
    const h = new HermesAgent();
    await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'https://a/1',
      source_type: 'reddit', title: 'X', summary: 's', topic: 't',
    });
    await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'https://a/2',
      source_type: 'reddit', title: 'X', summary: 's', topic: 't',
    });
    expect(h.listKnowledge({ tenant_id: TENANT })).toHaveLength(2);
  });

  it('listKnowledge filters by topic + tag + min_relevance', async () => {
    const h = new HermesAgent();
    await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'a', source_type: 'reddit',
      title: 'A', summary: 's', topic: 'ai', tags: ['agents'], relevance_score: 0.9,
    });
    await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'b', source_type: 'reddit',
      title: 'B', summary: 's', topic: 'ai', tags: ['other'],  relevance_score: 0.3,
    });
    const got = h.listKnowledge({ tenant_id: TENANT, topic: 'ai', tag: 'agents', min_relevance: 0.5 });
    expect(got).toHaveLength(1);
    expect(got[0]?.title).toBe('A');
  });
});

// ── Signal extraction ────────────────────────────────────────────

describe('HermesAgent.extractSignal', () => {
  it('produces a deterministic future_opportunity_score from the dimensions', async () => {
    const h = new HermesAgent();
    const k = await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'x', source_type: 'eu_ai_act',
      title: 'EDPB enforcement deadline for cross-border transfers',
      summary: 'Six-month notice issued; fines indicated for non-compliant exports.',
      topic: 'privacy',
    });
    const s = h.extractSignal({
      knowledge:          k,
      signal_type:        'regulatory',
      recommended_action: 'Schedule a TIA review for every cross-border processor.',
      time_horizon:       '3_months',
    });
    expect(s.future_opportunity_score).toBeGreaterThan(0.5);
    expect(s.evidence.length).toBeGreaterThan(0);
    expect(s.source_knowledge_id).toBe(k.id);
  });

  it('listSignals sorts by future_opportunity_score desc', async () => {
    const h = new HermesAgent();
    const k = await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'x', source_type: 'eu_ai_act',
      title: 't', summary: 's', topic: 'p',
    });
    h.extractSignal({ knowledge: k, signal_type: 'weak', recommended_action: 'a' });
    h.extractSignal({ knowledge: k, signal_type: 'regulatory', recommended_action: 'b', time_horizon: '3_months' });
    const list = h.listSignals({ tenant_id: TENANT });
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.future_opportunity_score).toBeGreaterThanOrEqual(list[i]!.future_opportunity_score);
    }
  });
});

// ── Market gap detection ─────────────────────────────────────────

describe('HermesAgent.detectMarketGap', () => {
  it('rejects gaps missing problem / target / product_angle', () => {
    const h = new HermesAgent();
    expect(() => h.detectMarketGap({
      tenant_id: TENANT, problem: '', target_customer: 'x',
      urgency: 'medium', existing_solutions: [],
      why_existing_solutions_fail: 'y',
      automation_potential: 0.5, revenue_potential: '0-50k',
      moat_potential: 'none', recommended_product_angle: 'z',
    })).toThrow(/required/);
  });

  it('persists a valid gap with status=open', () => {
    const h = new HermesAgent();
    const g = h.detectMarketGap({
      tenant_id: TENANT,
      problem: 'Pre-consent tracker audits take weeks',
      target_customer: 'DACH SaaS companies with > 50 employees',
      urgency: 'high',
      existing_solutions: [{ name: 'OneTrust', gap: 'No continuous detection' }],
      why_existing_solutions_fail: 'Static scans miss drift.',
      automation_potential: 0.8,
      revenue_potential: '250k-1m',
      moat_potential: 'data',
      recommended_product_angle: 'Continuous-detection runtime + evidence anchor.',
    });
    expect(g.status).toBe('open');
    expect(h.listMarketGaps(TENANT, 'open')).toHaveLength(1);
  });
});

// ── Future simulation ────────────────────────────────────────────

describe('HermesAgent.runFutureSimulation', () => {
  it('rejects simulations without assumptions', () => {
    const h = new HermesAgent();
    expect(() => h.runFutureSimulation({
      tenant_id: TENANT, agent: 'MarketSimulationAgent',
      scenario_name: 's', timeframe: '6_months',
      assumptions: [], expected_market_shift: 'm',
      risks: [], opportunities: [], recommended_moves: [],
      confidence: 0.5,
    })).toThrow(/assumption/);
  });

  it('clamps confidence and stores the simulation', () => {
    const h = new HermesAgent();
    const sim = h.runFutureSimulation({
      tenant_id: TENANT, agent: 'PricingSimulationAgent',
      scenario_name: 'Move enterprise to €299', timeframe: '6_months',
      assumptions: ['No competitor matches under €350'],
      expected_market_shift: 'Mid-market enterprises trade up.',
      risks: ['churn spike'],
      opportunities: ['margin uplift'],
      recommended_moves: ['Grandfather existing accounts'],
      confidence: 0.65,
    });
    expect(sim.confidence).toBe(0.65);
    expect(sim.assumptions.length).toBe(1);
  });
});

// ── Daily brief ──────────────────────────────────────────────────

describe('HermesAgent.createDailyBrief', () => {
  it('summarises top signals + gaps + competitor moves for the day', async () => {
    const h = new HermesAgent();

    const k1 = await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'https://edpb', source_type: 'regulator',
      title: 'EDPB enforcement deadline for cross-border transfers',
      summary: 'Six-month notice; sanctions likely for non-compliant exports.',
      topic: 'privacy', market_area: 'privacy',
    });
    h.extractSignal({
      knowledge: k1, signal_type: 'regulatory',
      recommended_action: 'Schedule TIA review for every cross-border processor.',
      time_horizon: '3_months',
    });
    const k2 = await h.ingestKnowledge({
      tenant_id: TENANT, source_url: 'https://competitor', source_type: 'competitor',
      title: 'OneTrust ships AI-Act risk classifier',
      summary: 'Big-vendor competitor moves into Annex-III scoring.',
      topic: 'competitor', market_area: 'compliance',
    });
    h.extractSignal({
      knowledge: k2, signal_type: 'competitor',
      recommended_action: 'Draft a differentiation post on continuous-runtime advantage.',
    });
    h.detectMarketGap({
      tenant_id: TENANT,
      problem: 'Pre-consent tracker audits take weeks',
      target_customer: 'DACH SaaS',
      urgency: 'high',
      existing_solutions: [],
      why_existing_solutions_fail: 'static',
      automation_potential: 0.8,
      revenue_potential: '250k-1m',
      moat_potential: 'data',
      recommended_product_angle: 'Continuous runtime + evidence chain.',
    });

    const brief = h.createDailyBrief({ tenant_id: TENANT, brief_date: '2026-05-17' });
    expect(brief.top_5_signals.length).toBeGreaterThanOrEqual(1);
    expect(brief.top_3_market_gaps.length).toBe(1);
    expect(brief.competitor_moves.length).toBeGreaterThan(0);
    expect(brief.recommended_actions_today.length).toBeGreaterThan(0);
  });

  it('is idempotent per (tenant_id, brief_date)', async () => {
    const h = new HermesAgent();
    const b1 = h.createDailyBrief({ tenant_id: TENANT, brief_date: '2026-05-17' });
    const b2 = h.createDailyBrief({ tenant_id: TENANT, brief_date: '2026-05-17' });
    expect(b1.id).toBe(b2.id);
  });
});

// ── Handoff ──────────────────────────────────────────────────────

describe('HermesAgent.handoffToAgent', () => {
  it('persists a handoff with status=pending', () => {
    const h = new HermesAgent();
    const ho = h.handoffToAgent({
      tenant_id: TENANT,
      target_agent: 'PlanningAgent',
      task_kind: 'roadmap_from_gap',
      context_summary: 'Three high-urgency gaps surfaced this week.',
      payload: { gap_count: 3 },
    });
    expect(ho.status).toBe('pending');
    expect(ho.target_agent).toBe('PlanningAgent');
  });

  it('requires a context_summary', () => {
    const h = new HermesAgent();
    expect(() => h.handoffToAgent({
      tenant_id: TENANT, target_agent: 'PlanningAgent',
      task_kind: 'x', context_summary: '',
    })).toThrow(/context_summary required/);
  });
});

// ── dailyHermesRun end-to-end ────────────────────────────────────

describe('dailyHermesRun', () => {
  it('ingests + extracts + briefs in one call', async () => {
    const h = new HermesAgent();
    const brief = await h.dailyHermesRun({
      tenant_id: TENANT,
      inputs: [
        {
          tenant_id: TENANT, source_url: 'https://edpb',
          source_type: 'regulator',
          title: 'EDPB cross-border transfers deadline',
          summary: 'Enforcement notice; six-month window.',
          topic: 'privacy', market_area: 'privacy',
          time_horizon: '3_months',
        },
        {
          tenant_id: TENANT, source_url: 'https://competitor',
          source_type: 'competitor',
          title: 'OneTrust ships Annex-III scoring',
          summary: 'Competitor moves; pricing likely 4x ours.',
          topic: 'competitor', market_area: 'compliance',
        },
      ],
      classify: (item) => item.source_type === 'regulator'
        ? { signal_type: 'regulatory', recommended_action: 'Schedule a TIA review.' }
        : { signal_type: 'competitor', recommended_action: 'Draft differentiation post.' },
    });
    expect(brief.top_5_signals.length).toBeGreaterThanOrEqual(2);
    expect(h.listKnowledge({ tenant_id: TENANT })).toHaveLength(2);
    expect(h.listSignals({ tenant_id: TENANT })).toHaveLength(2);
  });
});

// ── Safety rules (spec §11) ──────────────────────────────────────

describe('safety rules — Hermes never decides', () => {
  it('every brief is read-only — Hermes does not auto-resolve gaps or signals', () => {
    const h = new HermesAgent();
    h.detectMarketGap({
      tenant_id: TENANT,
      problem: 'x', target_customer: 'y',
      urgency: 'medium', existing_solutions: [],
      why_existing_solutions_fail: 'z',
      automation_potential: 0.5,
      revenue_potential: '0-50k',
      moat_potential: 'none',
      recommended_product_angle: 'q',
    });
    h.createDailyBrief({ tenant_id: TENANT, brief_date: '2026-05-17' });
    const gaps = h.listMarketGaps(TENANT);
    expect(gaps.every(g => g.status === 'open')).toBe(true);
  });

  it('handoffs land in pending — never auto-accepted', () => {
    const h = new HermesAgent();
    const ho = h.handoffToAgent({
      tenant_id: TENANT, target_agent: 'DecisionAgent',
      task_kind: 'pricing_change', context_summary: 'Q3 pricing experiment results.',
    });
    expect(ho.status).toBe('pending');
    expect(ho.resolved_at).toBeNull();
  });
});
