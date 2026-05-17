// HermesAgent — types.
//
// Mirrors the 6 tables in supabase/migrations/<ts>_hermes_agent.sql.
// Pure type definitions; the operational APIs live in
// futureFishModel.ts + hermes.ts.

// ── Enums ──────────────────────────────────────────────────────────

export type SourceType =
  | 'eu_ai_act' | 'dsgvo' | 'regulator'
  | 'saas_news' | 'ai_news'
  | 'github' | 'product_hunt' | 'hacker_news' | 'reddit' | 'linkedin'
  | 'competitor' | 'pricing' | 'funding'
  | 'legaltech' | 'regtech'
  | 'other';

export type SignalType =
  | 'weak' | 'rising' | 'regulatory' | 'competitor'
  | 'customer_pain' | 'technology' | 'funding' | 'platform_shift';

export type MarketArea =
  | 'compliance' | 'ai' | 'privacy' | 'saas' | 'enterprise'
  | 'legaltech' | 'regtech' | 'fintech' | 'marketing' | 'other';

export type TimeHorizon = '3_months' | '6_months' | '12_months' | '24_months';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type OpportunityType =
  | 'product' | 'distribution' | 'pricing' | 'automation' | null;

export type MoatPotential =
  | 'network' | 'data' | 'regulatory' | 'timing' | 'none';

export type RevenueBucket = '0-50k' | '50-250k' | '250k-1m' | '1m+';

export type SimulationAgent =
  | 'MarketSimulationAgent'
  | 'RegulationSimulationAgent'
  | 'CompetitorSimulationAgent'
  | 'CustomerPainSimulationAgent'
  | 'PricingSimulationAgent'
  | 'ProductStrategyAgent'
  | 'RiskSimulationAgent'
  | 'PromotionAgent'
  | 'DecisionAgent';

// ── 1. KnowledgeItem ───────────────────────────────────────────────

export interface KnowledgeItem {
  id:               string;
  tenant_id:        string;
  source_url:       string | null;
  source_type:      SourceType;
  title:            string;
  summary:          string;
  raw_excerpt:      string | null;
  topic:            string;
  tags:             string[];
  relevance_score:  number;       // 0..1
  confidence_score: number;       // 0..1
  time_horizon:     TimeHorizon;
  market_area:      MarketArea;
  risk_level:       RiskLevel;
  opportunity_type: OpportunityType;
  related_agents:   string[];
  status:           'active' | 'superseded' | 'redacted' | 'archived';
  content_hash:     string;
  created_at:       string;
}

// ── 2. MarketGap ───────────────────────────────────────────────────

export interface MarketGap {
  id:                          string;
  tenant_id:                   string;
  problem:                     string;
  target_customer:             string;
  urgency:                     RiskLevel;
  existing_solutions:          Array<{ name: string; gap: string }>;
  why_existing_solutions_fail: string;
  automation_potential:        number;  // 0..1
  revenue_potential:           RevenueBucket | null;
  moat_potential:              MoatPotential;
  recommended_product_angle:   string;
  evidence_item_ids:           string[];
  evidence_signal_ids:         string[];
  status:                      'open' | 'validating' | 'validated' | 'dismissed' | 'converted';
  created_at:                  string;
}

// ── 3. FutureSignal ────────────────────────────────────────────────

export interface SignalScores {
  novelty_score:       number;   // 0..1
  urgency_score:       number;
  monetization_score:  number;
  defensibility_score: number;
  timing_score:        number;
  evidence_score:      number;
}

export interface FutureSignal extends SignalScores {
  id:                          string;
  tenant_id:                   string;
  title:                       string;
  description:                 string;
  source:                      string;
  signal_type:                 SignalType;
  market_area:                 MarketArea;
  time_horizon:                TimeHorizon;
  evidence:                    string[];
  future_opportunity_score:    number;   // 0..1, deterministic aggregate
  recommended_action:          string;
  source_knowledge_id:         string | null;
  status:                      'fresh' | 'watched' | 'elevated' | 'dismissed' | 'converted';
  created_at:                  string;
}

// ── 4. Simulation ──────────────────────────────────────────────────

export interface HermesSimulation {
  id:                          string;
  tenant_id:                   string;
  agent:                       SimulationAgent;
  scenario_name:               string;
  timeframe:                   TimeHorizon;
  assumptions:                 string[];
  expected_market_shift:       string;
  risks:                       string[];
  opportunities:               string[];
  recommended_moves:           string[];
  confidence:                  number;    // 0..1
  triggered_by_signal_id:      string | null;
  triggered_by_market_gap_id:  string | null;
  created_at:                  string;
}

// ── 5. DailyBrief ──────────────────────────────────────────────────

export interface DailyBrief {
  id:                          string;
  tenant_id:                   string;
  brief_date:                  string;    // ISO date (YYYY-MM-DD)
  top_5_signals:               Array<{ id: string; title: string; score: number; signal_type: SignalType }>;
  top_3_market_gaps:           Array<{ id: string; problem: string; urgency: RiskLevel }>;
  top_3_risks:                 Array<{ source: string; risk: string; horizon: TimeHorizon }>;
  competitor_moves:            Array<{ competitor: string; move: string }>;
  recommended_actions_today:   Array<{ action: string; for_agent: string }>;
  strategic_watchlist:         string[];
  ideas_to_validate:           string[];
  content_angles_for_promotion: string[];
  created_at:                  string;
}

// ── 6. HermesHandoff ───────────────────────────────────────────────

export type HermesTargetAgent =
  | 'PlanningAgent'
  | 'PromotionAgent'
  | 'ResearchAgent'
  | 'SimulationAgent'
  | 'DecisionAgent'
  | 'TrainerAgent';

export interface HermesHandoff {
  id:                          string;
  tenant_id:                   string;
  target_agent:                HermesTargetAgent;
  task_kind:                   string;
  context_summary:             string;
  payload:                     Record<string, unknown>;
  source_signal_id:            string | null;
  source_market_gap_id:        string | null;
  status:                      'pending' | 'accepted' | 'rejected' | 'completed';
  created_at:                  string;
  resolved_at:                 string | null;
}

// ── Persistence hook ───────────────────────────────────────────────

export interface HermesPersistHook {
  saveKnowledge?:   (k: KnowledgeItem)     => Promise<void> | void;
  saveSignal?:      (s: FutureSignal)      => Promise<void> | void;
  saveMarketGap?:   (g: MarketGap)         => Promise<void> | void;
  saveSimulation?:  (s: HermesSimulation)  => Promise<void> | void;
  saveBrief?:       (b: DailyBrief)        => Promise<void> | void;
  saveHandoff?:     (h: HermesHandoff)     => Promise<void> | void;
}
