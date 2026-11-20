# RealSync Agent Operations — Chief-of-Staff M0 (2026-11-20)

> **Internal / experimental / no production enablement.** This design extends the existing Agent OS and Command Center; it does not introduce a fifth execution framework. No claim of end-to-end deployment or autonomous management.

## Existing components (default branch)

| Concept | Canonical existing source | Verified repository-level conclusion | Gap |
| --- | --- | --- | --- |
| Chief of Staff | `src/core/agent-os/orchestrator.ts`, `src/core/agent-os/store.ts`, `src/features/command-center/useAgentRegistry.ts` | In-memory task/decision/observation store, orchestration scaffold and read-only registry client exist | Unified, authenticated, persisted operator inbox |
| Shared Brain | `src/core/agent-os/types.ts` (`agent_memory`), `supabase/migrations/20260526000000_agent_os_substrate.sql` | Tenant-keyed memory contract exists | Permissioned, source-linked, sensitivity-classified cross-agent read contract and live adapter |
| Event triggers | `supabase/functions/automation-trigger/index.ts`, `supabase/migrations/20260705200000_webhook_delivery_system.sql` | Trigger and webhook infrastructure has code/schema | Idempotent event → validated task routing with durable audit and operator approvals |
| Reusable skills | `src/lib/skills/registry.ts`, `supabase/functions/skills/index.ts`, `docs/product/automation-skills.md` | Skill definitions and automation contract exist | A single capability/approval model, runtime wiring and operator proof |
| Agent report cards | `public.agent_registry_v` migration and agent/task/run surfaces | Status/last-run plumbing exists | Task outcomes + true run telemetry + independent quality measurements in one authorized view |

All statuses above refer to **source availability**, not successful production execution. Reconcile with `docs/architecture/agent-manager-roadmap.md` and the newer `20261029140000_agent_registry_v.sql` before extending database schemas.

## M0 deliverable in this PR

- `src/core/agent-os/chiefOfStaff.ts`: read-only `buildChiefOfStaffInbox()` over `AgentOsStore`.
- Counts open/in-progress/blocked/failed tasks, proposed decisions, unacknowledged high/critical observations.
- Attention list excludes routine open tasks to prevent alert fatigue, prioritizes by severity, and enforces a bounded response.
- `buildAgentTaskReportCards()`: observed task closure ratio only; **quality_score** and **cost_usd** explicitly `null` until verified independent telemetry exists.
- `test/core/agent-os/chiefOfStaff.test.ts`: tenant separation, no auto-approval, no write side effects, severity, acknowledgement, limits, unknown metrics.
- `src/features/command-center/chiefOfStaffApi.ts`: opt-in, authenticated **owner/admin-only** adapter using existing RLS-protected `agent_tasks`, `agent_decisions`, and `agent_observations`; no UI route or automatic invocation.
- `test/core/agent-os/chiefOfStaffApi.test.ts`: mocked tenant/role, data availability, exact counts and read-only contract tests (not an actual Postgres RLS integration test).
- `test/runtime/db/chief-of-staff-rls.db.test.ts`: five actual PostgreSQL RLS isolation checks (two real tenant memberships, known foreign row ID, outsider, empty identity). Run only in a fully migrated disposable database; never against production.
- `src/features/command-center/ChiefOfStaffPanel.tsx` and `test/command-center/ChiefOfStaffPanel.test.tsx`: opt-in read-only Command Center tab, with tenant-switch stale-result suppression and visible denied/unavailable states.
- No new database objects, cron, email, webhooks, publish flow, paid LLM usage or production changes.

**Important trust boundary:** These pure functions take a tenant_id parameter but DO NOT authenticate the caller. Never expose them directly to an external request handler; first authorize the requester for that tenant and use RLS-backed store adapters. The in-memory store's `getTaskById()`/global queue do not provide caller authorization and should not be used to read across tenant boundaries.

## Next implementation sequence and acceptance criteria

### M0.1 — Authenticated runtime adapter / operator inbox (P1)
- Read task/decision/observation and status data from appropriate persisted sources, not an in-memory singleton.
- Verify tenant membership/role server-side on every query and enforce database RLS.
- Separate agent registry **configured state** from observed **run state**; never synthesize online status for Grok-style desired agents.
- Done when automated two-tenant tests show zero cross-tenant leaks and logged-in operators see accurate data with explicit `source_unavailable` behavior.

### M0.2 — Shared Brain read contract (P1)
- Start with existing `agent_memory` only; support `active`/superseded/redacted and immutable source references.
- Explicit `tenant_id`, classification, permitted agent/capability and legal retention metadata. Store pointers, not raw secrets or private customer content.
- Human approval before expanding sharing to another agent or tenant; **no cross-tenant shared memory**.
- Done when same-tenant allowed agent can read approved facts, denied agent cannot, redacted facts never surface.

### M1 — Idempotent event intake (P1)
- Reuse the existing automation/webhook stack; validate signatures, schema, replay window, idempotency key and authorization.
- Durable transactional handoff to a tenant-scoped task/outbox; 2xx response only after acceptance is persisted.
- Dead-letter, retry/backoff and evidence reference must be observable; no external actions without risk/approval policy.
- Done when duplicate, invalid, out-of-order and cross-tenant events are tested.

### M2 — Skills/runtime integration (P2)
- Map existing skills to versioned manifests with capability scopes, risk levels, input/output schemas, deterministic implementation when feasible.
- All side effects go through the existing runtime approval and quota gates; no unsafe direct route from the dashboard.
- Done when a low-risk dry-run skill has task → execution → evidence coverage and higher-risk actions demonstrably wait for approval.

### M3 — Evidence-based weekly report cards (P2)
- Unify existing run ledgers **without** treating `agent_runs`, `enterprise_agent_runs`, `autonomous_agent_runs` and `automation_runs` as identical schemas.
- Collect exact observed completion/error counts, cost source/version, runtime, freshness and audited reviewer quality samples.
- A 0–10 quality score is shown only when measurement rules and sample thresholds are documented; otherwise `unknown`.
- Alert only on material regression, stale service, hard budget excess or pending human intervention.
- Done when tests prove missing telemetry is not reported as 0 cost or successful runs.

## Production release gates
1. Source/CI tests pass against PR HEAD, not an earlier commit.
2. RLS/role tests pass in an isolated database (including cross-tenant negatives).
3. No silent post-commit audit/evidence loss; use a durable transactional outbox for mutations and notifications.
4. Quotas and anti-loop protections are tested under retries/concurrency.
5. No live social publishing, messaging, purchase, deploy, or destructive changes without explicit human review.
6. Observability proves event/task/evidence correlation and operator-visible error handling.
7. Security/DSGVO review, rollback plan and deployment checklist before enabling any production trigger.

**Delivery state:** M0 read-model, M0.1 authenticated read adapter and opt-in Command Center tab are proposed for review. Five real PostgreSQL RLS tests have passed on commit `f8812d9e` in the disposable GitHub CI database; newer UI changes still require CI on the latest PR head. The UI is not production-deployed by this PR alone. No end-to-end HTTP/role/session browser test or production deployment is claimed. M0.2–M3 are **not implemented**.
