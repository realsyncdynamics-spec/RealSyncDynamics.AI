# DecisionAgent

The policy layer on top of the AgentOS `agent_decisions` table. Reviews proposed decisions, applies a per-tenant policy + a non-negotiable hard-rule layer, and either:

- **auto-approves** (if everything passes)
- **escalates** to a named human owner with an SLA
- **rejects** (only via explicit hard rules — kill-switch path)

DecisionAgent does **not** own a decisions table — those live in `agent_decisions` (AgentOS substrate). This package ships two satellite tables: per-tenant policy + an append-only routing audit log.

```
            ┌──────────────────┐
proposed →  │  DecisionAgent   │  →  auto_approved (status='approved')
            │  classify()      │  →  escalated     (status='proposed', routed)
            └──────────────────┘  →  rejected      (status='rejected')
                    │
                    └───►  decision_agent_routings  (append-only audit)
```

**Hard safety rule (spec §13):** DecisionAgent **never** auto-approves:

- `risk_level` in `{ 'high', 'critical' }`
- `reversibility = 'irreversible'`
- when `policy.paused = true` (kill-switch)
- when `confidence < policy.auto_approve_confidence_floor`

These are **code-enforced**, not policy-configurable. The per-tenant policy can only *tighten* the rules, never loosen them.

---

## Two tables

| Table | Role |
|---|---|
| `decision_agent_policies` | One row per tenant. Routing rules: confidence floor, risk + reversibility whitelists, default SLA, default owner. `paused = true` is the panic-button kill-switch. |
| `decision_agent_routings` | Append-only audit log. One row per touch (action ∈ `auto_approved` / `escalated` / `rejected` / `overdue` / `superseded`). Snapshots the risk/reversibility/confidence at routing time for replay. |

Policies: owner-only writes via RLS. Routings: insert-only (no UPDATE/DELETE policy).

---

## Public surface

```ts
import { DecisionAgent } from '@/src/core/decision-agent/decision';
import { AgentOsStore } from '@/src/core/agent-os/store';

const store  = new AgentOsStore();
const agent  = new DecisionAgent();

// 1. Set per-tenant policy (optional — defaults work for most cases).
agent.setPolicy('tenant_abc', {
  auto_approve_confidence_floor: 0.8,
  auto_approve_risk_levels:      ['low'],
  default_owner_user_id:         '550e8400-…',
  default_owner_handle:          '@founder',
  default_sla_hours:             4,
});

// 2. Some upstream agent proposes a decision.
const proposal = store.proposeDecision({
  tenant_id:       'tenant_abc',
  decision_title:  'Bump enterprise tier price to €299/mo',
  problem:         'Mid-market is under-monetised; competitors at €350+.',
  options:         [
    { label: 'bump-to-299', pros: ['+€2k MRR'], cons: ['churn risk'] },
    { label: 'hold',        pros: ['stability'], cons: ['miss window'] },
  ],
  recommendation:  'bump-to-299',
  reason:          'PricingSimulationAgent: 6mo simulation showed +€2.4k MRR.',
  risk_level:      'medium',
  reversibility:   'reversible',
  proposed_by:     'pricing-simulation-agent',
});

// 3. DecisionAgent reviews — picks auto-approve, escalate, or reject.
const outcome = agent.review(store, {
  decision_id:     proposal.id,
  self_confidence: 0.92,
});

// → outcome.action === 'escalated'  (risk='medium' is not in default whitelist)
// → outcome.routing.due_by          ISO timestamp = now + 4h
// → outcome.routing.routed_to_user_id === '550e8400-…'
// → store.listDecisions(...)[0].status === 'proposed' (awaiting human)

// 4. Later: the human responds via the store.
store.resolveDecision(proposal.id, 'approved', '550e8400-…');

// 5. Periodic SLA sweep.
const overdue = agent.sweepOverdue(store, 'tenant_abc');
// → returns one 'overdue' routing per decision whose due_by elapsed.

// 6. Audit reads.
agent.routingsFor(proposal.id);                 // every touch on this decision
agent.routingsByTenant('tenant_abc', 'escalated');
```

---

## Files

```
src/core/decision-agent/
├── README.md
├── types.ts                    DecisionPolicy + RoutingRecord +
│                                PLATFORM_DEFAULT_POLICY +
│                                FORBIDDEN_AUTO_APPROVE_RISK +
│                                FORBIDDEN_AUTO_APPROVE_REVERSIBILITY
└── decision.ts                 DecisionAgent class — 8 verbs

supabase/migrations/
└── 20260529000000_decision_agent.sql   2 tables + RLS + 1 trigger

test/core/decision-agent/
└── decision.test.ts            27 unit tests
```

---

## Out of scope (Phase B)

- Postgres adapter implementing `DecisionPersistHook`
- Real notification fanout on escalation (Slack/Email — today the routing just records who SHOULD be notified)
- Auto-rejection on hard rule violations beyond the kill-switch (e.g., "this decision touches `evidence.modify` and the policy forbids it" — not implemented; today the rule check is in code, not data-driven)
- Cross-tenant policy templates (each tenant gets its own row today)
- LLM-graded `self_confidence` (currently caller-supplied)
- Dashboard surface showing the routing log (admin UI follow-up)
