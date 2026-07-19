// HermesAgent — the knowledge + future-research scout.
//
// scan → extract → classify → store → simulate → recommend → brief
//
// In-memory by default with persist-hook for Phase-B Postgres adapter.
// Composable: every step is a public method so an orchestrator can
// drive Hermes piece-by-piece or call dailyHermesRun() for the full
// daily loop.
//
// HARD SAFETY RULE (spec §11):
//   No facts without sources. No prognosis without confidence_score.
//   No automatic business decisions. Hermes recommends + prioritises;
//   DecisionAgent or human gives final approval.

import type {
  KnowledgeItem, MarketGap, FutureSignal, SignalScores,
  HermesSimulation, DailyBrief, HermesHandoff, HermesTargetAgent,
  HermesPersistHook, SignalType, MarketArea, TimeHorizon, RiskLevel,
  SourceType, SimulationAgent,
} from './types';
import { scoreFutureSignal, heuristicScore, opportunityBand } from './futureFishModel';

let _counter = 0;
function nextId(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

/**
 * Lightweight SHA-256 → hex used for content-hash dedup. Works in
 * Node, Deno and the browser via SubtleCrypto.
 */
async function sha256Hex(input: string): Promise<string> {
  const cryptoObj = (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).crypto as Crypto | undefined) ?? null;
  if (cryptoObj?.subtle?.digest) {
    const buf = await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const bytes = new Uint8Array(buf);
    let out = '';
    for (const b of bytes) out += b.toString(16).padStart(2, '0');
    return out;
  }
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(input).digest('hex');
}

// ── HermesAgent ───────────────────────────────────────────────────

export interface HermesAgentOptions {
  hook?: HermesPersistHook | null;
}

export class HermesAgent {
  private knowledge   = new Map<string, KnowledgeItem>();
  private signals     = new Map<string, FutureSignal>();
  private gaps        = new Map<string, MarketGap>();
  private simulations = new Map<string, HermesSimulation>();
  private briefs      = new Map<string, DailyBrief>();        // key = tenant_id|date
  private handoffs    = new Map<string, HermesHandoff>();
  private hook: HermesPersistHook | null;

  constructor(opts: HermesAgentOptions = {}) {
    this.hook = opts.hook ?? null;
  }

  setPersistHook(h: HermesPersistHook | null): void {
    this.hook = h;
  }

  // ── 1. Knowledge ingestion + dedup ────────────────────────────

  /**
   * Ingest a single fact. Deduped by sha256(source_url + title).
   * Returns the persisted item OR the existing one when a duplicate
   * is detected (status stays unchanged on dup).
   */
  async ingestKnowledge(args: {
    tenant_id:        string;
    source_url:       string | null;
    source_type:      SourceType;
    title:            string;
    summary:          string;
    raw_excerpt?:     string;
    topic:            string;
    tags?:            string[];
    relevance_score?: number;
    confidence_score?: number;
    time_horizon?:    TimeHorizon;
    market_area?:     MarketArea;
    risk_level?:      RiskLevel;
    opportunity_type?: KnowledgeItem['opportunity_type'];
    related_agents?:  string[];
  }): Promise<KnowledgeItem> {
    if (!args.title || !args.summary) {
      throw new Error('ingestKnowledge: title and summary required (no facts without sources).');
    }
    const content_hash = await sha256Hex(`${args.source_url ?? ''}::${args.title}`);
    const dupKey = `${args.tenant_id}|${content_hash}`;
    const existing = [...this.knowledge.values()]
      .find(k => k.tenant_id === args.tenant_id && k.content_hash === content_hash);
    if (existing) return existing;

    const item: KnowledgeItem = {
      id:                nextId('know'),
      tenant_id:         args.tenant_id,
      source_url:        args.source_url,
      source_type:       args.source_type,
      title:             args.title,
      summary:           args.summary,
      raw_excerpt:       args.raw_excerpt ?? null,
      topic:             args.topic,
      tags:              args.tags ?? [],
      relevance_score:   clamp01(args.relevance_score ?? 0.5),
      confidence_score:  clamp01(args.confidence_score ?? 0.5),
      time_horizon:      args.time_horizon ?? '6_months',
      market_area:       args.market_area ?? 'compliance',
      risk_level:        args.risk_level ?? 'medium',
      opportunity_type:  args.opportunity_type ?? null,
      related_agents:    args.related_agents ?? [],
      status:            'active',
      content_hash,
      created_at:        new Date().toISOString(),
    };
    this.knowledge.set(item.id, item);
    void this.hook?.saveKnowledge?.(item);
    void dupKey;
    return item;
  }

