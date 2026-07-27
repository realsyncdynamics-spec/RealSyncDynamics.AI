# Browser Agent X07 — Design, Implementation Plan, Gap Analysis

**Status:** Vertical slice implemented (§1) · Phase 4 org-role is Proposed, not implemented (§4)
**Owner:** Governance Runtime / Platform
**Created:** 2026-07-27
**Companion to:** [`agent-os.md`](./agent-os.md) §3.1 (Runtime Core), §5.6 (Phase 4 role)
**Scope:** X07 observes and reports. It never remediates, never opens a
pull request, never touches production config. Escalation is a
`runtime_approval_gates` row for a human (or a downstream agent, once one
exists) to act on — X07's own authority ends at "this needs a look."

---

## 0. Why this exists

The original organizational sketch for RealSyncDynamics.AI's agent fleet
proposed Browser Agent X07 as a narrowly-scoped watcher: Chromium, DOM,
console, network, UI regressions — nothing else. That scope is worth
keeping even though the surrounding org-chart (Directors, Team Leads,
tickets, a dedicated knowledge graph) is **not** being built yet — see
`agent-os.md` §5 for why Multi-Agent Orchestration stays Phase 4.

This document describes the part that **is** real today: X07 as a single
Runtime Core skill, and what would need to change for it to become the
Phase-4 leaf node described in `agent-os.md` §5.6.

---

## 1. Status quo (implemented in this change)

| Surface | Form | Notes |
|---|---|---|
| `src/core/runtime/skills/browser-monitoring.ts` | Pure classification (`classifyConsoleErrors`, `classifyNetworkFailures`, `classifyUiChecks`) + `SkillManifest` (`browser.monitor_route`) + `SkillHandler` | No I/O. No new types beyond what a `HandlerResult` already allows. |
| `test/core/runtime/skills/browser-monitoring.test.ts` | 23 cases: pure-function unit tests + an Executor integration test using the same fakes as `test/core/runtime/executor.test.ts` | Proves the skill runs through the *existing* Executor unchanged. |
| `scripts/agents/browser-agent-x07.ts` | Node/Playwright runner: launches Chromium, collects console/network/UI telemetry, calls `Executor.execute()` wired to the production Postgres adapters (`SupabaseExecutionTracer`, `SupabaseEventLog`, `SupabaseApprovalGateService`), opens a gate directly when `requiresEscalation()` is true | Run via `npm run agent:browser-x07 -- --url … --tenant-id …`. Not wired to a scheduler yet (§4). |
| `runtime_executions` / `runtime_events` / `runtime_approval_gates` | **Unchanged.** No migration in this change. | X07 is the first real tenant of these tables outside the `src/lib/skills` chat-skill set. |

Nothing above adds a table, a queue, or a second event bus. The entire
vertical slice composes existing `src/core/runtime` primitives.

---

## 2. Data flow

```
 Playwright/Chromium                 pure classification              existing runtime
┌───────────────────┐   telemetry  ┌───────────────────────┐  args  ┌────────────────────────┐
│ scripts/agents/    │─────────────▶│ browser-monitoring.ts │───────▶│ Executor.execute()      │
│ browser-agent-x07  │  console,    │ classify* → severity   │        │  1. permission check    │
│ .ts                │  network,    │ buildInspectionResult  │        │  2. auto_approve=true → │
└───────────────────┘  UI checks   └───────────────────────┘        │     no gate for the      │
                                                                      │     crawl itself         │
                                                                      │  3. handler runs         │
                                                                      │  4. runtime_executions   │
                                                                      │     row persisted        │
                                                                      │  5. execution.completed  │
                                                                      │     → runtime_events     │
                                                                      └────────────┬─────────────┘
                                                                                   │ result.severity
                                                                                   ▼
                                                                      requiresEscalation(findings)?
                                                                                   │ yes (high/critical)
                                                                                   ▼
                                                                      gates.open({execution_id, …})
                                                                      → runtime_approval_gates row
                                                                        (pending human review)
```

Two deliberate design choices, both explained in
`src/core/runtime/skills/browser-monitoring.ts`:

1. **The crawl itself is `auto_approve: true`.** It is read-only, touches
   no PII, writes nothing. Gating every scheduled crawl behind human
   approval would make unattended monitoring pointless.
2. **Escalation is a second, explicit `gates.open()` call**, not a
   manifest-level property. The Executor's approval gate is static per
   skill (open before the handler runs); X07's escalation depends on
   *what the crawl found*, which is only known after the handler
   completes. Reusing `ApprovalGateService` directly — keyed to the
   already-persisted `execution_id` — gets the right behavior without
   adding a second gating mechanism next to the one the Executor already
   has.

---

## 3. Skill contract

| Field | Value | Rationale |
|---|---|---|
| `id` | `browser.monitor_route` | Dot-namespaced per the registry's validation rule (`registry.ts`). |
| `capabilities` | `read:website_content`, `network:external` | No `write:*`, no `pii:*` — matches what X07 is actually allowed to see. |
| `risk_level` | `low` | Read-only inspection of the platform's own public pages. |
| `auto_approve` | `true` | Permitted only because capabilities carry no write/PII (enforced by `registry.ts`'s manifest validator). |
| `pii_class` | `none` | X07 never processes user data — it inspects the platform, not tenant content. |
| `idempotent` | `true` | Re-running against the same route is safe; no side effects. |

This mirrors `gdpr-audit`'s shape in `src/lib/skills/registry.ts` (also a
read-only web inspection skill) but is **not** registered there — that
registry is for chat/prompt-routed LLM skills (free-text trigger →
guardrail-wrapped system prompt, enforced by `qa-skills-smoke.ts`'s
"exactly N skills" invariant). X07 is invoked on a schedule, never from a
user's chat turn, so it is registered directly against
`SkillRegistry`/`HandlerRegistry` via `registerBrowserMonitoringSkill()`.

