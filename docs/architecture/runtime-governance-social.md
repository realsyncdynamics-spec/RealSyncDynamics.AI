# Runtime → Governance → Social — Architecture Plan

> **Status**: Planning only. No code, no migrations.
> **Scope**: Defines how the existing Agent Runtime
> (`src/core/runtime/`, PR #190 + bindings in PR #270) connects to a
> Governance event surface and a Social Orchestrator layer.
> **Audience**: Engineers building the next phase. Companion to
> `docs/architecture/agent-os.md` (layered reference) and
> `docs/architecture/governance-os-blueprint.md` (long-form thesis).
>
> This document is **deliberately upstream of implementation**. Concrete
> migrations, contracts and folders ship in follow-up PRs after PR #270
> stabilises and after the DSGVO-quick-check branch is resumed.

---

## 0. Why now, what this is, what this is not

The runtime today (PR #270 merged into a synchronous Phase-1.1 executor) can:

- register skill manifests + handlers,
- enforce capability checks,
- open approval gates for non-`auto_approve` skills,
- emit structured `RuntimeEvent`s on an in-memory bus,
- persist execution rows via `ExecutionTracer`.

What it cannot yet do:

- normalise events into a stable cross-domain Governance surface,
- chain executions to evidence anchors automatically,
- publish to outbound channels (Slack, status page, social) with
  per-channel review,
- survive a process restart with replay (in-memory only),
- escalate to humans on anomaly without a manual path,
- guarantee public-safe content policies on outbound text.

This document specifies the contracts, boundaries and state machines for
those capabilities so the next code phase can be sliced into safe PRs.

**This document does NOT**

- propose new Postgres tables (those land in the Phase-1.2 / Phase-2 PRs),
- modify existing runtime types,
- introduce new dependencies,
- pre-empt the DSGVO-quick-check stabilisation.

---

## 1. Layer overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Callers                                                                  │
│ - n8n workflow node    - browser extension                               │
│ - REST API             - admin console                                   │
│ - scheduled cron       - chat surface                                    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ ExecutionInput
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Agent Runtime (src/core/runtime, PR #190 + bindings PR #270)             │
│                                                                          │
│  Executor → PermissionChecker → ApprovalGateService → Handler            │
│      │             │                   │                  │             │
│      └────────────────────► RuntimeEvent (in-memory bus today) ──────┐   │
└──────────────────────────────────────────────────────────────────────┼───┘
                                                                       │
                                ┌──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Governance Bus (new — src/core/governance-bus)                           │
│                                                                          │
│  RuntimeEvent ─┐                                                         │
│  MarketingEv. ─┼──► Normalizer ──► GovernanceEvent ──► Subscribers       │
│  CookieScan  ─┘    (typed, hashed)                       │               │
│                                                          │               │
│   Subscribers fan out: Evidence anchor, Notifier, Social orchestrator    │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │                                  │
                         ▼                                  ▼
┌──────────────────────────────┐    ┌──────────────────────────────────┐
│ Evidence Vault (existing +   │    │ Social Orchestrator (new —       │
│ chain-extension)             │    │ src/core/social-orchestrator)    │
│  - anchor(execution_id)      │    │  - policy filter                 │
│  - link to gov_event hash    │    │  - per-channel approval          │
│  - signed receipt            │    │  - publisher adapters            │
└──────────────────────────────┘    └────────────┬─────────────────────┘
                                                 │
                                  ┌──────────────┼────────────────────┐
                                  ▼              ▼                    ▼
                              Slack/internal   Status page        Marketing
                                                                  channels
```

**Reading order**: caller → runtime → governance bus → (evidence | social).
Each arrow is replay-safe: re-running the same `correlation_id` at any
layer must be idempotent.

---

## 2. Runtime event pipeline

### Today

- `RuntimeEventName` covers eight names: `execution.started`,
  `execution.completed`, `execution.failed`, `approval.requested`,
  `approval.granted`, `approval.denied`, `permission.denied`,
  `memory.written`, `memory.read`.
- `EventBus` is an interface with one production-aimed implementation
  (`InMemoryEventBus`).
- Payloads are pointer-style: only hashes leave the runtime.

### Proposed for next phase

1. **Outbox pattern**: writes to `runtime_executions` and to the (new)
   `runtime_event_outbox` happen in the same transaction. A worker
   drains the outbox and publishes to subscribers. Loss-free across
   restarts.
2. **Delivery contract**: at-least-once. Subscribers MUST be idempotent
   keyed on `(event.id, subscriber_name)`.
3. **Two delivery paths** during transition:
   - synchronous in-process (today) for fast feedback,
   - asynchronous outbox-drain for durability.
   Subscribers MUST tolerate both. Order is per-`correlation_id` only,
   never global.
4. **No raw payload in events** — already a runtime invariant, must
   propagate downstream.

### Sequence — successful execution

```
caller         Executor    Tracer    Gates    Handler    Bus    Outbox-drain
  │   execute()   │          │         │         │         │         │
  ├──────────────►│ start()  │         │         │         │         │
  │               ├─────────►│         │         │         │         │
  │               │ execution.started─────────────────────►│         │
  │               │ permissions.check                      │         │
  │               │ requiresApprovalGate? no               │         │
  │               │ handler(ctx)                  ┌────────┤         │
  │               │◄──────── HandlerResult ───────┘        │         │
  │               │ finish('completed', output_hash)       │         │
  │               ├─────────►│                             │         │
  │               │ execution.completed──────────────────►│         │
  │  outcome      │          │                             │         │
  │◄──────────────┤          │                             │ drain() │
  │               │          │                             │◄────────┤
  │               │          │                             │ deliver ▼
  │               │          │                          [governance-bus]
```

### Sequence — gated execution

```
caller         Executor   Tracer   Gates    Bus    Reviewer    Resume-worker
  │  execute()    │         │        │       │        │              │
  ├──────────────►│ start() │        │       │        │              │
  │               │ approval.requested──────►│        │              │
  │               │ finish('awaiting_approval')      │              │
  │ awaiting_approval                       (notify) │              │
  │◄──────────────┤                                  │ decide()      │
  │                                                  ├────────►Gates │
  │                                                  │  approval.granted──►
  │                                                  │              │ resume
  │                                                  │              │ handler
  │                                                  │              │ execution.completed
```

Resume after approval is a **Phase-2** worker (not yet built). For now the
caller polls the gate; the worker fills that gap later.

---

## 3. Governance event normalization

### Problem

Multiple sources emit events with different shapes:

- runtime — `RuntimeEvent` (today)
- marketing analytics — `marketing_events` rows
- cookie-scan / audit — domain-specific event tables
- manual admin actions

Consumers (evidence, notifier, social) should see one schema.

### Canonical shape (proposal — NOT yet ship-able)

```ts
interface GovernanceEvent {
  /** UUID; stable across re-deliveries. */
  id: string;
  /** Tenant scope. NEVER null in production. */
  tenant_id: string;
  /** Producer surface. Closed set. */
  source: 'runtime' | 'marketing' | 'cookie_scan' | 'audit' | 'manual';
  /** Coarse category for routing. Closed set. */
  category:
    | 'execution'
    | 'approval'
    | 'compliance_finding'
    | 'evidence_anchor'
    | 'consent_change'
    | 'incident';
  /** Severity for routing/filtering. Aligns with runtime RiskLevel. */
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  /** Stable hash of the raw payload at the source. */
  payload_hash: string;
  /** Optional pointer to the raw row (table + id). NEVER inline PII. */
  source_ref?: { table: string; id: string };
  /** Workflow correlation key — set by the originating caller. */
  correlation_id: string;
  /** RFC 3339 UTC. Source-clock; consumers must tolerate skew. */
  occurred_at: string;
  /** Free-form labels for routing. Closed vocabulary per source. */
  labels?: Record<string, string>;
}
```

### Normalizer rules

- **No PII fields** — only hashes and source refs.
- **One producer = one mapping function** in
  `src/core/governance-bus/normalizers/<source>.ts`.
- Producers don't talk to subscribers directly — they emit canonical
  events only.
- Subscribers may filter on any field; the bus offers indexed lookups on
  `(tenant_id, source, category, severity)`.

---

## 4. Evidence / audit hooks

### Today

- `evidence_vault_chain.sql` defines a hash-chained table.
- `evidence-vault-export` edge function produces signed exports.
- Audit-specific tables (`audit_evidence`, `audit_jobs_queue`) exist.

### Proposed integration

Every `execution.completed` and `approval.granted` event MUST result in:

1. An evidence row keyed on `correlation_id` + `execution_id`.
2. A chain link: `prev_hash → sha256(prev_hash || event.payload_hash)`.
3. A signed receipt available via the existing `evidence-vault-export`
   path.

Hook point: a single subscriber `evidence-anchor` in
`src/core/evidence/anchor.ts` that drains governance events and writes
to the chain. No skill code touches evidence directly.

**Tamper-evidence**: chain breaks are detectable by re-hashing the
sequence on read. Out-of-scope here: cryptographic signing keys
rotation policy — owned by Phase-2 evidence-export work.

---

## 5. Social orchestrator integration

### Goal

Turn certain governance events into outbound communications without ever
bypassing review boundaries.

### Channels (closed set v1)

| Channel | Direction | Audience | Default review |
| ------- | --------- | -------- | -------------- |
| `slack.internal`     | internal | team             | required, low latency |
| `email.digest`       | internal | tenant admins    | required, daily batch |
| `status.public`      | external | public webpage   | always required, two-eyes |
| `social.linkedin`    | external | LinkedIn org     | always required, two-eyes |
| `social.x`           | external | X.com org        | always required, two-eyes |
| `webhook.tenant`     | external | tenant endpoint  | tenant-policy controlled |

### Hard constraints

- **No external publish without an explicit per-channel approval**, even
  if the originating skill executed under `auto_approve`. The orchestrator
  opens a *publish-gate* distinct from the runtime's execution gate.
- **Public channels enforce content policies** (Section 10).
- **Tenant isolation**: a publish-target can only consume events whose
  `tenant_id` matches the target's tenant.
- **Dry-run mode** is the default in non-prod. Real-send requires an
  explicit `RSD_SOCIAL_LIVE=1` env per channel.

### Folder shape (proposal)

```
src/core/social-orchestrator/
├── channels/
│   ├── slack.ts
│   ├── email.ts
│   ├── status.ts
│   ├── linkedin.ts
│   └── x.ts
├── policy/
│   ├── content-policy.ts        // shared with marketing sanitizer
│   ├── pii-filter.ts
│   └── brand-vocabulary.ts
├── gates/
│   └── publish-gate.ts          // reuses ApprovalGateService
├── publisher.ts                 // glue
└── index.ts
```

---

## 6. Approval / review boundaries

### Reuse vs extend

| Concern | Current runtime | Extension needed? |
| ------- | --------------- | ----------------- |
| Execution gate (skill-level)        | `ApprovalGateService.open()` | No |
| Two-eyes for high-impact            | Single decider today          | Yes — multi-approver record |
| Per-channel publish gate            | Not modelled                  | Yes — new gate "kind" field |
| Gate expiry                         | `ApprovalStatus = 'expired'`  | Worker to actually expire — to be built |

### Proposed schema delta (NOT in this PR)

Add to the gate record (kept backward compatible):

```
kind: 'execution' | 'publish'
required_approvals: integer   -- default 1
approvers: text[]             -- decided_by list
channel?: text                -- when kind = 'publish'
```

### Invariants

- Skills' `reviewRequired` ⇒ execution gate.
- Any outbound channel ⇒ publish gate.
- A single execution may spawn 0..N publish gates (one per channel).
- A gate is owned by exactly one tenant. No cross-tenant approvers.

---

## 7. Human-in-the-loop escalation

### Triggers

- `severity ≥ medium` on a `compliance_finding` event.
- `RuntimeEvent.permission.denied` for capabilities the tenant should
  have ⇒ misconfiguration, not abuse.
- Marketing-analytics `detectAnomaly` reporting `zScore < -3` on a
  conversion metric.
- Any `execution.failed` with `error_code = handler_threw` exceeding a
  per-skill rate threshold (rate ⇒ Section 16).

### Routing model (proposal)

```
GovernanceEvent
   │
   ├─ matches escalation rule?
   │      │
   │      └─ open Incident (existing `incidents` table)
   │           │
   │           └─ notify primary contact (tenant policy)
   │                │
   │                └─ no ack within SLA → secondary contact
   │                     │
   │                     └─ no ack within SLA → super-admin paging
```

SLAs are tenant-configurable but default to `30m / 2h / 8h`. Out-of-scope
here: actual paging integrations (PagerDuty, Opsgenie) — slot reserved.

---

## 8. Event replay / recovery

### Replay-safe contract for every subscriber

1. Process events by `event.id`, dedupe in a subscriber-local table.
2. Tolerate **out-of-order delivery** within a window; reorder via
   `(correlation_id, occurred_at)` only when required for state
   transitions.
3. Side-effects are idempotent: writes use upsert keyed on
   `(tenant_id, event.id, target)`.

### Replay window

- Outbox retains 90 days.
- Evidence chain is append-only and never re-emits.
- Social publishes record `external_message_id` to detect re-publish
  attempts and skip them.

### Recovery procedure (operator-facing)

```
1. Identify lost subscriber + last-acked event.id.
2. Reset subscriber cursor.
3. Replay window from outbox.
4. Verify chain hashes match.
5. Reconcile any external side-effects manually.
```

This is documented in `docs/qa/` later, not in this design.

---

## 9. Tenant isolation

### Non-negotiable

- Every event carries `tenant_id`. The bus rejects events without it.
- Subscribers MUST filter by `tenant_id`. The Postgres-backed bus uses
  RLS to enforce that filter for queries; in-process subscribers use a
  shared utility.
- Cross-tenant joins are forbidden at the Governance layer. Aggregate
  views for super-admin live in a separate read-side schema.

### Auditing

- A daily job samples Governance events and verifies the originating row
  has the same `tenant_id`. Mismatches page Sec-On-Call.
- Subscribers log the `tenant_id` they used to fetch — drift is
  detectable on a quick `SELECT count(*) WHERE tenant_id != observed`.

---

## 10. Public-safe content policies

### Inputs at risk

- Skill outputs from `legal-*` and `finance-*` (carry the
  `no-legal-advice` / `no-audit-opinion` disclaimer).
- Marketing claims pulled from the `marketing_events.metadata.claim`
  field (already flagged by `ComplianceDriftAgent`).
- Sales-outreach drafts (never public anyway, but reused for content).

### Policy gates (run before publish)

1. **PII strip** — same allow/deny list as `sanitizeMetadata` from
   `src/core/marketing-analytics/sanitizeMetadata.ts`. Shared module,
   single source of truth.
2. **Claim drift filter** — reject any text matching the existing
   `SUPERLATIVES` regex set in `ComplianceDriftAgent`.
3. **Disclaimer enforcement** — legal/audit-derived outputs must carry
   the originating skill's disclaimer; gate rejects publish if absent.
4. **Brand vocabulary** — closed list of allowed terms for product
   names, regulations, plan names. Internal use of "Agent OS" is OK; the
   public surface keeps "Automated Digital Compliance Infrastructure"
   per `docs/architecture/agent-os.md`.
5. **Tenant override** — tenants may add additional deny terms.

### Hard blocks

- Never publish legal-compliance / legal-contract-review outputs to
  external channels at all. Internal-only.
- Never publish raw marketing events. Only aggregates.
- Never publish anomaly findings to public status without explicit
  super-admin approval.

---

## 11. Runtime observability

### Metrics (proposal)

| Metric | Type | Labels |
| ------ | ---- | ------ |
| `runtime_executions_total`        | counter | `tenant_id`, `skill_id`, `status`         |
| `runtime_gate_opens_total`        | counter | `tenant_id`, `kind`, `risk_level`         |
| `runtime_gate_decision_seconds`   | histogram | `kind`                                  |
| `runtime_event_outbox_lag_seconds`| gauge | (none, bus-wide)                            |
| `governance_subscriber_failures_total` | counter | `subscriber`, `event_category`        |
| `social_publish_total`            | counter | `channel`, `result`                       |
| `social_policy_block_total`       | counter | `channel`, `policy_rule`                  |

### Tracing

- Every `ExecutionInput` carries an `idempotency_key` today. Extend the
  notion to `correlation_id` end-to-end (already in the proposed
  `GovernanceEvent` shape).
- Log lines emit `correlation_id` as a top-level field; logs are then
  joinable across runtime / bus / publisher.

### Health probes

- `/admin/runtime/health` — counts pending gates, outbox lag, last
  successful subscriber tick.
- `/admin/governance/replay` — operator-only endpoint; never auto-call.

---

## 12. Proposed folder structure

```
src/core/
├── runtime/                       (existing)
│   ├── bindings/                  (existing, PR #270)
│   └── …
├── governance-bus/                (NEW)
│   ├── types.ts                   // GovernanceEvent et al
│   ├── normalizers/
│   │   ├── runtime.ts             // RuntimeEvent → GovernanceEvent
│   │   ├── marketing.ts
│   │   └── cookie-scan.ts
│   ├── outbox.ts                  // Postgres outbox interface (Phase 2)
│   ├── subscribers.ts             // subscriber registry
│   └── index.ts
├── evidence/                      (NEW)
│   ├── anchor.ts                  // subscriber: chain writer
│   ├── chain.ts                   // hash-chain helpers
│   └── index.ts
└── social-orchestrator/           (NEW)
    ├── channels/
    ├── policy/
    ├── gates/
    ├── publisher.ts
    └── index.ts

supabase/
├── functions/
│   ├── governance-publish/        (NEW, per channel or shared)
│   └── …
└── migrations/
    ├── …_runtime_event_outbox.sql     (Phase 1.2 — separate PR)
    ├── …_governance_events.sql        (Phase 2 — separate PR)
    ├── …_evidence_chain_extension.sql (Phase 2 — separate PR)
    └── …_social_publish_gates.sql     (Phase 2 — separate PR)
```

**Sequencing rule**: never ship a folder before its consumer is ready.
Order is governance-bus first (drained by a stub subscriber), then
evidence anchor, then social-orchestrator.

---

## 13. Event contract proposals

### Runtime → Governance mapping (canonical)

| RuntimeEvent name        | GovernanceEvent.category | severity     |
| ------------------------ | ------------------------ | ------------ |
| `execution.started`      | `execution`              | `info`       |
| `execution.completed`    | `execution`              | `info`       |
| `execution.failed`       | `execution`              | `medium`     |
| `approval.requested`     | `approval`               | from skill risk |
| `approval.granted`       | `approval`               | `info`       |
| `approval.denied`        | `approval`               | `medium`     |
| `permission.denied`      | `approval`               | `medium`     |
| `memory.written/read`    | (drop, not normalised v1)| —            |

Mapping is one-way; the bus never re-emits as RuntimeEvent.

### Marketing → Governance (existing data, new shape)

`marketing_compliance_findings` rows → `category: 'compliance_finding'`,
severity from the row's `severity` column.

### Outbound contract (orchestrator → channel adapter)

```ts
interface PublishRequest {
  channel: ChannelKey;
  tenant_id: string;
  payload: PublishPayload;   // already policy-checked
  correlation_id: string;
  /** Gate that approved this publish. Adapter must verify state. */
  publish_gate_id: string;
  /** Dry-run unless live mode is explicitly enabled per channel. */
  live: boolean;
}
```

Adapters return `{ ok, external_id?, error? }`. Failures don't loop —
they enqueue a retry with backoff and surface via `social_publish_total`.

---

## 14. Approval-state machine

### Execution gate (today + minor extensions)

```
          ┌──────────────┐
          │   pending    │◄──── open()
          └──────┬───────┘
                 │
        ┌────────┼────────┐
        │        │        │
     granted  denied   expired
        │        │        │
        ▼        ▼        ▼
    executing  cancelled cancelled
        │
        ▼
    completed  ──or──►  failed
```

Transitions:

- `pending → granted` requires decider with `approve:execution` capability.
- `pending → denied` always allowed by any approver with `review` permission.
- `pending → expired` driven by SLA timer (worker — Phase 2).
- `granted → executing` is automatic (resume worker — Phase 2).
- `granted → revoked` allowed before `executing` only (rare; audit-only).

### Publish gate (new)

```
                  ┌──────────────┐
publish_request──►│   pending    │
                  └──────┬───────┘
                         │
   ┌─────────────────────┼─────────────────────┐
   │                     │                     │
  approved          rejected            expired
   │                     │                     │
   ▼                     ▼                     ▼
publishing            archived              archived
   │
   ▼
published  ──or──►  publish_failed
```

Notes:

- A publish gate may require multiple approvers (`required_approvals`).
- `publishing → publish_failed` is recoverable; the orchestrator retries
  with backoff up to a per-channel limit, then escalates.
- `published` is terminal. Edits create a NEW publish request.

---

## 15. Risk analysis

| # | Risk | Likelihood | Impact | Mitigation |
| - | ---- | ---------- | ------ | ---------- |
| 1 | Cross-tenant leak via shared subscriber                       | medium | high     | tenant_id filter at bus, RLS on Postgres outbox, daily audit job (§9). |
| 2 | PII leak in event payload                                     | medium | high     | hashes-only contract, normalizers reject inline strings; unit tests on each normaliser. |
| 3 | Approval-gate bypass via direct DB write                      | low    | critical | RLS denies non-runtime writes; audit log diffs paged. |
| 4 | Mis-publish to public channel                                 | low    | critical | per-channel publish gate, dry-run default, live env flag, two-eyes for `status.public`/`social.*`. |
| 5 | Replay storm crashing subscriber                              | medium | medium   | dedupe table, dead-letter queue, rate-limit per source. |
| 6 | Outbox backlog growth                                         | medium | medium   | drain worker SLO + alert on lag metric, shed lowest-severity events first. |
| 7 | Skill version drift between runtime + edge function           | high   | low      | generator script (separate follow-up); contract tests on both. |
| 8 | Anomaly false positives flooding incidents                    | high   | medium   | per-rule hysteresis + per-tenant cooldown; require human ack to silence. |
| 9 | Compliance-finding noise reaching public                      | low    | high     | hard block (§10); legal-* outputs never reach `status.public`. |
| 10 | Memory event leakage (`memory.read`)                         | low    | medium   | dropped from v1 normalisation; reconsider with payload audit. |
| 11 | Single-node executor saturation                              | medium | medium   | horizontally scaled outbox-drainer; executor stays per-process. |
| 12 | Postgres outbox becomes hot table                            | medium | medium   | partition by month + index on `(processed, tenant_id)`. |

---

## 16. Future scaling bottlenecks

1. **In-memory bus** — fine for tests, not for prod. Outbox + LISTEN/NOTIFY
   (Phase 3 in `agent-os.md`) lifts the ceiling but introduces operational
   surface (worker fleet, lag monitoring).
2. **Synchronous executor** — no streaming, no parallel sub-skills. The
   architecture intentionally defers parallelism to a workflow engine
   (Phase 2). Don't bolt parallelism into the executor.
3. **Single Postgres** — at low five-digit tenants this is fine. Beyond
   that, tenant-cohort sharding by `tenant_id` hash is the obvious move.
4. **Approval queue UI** — once `publish` gates exist alongside
   `execution` gates, the reviewer surface needs filtering by `kind`.
   The current UI assumes one queue.
5. **Per-tenant rate-limits** — runtime today has none. Add a leaky
   bucket per `(tenant_id, skill_id)` before opening the runtime to
   tenant-supplied custom skills.
6. **Evidence chain growth** — append-only chain is fine for years at
   pilot volumes, but require quarterly snapshots after that.
7. **Channel adapter dependencies** — each social adapter pulls a new
   external SDK. Keep them in `social-orchestrator/channels/` so they
   don't leak into the runtime bundle.

---

## 17. Open questions to resolve before implementation

1. **Outbox vs. event-sourced topic**: do we double-write to outbox + a
   Kafka-like stream, or stay outbox-only? Resolve before drafting the
   Phase-1.2 migration.
2. **Replay ownership**: which team owns rerun decisions when an
   evidence chain breaks? Probably Sec-On-Call.
3. **Tenant-level publish policies**: how granular should
   per-tenant overrides be on Section 10's content policy?
4. **Channel auth model**: do we store channel credentials per tenant
   in Vault, or expect tenant to operate webhooks?
5. **Public-status surface ownership**: existing `Status` page vs new
   `social.status` channel — same backend or separate?

These are deliberately listed as questions, not decisions. Each gates a
slice of implementation work and should be answered in a short ADR
before its corresponding PR.

---

## 18. Sequencing recommendation

After PR #270 is green and DSGVO-quick-check is stabilised:

1. **PR — Governance bus skeleton**: types, normalizer for `RuntimeEvent`,
   single stub subscriber (logger). No outbox yet; runs in-process.
2. **PR — Evidence anchor subscriber**: writes to existing
   `evidence_vault_chain` keyed on `correlation_id`. Read-only tests.
3. **PR — Postgres outbox migration + drain worker**: makes the bus
   durable. Backwards compatible — in-process bus stays as fallback.
4. **PR — Social orchestrator skeleton + dry-run channels**: Slack
   internal first, no external channels.
5. **PR — Publish gates + multi-approver record**: backward-compatible
   schema delta on the approval table.
6. **PR — External channels enabled per env flag**: LinkedIn / X /
   status.public, each behind its own `RSD_SOCIAL_LIVE_*`.

No single PR ships more than one of the above. Each must include
contract tests against the next layer.

---

## Appendix A — non-goals for this design

- **Multi-agent collaboration / sub-agent calls** — explicitly Phase 2
  workflow-engine territory (see `agent-os.md` §2 layered model).
- **Self-modifying skills / autonomous code generation** — out of scope.
- **External LLM model selection / routing** — orthogonal; lives in
  `src/core/ai-gateway`.
- **Realtime UI streaming of events** — interesting but premature; the
  in-memory subscriber for the admin console can ride on the same bus
  later.

---

## Appendix B — links

- `docs/architecture/agent-os.md` — layered reference & roadmap
- `docs/architecture/governance-os-blueprint.md` — long-form thesis
- `docs/skills/skill-registry.md` — current skill registry + runtime
  bindings (PR #270)
- `src/core/runtime/types.ts` — runtime contract source of truth
- `src/core/marketing-analytics/` — first compliance-finding producer
