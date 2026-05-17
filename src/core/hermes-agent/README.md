# HermesAgent

The platform's knowledge + future-research scout. HermesAgent ingests public-source knowledge daily, runs every item through the **FutureFishModel**, detects market gaps, runs simulations, and emits a daily brief.

```
scan → extract → classify → store → simulate → recommend → brief
```

**Hard safety rule (spec §11):** Hermes **recommends, prioritises, simulates**. He never makes binding business decisions. Every market-gap stays `open` until a human resolves it; every handoff stays `pending` until the target agent accepts; every prognosis carries an explicit `confidence_score`.

---

## Six tables (Phase A: migration shipped + in-memory store)

| Table | Role |
|---|---|
| `hermes_knowledge_items` | Daily knowledge captures, deduped by `sha256(source_url + title)` |
| `hermes_future_signals` | FutureFishModel scores per signal, with deterministic `future_opportunity_score` aggregate |
| `hermes_market_gaps` | Detected gaps with `problem`, `target_customer`, `recommended_product_angle`, `automation_potential`, `moat_potential` |
| `hermes_simulations` | Scenario outputs from any of 9 specialised simulation agents |
| `hermes_daily_briefs` | One brief per `(tenant_id, brief_date)` — top signals, gaps, risks, competitor moves, actions |
| `hermes_agent_handoffs` | Tasks Hermes hands off to PlanningAgent / PromotionAgent / etc. |

All tables `ENABLE ROW LEVEL SECURITY` via memberships.

---

## FutureFishModel — six dimensions

| Dimension | Default weight |
|---|---|
| `novelty_score` | 15 |
| `urgency_score` | 22 |
| `monetization_score` | 22 |
| `defensibility_score` | 13 |
| `timing_score` | 18 |
| `evidence_score` | 10 |

Weights favour signals that **could monetise soon** (urgency + monetization + timing) over signals that are merely novel.

`heuristicScore()` produces a baseline `SignalScores` from `(signal_type, evidence, description, time_horizon)`. For real production use, swap in an LLM-graded scorer via the `score_override` argument of `extractSignal()`.

`opportunityBand()` maps the aggregate to `top` (≥0.70) / `watch` (0.50–0.69) / `background` (<0.50) for UI surfacing.

---

## Eight signal types

```
weak  ·  rising  ·  regulatory  ·  competitor
customer_pain  ·  technology  ·  funding  ·  platform_shift
```

Each type has a baseline weight per dimension (e.g., `regulatory` boosts urgency + defensibility; `customer_pain` boosts monetization + timing).

---

## Public surface

```ts
const hermes = new HermesAgent();

// 1. Ingest knowledge (dedup is implicit).
const k = await hermes.ingestKnowledge({
  tenant_id: 'tenant_abc',
  source_url: 'https://edpb.europa.eu/news/...',
  source_type: 'regulator',
  title: 'EDPB enforcement deadline for cross-border transfers',
  summary: 'Six-month notice issued. Sanctions likely for non-compliant exports.',
  topic: 'privacy',
  market_area: 'privacy',
  time_horizon: '3_months',
});

// 2. Extract a signal.
const sig = hermes.extractSignal({
  knowledge: k,
  signal_type: 'regulatory',
  recommended_action: 'Schedule a TIA review for every cross-border processor.',
  time_horizon: '3_months',
});
// sig.future_opportunity_score → 0..1, deterministic

// 3. Detect a market gap.
const gap = hermes.detectMarketGap({
  tenant_id: 'tenant_abc',
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

// 4. Run a simulation.
const sim = hermes.runFutureSimulation({
  tenant_id: 'tenant_abc',
  agent: 'PricingSimulationAgent',
  scenario_name: 'Move enterprise tier to €299/mo',
  timeframe: '6_months',
  assumptions: ['No competitor matches under €350'],
  expected_market_shift: 'Mid-market enterprises trade up.',
  risks: ['churn spike on €99 tier'],
  opportunities: ['margin uplift'],
  recommended_moves: ['Grandfather existing accounts for 6 months'],
  confidence: 0.65,
});

// 5. Daily brief.
const brief = hermes.createDailyBrief({ tenant_id: 'tenant_abc' });
// → top_5_signals, top_3_market_gaps, top_3_risks, competitor_moves,
//   recommended_actions_today, strategic_watchlist, ideas_to_validate,
//   content_angles_for_promotion

// 6. Hand off to another agent.
hermes.handoffToAgent({
  tenant_id: 'tenant_abc',
  target_agent: 'PromotionAgent',
  task_kind: 'content_from_trend',
  context_summary: 'Three rising signals about agentic compliance need a LinkedIn post.',
  payload: { signal_ids: [sig.id] },
});

// 7. One-shot daily pipeline.
const brief2 = await hermes.dailyHermesRun({
  tenant_id: 'tenant_abc',
  inputs: [...],          // ingest these in one call
  classify: (item) => ({  // optional classifier per item
    signal_type: 'regulatory',
    recommended_action: 'Watch enforcement updates.',
  }),
});
```

---

## Example payloads

