# MonitoringAgent

SLO-defined observability over the AgentOS event stream. Per-tenant SLOs against five metric types; each evaluation emits at most one `agent_observations` row per (SLO, window-bucket).

```
SLO definitions  →  evaluate()  →  measure metric  →  emit observation
                                                       (via AgentOsStore)
```

**Hard safety rule (spec §14):** MonitoringAgent **observes and reports**. It never pauses agents, never modifies tasks, never auto-resolves anything. Observations land in the existing `agent_observations` table; humans (or DecisionAgent) decide what to do.

## Five metrics

| Metric | What it counts | Comparator | Typical threshold |
|---|---|---|---|
| `task_failure_rate` | failed / (done + failed) in window | `gt` | 0.05 (5 %) |
| `decision_escalation_rate` | escalated / total routed in window | `gt` | 0.30 |
| `task_open_count` | current count of `open` tasks | `gt` | 50 |
| `task_blocked_count` | current count of `blocked` tasks | `gt` | 5 |
| `observation_unack_count` | high+critical unacked observations | `gt` | 3 |

`window_hours` only applies to rate metrics. Count metrics ignore it.

## One table

`monitoring_agent_slos` — per-tenant SLO definitions. Members read; owners + admins write. RLS via memberships.

The agent does **not** ship an alerts table — alerts are observations in the AgentOS substrate, which keeps the audit-and-acknowledgement surface single-sourced.

## Public surface

```ts
import { MonitoringAgent } from '@/src/core/monitoring-agent/monitoring';
import { AgentOsStore } from '@/src/core/agent-os/store';

const store      = new AgentOsStore();
const monitoring = new MonitoringAgent();

// 1. Define an SLO.
monitoring.defineSlo({
  tenant_id:      'tenant_abc',
  name:           'promotion-agent failure rate',
  agent:          'promotion-agent',
  metric:         'task_failure_rate',
  comparator:     'gt',
  threshold:      0.05,
  window_hours:   24,
  alert_severity: 'high',
});

// 2. Periodically evaluate (cron, on tick, ...).
const results = monitoring.evaluate(store, 'tenant_abc');
// → [{ slo_id, slo_name, observed, threshold, breached, observation_id, ... }]

// 3. Optional: decision-escalation SLOs need a routings callback.
import { DecisionAgent } from '@/src/core/decision-agent/decision';
const decision = new DecisionAgent();
monitoring.evaluate(store, 'tenant_abc', {
  decisionRoutingsByTenant: (tid) => decision.routingsByTenant(tid),
});
```

### Idempotency

Each SLO breach emits one observation per `window_hours`-bucket. Re-running `evaluate()` in the same bucket adds nothing. Crossing into the next bucket allows a fresh observation if the breach persists.

## Files

```
src/core/monitoring-agent/
├── README.md
├── types.ts                SloDefinition + EvaluationResult + persist-hook
└── monitoring.ts           MonitoringAgent class — defineSlo, setEnabled,
                            listSlos, evaluate, private measure + bucket

supabase/migrations/
└── 20260530000000_monitoring_agent.sql   1 table + RLS

test/core/monitoring-agent/
└── monitoring.test.ts      16 unit tests
```

## Out of scope (Phase B)

- Postgres adapter for `MonitoringPersistHook`
- Cron scheduling — `evaluate()` is callable; the runner is a follow-up
- Custom metrics via SQL — today the metric set is closed (5)
- Notifications (Slack/email) — observations are the audit surface; an OutputAgent or similar wires fan-out
- Anomaly detection beyond rule-based SLOs (ML-driven baselines) — Phase C
