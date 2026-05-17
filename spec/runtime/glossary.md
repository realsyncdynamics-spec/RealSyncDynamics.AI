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

## Deprecated / non-preferred terms

| Don't use | Use instead | Why |
|---|---|---|
| "Webhook" (internal) | Event | "Webhook" implies HTTP; the bus is not HTTP. |
| "Microservice" | Agent or Component | Industry word, too broad. |
| "Audit log" | Evidence chain | A log can be rewritten; a chain cannot. |
| "Database write" (for evidence) | Append | Evidence is append-only by spec. |
| "User" (when scoping) | Tenant + User | Scoping is always tenant-first, user-second. |
