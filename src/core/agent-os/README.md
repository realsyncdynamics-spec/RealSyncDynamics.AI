# Agent OS — Substrate

The 7-table foundation that turns isolated agents into a multi-agent operating system. Memory + Tasks + Decisions + immutable audit (Inputs / Outputs / Observations / Events).

This is **Phase A**: in-memory implementation with a persistence hook + a Postgres-schema migration that the Phase-B adapter can fill.

```
observe → analyze → propose → execute → verify → store
```

---

## The 7 tables

| Table | Role | Append-only? |
|---|---|---|
| `agent_memory` | Structured retrievable facts. NOT chat history. Each row has topic / tags / importance / status. | No (supports `supersede`) |
| `agent_tasks` | Task queue. State machine: `open → in_progress → done | failed | blocked | cancelled`. | No (status updates) |
| `agent_decisions` | Decision proposals. Status flips `proposed → approved | rejected | withdrawn` **only on explicit human/DecisionAgent action**. | No (status updates) |
| `agent_inputs` | Every external input the OS observes. Replay substrate. | **Yes** |
| `agent_outputs` | Every agent emission. Trainer's reviews reference these by `task_id`. | **Yes** |
| `agent_observations` | Monitor-agent surface for "noticed something, not yet escalated". `acknowledged` flips false → true. | No (ack only) |
| `agent_events` | Monotonic `BIGSERIAL` state-machine event log. The replay surface. | **Yes** |

Hard safety rule (mirrors trainer-agent §12): **the OS never auto-approves decisions**. A proposal stays in `status='proposed'` until `resolveDecision(id, 'approved', user_id)` is called by an authorised actor.

---

## Files

```
src/core/agent-os/
├── README.md
├── types.ts          11 record types + AgentOsPersistHook interface
├── store.ts          AgentOsStore — in-memory, hook-pluggable
└── orchestrator.ts   Orchestrator — register agents, run tasks, drain queue

supabase/migrations/
└── 20260526000000_agent_os_substrate.sql   7 tables + RLS + triggers

test/core/agent-os/
└── agent-os.test.ts  29 unit tests
```

---

## Quick-start

```ts
import { Orchestrator } from '@/src/core/agent-os/orchestrator';

const orch = new Orchestrator();   // owns an AgentOsStore

// 1. Register handlers per agent name (the names match what
//    trainer-agent's AgentRole expects).
orch.registerAgent('research-agent', async (ctx) => {
  // ctx.task carries the task, ctx.store gives full Agent OS access.
  ctx.observe({
    category: 'research',
    severity: 'info',
    title: 'Source candidates found',
    detail: '3 sources for the brief',
    data: { count: 3 },
  });

  return {
    content: { findings: ['fact 1', 'fact 2'] },
    self_confidence: 80,
    evidence: ['evt_01', 'evt_02'],
  };
});

// 2. Push a task into the queue.
const task = orch.store.createTask({
  tenant_id: 'tenant_abc',
  agent: 'research-agent',
  task: 'Brief on pre-consent tracking enforcement',
  priority: 'high',
  input: { region: 'DE' },
});

// 3. Run.
const result = await orch.run(task.id);
// result.status === 'done'
// orch.store.listOutputsForTask(task.id) → the agent's output record
// orch.store.listEvents({ tenant_id: 'tenant_abc' }) → full replay tape
```

`orch.drain()` processes every open task across all tenants in priority order.

---

## Handler contract

A handler is a function that receives a `HandlerContext` and returns a `HandlerResult`:

```ts
type AgentHandler = (ctx: HandlerContext) => Promise<HandlerResult> | HandlerResult;

interface HandlerContext {
  task:    AgentTask;       // assignee + input
  store:   AgentOsStore;    // full access
  observe: (...)   => AgentObservation;     // record_observation convenience
  propose: (...)   => DecisionProposal;     // propose_decision convenience
}

interface HandlerResult {
  content:          unknown;
  self_confidence?: number;            // 0..100
  evidence?:        string[];          // evidence-chain link ids
  risk_dimensions?: string[];
  outcome?:         'done' | 'blocked' | 'failed';   // default 'done'
  reason?:          string;            // for blocked / failed
}
```

If the handler throws, the orchestrator marks the task `failed` with the error message as `blocker_reason`. The output record is still written, so the trainer can inspect failed runs.

---

## Why memory is structured, not chat history

The substrate's `agent_memory` is intentionally NOT a chat log. Every row has:

- `topic` — short subject label for retrieval
- `tags` — array, GIN-indexed
- `importance` — 1..5
- `status` — `active | superseded | redacted` (no hard delete)
- `decided_action` — what gets done next, if anything
- `responsible_agent` — who owns the follow-up

So an LLM agent recovering context for a tenant doesn't replay an unbounded chat tape — it queries by `topic` + `tag` + `min_importance` and gets a 10-row digest.

---

## Decision lifecycle (no auto-approval)

```
                    proposeDecision()
                          ↓
              ┌──────────────────────────┐
              │   status: 'proposed'      │
              └──┬──────────┬───────┬────┘
                 │          │       │
   resolveDecision('approved', user_id)
                 │          │
                 ▼          ▼       ▼
            approved   rejected  withdrawn
```

`resolveDecision` requires an `approver_user_id` to move to `approved`. The store throws if anything other than a `proposed` decision is resolved twice. The Postgres RLS policy mirrors this: only owners/admins can `UPDATE` `agent_decisions`.

---

## Events / replay

Every mutation emits exactly one `AgentEvent` row with a monotonic `id`. To replay a tenant's runtime up to a point:

```ts
const tape = store.listEvents({ tenant_id, from_id: cursor, limit: 1000 });
for (const ev of tape) {
  // apply ev.event_type to a sink (rehydrate UI, audit-export, etc.)
}
```

Postgres-side this is a `BIGSERIAL` ordered scan — fast and `seq`-stable across deploys.

---

## Out of scope (Phase B)

- **Postgres adapter** — the `AgentOsPersistHook` interface is there; a Phase-B implementation fills the 7 callbacks. The migration in this PR creates the tables but doesn't wire them.
- **Cron-scheduled tasks** — `agent_tasks` rows are created by callers today. A scheduler that creates recurring tasks per agent comes later.
- **Distributed orchestration** — the in-memory orchestrator is single-process. Phase B uses Supabase Realtime or NATS for cross-process delivery.
- **Built-in agents** — only the substrate ships here. The 8 role-specific agents (Research / Memory / Planning / Simulation / Promotion / Monitoring / Decision / Output) + HermesAgent + TrainerAgent register against this substrate in follow-up PRs.

## Roadmap dependency

This PR is the foundation per the user's bottom-up build order:

```
1. Memory-System       ✅ this PR
2. Task-System         ✅ this PR
3. Monitoring-Agent    ⏭ next PR (registers a handler)
4. Research-Agent      ⏭
5. Planning-Agent      ⏭
6. Promotion-Agent     ⏭
7. Simulation-Agent    ⏭
8. Decision-Agent      ⏭
9. Orchestrator        ✅ thin scaffold in this PR; full features later
```

`TrainerAgent` (#304) and the SocialOrchestrator (#272) already exist and can plug into this substrate via a small wrapper handler.