  listKnowledge(filter: { tenant_id: string; topic?: string; tag?: string; min_relevance?: number; limit?: number }): KnowledgeItem[] {
    const rows = [...this.knowledge.values()].filter(k => {
      if (k.tenant_id !== filter.tenant_id) return false;
      if (filter.topic && k.topic !== filter.topic) return false;
      if (filter.tag && !k.tags.includes(filter.tag)) return false;
      if (filter.min_relevance !== undefined && k.relevance_score < filter.min_relevance) return false;
      return k.status === 'active';
    }).sort((a, b) => b.relevance_score - a.relevance_score);
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }

  // ── 2. Signal extraction (FutureFishModel) ────────────────────

  /**
   * Extract one or more future signals from a knowledge item. The
   * default produces ONE signal of the given type per call; an
   * LLM-driven extractor can override by composing extractSignal()
   * with its own classification step.
   */
  extractSignal(args: {
    knowledge:    KnowledgeItem;
    signal_type:  SignalType;
    title?:       string;
    description?: string;
    recommended_action: string;
    evidence?:    string[];
    market_area?: MarketArea;
    time_horizon?: TimeHorizon;
    score_override?: SignalScores;
  }): FutureSignal {
    const evidence = args.evidence ?? (args.knowledge.source_url ? [args.knowledge.source_url] : []);
    const description = args.description ?? args.knowledge.summary;
    const scores = args.score_override ?? heuristicScore({
      signal_type:  args.signal_type,
      evidence,
      description,
      time_horizon: args.time_horizon ?? args.knowledge.time_horizon,
    });
    const future_opportunity_score = scoreFutureSignal(scores);

    const sig: FutureSignal = {
      id:                       nextId('sig'),
      tenant_id:                args.knowledge.tenant_id,
      title:                    args.title ?? args.knowledge.title,
      description,
      source:                   args.knowledge.source_url ?? args.knowledge.title,
      signal_type:              args.signal_type,
      market_area:              args.market_area ?? args.knowledge.market_area,
      time_horizon:             args.time_horizon ?? args.knowledge.time_horizon,
      evidence,
      ...scores,
      future_opportunity_score,
      recommended_action:       args.recommended_action,
      source_knowledge_id:      args.knowledge.id,
      status:                   'fresh',
      created_at:               new Date().toISOString(),
    };
    this.signals.set(sig.id, sig);
    void this.hook?.saveSignal?.(sig);
    return sig;
  }

  listSignals(filter: { tenant_id: string; min_score?: number; signal_type?: SignalType; limit?: number }): FutureSignal[] {
    const rows = [...this.signals.values()].filter(s => {
      if (s.tenant_id !== filter.tenant_id) return false;
      if (filter.min_score !== undefined && s.future_opportunity_score < filter.min_score) return false;
      if (filter.signal_type && s.signal_type !== filter.signal_type) return false;
      return s.status !== 'dismissed';
    }).sort((a, b) => b.future_opportunity_score - a.future_opportunity_score);
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }

  // ── 3. Market gap detection ───────────────────────────────────

  detectMarketGap(args: Omit<MarketGap, 'id' | 'status' | 'created_at' | 'evidence_item_ids' | 'evidence_signal_ids'> & {
    evidence_item_ids?: string[];
    evidence_signal_ids?: string[];
  }): MarketGap {
    if (!args.problem || !args.target_customer || !args.recommended_product_angle) {
      throw new Error('detectMarketGap: problem, target_customer, recommended_product_angle all required.');
    }
    const gap: MarketGap = {
      id:                          nextId('gap'),
      tenant_id:                   args.tenant_id,
      problem:                     args.problem,
      target_customer:             args.target_customer,
      urgency:                     args.urgency,
      existing_solutions:          args.existing_solutions,
      why_existing_solutions_fail: args.why_existing_solutions_fail,
      automation_potential:        clamp01(args.automation_potential),
      revenue_potential:           args.revenue_potential,
      moat_potential:              args.moat_potential,
      recommended_product_angle:   args.recommended_product_angle,
      evidence_item_ids:           args.evidence_item_ids   ?? [],
      evidence_signal_ids:         args.evidence_signal_ids ?? [],
      status:                      'open',
      created_at:                  new Date().toISOString(),
    };
    this.gaps.set(gap.id, gap);
    void this.hook?.saveMarketGap?.(gap);
    return gap;
  }

