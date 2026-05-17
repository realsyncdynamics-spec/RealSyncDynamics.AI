# RealSync Runtime — Glossary

The runtime specs use these terms with the meanings fixed below. Synonyms are listed where the industry uses them interchangeably; within these specs only the **preferred form** is normative.

---

### Agent
A bounded component that consumes one or more events and optionally emits one or more events. An agent **MUST** declare an Agent Contract (ACS). "Agent" is the runtime term; "service", "worker", "function", "lambda" are non-normative synonyms.

### Bus
The transport that delivers events from producers to consumers. The reference implementation uses NATS; the spec is transport-agnostic. The bus **MUST** preserve event ordering per `subject` per `tenant_id`.

### Consumer
Any component that subscribes to events from the bus. A consumer **MAY** also be a producer.

### Content Hash
A cryptographic digest of a payload, used to detect tampering and to link evidence records. The runtime fixes the algorithm at **SHA-256** for v1.0. Future major versions **MAY** introduce a hash agility field.

### Evidence Record
An immutable persisted observation of a real-world or system fact. Defined by ECS. An evidence record **MUST NOT** be updated or deleted by a tenant or operator; rectification is achieved by appending a successor record that references the original via `replaces_id`.

### Event
A structured message published on the bus, conforming to ESS. Events are the only legal wire format between components inside the runtime. Components **MAY** use other protocols for ingress (HTTP, gRPC) but **MUST** translate to ESS before publishing.

### Forward Auth
A request-rewriting mechanism (typically Traefik or NGINX `auth_request`) that authenticates an incoming HTTP request against `realsync-runtime-core` and injects `X-Tenant-ID`, `X-User-ID`, `X-User-Role` headers before the request reaches the target service. See RCS §2.

### Human Review
A workflow gate at which an automated decision **MUST** be paused for explicit human approval before its side effects fire. Defined by HRP.

### Producer
Any component that publishes events to the bus.

### Runtime Context (RCS Envelope)
The tenant- and request-scoped object every handler receives as its first dependency. Carries `tenant`, `governance`, optional domain blocks (`finance`, `inventory`, …). Defined by RCS.

### Sealed Evidence
An evidence record whose `current_hash` has been computed and whose preceding chain link (`previous_hash`) has been verified. A consumer **MUST NOT** treat an evidence record as authoritative until it is sealed.

### Severity
A classification of an event's operational urgency: `info | low | medium | high | critical`. Severity is independent of compliance classification (`gdpr`, `ai_act`).

### Spec Version
A two-component identifier `MAJOR.MINOR` declared on every event, manifest and context envelope. Producers and consumers negotiate compatibility via `spec_version`.

### Subject
A dotted name identifying an event class (`invoice.received`, `ai.risk.classified`, `policy.updated`). Subjects form a hierarchy: a consumer subscribing to `invoice.*` **MUST** receive `invoice.received`, `invoice.classified`, etc.

### Tenant
A logical isolation unit. All non-system events **MUST** carry a `tenant_id` and **MUST NOT** be cross-readable between tenants. The runtime enforces tenant isolation as a primary security boundary.

---

## v1.1 additions

### Evidence Coupling
The four-mode declaration on an agent's manifest (`mandatory | optional | linked | forbidden`) that specifies whether the agent **MUST**, **MAY**, **MUST link to**, or **MUST NOT** produce evidence. Defined by EVC.

### Escalation Matrix
The per-severity-tier behaviour declaration on an agent's manifest. Each tier (`sev_info` … `sev_critical`) specifies whether the agent auto-continues, requires triage, or requires human review. Defined by EM.

### Output Constraints
The output-shape declaration on an agent's manifest — `format`, `schema_validation`, `confidence_score`, `template_locked`, `hallucination_sensitive`. Pins the agent's response surface so downstream consumers can rely on it. Defined by OC.

### Triage
A pre-review human gate distinct from HRP review. A triager (role: `admin`+) groups, prioritises, dismisses, or escalates events to review. The triager **MAY** also be the eventual reviewer; HRP §4 (no self-review) only constrains the escalator-to-reviewer step.

### PII Access (`pii_access`)
The four-level declaration on a CPS `isolation` block specifying the agent's exposure to personally-identifiable information: `none` (PII fields stripped before invocation), `minimised` (one-way transformations), `scoped` (cleartext for explicitly requested records only), `full` (cleartext, requires HRP gating).

### Cross-Tenant Visibility (`cross_tenant_visibility`)
The three-level declaration on a CPS `isolation` block specifying the agent's view across tenants: `forbidden` (default; tenant isolation strict), `aggregate_only` (statistics only, never per-tenant rows), `full` (raw cross-tenant reads — operator agents only).

### Runtime Freeze
The `frozen` agent state. Triggered by the runtime when an agent emits repeated `sev_critical` events AND its manifest carries `escalation_matrix.sev_critical.runtime_freeze_possible = true`. Bus deliveries pause until an operator clears the state via `frozen.unfreeze`.

---

## Deprecated / non-preferred terms

| Don't use | Use instead | Why |
|---|---|---|
| "Webhook" (internal) | Event | "Webhook" implies HTTP; the bus is not HTTP. |
| "Microservice" | Agent or Component | Industry word, too broad. |
| "Audit log" | Evidence chain | A log can be rewritten; a chain cannot. |
| "Database write" (for evidence) | Append | Evidence is append-only by spec. |
| "User" (when scoping) | Tenant + User | Scoping is always tenant-first, user-second. |
