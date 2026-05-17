# OrchestratorRunner

The cron entry point for the multi-agent OS. Bundles three periodic per-tenant operations into one report and exposes them via a Bearer-authenticated Edge Function for pg_cron.

```
hourly  → monitoring.evaluate() + decision.sweepOverdue()
daily   → hermes.dailyHermesRun() + monitoring.evaluate() + decision.sweepOverdue()
```

**Hard safety rule:** the runner is a SCHEDULER, not a decider. Every agent it calls is itself §-safety-bound:
- Hermes (§11) only emits briefs + handoffs that stay `pending`
- Monitoring (§14) only emits observations, never acts on them
- Decision (§13) only auto-approves what its hard-rule + policy layer permits

The runner adds no new decision-making — it only schedules.

## Files

```
src/core/orchestrator-runner/
├── README.md
├── types.ts          RunReport + PerTenantRunReport + RunCadence
└── runner.ts         runHourly() + runDaily() + structural agent interfaces

supabase/functions/agent-os-runner/
└── index.ts          Edge Function: Bearer auth via Vault → runner

supabase/migrations/
└── 20260531000000_agent_os_runner_cron.sql   pg_cron @ '0 * * * *' + '0 6 * * *'

test/core/orchestrator-runner/
└── runner.test.ts    10 unit tests
```

## Architecture: structural typing

The runner accepts ANY object that matches the verb-subset it actually calls (`HermesLike`, `MonitoringLike`, `DecisionLike`). This decouples the runner from the concrete `HermesAgent` / `MonitoringAgent` / `DecisionAgent` classes — useful because:

1. **This PR ships independently** of #306/#309/#311 (the real agents). Their classes are structurally compatible; the runner imports nothing from them.
2. **Testing is trivial** — stub agents implementing the 4-method surface are enough.
3. **Phase B swap** — when Postgres adapters land, the same runner runs unchanged; you just hand it adapter-wrapped agent instances.

## Public surface

```ts
import { runHourly, runDaily } from '@/src/core/orchestrator-runner/runner';

const report = await runHourly({
  hermes:     hermesInstance,
  monitoring: monitoringInstance,
  decision:   decisionInstance,
  store:      agentOsStore,
}, {
  tenant_ids: ['tenant_a', 'tenant_b'],
  now:        '2026-05-17T00:00:00Z',   // optional, for tests
});

// report.tenants[i] = PerTenantRunReport with:
//   hermes_brief_created / hermes_brief_id
//   monitoring_slos_evaluated / monitoring_slos_breached
//   decision_overdue_flagged
//   errors:  string[]
// report.total_errors = sum across tenants
```

### Error isolation

Each tenant runs in its own try/catch per agent. A failure in tenant A's monitoring sweep does NOT stop tenant B from running. The runner ALWAYS returns a report — it never throws.

## Edge Function + cron

```
POST /functions/v1/agent-os-runner
Headers: Authorization: Bearer <vault: agent_os_runner_token>
Body:    { cadence?: 'hourly' | 'daily', tenant_ids?: string[] }
```

When `tenant_ids` is omitted, the function reads all tenants from `public.tenants` and processes them.

pg_cron schedules:
- `agent-os-runner-hourly` → every full hour
- `agent-os-runner-daily`  → 06:00 UTC daily

Operator setup (one-time):
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
INSERT INTO vault.secrets (name, secret) VALUES
  ('agent_os_runner_token', '<random-bytes>');
```

## Phase A vs Phase B

**Phase A (this PR):** Edge Function returns a STUB report. Each tenant's `errors` carries `'phase_a_scaffold: agent persistence not yet wired'`. This is deliberate — the cron URL, the auth, the schedule, and the per-tenant fan-out all work, but agent state isn't persisted yet so the runner can't actually execute Hermes/Monitoring/Decision against real data.

**Phase B (follow-up):** Replace the stub block in `agent-os-runner/index.ts` with the import + instantiation code from the comment block. Requires Postgres adapter implementations of `HermesPersistHook`, `MonitoringPersistHook`, `DecisionPersistHook`, plus a Postgres-backed `AgentOsStore` (the `AgentOsPersistHook` already exists).

## Out of scope

- Postgres adapters for the agent persist-hooks (Phase B)
- Distributed locking (today: single Edge Function invocation per cron tick; pg_cron retries on failure)
- Per-tenant cadence overrides (today: all tenants get the same schedule)
- Retry policy beyond pg_cron's built-in retry (today: failures emit observations, humans investigate)