  listMarketGaps(tenant_id: string, status?: MarketGap['status']): MarketGap[] {
    return [...this.gaps.values()]
      .filter(g => g.tenant_id === tenant_id)
      .filter(g => !status || g.status === status)
      .sort((a, b) => urgencyRank(b.urgency) - urgencyRank(a.urgency));
  }

  // ── 4. Future simulation ──────────────────────────────────────

  runFutureSimulation(args: {
    tenant_id:                  string;
    agent:                      SimulationAgent;
    scenario_name:              string;
    timeframe:                  TimeHorizon;
    assumptions:                string[];
    expected_market_shift:      string;
    risks:                      string[];
    opportunities:              string[];
    recommended_moves:          string[];
    confidence:                 number;
    triggered_by_signal_id?:    string;
    triggered_by_market_gap_id?: string;
  }): HermesSimulation {
    if (args.assumptions.length === 0) {
      throw new Error('runFutureSimulation: at least one assumption required (non-falsifiable scenarios are not evidence).');
    }
    if (args.confidence < 0 || args.confidence > 1) {
      throw new Error('runFutureSimulation: confidence must be in [0,1].');
    }
    const sim: HermesSimulation = {
      id:                          nextId('sim'),
      tenant_id:                   args.tenant_id,
      agent:                       args.agent,
      scenario_name:               args.scenario_name,
      timeframe:                   args.timeframe,
      assumptions:                 args.assumptions,
      expected_market_shift:       args.expected_market_shift,
      risks:                       args.risks,
      opportunities:               args.opportunities,
      recommended_moves:           args.recommended_moves,
      confidence:                  clamp01(args.confidence),
      triggered_by_signal_id:      args.triggered_by_signal_id      ?? null,
      triggered_by_market_gap_id:  args.triggered_by_market_gap_id  ?? null,
      created_at:                  new Date().toISOString(),
    };
    this.simulations.set(sim.id, sim);
    void this.hook?.saveSimulation?.(sim);
    return sim;
  }

  // ── 5. Daily brief ────────────────────────────────────────────

  createDailyBrief(args: { tenant_id: string; brief_date?: string }): DailyBrief {
    const tenant_id = args.tenant_id;
    const brief_date = args.brief_date ?? new Date().toISOString().slice(0, 10);
    const key = `${tenant_id}|${brief_date}`;
    if (this.briefs.has(key)) return this.briefs.get(key)!;

    const topSignals = this.listSignals({ tenant_id, limit: 5 });
    const topGaps    = this.listMarketGaps(tenant_id, 'open').slice(0, 3);

    // Top 3 risks: signals with high urgency × high risk_level on
    // knowledge → derive from urgency_score.
    const risky = topSignals
      .filter(s => s.urgency_score >= 0.65)
      .slice(0, 3);

    // Competitor moves: signals of signal_type='competitor'.
    const competitor = this.listSignals({ tenant_id, signal_type: 'competitor', limit: 5 });

    // Recommended actions: each top signal gets a `recommended_action`.
    const actions = topSignals.map(s => ({
      action: s.recommended_action,
      for_agent: pickAgentForSignal(s.signal_type),
    }));

    // Watchlist: signals in opportunityBand 'watch'.
    const watchlist = this.listSignals({ tenant_id, limit: 20 })
      .filter(s => opportunityBand(s.future_opportunity_score) === 'watch')
      .map(s => s.title);

    // Ideas to validate: gaps with status='open' AND
    // automation_potential >= 0.5.
    const ideas = this.listMarketGaps(tenant_id, 'open')
      .filter(g => g.automation_potential >= 0.5)
      .slice(0, 5)
      .map(g => `${g.problem} — Angle: ${g.recommended_product_angle}`);

    // Promotion angles: any signal type tied to compliance or privacy.
    const promo = topSignals
      .filter(s => s.market_area === 'compliance' || s.market_area === 'privacy')
      .map(s => s.title);

    const brief: DailyBrief = {
      id:                          nextId('brief'),
      tenant_id,
      brief_date,
      top_5_signals: topSignals.map(s => ({
        id: s.id, title: s.title,
        score: s.future_opportunity_score,
        signal_type: s.signal_type,
      })),
      top_3_market_gaps: topGaps.map(g => ({
        id: g.id, problem: g.problem, urgency: g.urgency,
      })),
      top_3_risks: risky.map(r => ({
        source: r.source, risk: r.recommended_action, horizon: r.time_horizon,
      })),
      competitor_moves: competitor.map(c => ({
        competitor: c.source, move: c.title,
      })),
      recommended_actions_today: actions,
      strategic_watchlist:       watchlist,
      ideas_to_validate:         ideas,
      content_angles_for_promotion: promo,
      created_at: new Date().toISOString(),
    };
    this.briefs.set(key, brief);
    void this.hook?.saveBrief?.(brief);
    return brief;
  }