### KnowledgeItem
```json
{
  "id": "know_lm5yh_1",
  "tenant_id": "tenant_abc",
  "source_url": "https://edpb.europa.eu/news/...",
  "source_type": "regulator",
  "title": "EDPB enforcement deadline for cross-border transfers",
  "summary": "Six-month notice...",
  "raw_excerpt": null,
  "topic": "privacy",
  "tags": [],
  "relevance_score": 0.5,
  "confidence_score": 0.5,
  "time_horizon": "3_months",
  "market_area": "privacy",
  "risk_level": "medium",
  "opportunity_type": null,
  "related_agents": [],
  "status": "active",
  "content_hash": "9c7d…",
  "created_at": "2026-05-17T00:00:00.000Z"
}
```

### FutureSignal
```json
{
  "id": "sig_lm5yh_2",
  "tenant_id": "tenant_abc",
  "title": "EDPB enforcement deadline for cross-border transfers",
  "description": "Six-month notice...",
  "source": "https://edpb.europa.eu/news/...",
  "signal_type": "regulatory",
  "market_area": "privacy",
  "time_horizon": "3_months",
  "evidence": ["https://edpb.europa.eu/news/..."],
  "novelty_score":       0.55,
  "urgency_score":       0.90,
  "monetization_score":  0.80,
  "defensibility_score": 0.75,
  "timing_score":        0.80,
  "evidence_score":      0.55,
  "future_opportunity_score": 0.74,
  "recommended_action": "Schedule a TIA review for every cross-border processor.",
  "source_knowledge_id": "know_lm5yh_1",
  "status": "fresh",
  "created_at": "2026-05-17T00:00:00.000Z"
}
```

### MarketGap
```json
{
  "id": "gap_lm5yh_3",
  "tenant_id": "tenant_abc",
  "problem": "Pre-consent tracker audits take weeks",
  "target_customer": "DACH SaaS companies with > 50 employees",
  "urgency": "high",
  "existing_solutions": [{ "name": "OneTrust", "gap": "No continuous detection" }],
  "why_existing_solutions_fail": "Static scans miss drift.",
  "automation_potential": 0.8,
  "revenue_potential": "250k-1m",
  "moat_potential": "data",
  "recommended_product_angle": "Continuous-detection runtime + evidence anchor.",
  "evidence_item_ids": [],
  "evidence_signal_ids": [],
  "status": "open",
  "created_at": "2026-05-17T00:00:00.000Z"
}
```

### DailyBrief (shortened)
```json
{
  "id": "brief_lm5yh_5",
  "tenant_id": "tenant_abc",
  "brief_date": "2026-05-17",
  "top_5_signals": [
    { "id": "sig_…", "title": "EDPB …", "score": 0.74, "signal_type": "regulatory" },
    { "id": "sig_…", "title": "OneTrust ships Annex-III scoring", "score": 0.61, "signal_type": "competitor" }
  ],
  "top_3_market_gaps": [
    { "id": "gap_…", "problem": "Pre-consent tracker audits take weeks", "urgency": "high" }
  ],
  "top_3_risks": [
    { "source": "https://edpb…", "risk": "Schedule a TIA review…", "horizon": "3_months" }
  ],
  "competitor_moves": [
    { "competitor": "https://competitor", "move": "OneTrust ships Annex-III scoring" }
  ],
  "recommended_actions_today": [
    { "action": "Schedule a TIA review…", "for_agent": "DecisionAgent" }
  ],
  "strategic_watchlist": [ ],
  "ideas_to_validate":  [ "Pre-consent tracker audits — Angle: Continuous-detection runtime + evidence anchor." ],
  "content_angles_for_promotion": [ "EDPB enforcement deadline for cross-border transfers" ],
  "created_at": "2026-05-17T00:00:00.000Z"
}
```

### HermesHandoff
```json
{
  "id": "hh_lm5yh_6",
  "tenant_id": "tenant_abc",
  "target_agent": "PromotionAgent",
  "task_kind": "content_from_trend",
  "context_summary": "Three rising signals about agentic compliance need a LinkedIn post.",
  "payload": { "signal_ids": ["sig_…"] },
  "source_signal_id": null,
  "source_market_gap_id": null,
  "status": "pending",
  "created_at": "2026-05-17T00:00:00.000Z",
  "resolved_at": null
}
```

---

## Files

```
src/core/hermes-agent/
├── README.md
├── types.ts             6 record types + persist-hook
├── futureFishModel.ts   pure scoring (scoreFutureSignal +
│                         heuristicScore + opportunityBand)
└── hermes.ts            HermesAgent class — the 7 spec verbs

supabase/migrations/
└── 20260527000000_hermes_agent.sql   6 tables + RLS

test/core/hermes-agent/
└── hermes.test.ts       ~20 unit tests
```

---

## Out of scope (Phase B)

- Live source scrapers (EDPB / EUR-Lex / GitHub trending / Reddit / etc.)
- LLM-graded scorer (currently `heuristicScore` baseline + content cues)
- Postgres adapter implementing `HermesPersistHook`
- Cron scheduling (`dailyHermesRun()` is callable; the runner is a follow-up)
- Hand-off RECEIVERS — TrainerAgent / SocialOrchestrator (#272) / etc. need to accept these as their AgentOS substrate tasks
