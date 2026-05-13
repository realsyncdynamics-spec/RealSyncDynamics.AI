# RealSyncDynamics.AI — Governance OS Blueprint

> **Status**: v1 draft, 2026-05-12.
> **Author**: Architecture working group (Principal AI Governance Architect + Distributed Systems + Agent Runtime).
> **Scope**: Multi-year evolution from the current pilot (PR #134–#160, governance runtime live on `ebljyceifhnlzhjfyxup`) into a category-defining EU-native AI Governance Operating System.
> **Audience**: Engineers building the platform; investors evaluating the technical thesis; regulators reviewing the control model.

This blueprint is the technical thesis for the next 24 months. It is not a roadmap PowerPoint — it is the system specification that engineering, product and compliance teams operate against. Every section is intended to be directly implementable.

---

## 0. Why this exists

The pilot ships in May 2026 with a working end-to-end governance loop: onboarding → asset/policy → ingest key → SDK/extension → telemetry → policy decision → approval queue → audit log → vendor inventory → incident workflow → DPIA → DSR tracker → cost dashboard → integration connectors → multi-env → compliance export. That stack proves the loop closes. It does **not** yet prove the loop scales, generalises across customers, or wins the category.

The competitive set — OneTrust AI Governance, Credo AI, Holistic AI, IBM watsonx.governance, Microsoft Purview AI Governance — is consultant-shaped: heavy on document templates, light on runtime. Our wedge is the opposite shape: **a runtime governance OS** with policy-as-code, agentic operators, immutable evidence and EU-native deployment. The blueprint below describes the system that fulfils that wedge.

---

## 1. Design Principles

These are non-negotiable. Every PR is reviewed against them.

| # | Principle | Operational consequence |
|---|---|---|
| 1 | **API-first** | Every capability has a stable, versioned HTTP/JSON API before any UI is built. UI is a client of the API like any third-party. |
| 2 | **Event-driven** | State changes emit events. Synchronous request/response is the exception, not the rule. Eventual consistency is the default. |
| 3 | **Multi-tenant** | `tenant_id` is the primary partition key on every governance table. Cross-tenant queries require an explicit, audited `cross_tenant_admin` role. RLS enforces tenant boundaries at the database, not in app code. |
| 4 | **Modular** | Each service owns its data. No shared database tables between services after Phase 2. Services communicate via events + APIs only. |
| 5 | **Scalable** | Stateless services behind autoscalers. Read-heavy work goes through read replicas + materialised views. Writes go through partitioned tables once a tenant crosses 10M events. |
| 6 | **Audit-ready** | Every state change writes to an append-only audit log with `actor_user_id`, `tenant_id`, `target_type`, `target_id`, `payload`, `at`. The audit log is the source of truth for "what happened, when, and by whom." |
| 7 | **Agentic-first** | Operations that today require a human review (DPIA drafting, vendor risk classification, regulatory diff) are designed from day one to be agent-executable with human approval gates. The UI is the **fallback**, not the primary path. |
| 8 | **Policy-as-code** | All policies are versioned source artefacts (Rego/OPA + a higher-level YAML wrapper). No clickable rule builders. Policies are reviewed in PRs like any code. |
| 9 | **Evidence-centric** | Every claim ("policy enforced", "training completed", "incident reported within 72h") points to a hashed evidence record. No claim without a hash. |
| 10 | **Developer-friendly** | SDKs in TS, Python, Go. Sub-200ms p95 ingest latency. OpenAPI spec generated from server code. Test fixtures published for every event schema. |
| 11 | **EU-hosted** | All primary data planes (Postgres, object storage, queues, vector index, observability) deploy in `eu-central-1` or `eu-west-3`. US replicas exist only for read-only DR and require customer opt-in. |
| 12 | **GDPR-first** | Lawful basis tagged on every data category at the schema level. DSR responses ship within 7 days, not 30. Right to erasure is a primitive (`tenant.purge(user_id)`), not a workflow. |
| 13 | **AI-Act-ready** | Every AI asset carries a machine-verifiable `ai_act_class` and `obligation_set`. The control library maps Articles 9–15 to runtime checks. Annex IV technical documentation is generated from live system state, not authored. |

**Hard architectural choices that follow from the principles:**

- **No global tables.** Even `regulations` (which is conceptually global) is replicated per-tenant for snapshot isolation when a customer asks "what did this say on the day my incident occurred?"
- **No soft delete by default.** Audit + RLS make hard delete safe. Soft delete is opt-in, per table, and triggers a retention policy review.
- **No client-side policy decisions.** The policy engine is server-side only. SDKs send telemetry; they never decide.
- **No PII in logs.** Structured logs use opaque IDs. PII flows through the evidence vault, which is keyed by tenant CMK.

---

## 2. Core Platform Vision

**RealSyncDynamics.AI is the operating system for AI and privacy governance.** Not a dashboard. Not a document mill. An OS — meaning it owns the runtime, it owns the control plane, and it owns the evidence.

### 2.1 The loop the OS closes

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   DISCOVER ─▶ INVENTORY ─▶ CLASSIFY ─▶ ENFORCE ─▶ MONITOR ─▶ DETECT   │
│      ▲                                                          │     │
│      │                                                          ▼     │
│   EVIDENCE ◀── WORKFLOW ◀── REMEDIATE ◀── ESCALATE ◀── DRIFT          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

Each arrow is a service. Each service emits events. The loop runs continuously per tenant.

- **DISCOVER**: browser extension, SDK, cloud connectors, CI/CD hooks. Identifies new AI assets, vendors, datasets, prompts, agents.
- **INVENTORY**: governance graph stores the discovered entities and their lineage.
- **CLASSIFY**: risk engine + AI-Act classifier assigns `risk_level` and `obligation_set`.
- **ENFORCE**: policy engine intercepts runtime events and returns an action (allow / warn / require_approval / block).
- **MONITOR**: telemetry pipeline streams runtime events into TSDB + the graph.
- **DETECT**: drift, anomaly, regulatory change.
- **ESCALATE / REMEDIATE / WORKFLOW**: incident, DPIA, DSR, vendor review workflows.
- **EVIDENCE**: every step writes a hashed, timestamped record to the evidence vault.

### 2.2 What the OS is **not**

- It is not a static questionnaire engine. (Vanta, Drata.)
- It is not a chatbot wrapper that summarises regulations. (a hundred 2025-vintage SaaS bets.)
- It is not a one-off audit report generator. (Most "AI Act readiness" tools shipped in 2024–2025.)
- It is not a compliance LMS or training platform.
- It is not a contract review tool, though it ingests contract metadata.

### 2.3 The shape of the product

Three plane separation, exactly like Kubernetes:

| Plane | Responsibility | Primary user |
|---|---|---|
| **Control plane** | Tenants, policies, controls, agents, identity, billing | DPO, AI governance lead, platform admin |
| **Data plane** | Events, telemetry, evidence, graph, vector index | Application + agent (writes), audit + analytics (reads) |
| **Workflow plane** | DPIA, DSR, incidents, vendor reviews, regulatory updates | Privacy ops, AI ops, legal, security |

The control plane defines policy. The data plane records reality. The workflow plane reconciles the two when they diverge.

---

## 3. Target Architecture

### 3.1 Frontend Layer

```
src/
├── apps/
│   ├── governance/      # Governance Dashboard (DPO + AI gov lead)
│   ├── developer/       # API keys, SDK docs, event explorer
│   ├── admin/           # Tenant management, billing, RBAC
│   ├── agents/          # Agent console — review, approve, override
│   └── runtime/         # Real-time telemetry + policy decisions feed
├── shared/
│   ├── components/      # Design system primitives (RSD-UI)
│   ├── auth/            # Supabase + custom RBAC/ABAC overlay
│   ├── api/             # Generated OpenAPI client
│   ├── flags/           # Feature flag bindings
│   └── audit/           # Audit visibility hooks (every mutation visualised)
└── pages/
    └── ... (existing marketing site)
```

**Routing strategy.** Per-app SPAs share a session via the Supabase Auth provider. App boundaries become Vite multi-page entrypoints once each app crosses 50 routes (pre-PR threshold to avoid bundle bloat). React Router v6 with lazy `route.lazy()` everywhere.

**Multi-tenant in the UI.** Tenant is selected once after login, persisted in `sessionStorage` (never `localStorage`), and threaded as an HTTP header (`X-RSD-Tenant-Id`) on every API call. The server re-validates that `(auth.uid(), tenant_id)` matches a `memberships` row.

**RBAC.** Five base roles: `owner`, `admin`, `dpo`, `developer`, `auditor`. Custom roles compose from a fixed permission set (e.g. `policy:write`, `evidence:export`, `agent:run`). Permission checks happen server-side; UI hides controls but never trusts the hide.

**ABAC.** On top of RBAC, attribute conditions (`asset.environment == 'production'`, `incident.severity >= 'high'`) gate critical actions. Implemented as a tiny rule engine in `shared/auth/abac.ts`, evaluated server-side at the API layer.

**Feature flags.** Two-tier: `global_flags` for product rollouts (GrowthBook), `tenant_flags` for per-tenant overrides (in our own Postgres). Every flag has an owner, a kill date, and a removal PR template.

**Audit visibility.** Every list view in the Governance Dashboard has an "Audit" tab that joins to `governance_admin_audit_log` and shows the last 50 mutations on the displayed entities. This is the user-facing version of the audit guarantee — and a real product feature, not a developer tool.

### 3.2 Backend Services Layer

```
                        ┌────────────────────┐
                        │   API Gateway      │
                        │ (Supabase Edge +   │
                        │  custom Hono/Deno) │
                        └─────────┬──────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   ┌────▼────┐               ┌────▼────┐              ┌─────▼─────┐
   │ Control │               │  Data   │              │ Workflow  │
   │ Plane   │               │  Plane  │              │ Plane     │
   └─────────┘               └─────────┘              └───────────┘
   - Tenants                 - Telemetry              - DPIA
   - Policies                - Evidence Vault         - DSR
   - Controls                - Governance Graph       - Incidents
   - Agents                  - Vector Index           - Vendor Review
   - Identity                - Search                 - Regulatory Diff
   - Billing                                          - Notifications

                              EVENT BUS
                       (NATS JetStream, EU)
```

**13 first-class services.** Each owns its data, its events, and its scaling profile.

| Service | Responsibility | Inputs | Outputs | Storage | Events produced | Events consumed | Scaling |
|---|---|---|---|---|---|---|---|
| **Governance Graph** | Source of truth for the entity graph (assets, vendors, controls, etc.) and their lineage | Mutations from CRUD APIs, telemetry-derived updates | Graph queries, lineage paths, blast-radius queries | Postgres + Apache AGE (graph extension) | `graph.node.created`, `graph.edge.added`, `graph.path.computed` | All `*.created` events | Read-heavy, scales horizontally via read replicas; writes batched in 5s windows |
| **Policy Engine** | Evaluates events against policies; returns decisions | Telemetry events, policy bundles | `PolicyDecision{action, score, matched_rules}` | OPA/Rego bundles in object storage + Postgres for policy metadata | `policy.decision.made`, `policy.violation.detected` | `telemetry.event.received` | CPU-bound; one decision = ~1ms; horizontal autoscale to N replicas per tenant tier |
| **Risk Engine** | Continuously scores assets, vendors, prompts | Graph state, telemetry stream, historical incidents | `RiskScore{value, factors, confidence}` | Postgres (`asset_risk_history`, `vendor_risk_history`) | `risk.score.updated`, `risk.threshold.crossed` | `graph.*`, `telemetry.*` | Batch recompute every 5min + event-triggered recomputes |
| **Evidence Engine** | Generates, hashes, chains and stores evidence artefacts | All other services' outputs + cron schedules | Sealed evidence records | Postgres (metadata) + S3-compatible object storage (artefacts, EU) | `evidence.sealed`, `evidence.chain.extended` | All `*.completed` events | Write-heavy bursts; partitioned by `tenant_id, sealed_at` |
| **Agent Runtime** | Executes agents in sandboxed containers with scoped tokens | Agent triggers, tool registry, memory store | Agent actions (tool calls, escalations) | Postgres (runs, traces) + S3 (artefacts) + Qdrant (memory) | `agent.started`, `agent.step`, `agent.escalated`, `agent.completed` | `*.triggered`, `human.approved` | One container per agent run, killed on completion; warm pool per tenant tier |
| **Agent Orchestrator** | Schedules + chains agents, handles retries + DLQs + approvals | Triggers from any service, cron schedules | Run requests to Agent Runtime | Postgres + Redis (queue) | `orchestrator.run.queued`, `orchestrator.run.failed` | Many | DAG-shaped workflows; concurrent run cap per tenant |
| **Website Scanner** | Discovers trackers, scripts, AI vendors on customer websites | URLs, scan schedules | Inventory updates, findings | Postgres (findings) + S3 (HAR + screenshots) | `scan.completed`, `scan.finding.created` | `tenant.website.added` | Scheduled fleet; one browser per scan via Playwright on Cloud Run |
| **API Telemetry Collector** | Ingests events from SDK, extension, server connectors | HTTPS event submissions | Normalised telemetry | Postgres (governance_events) + Kafka topic for replay | `telemetry.event.received`, `telemetry.batch.received` | None (entry point) | Edge functions; horizontally infinite; backpressure via queue depth |
| **Vendor Intelligence** | Maintains a normalised catalogue of AI/sub-processor vendors and their DPA/transfer status | Vendor crawls, manual entries, regulatory intelligence | `VendorProfile{dpa_status, transfer_mechanism, ...}` | Postgres (`vendors`) + Qdrant (vendor doc embeddings) | `vendor.profile.updated`, `vendor.risk.changed` | `connector.vendor.discovered` | Light; batch updates nightly |
| **Regulatory Intelligence** | Tracks EU/national/sector regulatory changes, diffs them, surfaces obligations | RSS, official journals, manual curation, LLM extraction | `RegulatoryUpdate{change_set, affected_controls}` | Postgres + Qdrant | `regulation.updated`, `obligation.changed` | None | Cron-driven; high LLM cost but ~50 events/day |
| **Notification Service** | Routes events to Slack, Teams, email, webhooks per tenant preference | Events with `notify_*` tags | HTTP calls / SDK calls to channels | Postgres (delivery log) | `notification.delivered`, `notification.failed` | Many | Trivial; one consumer per channel type |
| **Workflow Engine** | Stateful workflows for DPIA, DSR, incidents, vendor reviews | Trigger events, human inputs | Workflow state transitions | Postgres (workflow state) + Temporal (durable execution) | `workflow.transitioned`, `workflow.completed` | Many | One Temporal worker pool per tenant tier |
| **Reporting Service** | Compliance reports (Annex IV, Art. 30 ROPA, SOC2 evidence packs) on demand | Graph state, evidence pointers, time range | PDF + signed JSON + ZIP artefact | S3 + Postgres (report manifest) | `report.generated` | `report.requested` | Bursty; queued; long-running |

**Why these 13 and not more.** Anything not on this list is either (a) a sub-component (e.g. "cron scheduler" lives inside Agent Orchestrator), (b) cross-cutting (auth, billing — bought, not built), or (c) premature for Phase 1–2.

**Service boundaries are enforced by code.** Each service is a directory under `services/` with its own `package.json`, `migrations/`, `events.ts` (event schemas), and `api.ts`. CI fails any PR that imports across service boundaries except through the published event/API surface.

### 3.3 Governance Graph

The graph is the **memory** of the OS. Every other service either writes to it or reads from it.

**Choice: Postgres + Apache AGE** (not Neo4j, not Neptune). Reasons:
- Single transactional store for graph + relational; no dual-write consistency problem.
- EU-hosted via Supabase / self-hosted Postgres in `eu-central-1`.
- Native RLS gives tenant isolation for graph data, which Neo4j/Neptune do not.
- Apache AGE supports openCypher 0.9, sufficient for our traversal patterns.
- Single backup, single restore, single point of audit.

**Trade-off**: graph traversal performance is ~2–5× slower than a dedicated graph DB at >10⁸ edges. We accept this until we hit that scale (Phase 4); migration path is documented (per-tenant Neptune mirror keyed on `tenant_id`).

#### 3.3.1 Entity types

```cypher
-- Core entities
(:Tenant {id, name, region})
(:User {id, email, role})
(:Website {id, url, last_scan_at})
(:Page {id, url, last_seen_at})
(:Script {id, src, sha256})
(:Cookie {id, name, host, lifetime})
(:Tracker {id, host, vendor_id})
(:Vendor {id, name, country, dpa_status, transfer_mechanism})
(:AiUsecase {id, name, ai_act_class, obligation_set})
(:Model {id, family, version, provider})
(:Dataset {id, name, lawful_basis, retention_days})
(:Prompt {id, template_hash, system_prompt_hash})
(:Agent {id, kind, permissions_scope})
(:Policy {id, version, effective_at})
(:Control {id, framework, article, requirement})
(:Regulation {id, jurisdiction, name, version})
(:Risk {id, level, kind, scored_at})
(:Evidence {id, sha256, sealed_at})
(:Workflow {id, kind, state})
(:Deployment {id, environment, deployed_at})
(:ApiEndpoint {id, method, path})
(:CloudResource {id, provider, kind, arn})
```

#### 3.3.2 Relationships (the interesting ones)

```cypher
(:Page)-[:LOADS]->(:Script)
(:Script)-[:SERVED_BY]->(:Vendor)
(:Cookie)-[:SET_BY]->(:Script)
(:AiUsecase)-[:USES_MODEL]->(:Model)
(:AiUsecase)-[:CONSUMES_DATASET]->(:Dataset)
(:AiUsecase)-[:DEPLOYED_AS]->(:Deployment)
(:AiUsecase)-[:GOVERNED_BY]->(:Policy)
(:Policy)-[:IMPLEMENTS]->(:Control)
(:Control)-[:REQUIRED_BY]->(:Regulation)
(:Vendor)-[:SUBJECT_TO]->(:Regulation)
(:AiUsecase)-[:HAS_RISK]->(:Risk)
(:Evidence)-[:PROVES]->(:Control)
(:Evidence)-[:ABOUT]->(:AiUsecase | :Vendor | :Deployment)
(:Workflow)-[:TRIGGERED_BY]->(:Risk | :PolicyViolation)
(:Agent)-[:OPERATES_ON]->(:AiUsecase | :Workflow)
(:Deployment)-[:RUNS_ON]->(:CloudResource)
```

#### 3.3.3 Traversal patterns we run thousands of times a day

**Blast radius.** "If vendor X loses their adequacy decision tomorrow, what stops working?"
```cypher
MATCH (v:Vendor {id: $vendor_id})<-[:SERVED_BY]-(s:Script)<-[:LOADS]-(p:Page)<-[:HAS_PAGE]-(w:Website),
      (v)<-[:USES_VENDOR]-(u:AiUsecase)
WHERE w.tenant_id = $tenant_id
RETURN DISTINCT u.id, u.name, count(p) AS affected_pages
```

**Lineage.** "What evidence proves we comply with Article 13 for usecase Y?"
```cypher
MATCH (u:AiUsecase {id: $uc_id})-[:GOVERNED_BY]->(:Policy)-[:IMPLEMENTS]->(c:Control)<-[:PROVES]-(e:Evidence)
WHERE c.article = 'AI_ACT_13'
RETURN e.id, e.sha256, e.sealed_at
ORDER BY e.sealed_at DESC
```

**Risk propagation.** Risk scores propagate **downstream** along `:USES_MODEL`, `:USES_VENDOR`, `:CONSUMES_DATASET`. A high-risk model surfaces high-risk usecases. Implemented as a nightly batch traversal that updates `Risk` nodes with `kind: 'inherited'`.

**Shadow AI discovery.** "Any AI usecases reachable from a deployment but missing a `:GOVERNED_BY` edge?"
```cypher
MATCH (u:AiUsecase)-[:DEPLOYED_AS]->(d:Deployment)
WHERE u.tenant_id = $tenant_id
  AND NOT (u)-[:GOVERNED_BY]->(:Policy)
RETURN u, d
```

#### 3.3.4 Telemetry → graph updates

Telemetry events do not write directly to the graph. They go through a **graph projector**:

```
Telemetry ─▶ Kafka topic ─▶ Graph Projector worker ─▶ Apache AGE upserts
                                       │
                                       ├─ deduplication (event_id)
                                       ├─ rate-limit per tenant
                                       └─ schema validation
```

The projector is idempotent. Replaying the entire Kafka topic must yield the same graph state — a non-negotiable invariant.

#### 3.3.5 How agents use the graph

Agents read the graph via a Cypher-over-HTTP wrapper that enforces:
- Tenant scope (`WHERE *.tenant_id = $agent.tenant_id` injected into every query).
- Depth cap (default 5 hops; only `auditor` agents can request deeper).
- Result cap (default 1000 rows).

Agents **propose** writes (`graph.propose`) which go to a pending queue. Either a higher-trust agent or a human approves the write before it lands. This prevents a misbehaving agent from corrupting the graph.

---

## 4. Policy Engine

### 4.1 The DSL

Two layers:

1. **Authoring DSL (YAML).** What governance leads write.
2. **Execution DSL (Rego).** What the engine evaluates. Generated from layer 1.

A YAML policy:

```yaml
id: policy.tracker_without_consent
version: 3
title: "No tracking before consent (TTDSG §25)"
description: |
  A tracker script must not load on a page unless the page has
  emitted a `consent.granted` event for category=analytics within
  the current session.
effective_at: 2026-06-01
applies_to:
  asset_type: [website, page]
  environment: [production]
when:
  event.event_type: "scanner.tracker_added"
require:
  exists:
    event_type: "consent.granted"
    within: "session"
    where: "category IN ('analytics', 'marketing')"
on_violation:
  severity: high
  action: require_approval
  evidence:
    capture: [page_url, script_src, session_id]
  notify:
    - channel: slack
      template: tracker-without-consent
references:
  - regulation: TTDSG_25
  - control: GDPR_ART_6
  - control: GDPR_ART_7
```

The same policy compiled to Rego:

```rego
package rsd.policies.tracker_without_consent

import future.keywords

default decision := {"action": "allow", "score": 0}

decision := {
  "action": "require_approval",
  "score": 80,
  "matched_rules": ["tracker_added_without_consent"],
  "evidence": {"page_url": input.event.payload.url, "script_src": input.event.payload.script}
} if {
  input.event.event_type == "scanner.tracker_added"
  not consent_granted_in_session(input.event.session_id)
}

consent_granted_in_session(sid) if {
  some e in input.session_events
  e.event_type == "consent.granted"
  e.payload.category in {"analytics", "marketing"}
}
```

The Rego is generated by the engine at policy save time; reviewers PR-approve both.

### 4.2 Evaluation lifecycle

```
Event arrives at API gateway
        ▼
Telemetry Collector persists event + tags tenant_id
        ▼
Event is enqueued on `policy.eval.requested`
        ▼
Policy Engine consumer:
    1. Loads tenant's compiled policy bundle from object storage (cached 30s)
    2. Loads session_events context (last 5 min for this session_id)
    3. Calls OPA evaluator (in-process)
    4. Persists PolicyDecision to Postgres
    5. Emits `policy.decision.made` event
        ▼
Downstream consumers:
    - Risk Engine adjusts asset score
    - Workflow Engine starts approval workflow if action = require_approval
    - Notification Service routes alerts
    - Evidence Engine seals the decision + event together
```

p50 evaluation latency: 4ms. p99: 35ms. Eval is in-process (OPA SDK) — no HTTP hop to a separate OPA server. Bundles auto-reload every 30s on file mtime.

### 4.3 Policy inheritance

```
Global default policies (RSD-shipped)
        ▼
Industry pack policies (e.g. "healthcare", "fintech") — tenant opts in
        ▼
Tenant-custom policies (authored in-product or via Git PR)
        ▼
Environment overrides (prod stricter than staging)
```

Higher layers can **strengthen** lower-layer policies (raise severity, narrow allow conditions) but cannot weaken them. Compiler refuses to emit a bundle that violates this.

### 4.4 Real-time enforcement

Two enforcement modes:

- **Observe mode (default).** Policy evaluates async on the event bus. Decisions written to history; no in-line block.
- **Inline mode.** SDK posts to a synchronous `/policy/decide` endpoint and **waits** for the decision before continuing. p99 must stay <50ms. Only used for asset types tagged `inline_enforcement: true` (typically the AI-runtime SDK guarding LLM calls).

### 4.5 Multi-framework example: the same event triggers multiple frameworks

Event: an AI usecase classified `high_risk` deploys without a completed DPIA.

| Framework | Article / control | Policy id | Action |
|---|---|---|---|
| GDPR | Art. 35 | `policy.dpia_required_before_deploy` | block |
| EU AI Act | Art. 9 (risk management), Art. 11 (technical doc) | `policy.ai_act_high_risk_obligations` | block |
| ISO 27001 | A.5.34 | `policy.iso_privacy_assessment` | require_approval |
| SOC2 | CC9.1 | `policy.soc2_change_management` | warn |

The strictest action wins (`block`). The evidence record links to **all** matched policies, so a single deployment-blocked event proves compliance with four frameworks at once.

---

## 5. AI Act Control System

This is where the platform earns its category. We do not generate Annex IV docs from templates. We **derive** them from live system state.

### 5.1 Risk classification

The AI-Act-Classifier service runs at three lifecycle points:
1. **At asset creation** — the user describes the usecase; the classifier proposes a class.
2. **On graph change** — when a usecase gains a new dataset/model/deployment edge, the class is re-evaluated.
3. **Continuously** — nightly cron re-runs the classifier on every usecase to catch drift in the upstream rules.

Classifier input:
```json
{
  "purpose": "Auto-screening of CV applications",
  "domain": "employment",
  "model_kind": "general-purpose LLM",
  "decision_autonomy": "advisory_to_human",
  "affected_subjects": "natural_persons",
  "training_data_pii": true,
  "geo_scope": "EU"
}
```

Classifier output:
```json
{
  "ai_act_class": "high_risk",
  "rationale": "Annex III §4(a) — employment, worker management",
  "obligation_set": [
    "art_9_risk_management",
    "art_10_data_governance",
    "art_11_technical_documentation",
    "art_12_record_keeping",
    "art_13_transparency_to_deployer",
    "art_14_human_oversight",
    "art_15_accuracy_robustness_cybersecurity"
  ],
  "confidence": 0.93,
  "method": "rule_engine + llm_review",
  "classifier_version": "2026.05.0"
}
```

The rule engine is deterministic (Annex I + III mapped to a decision tree). The LLM review only **flags** edge cases for human verification; it never decides class.

### 5.2 Obligation Engine

For each high-risk usecase, the Obligation Engine instantiates a checklist of controls and assigns owners:

| Obligation | Control id | Owner role | Verification method | Cadence |
|---|---|---|---|---|
| Art. 9 — Risk management system | `aiact.art9.rms_in_place` | DPO | Workflow `risk_management_plan` completed and signed | per release |
| Art. 10 — Data governance | `aiact.art10.dataset_provenance` | data_owner | Dataset has `lawful_basis`, `provenance_url`, `pii_review_passed=true` | per dataset version |
| Art. 11 — Technical documentation | `aiact.art11.annex_iv` | ai_lead | Reporting Service generates Annex IV pack on demand | per release + on-demand |
| Art. 12 — Record keeping | `aiact.art12.runtime_logs` | platform | Telemetry pipeline retains events for 6 months minimum | continuous |
| Art. 13 — Transparency | `aiact.art13.user_facing_notice` | product | Deployment manifest contains `transparency_notice_url` that returns 200 | per deploy |
| Art. 14 — Human oversight | `aiact.art14.override_mechanism` | product | Deployment exposes a `/override` endpoint or an approval-queue link | per deploy |
| Art. 15 — Accuracy / robustness / cybersec | `aiact.art15.eval_passed` | ai_lead | Eval suite results uploaded; min thresholds met | per release |

Each obligation has a **machine-verifiable check** (column "Verification method") that runs automatically. Failed checks open a workflow in the Workflow Engine.

### 5.3 Post-market monitoring

Continuous monitoring is implemented as a set of runtime detectors that subscribe to the telemetry stream:

- **Drift detector.** Compares the rolling 7-day distribution of model inputs/outputs to a baseline captured at release. Statistical tests (KS, PSI). Fires `model.drift.detected` if `psi > 0.25`.
- **Performance regression detector.** Compares current accuracy on canary inputs to release-time accuracy. Fires `model.performance.regressed`.
- **Incident pipeline integration.** Both detectors auto-open AI Act Art. 62 incident workflows if the affected usecase is `high_risk`.

### 5.4 Annex IV generation

The Reporting Service composes Annex IV technical documentation from the live graph:

```
section 1 (general description)   ← AiUsecase.description, .purpose, .deployment
section 2 (description of elements) ← Model, Dataset, Prompt nodes + version pins
section 3 (monitoring)            ← latest drift/perf detector configs + last 90 days of findings
section 4 (risk management)       ← workflow `risk_management_plan` artefacts
section 5 (changes)               ← audit log of `AiUsecase`-related mutations
section 6 (harmonised standards)  ← Control nodes with framework='EN_ISO_*'
section 7 (declaration of conformity) ← human-signed PDF stored in evidence vault
section 8 (post-market monitoring) ← incident records, drift findings, retraining log
```

Output: a deterministically-named ZIP (`annex-iv-<usecase_id>-<sealed_at>.zip`) containing:
- `manifest.json` (SHA-256 of every file, signed)
- `<section_n>.pdf` per section
- `evidence/` directory with all referenced evidence records
- `graph-snapshot.json` (the slice of the graph used)

The pack is byte-stable for a given `(usecase_id, sealed_at)`. Regenerating produces an identical archive. This makes the output **verifiable** by a regulator: they can recompute the SHA-256 and confirm no tampering.

---

## 6. Agentic GRC System

This section is the strongest competitive differentiator. None of the listed competitors have a true agent runtime — they have automations and workflows. We have agents that reason, plan, and act under constrained authority.

### 6.1 The agent fleet

Ten production agents. Each is its own deployable, with its own permissions, prompt, tools, and risk envelope.

#### 6.1.1 Website Drift Agent

| Field | Value |
|---|---|
| **Purpose** | Detect material changes to a customer's public website that affect privacy/AI compliance posture. |
| **Triggers** | Cron (every 6h per website), webhook (CI deploy notification). |
| **Permissions** | `scan:run`, `graph:read`, `graph:propose`, `evidence:write`. No `policy:write`. |
| **Memory/context** | Last 30 days of scan results for this website. Tenant-specific tracker allowlist. |
| **Tools** | `website.scan(url)`, `graph.diff(before, after)`, `evidence.seal(record)`, `notify.send(channel, template)`. |
| **Reasoning loop** | (1) Pull latest scan. (2) Diff against previous. (3) Classify each change (added tracker, removed consent banner, new vendor, …). (4) For each material change, propose a graph mutation + evidence record. (5) If `severity >= high`, open a workflow. |
| **Actions** | Graph proposals, evidence writes, notifications. Cannot block deploys (that's the policy engine's job). |
| **Escalation** | Notifies the tenant DPO if `severity == critical` (e.g. new tracker from a non-adequacy country). |
| **Human approval** | Required for any change involving a vendor not yet in the tenant inventory. |
| **Audit logs** | Every step (tool call, reasoning trace, decision) logged in `agent_runs.trace`. |
| **Risk boundaries** | Cannot scan domains outside the tenant's `verified_domains` allowlist. Hard limit: 100 scans/hour/tenant. |

#### 6.1.2 AI Risk Classification Agent

| Field | Value |
|---|---|
| **Purpose** | Assign AI Act risk class + obligation set to new or modified AiUsecase nodes. |
| **Triggers** | `graph.node.created` for `:AiUsecase`, `graph.edge.added` involving `:AiUsecase`. |
| **Permissions** | `graph:read`, `graph:propose:ai_act_class`, `evidence:write`. |
| **Memory/context** | Historical classifications for similar usecases in this tenant + RSD-curated reference cases. |
| **Tools** | `aiact.classify(payload)`, `aiact.lookup_annex_iii(domain, subject_kind)`, `evidence.seal(record)`. |
| **Reasoning loop** | (1) Fetch usecase + linked datasets/models. (2) Run deterministic rule engine. (3) If confidence < 0.95, run LLM review with structured output. (4) Propose `ai_act_class` mutation + rationale. |
| **Actions** | One graph proposal per run. |
| **Escalation** | Always escalates classifications of `high_risk` or `prohibited` for human confirmation. |
| **Audit logs** | Full reasoning trace + LLM prompt + LLM response stored. |
| **Risk boundaries** | Cannot set `ai_act_class = minimal_risk` on a usecase tagged `domain in {employment, education, biometric_id, critical_infrastructure}`. |

#### 6.1.3 Vendor Risk Agent

| Field | Value |
|---|---|
| **Purpose** | Maintain vendor risk profiles: DPA status, transfer mechanism, sub-processors, sanctions exposure. |
| **Triggers** | Cron (weekly), `vendor.discovered` event, news webhook (Sanctions / GDPR fines). |
| **Permissions** | `graph:read`, `graph:propose:vendor_*`, `web:fetch` (allowlisted domains), `evidence:write`. |
| **Tools** | `vendor.fetch_profile(name)`, `web.fetch(url)` (rate-limited), `llm.extract(text, schema)`, `evidence.seal`. |
| **Reasoning loop** | (1) For each vendor, fetch privacy policy + DPA URL. (2) Extract structured fields. (3) Compare to last known state. (4) Score change. (5) Open vendor review workflow if scoring crosses threshold. |
| **Escalation** | Adequacy-decision changes always escalate. |
| **Risk boundaries** | Cannot mutate `dpa_status = signed` — only humans can confirm. |

#### 6.1.4 Regulatory Change Agent

| Field | Value |
|---|---|
| **Purpose** | Monitor EU/national regulators, parse new acts and amendments, map to existing controls, surface obligations. |
| **Triggers** | Cron (daily), RSS push. |
| **Permissions** | `regulation:write`, `obligation:propose`, `web:fetch`, `evidence:write`. Cannot modify tenant data — only RSD-managed regulatory tables. |
| **Tools** | `rss.poll`, `web.fetch`, `llm.diff(text_a, text_b)`, `control.map(text, framework)`. |
| **Reasoning loop** | (1) Pull new regulatory texts. (2) Diff against previous version. (3) For each material change, map to affected controls. (4) Propose updated obligation set. |
| **Escalation** | RSD compliance lead must approve every regulation update before it goes live to tenants. |
| **Risk boundaries** | Operates only on the RSD-owned regulatory schema; never touches per-tenant data. |

#### 6.1.5 Evidence Generation Agent

| Field | Value |
|---|---|
| **Purpose** | Generate evidence records on a schedule (e.g. "weekly screenshot of consent banner") or on event (e.g. "every model release ships a model card"). |
| **Triggers** | Cron schedules from `evidence_collection_schedules`. |
| **Permissions** | `evidence:write`, `graph:read`, `scan:run`, `llm:summarise`. |
| **Tools** | `screenshot(url)`, `scan.export(scan_id)`, `llm.summarise(text)`, `evidence.seal`. |
| **Risk boundaries** | Cannot generate evidence for controls not subscribed by the tenant. |

#### 6.1.6 Remediation Agent

| Field | Value |
|---|---|
| **Purpose** | Open Jira/GitHub/Linear/ServiceNow tickets for unresolved policy violations and follow them to completion. |
| **Triggers** | `policy.violation.detected` with `severity in {high, critical}`, after 24h without manual triage. |
| **Permissions** | `integration:write:ticket`, `workflow:transition`, `notify:send`. |
| **Tools** | `jira.create_issue`, `github.create_issue`, `slack.send`, `workflow.advance`. |
| **Risk boundaries** | Per-tenant configurable trigger rules (`trigger_on_policy_action`, `trigger_on_risk_level`). |

#### 6.1.7 Runtime Telemetry Agent

| Field | Value |
|---|---|
| **Purpose** | Watch the live telemetry stream for anomalies that policies don't catch (novel patterns, rate spikes). |
| **Triggers** | Continuous (subscribed to `governance_events`). |
| **Permissions** | `telemetry:read`, `incident:create`, `notify:send`. |
| **Tools** | `anomaly.detect(window, metric)`, `incident.open(severity, summary)`. |
| **Escalation** | Critical anomalies page on-call DPO. |
| **Risk boundaries** | Read-only on telemetry; can only create incidents, not modify them. |

#### 6.1.8 AI Usage Discovery Agent

| Field | Value |
|---|---|
| **Purpose** | Find AI usage that the tenant hasn't told us about. Reads connector data (SSO logs, SaaS API audit logs, cloud bills, network logs from optional NetFlow connector). |
| **Triggers** | Cron (daily). |
| **Permissions** | `connector:read`, `graph:propose:ai_usecase`, `notify:send`. |
| **Tools** | `connector.query(provider, kind)`, `llm.classify(text, taxonomy)`. |
| **Reasoning loop** | (1) Pull last 24h of SSO + bill + API logs. (2) Filter for AI-vendor hits. (3) Cluster by user/department. (4) For each cluster, propose a new AiUsecase node (status: `discovered_unverified`). |
| **Risk boundaries** | Cannot auto-promote `discovered_unverified` to `inventoried` — needs human. |

#### 6.1.9 Shadow AI Detection Agent

Special case of (6.1.8) focused on browser-extension + endpoint-agent signals.

| Field | Value |
|---|---|
| **Purpose** | Detect ChatGPT/Claude/Copilot/Gemini usage in browsers and editors and link it to a user identity. |
| **Triggers** | `browser_extension.ai_call_observed`, `editor_plugin.ai_call_observed`. |
| **Permissions** | `graph:propose:ai_usecase`, `notify:send`. |
| **Risk boundaries** | Per-tenant configurable: some tenants want every personal use flagged, others only enterprise endpoints. PII redaction enforced before storing prompt previews. |

#### 6.1.10 Agent Governance Agent

The meta-agent. Watches all other agents.

| Field | Value |
|---|---|
| **Purpose** | Detect when agents misbehave: too many escalations, low approval rates, accuracy regressions on classifications, runaway tool-call loops. |
| **Triggers** | Continuous (subscribed to `agent.*` events). |
| **Permissions** | `agent:pause`, `agent:audit`, `notify:on_call`. |
| **Tools** | `agent.pause(agent_id)`, `agent.run_replay(run_id)`, `metrics.query`. |
| **Escalation** | Pages RSD on-call SRE if a tenant-scoped agent is paused. |
| **Risk boundaries** | Cannot resume a paused agent — humans only. |

### 6.2 Agent Orchestrator

The orchestrator is the **deterministic** plane around the non-deterministic agents.

#### 6.2.1 Architecture

```
                ┌──────────────────────────────────────┐
                │           Agent Orchestrator         │
                └──────────────────────────────────────┘
                          │             │
              ┌───────────┘             └──────────────┐
              ▼                                        ▼
     ┌────────────────┐                      ┌─────────────────┐
     │ Trigger Router │                      │ Approval Queue  │
     │ (cron + bus)   │                      │ (human gates)   │
     └────────────────┘                      └─────────────────┘
              │                                        │
              ▼                                        ▼
     ┌────────────────────────────────────────────────────┐
     │             Run Queue (Redis Streams)              │
     └────────────────────────────────────────────────────┘
              │
              ▼
     ┌──────────────────────────────────────────────────────────┐
     │              Agent Runtime (Cloud Run / Fly)             │
     │  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  │
     │  │ Container per │  │ Tool registry │  │  Memory      │  │
     │  │ agent run     │  │  (allowlist)  │  │  (Qdrant)    │  │
     │  └───────────────┘  └───────────────┘  └──────────────┘  │
     └──────────────────────────────────────────────────────────┘
              │
              ▼
     ┌────────────────────┐    ┌──────────────────┐
     │ Trace + Artefact   │    │  Event emitter   │
     │ store (Postgres+S3)│    │ (agent.* events) │
     └────────────────────┘    └──────────────────┘
```

#### 6.2.2 Task scheduling

- **Cron triggers** are defined in `agent_schedules` (Postgres). Orchestrator reads them every minute and enqueues `agent.run.requested`.
- **Event triggers** are defined in `agent_subscriptions`. Orchestrator subscribes to NATS and enqueues runs.
- **Manual triggers** come from the UI or API (`POST /agents/:id/runs`).
- **Tenant tier caps** apply (free: 100 runs/day, growth: 5k, enterprise: unlimited but billed). Excess goes to a deferred queue.

#### 6.2.3 Retries and DLQ

- Each run has a max-attempts budget (default 3) and a per-attempt timeout (default 5min).
- Transient failures (network, rate-limit) retry with exponential backoff.
- Permanent failures (invalid input, missing permission) DLQ immediately.
- DLQ visible in the Agent Console; humans triage.

#### 6.2.4 Approval gates

```yaml
# agent definition fragment
approval_gates:
  - when: "decision.action == 'block'"
    approvers: ["role:dpo", "role:ai_lead"]
    sla_hours: 4
    on_timeout: escalate_to_owner
  - when: "tool == 'jira.create_issue' AND severity == 'critical'"
    approvers: ["role:dpo"]
    sla_hours: 1
```

The orchestrator suspends a run when a gate hits, persists the pending state, and resumes on approval/rejection/timeout.

#### 6.2.5 Chain-of-agents workflows

Agents can request runs of **other** agents via `orchestrator.chain(target_agent, payload)`. Chains have a max depth of 4 and a budget of 16 total agent runs per chain (configurable per tenant).

Example chain — a `policy.violation.detected{severity: critical}` event:

```
Runtime Telemetry Agent (detected)
    └─▶ AI Risk Classification Agent (re-classify the usecase)
            └─▶ Evidence Generation Agent (seal a snapshot)
                    └─▶ Remediation Agent (open Jira + Slack)
                            └─▶ Workflow Engine (incident workflow)
```

The Agent Governance Agent watches the chain. If any agent in the chain exceeds its tool-call budget, the meta-agent pauses the chain.

#### 6.2.6 Rollback

Agent actions are designed as **proposals** with explicit commits. If the chain fails mid-way, proposals not yet committed are dropped. Committed actions are not rolled back automatically — they generate `rollback.required` events that go to a human workflow.

#### 6.2.7 Agent Registry

Postgres table `agents`:
```sql
CREATE TABLE agents (
  id            UUID PRIMARY KEY,
  tenant_id     UUID,                  -- NULL = RSD-managed
  kind          TEXT NOT NULL,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  manifest_url  TEXT NOT NULL,         -- S3 URL to a signed manifest
  manifest_sha  TEXT NOT NULL,
  enabled       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
);
```

The manifest is a YAML document describing tools, permissions, schedule, model, prompt template hash. The manifest is signed; the runtime refuses to start an agent whose hash doesn't match the registry.

#### 6.2.8 Agent Permissions Model

A single capability vocabulary across the whole platform:

```
scan:run
graph:read
graph:propose
graph:write
graph:propose:<entity_type>
evidence:write
policy:read
policy:write
workflow:transition
integration:write:ticket
integration:read:<provider>
telemetry:read
web:fetch
llm:invoke
notify:send
agent:pause
agent:audit
incident:create
report:generate
```

Permissions are **scoped by tenant**. An agent with `graph:propose` on tenant A cannot act on tenant B even if it knows the IDs. Enforced by the API gateway via `auth.uid()` → agent → tenant binding.

#### 6.2.9 Agent Risk Budgeting

Each agent run carries a budget:
- **LLM tokens** (caps the cost per run).
- **Tool calls** (caps the chatter, prevents runaway loops).
- **Wall-clock time** (caps the latency tail).
- **Money** (rolled up from tokens + tool-call vendor costs).

The Orchestrator deducts from the budget at every step; over-budget runs are killed with a `agent.run.budget_exceeded` event. Budgets are per-run and per-day-per-tenant.

#### 6.2.10 Agent Audit Trails

The trace for every run looks like:

```jsonc
{
  "run_id": "01HW...",
  "agent_id": "...",
  "tenant_id": "...",
  "started_at": "2026-05-12T22:34:01Z",
  "trigger": {"kind": "event", "event_id": "..."},
  "input": {...},
  "steps": [
    {"t": "2026-05-12T22:34:01.123Z", "kind": "plan", "content": "..."},
    {"t": "2026-05-12T22:34:01.456Z", "kind": "tool_call", "tool": "graph.query", "args": {...}, "result_sha256": "...", "tokens": 124},
    {"t": "2026-05-12T22:34:02.001Z", "kind": "llm_call", "model": "claude-sonnet-4-6", "prompt_sha256": "...", "completion_sha256": "...", "tokens_in": 1830, "tokens_out": 412},
    {"t": "2026-05-12T22:34:02.500Z", "kind": "proposal", "target": "graph.node", "diff": {...}},
    {"t": "2026-05-12T22:34:02.520Z", "kind": "escalation", "reason": "high_risk", "approvers": ["..."]},
    {"t": "2026-05-12T22:35:11.700Z", "kind": "approval", "approver_id": "...", "decision": "approved"},
    {"t": "2026-05-12T22:35:11.900Z", "kind": "commit", "target": "graph.node", "result": "ok"}
  ],
  "completed_at": "2026-05-12T22:35:12Z",
  "outcome": "success",
  "budget_used": {"tokens": 2242, "tool_calls": 4, "wall_ms": 71200, "money_usd": 0.0173}
}
```

Stored in Postgres (`agent_runs`) with the prompt/completion content offloaded to S3 by SHA. This separation lets us delete PII payloads while preserving the trace skeleton for audit.

---

## 7. Runtime Telemetry

### 7.1 Sources

| Source | Mechanism | Volume estimate (per enterprise tenant) |
|---|---|---|
| Browser extension | HTTPS POST per page event | 10k–100k events/day |
| Server SDK (TS/Py/Go) | HTTPS POST batched 1s | 1M–100M events/day |
| Cloud connectors (AWS/Azure/GCP) | Periodic pulls + SNS/EventGrid push | 100k–10M/day |
| AI provider connectors (OpenAI/Anthropic/Azure OpenAI) | Webhook + API pulls | 10k–1M/day |
| CI/CD hooks (GitHub/GitLab/Vercel) | Webhook | 100–10k/day |
| Workflow tools (Jira/Linear/ServiceNow) | Webhook + API pulls | 100–10k/day |

### 7.2 Pipeline

```
SDK / Extension / Connector
        │  HTTPS POST {event}
        ▼
┌────────────────────────────┐
│  API Gateway (Edge)        │   1ms
│  - HMAC verify             │
│  - tenant resolution       │
│  - rate limit (per key)    │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│  Telemetry Collector       │   2ms
│  - schema validate         │
│  - normalise               │
│  - dedupe (event_id)       │
└────────────────────────────┘
        │
        ├──▶ Postgres (governance_events, partitioned by month)
        │
        └──▶ Kafka topic `telemetry.events`
                    │
        ┌───────────┼───────────┬────────────┐
        ▼           ▼           ▼            ▼
   Policy Eng.  Graph Proj.  Evidence Eng.  TSDB (ClickHouse)
```

### 7.3 Event schema

Canonical envelope, versioned with `schema_version`:

```jsonc
{
  "schema_version": "1.1.0",
  "event_id": "01HW...",              // ULID, client-generated, used for dedupe
  "event_type": "agent.runtime.call", // dot.namespaced, ~80 types in v1
  "event_source": "server_sdk",       // sdk | browser_extension | cloud_connector | ai_connector | ci | manual
  "tenant_id": "uuid",
  "session_id": "uuid | null",
  "occurred_at": "2026-05-12T22:30:14.123Z",
  "received_at": "2026-05-12T22:30:14.456Z",
  "environment": "production",
  "asset_id": "uuid | null",
  "actor": {
    "kind": "user | agent | system",
    "id": "..."
  },
  "vendor": "api.openai.com | null",
  "model_name": "gpt-4o-mini | null",
  "risk_level": "low | medium | high | critical | null",
  "data_types": ["prompt_text", "cookie_ids", ...],
  "policy_action": "allow | warn | require_approval | block | null",
  "title": "Outbound AI call: api.openai.com",
  "summary": "...",
  "payload": { /* event-type-specific, opaque to collector */ },
  "metadata": { /* free-form */ }
}
```

The 80 event types in v1 fall into 8 namespaces: `agent.*`, `policy.*`, `scanner.*`, `consent.*`, `dataset.*`, `model.*`, `incident.*`, `workflow.*`.

### 7.4 Retention strategy

| Layer | Default retention | Per-tenant override | Storage cost driver |
|---|---|---|---|
| Postgres `governance_events` (recent) | 90 days | up to 24 months | Random-access reads |
| Kafka `telemetry.events` | 7 days | fixed | Replay window |
| ClickHouse aggregates | 5 years | up to 7 years | Analytics |
| S3 cold archive (Parquet) | 7 years | up to 10 years | Regulatory floor |
| Evidence vault | per evidence record (`retention_until`) | — | Compliance |

Beyond Postgres, ClickHouse holds **aggregates** (per-day, per-asset, per-event-type rollups), not raw events. Raw events older than 90 days live in S3 Parquet partitioned by `tenant_id/yyyy=/mm=/`. Re-hydration into ClickHouse for an audit takes minutes via S3 → ClickHouse `INSERT FROM s3()`.

### 7.5 Immutable evidence storage

Telemetry is not evidence. Telemetry is **input** to evidence. The Evidence Engine reads telemetry, decides what to seal, and writes a hashed record. Telemetry can be deleted on retention boundary; sealed evidence cannot, except via documented purge workflow.

---

## 8. Evidence & Audit System

### 8.1 Vault structure

Two-layer design:

1. **Evidence Vault** (immutable, hash-chained). The compliance source of truth.
2. **Audit Log** (append-only). The operational source of truth — every state change in the OS.

These are different tables, different SLOs, different access patterns.

### 8.2 Evidence record schema

```sql
CREATE TABLE evidence_records (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  kind            TEXT NOT NULL,             -- e.g. 'scan_result', 'policy_decision', 'annex_iv_section', 'consent_snapshot'
  subject_type    TEXT NOT NULL,             -- e.g. 'AiUsecase', 'Website', 'Vendor'
  subject_id      UUID NOT NULL,
  proves_control  TEXT[],                    -- e.g. ['aiact.art11.annex_iv', 'gdpr.art_30_ropa']
  artefact_url    TEXT NOT NULL,             -- s3://...
  artefact_sha256 TEXT NOT NULL,
  prev_sha256     TEXT NOT NULL,             -- chain link
  chain_index     BIGINT NOT NULL,
  sealed_at       TIMESTAMPTZ NOT NULL,
  retention_until TIMESTAMPTZ NOT NULL,
  signer          TEXT NOT NULL,             -- 'system' | 'user:<uuid>' | 'agent:<uuid>'
  signature       TEXT NOT NULL,             -- Ed25519 over (artefact_sha256 || prev_sha256 || sealed_at)
  metadata        JSONB
);

CREATE UNIQUE INDEX ON evidence_records(tenant_id, chain_index);
CREATE INDEX ON evidence_records(tenant_id, subject_type, subject_id);
CREATE INDEX ON evidence_records(tenant_id, kind);
CREATE INDEX ON evidence_records USING GIN (proves_control);
```

### 8.3 Hash chain

Per tenant, `chain_index` starts at 0 and increments monotonically. `prev_sha256` of record `n` equals `artefact_sha256` of record `n-1`. This is enforced by a trigger that refuses inserts that break the chain.

Verification (run by any auditor on demand):

```sql
WITH chain AS (
  SELECT chain_index, artefact_sha256, prev_sha256,
         LAG(artefact_sha256) OVER (PARTITION BY tenant_id ORDER BY chain_index) AS expected_prev
  FROM evidence_records
  WHERE tenant_id = $1
)
SELECT chain_index, artefact_sha256, prev_sha256, expected_prev
FROM chain
WHERE chain_index > 0 AND prev_sha256 IS DISTINCT FROM expected_prev;
```

An empty result set proves the chain. A non-empty result means tampering or a bug — both are P1 incidents.

### 8.4 Signatures

Every record is signed with the **tenant's Ed25519 key**, generated at tenant creation and stored in HSM-backed key management (AWS KMS in `eu-central-1`, Hetzner Vault as DR alternative). The private key never leaves the HSM. The vault calls KMS `sign()`. Verification is public — anyone with the tenant's public key (published in the tenant's compliance portal) can verify any evidence record.

### 8.5 Timestamping

For records that must be defensible against "you backdated this":

- **Internal**: `sealed_at` is from a monotonic NTP-synced clock on the evidence service.
- **External**: high-stakes records additionally submit `artefact_sha256` to **RFC 3161 trusted timestamping** via at least two independent EU-based TSAs (Bundesdruckerei, Swiss Post). The two timestamps + their signatures are stored in `evidence_records.metadata.tsa`.

The cost of external timestamping is ~€0.01 per record. We apply it to all `kind in {annex_iv_section, dpia_signed, incident_report, regulator_export}`.

### 8.6 Audit reconstruction

"What was our policy on 2026-04-15 at 14:00? What did it decide on event X?"

Implemented via:
1. **Audit log** tells us every policy mutation by timestamp.
2. **Policy bundles** in object storage are versioned (`policies/<tenant>/<sha>.tar.gz`).
3. **Evidence records** for policy decisions store the `policy_bundle_sha`.

Given an `event_id`, we can reconstruct: which bundle was active, which rules matched, what action was returned, who approved any escalation. End-to-end, with cryptographic proof.

### 8.7 Forensics

For incident investigations:
- The audit log + evidence vault together give a complete history.
- Special "preservation" tag on records prevents retention-driven deletion until the case closes.
- A signed "forensic export" packages all records related to a subject (e.g. an affected user, a specific deployment) for legal review.

### 8.8 Regulator export packs

```
regulator-export-<tenant>-<from>-<to>.zip
├── manifest.json          (every file, sha256, signed)
├── inventory/
│   ├── ai_usecases.json
│   ├── vendors.json
│   ├── datasets.json
│   └── deployments.json
├── policies/
│   └── <bundle_sha>/      (snapshots of active bundles in the window)
├── decisions/
│   └── policy_decisions_<yyyymm>.parquet
├── evidence/
│   └── <record_id>/       (each evidence artefact + metadata)
├── audit/
│   └── audit_log_<yyyymm>.parquet
└── chain/
    └── verification.txt   (output of the chain verification query)
```

Deterministically produced. Signed with both the tenant key and the RSD platform key (two-of-two).

### 8.9 Historical state reconstruction

The graph + audit log together support "what did our governance posture look like on 2026-Q1-30?" queries. Implemented as event sourcing on top of the graph projector: replay the audit log up to time T, apply to a snapshot, and you have the graph at time T. Heavy queries are pre-materialised (per-tenant nightly snapshots).

---

## 9. Integrations

### 9.1 Integration matrix

| Provider | Auth | Direction | Triggers / data |
|---|---|---|---|
| **GitHub** | GitHub App (per-tenant install) | Bidirectional | Webhook on push/PR/release; we create issues + PR comments |
| **GitLab** | OAuth + project token | Bidirectional | Pipeline + push hooks; we create issues |
| **Jira** | OAuth 2.0 (Atlassian Cloud) or API token (Server) | Outbound (we create issues) | — |
| **Linear** | OAuth 2.0 | Outbound | — |
| **Slack** | OAuth 2.0 (per-workspace install) | Outbound + slash commands | Notifications + `/rsd approve <id>` |
| **Teams** | Azure AD app registration | Outbound + adaptive cards | Notifications + approve buttons |
| **AWS** | Cross-account IAM role (per tenant) | Inbound (we pull) | CloudTrail, Bedrock invocations, IAM auth events |
| **Azure** | Managed Identity + custom RBAC role | Inbound | Azure Monitor, Azure OpenAI logs, Entra audit |
| **GCP** | Workload Identity Federation | Inbound | Audit logs, Vertex AI usage |
| **Vercel** | Vercel integration | Inbound | Deployment webhooks, runtime logs (Edge) |
| **Netlify** | OAuth + site token | Inbound | Deploy webhooks |
| **Cloudflare** | API token (scoped) | Inbound | Workers events, Pages deploys, Zero Trust audit |
| **OpenAI** | Org API key (read-only) | Inbound | Org usage, audit logs |
| **Anthropic** | Workspace API key | Inbound | Org usage, audit logs |
| **Azure OpenAI** | Inherits Azure auth | Inbound | Resource logs |
| **HuggingFace** | Org access token | Inbound | Inference Endpoint logs, model card metadata |

### 9.2 Authentication model

- **OAuth 2.0 PKCE** for user-installed integrations (Slack, GitHub, GitLab, Linear, etc.). Refresh tokens stored in `vault.secrets` (Supabase Vault, eu-central-1, KMS-wrapped).
- **Cross-account roles** for hyperscaler reads (AWS IAM role assumption with `ExternalId` per tenant). Zero static creds.
- **Workload Identity Federation** for GCP. Same idea: no static keys.
- **API keys** as last resort (some SaaS still don't expose OAuth). Stored encrypted; rotated reminders surfaced in the UI; tenant-scoped.

### 9.3 Ingestion patterns

Three patterns, picked per provider:

1. **Push (webhook).** Provider POSTs to `https://api.rsd.eu/connectors/<provider>/<connector_id>`. We verify the signature, dedupe by provider event id, enqueue to telemetry pipeline. Used: GitHub, GitLab, Vercel, Netlify, Slack, Teams.
2. **Pull (poll).** Cron job per connector_id pulls deltas from the provider API. Cursor stored in Postgres. Used: OpenAI/Anthropic usage (no webhooks today), HuggingFace.
3. **Streaming (push via cloud-native).** AWS EventBridge → our SQS → our worker. Azure EventGrid → our endpoint. GCP Pub/Sub → our subscriber. Used: AWS, Azure, GCP.

### 9.4 Webhook strategy (outbound)

When we **send** events outbound (e.g. into a tenant's Datadog or webhook endpoint):

- HMAC-SHA256 signed payloads (`X-RSD-Signature`).
- Replay protection via `X-RSD-Timestamp` (5 minute window).
- At-least-once delivery; consumers must be idempotent on `event_id`.
- Exponential backoff retry: 1m, 5m, 30m, 3h, 24h, then DLQ.
- DLQ visible per-tenant in the developer console.

### 9.5 Sync architecture

For inbound integrations, each connector has a state machine in Postgres:

```
                  ┌──────────┐
                  │ pending  │
                  └────┬─────┘
                       │ install completed
                       ▼
                  ┌──────────┐
            ┌────▶│  active  │
            │     └────┬─────┘
            │          │  error rate > threshold
            │          ▼
            │     ┌──────────┐  manual fix
            └─────┤  failed  │
                  └──────────┘
                       │  user revokes
                       ▼
                  ┌──────────┐
                  │ revoked  │
                  └──────────┘
```

Each connector run records `last_run_at`, `cursor`, `events_ingested`, `errors`. The Connector Observability dashboard surfaces failures per tenant.

---

## 10. Multi-Tenancy & Security

### 10.1 Tenant isolation

Three layers, defence in depth:

| Layer | Mechanism | What it catches |
|---|---|---|
| **DB** | Postgres RLS policies on every governance table: `tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())` | App-layer bugs that try cross-tenant reads |
| **Service** | Every service receives a tenant-scoped JWT; rejects mismatched tenant_id in request body | Bugs in one service trying to act on another tenant |
| **Storage** | Object storage prefixed `tenant/<id>/...`; IAM policy on the prefix | Misissued presigned URLs |

### 10.2 RBAC

The five base roles (`owner`, `admin`, `dpo`, `developer`, `auditor`) compose from a permission catalogue.

```yaml
roles:
  owner:
    inherits: [admin]
    permissions: [billing:*, tenant:*]
  admin:
    inherits: [dpo, developer]
    permissions: [memberships:*, policy:write, integration:write:*]
  dpo:
    inherits: [auditor]
    permissions: [policy:write, workflow:transition, evidence:write, dpia:*, dsr:*, incident:*]
  developer:
    inherits: [auditor]
    permissions: [integration:read:*, integration:write:*, asset:write, ingest_key:*]
  auditor:
    permissions: [tenant:read, policy:read, evidence:read, audit_log:read, report:generate]
```

Custom roles are not free-form — they pick from the catalogue. Audit log records every role grant/revoke with a 7-year retention.

### 10.3 ABAC overlay

Attribute conditions evaluated **after** the role check:

```yaml
- action: deployment.publish
  condition: "actor.role >= 'admin' AND deployment.environment == 'production'"
- action: evidence.purge
  condition: "actor.role == 'dpo' AND target.retention_until < NOW()"
- action: agent.run.manual
  condition: "actor.role >= 'developer' AND agent.tier <= actor.max_agent_tier"
```

Implemented in a `policies/abac.rego` bundle that the API gateway calls per request. Latency cost: <2ms.

### 10.4 Encryption

- **At rest**: AES-256 by Postgres TDE + per-tenant CMK in AWS KMS / Hetzner Vault. Evidence vault uses envelope encryption (data key per record, wrapped with CMK).
- **In transit**: TLS 1.3 only. mTLS for service-to-service.
- **Application-level**: PII fields (email, phone) encrypted via pgcrypto with per-tenant keys; only decrypted at the read boundary by an authorized actor.

### 10.5 Audit logs (security view)

Beyond the operational audit log, a security audit log captures:
- Auth events (login, MFA challenge, token issued, token revoked).
- Admin actions (role changes, policy publish, evidence purge).
- Anomalies (impossible travel, brute force, privilege escalation attempt).

Shipped to a tenant-isolated SIEM stream (Elastic in `eu-central-1`) with 13-month minimum retention.

### 10.6 Secrets management

- **Tenant secrets** (integration tokens, webhook secrets): Supabase Vault (Postgres-native, KMS-wrapped, queryable but unreadable from the app role).
- **RSD platform secrets**: Doppler (EU-resident) for service env, AWS Secrets Manager for runtime KMS access.
- **Agent tool credentials**: scoped to one tenant + one tool, expire after run completion, never persisted in agent memory.

### 10.7 Regional data residency

| Data category | Default region | Allowed alternates |
|---|---|---|
| Tenant DB | eu-central-1 | eu-west-3 (DR), eu-west-1 (opt-in) |
| Object storage | eu-central-1 | eu-west-3 (DR) |
| Vector index | eu-central-1 | eu-west-1 |
| Telemetry hot | eu-central-1 | — |
| Telemetry cold (Parquet) | eu-central-1 | — |
| LLM inference | EU-only (Mistral La Plateforme, Azure OpenAI EU, AWS Bedrock EU) | US (opt-in per tenant per agent) |

Each LLM-using agent declares its accepted regions. Default deny on cross-region.

### 10.8 EU-only deployment strategy

- Primary: Hetzner Cloud (Nuremberg, Falkenstein, Helsinki) for compute + storage.
- Edge / CDN: Cloudflare with EU-only PoPs enabled.
- DR: AWS `eu-central-1` for evidence vault replication + cold storage.
- No US-resident control-plane services. Stripe (US-controlled) is the only US data path; only billing data crosses, no governance data.

### 10.9 Agent credential isolation

Each agent run gets a fresh, scoped token issued by a dedicated `Agent Token Service`:
- Bound to (tenant_id, agent_id, run_id).
- Expires in 30 min or on run completion, whichever first.
- Lists exactly the capabilities the agent declared in its manifest.
- Revokable individually without affecting other runs.

The Agent Token Service is the only service that can mint these tokens. The token format is a signed JWT plus an opaque server-side state record (so revocation works instantly).

---

## 11. Tech Stack

### 11.1 Recommendations

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| **Relational DB** | Postgres 15 + Apache AGE | One transactional store for relational + graph. RLS. EU hosting. AGE handles our graph scale through Phase 3. |
| **Graph DB (later)** | Neptune (AWS) or self-hosted JanusGraph — only if AGE saturates | We defer this until ≥10⁸ edges. |
| **Queue / event bus** | NATS JetStream | Lightweight, multi-tenant subjects, EU self-host, persistent streams. Kafka is overkill until Phase 3. |
| **Streaming pipeline** | Kafka (Confluent Cloud EU) — added at Phase 3 | When ingest > 1B events/month. |
| **Vector DB** | Qdrant (EU-self-hosted) | OSS, EU, gRPC, payload filters mean we can attach `tenant_id` and let the DB enforce isolation. Pinecone is US-hosted (deal-breaker). |
| **Search** | Meilisearch (self-host) | Fast, EU, simple. Elastic if we need aggregations. |
| **Object storage** | Hetzner Storage Box / Cloud Object Storage primary; S3 Frankfurt for evidence DR | Cost + EU sovereignty. |
| **Observability — metrics** | VictoriaMetrics + Grafana | Lower TCO than Prometheus at scale, fully OSS. |
| **Observability — traces** | Tempo + OpenTelemetry collector | OTLP everywhere. |
| **Observability — logs** | Loki | Cheap; trace correlation. |
| **SIEM** | Elastic Cloud (eu-central-1) | Tenant-isolated streams. |
| **Workflow orchestration** | Temporal (self-host on Hetzner) | Durable execution, the right abstraction for DPIA/DSR/incident workflows. |
| **Agent orchestration** | In-house on Cloud Run / Fly Machines | Off-the-shelf agent frameworks (LangGraph) are libraries, not orchestrators. We need the orchestrator we describe in §6.2, not their runtime. |
| **LLM routing** | LiteLLM proxy (self-host, EU) | One API for OpenAI / Anthropic / Mistral / Azure OpenAI / Bedrock; built-in cost tracking. |
| **Inference (open-source models)** | TGI on dedicated GPU nodes (Hetzner GEX or Lambda EU) for Llama-3, Mistral, Mixtral | For tenants with "no closed-source LLM" policy. |
| **Inference (closed-source)** | Mistral La Plateforme (FR), Azure OpenAI Sweden / France, Anthropic via AWS Bedrock EU | All EU-resident. |
| **API gateway** | Hono on Deno Deploy (edge) + Cloudflare Workers as alt | TS-native, low cold-start. Supabase Edge Functions for tenant-data adjacent endpoints. |
| **CI/CD** | GitHub Actions + ArgoCD for Kubernetes manifests | Already in use. |
| **IaC** | Pulumi (TypeScript) | Same language as the app code; type-safe infra. |
| **Cluster** | k3s on Hetzner (3-node ctrl + N workers) | Cheap, EU, no AWS lock-in. AWS for evidence-only. |
| **Secrets** | Supabase Vault (tenant), Doppler (platform), AWS KMS (CMK / sign) | Tiered by trust level. |

### 11.2 What we explicitly reject

- **AWS Bedrock as default**. US-controlled service, even in EU regions. Used only as fallback for tenants that opt in.
- **Pinecone**. US-only at meaningful scale tier.
- **OpenAI Embeddings as default**. Switch to `intfloat/multilingual-e5-large` self-hosted; OpenAI only on tenant opt-in.
- **Auth0**. EU hosting tier costs > our entire stack today; Supabase Auth + WorkOS for enterprise SSO is sufficient.
- **LangChain in production**. Library churn + memory leaks observed in 2025–2026; in-house orchestrator is cheaper to maintain.

### 11.3 Open-source-first stance

Every paid SaaS in the stack must have a documented OSS replacement and a migration plan. The threshold to add a closed-source dependency is: "this is the only thing on the market that works, and we have a 12-month exit plan."

---

## 12. Implementation Roadmap

Five phases. Each phase ships in 4–8 months.

### Phase 1 — MVP Governance Runtime (DONE, May 2026)

**Goal**: prove the end-to-end loop closes.

| Dimension | Phase 1 deliverable |
|---|---|
| Architecture | Single-tenant per Supabase project (PoC), 11 edge functions, 16 migrations |
| Features | Onboarding, asset/policy CRUD, ingest keys, browser extension, telemetry ingest, policy engine, audit log, webhooks, approvals, DPIA, DSR, incidents (72h), connectors (Jira/GitHub/Slack), vendors, multi-env, cost tracking, compliance export |
| Integrations | Jira, GitHub, Linear, ServiceNow, Slack, Teams (write-only) |
| Data model | 22 governance tables + materialised views |
| Agents | 0 production agents; Risk Engine runs as a scheduled batch |
| Target customers | 5 pilot enterprises, EU-only, governance-led design partner program |
| Monetization | Tier pricing (Starter €79, Growth €249, Agency €699, Enterprise €1500+) |
| Hiring | Founding eng team (4 FTE), 1 compliance counsel, 1 design partner success |

**Where the pilot leaves gaps**: 
- Single-DB multi-tenancy (RLS only, no schema-per-tenant)
- No agent runtime, no graph DB
- Token-usage payload not yet piped end-to-end
- No JIRA/GitHub remediation executor (only manual flow)

### Phase 2 — AI Governance OS (Q3 2026 → Q1 2027)

**Goal**: become the system that runs continuously, not the dashboard the human checks weekly.

| Dimension | Phase 2 deliverable |
|---|---|
| Architecture | Split into 6 first-class services (Telemetry Collector, Policy Engine, Risk Engine, Evidence Engine, Notification, Reporting). Postgres + Apache AGE for graph. NATS JetStream for events. |
| Features | Governance Graph v1, AI-Act classifier service, Annex IV generator, regulatory intelligence MVP, drift detector, real-time policy enforcement (inline mode for SDK), evidence vault v2 (hash chain + Ed25519 + RFC 3161 timestamping) |
| Integrations | + AWS / Azure / GCP read-only connectors, OpenAI / Anthropic / Azure OpenAI usage pulls, Vercel deploy hooks |
| Data model | Graph nodes/edges; evidence chain enforced by trigger; policy bundle storage |
| Agents | First three: AI Risk Classification Agent, Website Drift Agent, Evidence Generation Agent. Approval gates in production. |
| Target customers | First 50 paying enterprises. AI-Act high-risk operators (HR-tech, healthtech, fintech, edtech) prioritised. |
| Monetization | Add seat-based pricing on top of platform tiers. Compliance Pack add-ons (e.g. "ISO 27001 evidence templates", €299/mo). |
| Hiring | + 1 Agent Runtime engineer, + 1 Compliance Engineer (AI Act specialist), + 2 Customer Engineer |

**Definition of done for Phase 2**: a tenant can stand up the OS, connect their AWS + OpenAI + GitHub, and within 24 hours have a populated graph, classified usecases, sealed evidence and a generated draft Annex IV. End-to-end without a human inside RSD doing manual work.

### Phase 3 — Agentic GRC (Q2 2027 → Q4 2027)

**Goal**: agents run material parts of the compliance program autonomously, with humans on approval gates.

| Dimension | Phase 3 deliverable |
|---|---|
| Architecture | Agent Runtime + Orchestrator in production. Temporal for workflow durability. Kafka added as the primary event bus (NATS demoted to internal control plane). |
| Features | Full agent fleet (10 agents), chain-of-agents workflows, agent risk budgeting, agent governance meta-agent, automated regulator export packs |
| Integrations | + GitLab, HuggingFace, Cloudflare Zero Trust, Atlassian Suite, ServiceNow GRC mod |
| Data model | Per-tenant Kafka topic partitions; agent_runs + agent_traces with SHA-keyed payloads in S3 |
| Agents | 10/10 production agents; per-agent SLOs published |
| Target customers | First 5 customers >5k seats. First public-sector tenant. |
| Monetization | Per-agent-run pricing tier added (e.g. €0.05/run for the Vendor Risk Agent). Enterprise contracts cross €500k ACV. |
| Hiring | + 1 Agent Eng (sr), + 1 Eval Eng (agent quality), + 1 SRE, + 1 EU Public Sector AE |

### Phase 4 — Cross-Framework Compliance Infrastructure (Q1 2028 → Q3 2028)

**Goal**: one event, all frameworks. The OS becomes the infrastructure layer beneath every other compliance tool in the customer's stack.

| Dimension | Phase 4 deliverable |
|---|---|
| Architecture | Multi-region active (EU-central + EU-west). Per-tenant Postgres clusters at the top tier. Optional per-tenant Kafka cluster. |
| Features | Cross-framework control library (GDPR, AI Act, ISO 27001, SOC2, NIST AI RMF, DORA, NIS2, HIPAA-EU, sectoral); compliance graph diffs; auto-mapped evidence reuse across frameworks |
| Integrations | API + SDK for plugging RSD into other GRC tools (Vanta, Drata, Hyperproof). RSD becomes the data plane, they become the UI plane for non-AI controls. |
| Data model | Control taxonomy v3; per-framework evidence reuse pointers |
| Agents | Domain-specialised classifier agents (sectoral); custom-tenant-agent SDK published |
| Target customers | First 5 customers >50k seats. First multi-national bank. First insurance carrier. |
| Monetization | Platform-tier pricing crosses €1M ACV. SI partner channel. |
| Hiring | + EU sales team (DE, FR, NL, ES). EU compliance research team (2 FTE). |

### Phase 5 — Autonomous Governance Platform (2029+)

**Goal**: governance runs as infrastructure. The customer's compliance team supervises a fleet of agents the way an SRE team supervises Kubernetes.

| Dimension | Phase 5 deliverable |
|---|---|
| Architecture | "Governance-as-platform". Customers run their own RSD operator in their cluster (Hybrid deployment); control plane stays managed. |
| Features | Predictive governance (forecast which usecases will breach controls next quarter); autonomous incident response; reg-tech sandbox where new EU regulations are simulated against the live graph before they're enacted |
| Integrations | Direct integration with EU regulator portals (eIDAS-signed reports submitted from the platform) |
| Agents | Customer-authored agents via our SDK (verified + sandboxed) |
| Target customers | Global Top-500 EU operations. Sovereign-tech contracts (BSI, ANSSI). |
| Monetization | Per-asset metered pricing at platform tier. SDK royalty model. |
| Hiring | Open-ended. |

---

## 13. Cross-cutting concerns

### 13.1 SLOs

| Service | Availability | p99 latency | Error rate |
|---|---|---|---|
| Telemetry ingest | 99.95% | <100ms | <0.1% |
| Policy decision (inline) | 99.9% | <50ms | <0.05% |
| Graph query (UI-driven) | 99.9% | <500ms | <0.5% |
| Agent run start | 99.5% | <30s | <2% |
| Evidence seal | 99.99% | <2s | <0.01% |
| Reporting (Annex IV) | 99.5% | <5min | <1% |

### 13.2 Data classification

Every column on every governance table tagged at schema time:

```sql
COMMENT ON COLUMN governance_events.payload IS 'class: tenant_sensitive; pii: maybe; retention: 90d';
COMMENT ON COLUMN dpias.dpo_email IS 'class: pii; lawful_basis: contract; retention: 7y';
COMMENT ON COLUMN evidence_records.artefact_sha256 IS 'class: derived; pii: no; retention: chain';
```

Classes: `public`, `internal`, `tenant_sensitive`, `pii`, `secret`. The DSR engine reads these comments to know which columns to mask in exports and which to delete on erasure.

### 13.3 Schema evolution discipline

- Migrations are append-only after merge to main. CI enforces this; the only exception is `[hotfix]`-prefixed PRs for migrations that never successfully ran in production.
- Every new table ships with: RLS enabled, owner role, service role policy, tenant-read policy, an `updated_at` trigger, indices for `tenant_id` + the obvious access patterns, and a comment classifying each column.
- Materialised view changes go through a `CREATE OR REPLACE` migration; views referenced by other views require rebuild scripts in the migration.

### 13.4 Cost model (back-of-envelope, Phase 2)

| Cost line | Estimate | Driver |
|---|---|---|
| Compute (Hetzner k3s) | €1.2k/mo | 8 nodes, 32 vCPU each |
| Postgres (managed, eu-central-1) | €2k/mo | tenant DB + 2 read replicas |
| Object storage | €0.3k/mo | 5TB + egress |
| Kafka / NATS | €0.4k/mo | dedicated brokers |
| Qdrant | €0.5k/mo | vector index, 3-node cluster |
| Observability | €0.6k/mo | metrics + logs + traces |
| LLM (operations) | €2k/mo | classifier + agents at 50 tenants |
| KMS | €0.1k/mo | per-tenant CMK |
| TSA timestamping | €0.05k/mo | high-value evidence only |
| **Total infrastructure** | **~€7.2k/mo at 50 paying tenants** | — |

ARR/cost ratio at Phase 2 target (50 tenants × avg €1.2k/mo MRR): **10×**. Healthy.

### 13.5 Open questions (Phase 1 → Phase 2 transition)

These get resolved in dedicated ADRs before Phase 2 kickoff:

1. **Per-tenant Postgres vs single-DB-RLS at scale?** Decision criterion: when noisy-neighbour incidents > 1/quarter on the shared DB. ADR-0014 owner: platform lead.
2. **AGE vs Neo4j cutover threshold?** Currently set to 10⁸ edges; revisit at 10⁷. ADR-0015 owner: graph lead.
3. **Should agents have their own Kafka topics, or share telemetry topic?** Sharing is simpler; isolation costs more. ADR-0016 owner: agent runtime lead.
4. **In-house OPA build vs vendored binary?** Currently vendored; in-house may be needed for custom built-ins. ADR-0017 owner: policy lead.

---

## 14. Open questions for the founding team

1. **Pricing model**: shift from seat-based to event-based, or hybrid? Event-based aligns with the "infrastructure" framing; seats are familiar to enterprise buyers.
2. **Open-core**: which parts of the platform do we open-source? The SDK is obvious. The policy bundle format. The classifier rule engine. The orchestrator probably stays closed.
3. **Partner channel**: do we sell direct to enterprises only, or build a partner program with EU SI firms (Capgemini, Atos, T-Systems) from Phase 3?
4. **Compliance moat**: do we acquire or partner with a notified body for AI Act conformity assessment, or stay product-only?

These are not architectural choices, but they materially affect what we build in Phase 4–5 and how.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Asset** | Anything that is governed: an AI usecase, a website, a model, a dataset, a vendor, a deployment. |
| **Control** | A technical or organisational measure that implements a regulatory requirement. |
| **Evidence** | A hashed, timestamped, signed artefact that proves a control was satisfied at a point in time. |
| **Obligation** | A specific requirement on the tenant arising from a regulation (e.g. "complete Annex IV before market"). |
| **Policy** | A versioned, executable artefact that decides what action to take when an event happens. |
| **Policy decision** | The output of evaluating a policy against an event: `(action, score, matched_rules)`. |
| **Tenant** | The unit of isolation. A tenant has its own data, policies, evidence chain, KMS key, billing. |
| **Workflow** | A stateful, multi-step process spanning humans and agents (DPIA, DSR, incident, vendor review). |

---

*End of v1 blueprint. Open ADRs and per-section deep dives live under `docs/architecture/adr/` and `docs/architecture/sections/`.*