  getBrief(tenant_id: string, brief_date: string): DailyBrief | null {
    return this.briefs.get(`${tenant_id}|${brief_date}`) ?? null;
  }

  // ── 6. Handoff to other agents ────────────────────────────────

  handoffToAgent(args: {
    tenant_id:              string;
    target_agent:           HermesTargetAgent;
    task_kind:              string;
    context_summary:        string;
    payload?:               Record<string, unknown>;
    source_signal_id?:      string;
    source_market_gap_id?:  string;
  }): HermesHandoff {
    if (!args.context_summary) {
      throw new Error('handoffToAgent: context_summary required.');
    }
    const handoff: HermesHandoff = {
      id:                    nextId('hh'),
      tenant_id:             args.tenant_id,
      target_agent:          args.target_agent,
      task_kind:             args.task_kind,
      context_summary:       args.context_summary,
      payload:               args.payload ?? {},
      source_signal_id:      args.source_signal_id     ?? null,
      source_market_gap_id:  args.source_market_gap_id ?? null,
      status:                'pending',
      created_at:            new Date().toISOString(),
      resolved_at:           null,
    };
    this.handoffs.set(handoff.id, handoff);
    void this.hook?.saveHandoff?.(handoff);
    return handoff;
  }

  // ── 7. Daily run — the full pipeline ─────────────────────────

  /**
   * Run the full daily pipeline against a batch of new inputs. The
   * caller is expected to source `inputs` from external feeds; this
   * function does the agent's work end-to-end given those inputs.
   */
  async dailyHermesRun(args: {
    tenant_id: string;
    inputs:    Array<Parameters<HermesAgent['ingestKnowledge']>[0]>;
    /** Optional: extra (signal_type, recommended_action) overlays per
     *  ingested item — when the caller can classify upstream. */
    classify?: (item: KnowledgeItem) => { signal_type: SignalType; recommended_action: string } | null;
  }): Promise<DailyBrief> {
    const { tenant_id, inputs, classify } = args;

    // 1. Ingest, dedup is implicit.
    const ingested: KnowledgeItem[] = [];
    for (const raw of inputs) {
      ingested.push(await this.ingestKnowledge(raw));
    }

    // 2. Extract a signal per ingested item using the classifier; if
    //    none provided, a default "rising" signal is emitted.
    for (const item of ingested) {
      const cls = classify
        ? classify(item)
        : { signal_type: 'rising' as SignalType, recommended_action: 'Watch for follow-ups in the next 30 days.' };
      if (cls) {
        this.extractSignal({
          knowledge: item,
          signal_type: cls.signal_type,
          recommended_action: cls.recommended_action,
        });
      }
    }

    // 3. Produce the brief.
    return this.createDailyBrief({ tenant_id });
  }

  // ── Test helper ────────────────────────────────────────────────

  __resetForTests(): void {
    this.knowledge.clear();
    this.signals.clear();
    this.gaps.clear();
    this.simulations.clear();
    this.briefs.clear();
    this.handoffs.clear();
    this.hook = null;
    _counter = 0;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function urgencyRank(u: RiskLevel): number {
  return u === 'critical' ? 4 : u === 'high' ? 3 : u === 'medium' ? 2 : 1;
}

function pickAgentForSignal(t: SignalType): HermesTargetAgent {
  switch (t) {
    case 'regulatory':      return 'DecisionAgent';
    case 'competitor':      return 'PromotionAgent';
    case 'customer_pain':   return 'PlanningAgent';
    case 'technology':      return 'ResearchAgent';
    case 'funding':         return 'ResearchAgent';
    case 'platform_shift':  return 'SimulationAgent';
    case 'weak':            return 'ResearchAgent';
    case 'rising':          return 'PlanningAgent';
  }
}

// ── Module-level default Hermes (convenience) ─────────────────────

let _default: HermesAgent | null = null;
export function getDefaultHermes(): HermesAgent {
  if (!_default) _default = new HermesAgent();
  return _default;
}
export function __resetDefaultHermesForTests(): void {
  _default?.__resetForTests();
  _default = null;
}

export { scoreFutureSignal, heuristicScore, opportunityBand };