---

## 4. Implementation plan

**Done (this change):**
- Classification logic, tests, manifest, handler.
- A runnable collector (Playwright) wired to the production runtime
  adapters, invocable by hand or by CI.

**Next, still pre-Phase-4 (small, additive, no schema changes):**
1. Wire `scripts/agents/browser-agent-x07.ts` to a scheduler. The
   existing `governance-monitoring-scheduler` Edge Function cannot launch
   Chromium (Deno Deploy / Supabase Edge Functions have no browser
   binary) — the practical next step is a scheduled CI job (GitHub
   Actions cron) or a small long-lived worker, **not** a new Edge
   Function. This is an infra decision, deliberately left open here.
2. Multi-route crawling (a fixed list of critical routes) — still one
   `execute()` call per route, no new abstraction.
3. Wire `runtime.execution` cost metering (`src/core/usage`, per
   `agent-os.md` §9) so X07's runs show up in the same usage accounting
   as every other skill.

**Phase 4 (org hierarchy, per `agent-os.md` §5 — proposed, not started):**
4. Give X07 a Team Lead that rolls its `runtime_events` up into a
   Platform Director report (§5.3) — a query, not a new table.
5. Route X07's `browser.monitor_route` under an `AgentDefinition` scoped
   to a "Platform" team, once team grouping is actually decided
   (`agent-os.md` §5.8).

---

## 5. Gap analysis: current runtime vs. the Phase-4 picture

| Gap | Why it matters | Recommendation |
|---|---|---|
| No platform-scope (non-tenant) execution. `runtime_executions.tenant_id` is `NOT NULL references tenants(id)`. | X07 watches RealSyncDynamics' **own** product, not a specific customer's system, but the schema forces a tenant row today. | Don't add a nullable-tenant carve-out speculatively (that's exactly the kind of schema change Task 1–3 were scoped to avoid). Run X07 today under a designated internal-ops tenant; decide the platform-scope question only when a second platform-level skill needs it too. |
| "WebMCP" (named in the original org sketch) doesn't exist as a library anywhere in this repo or its dependencies. | The design language should not imply an integration that isn't real. | This slice uses Playwright/CDP directly (`playwright-core`, already a transitive dependency of `@playwright/test`, now a direct devDependency). If/when a WebMCP-style protocol becomes available and adopted, it would replace `inspect()` in `scripts/agents/browser-agent-x07.ts` — the classification layer is already decoupled from the collector, so this is a non-breaking swap. |
| No scheduler triggers the runner today. | X07 doesn't actually watch anything continuously yet — it's a script you run. | See Implementation Plan §4 item 1. Deliberately not solved here — it's an infra/ops decision (CI cron vs. worker), not an architecture one. |
| `spec/runtime/` (ACS/CPS/HRP/EVC/EM/OC — 10 formal standards) and `apps/agent-runtime/` exist as a separate, more mature agent-governance framework and are not reconciled with either `agent-os.md`'s Phase 0/1 runtime or this document. | Two credible "how an agent is declared" answers exist in the repo (`SkillManifest` here vs. `AgentContract` in `src/runtime/agents/*.contract.ts`). Building Phase 4 without picking one risks a real second orchestration layer — the exact thing this task was scoped to avoid. | Flagged, not resolved, here. `agent-os.md` §5.8 carries this as an open question for whoever scopes Phase 4 for real. |
| Escalation gate risk_level is hard-coded to `'critical'`/`'high'` in the runner, not derived from a policy. | Fine for a single-operator vertical slice; won't scale to per-tenant policy differences once X07 (or a sibling skill) runs against tenant-facing surfaces. | Revisit once `spec/runtime/policy-specification.md` (RPS) or an equivalent tenant-configurable policy exists — not before. |
| No idempotency key set on the `ExecutionInput`. | Two overlapping crawls of the same route within a short window create two `runtime_executions` rows instead of de-duping. | Low priority — X07 is read-only and idempotent by nature (`idempotent: true` on the manifest already documents this); worth an `idempotency_key` (e.g. `route + 5-minute bucket`) only once it actually runs on a schedule. |

---

## 6. Explicitly out of scope for this change

- No `agent_tickets` / `agent_reports` / `agent_kg_*` / `org_units` tables.
  Findings live in `runtime_events`; escalation lives in
  `runtime_approval_gates`. Nothing new was added to the schema.
- No changes to the Executor, the approval-gate state machine, or the
  event bus. `src/core/runtime` is used exactly as it already exists.
- No production scheduling. Running X07 today is a manual/CI-triggered
  action (`npm run agent:browser-x07`).

---

## 7. References

- `docs/architecture/agent-os.md` — the runtime this slice builds on, and
  §5 for the Phase 4 org-hierarchy mapping.
- `src/core/runtime/skills/browser-monitoring.ts` — classification + manifest + handler.
- `scripts/agents/browser-agent-x07.ts` — the collector + runtime wiring.
- `test/core/runtime/skills/browser-monitoring.test.ts` — unit + integration tests.
- `src/lib/skills/gdprAudit.ts` — the closest existing analog (read-only
  web inspection skill), whose shape this module deliberately mirrors.
