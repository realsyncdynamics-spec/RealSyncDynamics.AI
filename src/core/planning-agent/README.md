# PlanningAgent

Strategic-plan agent. Receives Hermes handoffs (signals + market gaps) and turns them into a sequenced, owned, human-reviewed plan. On approval, milestones can be **materialised** as AgentTasks for the assigned agents via the AgentOS substrate.

```
draft → pending_review → approved → active → completed
                       ↘ rejected
                       ↘ needs_revision → (back to draft)
                                          any non-terminal → cancelled
```

**Hard safety rule (spec §12):** PlanningAgent **drafts, decomposes, recommends**. It never auto-activates. The only path to `approved` is `recordReview(decision='approved', reviewer=...)`; the only path to `active` is `activatePlan()` AFTER `approved`.

---

## Three tables

| Table | Role |
|---|---|
| `planning_agent_plans` | One row per strategic plan. Source-tracking (`source_signal_ids[]`, `source_gap_ids[]`, `source_handoff_id`) links back to Hermes. CHECK constraints enforce that `approved` plans have `approved_by + approved_at` and `rejected` plans have `rejected_reason`. |
| `planning_agent_milestones` | Sequenced steps within a plan. May depend on an earlier milestone, may carry `requires_human_review`, may target a specific `assignee_agent` (kebab-case) or `assignee_role` (human). |
| `planning_agent_reviews` | Append-only audit history. One plan can have N reviews across its lifecycle (rejected → revised → approved). |

All RLS-scoped via `memberships`. Reviews are insert-only (no UPDATE policy).

---

## Public surface

```ts
const planning = new PlanningAgent();

// 1. Draft a plan (always starts as 'draft').
const plan = planning.draftPlan({
  tenant_id:        'tenant_abc',
  title:            'Capture DACH regulatory-tech wave',
  objective:        'Convert 25 DACH SaaS customers in next 6 months.',
  priority:         'high',
  owner_agent:      'promotion-agent',
  success_metric:   'MRR > €25k by end of period',
  confidence_score: 0.6,
  source_signal_ids: ['sig_edpb_2026'],
});

// 2. Decompose into milestones.
const m1 = planning.addMilestone({
  plan_id: plan.id,
  title:   'Publish 3 LinkedIn posts on agentic compliance',
  assignee_agent: 'promotion-agent',
});
const m2 = planning.addMilestone({
  plan_id: plan.id,
  title:   'Run pricing simulation at €399/mo',
  assignee_agent: 'hermes-agent',
  depends_on_milestone_id: m1.id,
});
const m3 = planning.addMilestone({
  plan_id: plan.id,
  title:   'Sign off on Q3 budget',
  assignee_role: 'founder',
  requires_human_review: true,
});

// 3. Request human review.
planning.requestReview({ plan_id: plan.id });

// 4. Human approves (or rejects with notes).
planning.recordReview({
  plan_id:         plan.id,
  decision:        'approved',
  reviewer:        'founder@realsync',
  reviewer_user_id: '550e8400-…',
});

// 5. Activate — bridges to AgentOS by emitting one AgentTask per
//    agent-assigned milestone.
import { AgentOsStore } from '@/src/core/agent-os/store';
const store = new AgentOsStore();
planning.activatePlan(plan.id, { orchestratorStore: store });

// → store.nextOpenTask() now returns m1's materialised task.
//   m1.materialised_task_id is set; m1.status = 'active'.
//   m3 (human-only) stays 'pending', no task created.

// 6. Mark milestones complete as work progresses.
planning.markMilestone(m1.id, 'done');
planning.markMilestone(m2.id, 'done');
planning.markMilestone(m3.id, 'done');
// → plan auto-flips to 'completed' (every milestone terminal-success).
```

### Hermes handoff bridge

```ts
const plan = planning.draftFromHermesHandoff({
  id:               'hh_lm5yh_6',
  tenant_id:        'tenant_abc',
  target_agent:     'promotion-agent',
  task_kind:        'content_from_trend',
  context_summary:  'Three rising signals about agentic compliance.',
  payload:          { signal_ids: ['sig_1', 'sig_2'] },
  source_signal_id: null,
  source_market_gap_id: null,
});
// plan.status === 'draft'        — still needs decomposition + review
// plan.source_handoff_id         === 'hh_lm5yh_6'
// plan.source_signal_ids         === ['sig_1', 'sig_2']
// plan.owner_agent               === 'promotion-agent'
```

---

## Files

```
src/core/planning-agent/
├── README.md
├── types.ts             3 record types + persist-hook
└── planning.ts          PlanningAgent class — 9 verbs

supabase/migrations/
└── 20260528000000_planning_agent.sql   3 tables + RLS

test/core/planning-agent/
└── planning.test.ts     26 unit tests
```

---

## Out of scope (Phase B)

- Postgres adapter implementing `PlanningPersistHook`
- Milestone dependency-aware scheduling (today: tasks are created at activation; orchestrator sees them in sequence-order but doesn't honour `depends_on` semantically — that's the Orchestrator's job to add)
- Auto-recall on stale plans (target_date elapsed, no progress) — a cron in Phase B
- A LLM-graded `confidence_score` (currently caller-supplied or default 0.5)
