# ESS — Event Specification Standard

**Version:** 1.0
**Status:** Draft
**Schema:** [`schemas/event.schema.json`](schemas/event.schema.json)

This specification defines the wire format of every event on the RealSync runtime. Components inside the runtime communicate **exclusively** in events that conform to this spec. Ingress from outside the runtime (HTTP, gRPC, file-drop) **MUST** be translated to ESS-conformant events before reaching the bus.

---

## 1. Why this exists

A runtime that allows ad-hoc payloads cannot:

- guarantee tenant isolation,
- attach evidence to a uniformly hashable byte sequence,
- support tooling that does not yet exist (replay, analytics, certifier export),
- be audited by a third party who has never seen the producer's code.

ESS solves all four by fixing the envelope. Producers and consumers may evolve their domain payloads freely as long as the envelope holds.

---

## 2. Required envelope

Every event **MUST** be a JSON object with the following top-level structure:

```yaml
spec_version:   "1.0"                     # MUST match the major.minor of this spec
id:             "evt_01HXYZ..."           # ULID, MUST be unique across the runtime
subject:        "invoice.received"        # dotted name, MUST match /^[a-z][a-z0-9_.]*$/
category:       "finance"                 # one of: finance | governance | inventory | ai | platform
severity:       "medium"                  # info | low | medium | high | critical
occurred_at:    "2026-05-15T11:23:04Z"    # MUST be RFC3339 UTC

source:
  agent:        "detection-agent"         # ACS-declared name
  runtime:      "realsync-runtime-core"   # service identifier
  spec_version: "1.0"                     # ACS spec version of the producer

tenant:
  tenant_id:    "tenant_123"              # MUST be present except for `platform.*` system events
  region:       "eu-central-1"            # ISO-style region code

correlation:
  trace_id:     "trace_01HXYZ..."         # MUST be present; propagated end-to-end
  parent_id:    "evt_01HABC..."           # MAY be absent for root events

payload: { ... }                           # opaque to the spec; constrained by `subject`

compliance:
  gdpr:                  true              # boolean, MUST be present
  ai_act:                false             # boolean, MUST be present
  retention_years:       10                # integer >= 0
  human_review:                            # optional, see HRP
    required:            false
    reason:              null

evidence:
  required:            true                # if false, no evidence record is written
  sha256:              null                # set by the evidence runtime, NOT by producer
  immutable:           true
```

A field marked **MUST** that is missing makes the event **non-conformant**. A consumer **MUST** reject non-conformant events with `protocol_violation` and **MUST NOT** silently coerce them.

---

## 3. The `subject` taxonomy

Subjects form a hierarchy. A consumer subscribing to a prefix **MUST** receive all events under it. The runtime ships these top-level categories at v1.0:

| Prefix | Owner | Examples |
|---|---|---|
| `invoice.*` | finance pipeline | `invoice.received`, `invoice.classified`, `invoice.rejected` |
| `inventory.*` | operations | `inventory.updated`, `inventory.depleted` |
| `tax.*` | finance/tax | `tax.deadline.due`, `tax.package.prepared` |
| `ai.*` | AI orchestration | `ai.risk.classified`, `ai.completion.requested` |
| `agent.*` | agent runtime | `agent.dispatched`, `agent.executed`, `agent.failed` |
| `policy.*` | governance | `policy.updated`, `policy.activated`, `policy.evaluated` |
| `evidence.*` | evidence runtime | `evidence.created`, `evidence.export.ready` |
| `runtime.*` | core platform | `runtime.tenant.created`, `runtime.scan.completed` |
| `platform.*` | system-level (no tenant) | `platform.deploy.completed` |

New top-level categories **MUST** be introduced via a MINOR spec bump. Sub-subjects within an existing category **MAY** be added at any time without a spec bump.

---

## 4. Identifiers

- `id` and all `*_id` correlation fields **MUST** be [ULID](https://github.com/ulid/spec) v1, lowercase with a stable prefix:
  - `evt_<ulid>` for events
  - `trace_<ulid>` for traces
- `tenant_id` is opaque to the spec; the platform fixes its format (currently UUID v4) but a future implementation **MAY** use ULID or a custom scheme.

A consumer **MUST NOT** parse identifier internals to make policy decisions. Identifier inspection beyond equality / prefix-check is non-conformant.

---

## 5. Severity vs. compliance

`severity` describes operational urgency. `compliance.{gdpr,ai_act}` describes regulatory scope. These are independent axes:

| | `gdpr=false` | `gdpr=true` |
|---|---|---|
| `severity=info` | logging only | needs to be in evidence chain |
| `severity=critical` | page on-call | page on-call AND notify DPO |

A producer **MUST NOT** raise `severity` to escalate a compliance concern; it **MUST** set the `compliance` block correctly instead.

---

## 6. Versioning and forwards-compatibility

- Consumers **MUST** accept events whose `spec_version` MINOR is greater than their own, by ignoring unknown fields. Strict validation belongs in a separate certification step, not in the hot path.
- Consumers **MUST** reject events whose `spec_version` MAJOR is greater than their own, because the envelope itself may have changed.
- Producers **MUST NOT** downgrade an event's `spec_version` to match a consumer; the consumer is responsible for upgrading or rejecting.

---

## 7. Tenant isolation

Tenant isolation is the runtime's primary security boundary. The bus **MUST** prevent cross-tenant delivery:

- A subscription scoped to `tenant_id = X` **MUST NOT** receive events for `tenant_id = Y`.
- The reference implementation enforces this in the consumer (filter on receipt). A stricter implementation **MAY** use NATS account isolation per tenant.
- `platform.*` events have no `tenant_id` and **MUST NOT** carry tenant-scoped payload.

Cross-tenant data in any non-`platform.*` event is a **P0** security incident.

---

## 8. Worked example

A typical `invoice.received` event:

```json
{
  "spec_version": "1.0",
  "id": "evt_01HXYZ8K9M2NQ5P3R7T6V8WJYC",
  "subject": "invoice.received",
  "category": "finance",
  "severity": "medium",
  "occurred_at": "2026-05-15T11:23:04.512Z",
  "source": {
    "agent": "detection-agent",
    "runtime": "realsync-runtime-core",
    "spec_version": "1.0"
  },
  "tenant": {
    "tenant_id": "ac1d8c4f-3a4f-4e3a-9b1a-3f4c5b6a7d8e",
    "region": "eu-central-1"
  },
  "correlation": {
    "trace_id": "trace_01HXYZ8K9M2NQ5P3R7T6V8WJYC",
    "parent_id": null
  },
  "payload": {
    "invoice_number": "RE-2026-0042",
    "issuer": { "name": "Acme GmbH", "vat_id": "DE123456789" },
    "amount_gross": 1190.00,
    "currency": "EUR",
    "received_at": "2026-05-15T11:23:00Z",
    "source_channel": "email"
  },
  "compliance": {
    "gdpr": true,
    "ai_act": false,
    "retention_years": 10,
    "human_review": { "required": false, "reason": null }
  },
  "evidence": {
    "required": true,
    "sha256": null,
    "immutable": true
  }
}
```

After the evidence runtime processes it, the same event id appears in the evidence chain (see ECS) with `sha256` populated.

---

## 9. Conformance checklist

A producer is ESS-conformant at v1.0 if and only if every event it emits:

- [ ] sets `spec_version` to `"1.0"`,
- [ ] has a ULID `id` unique across all its emissions,
- [ ] has a `subject` matching `/^[a-z][a-z0-9_.]*$/` from the taxonomy in §3,
- [ ] sets `category`, `severity`, `occurred_at` (UTC RFC3339),
- [ ] sets `source.agent`, `source.runtime`, `source.spec_version`,
- [ ] sets `tenant.tenant_id` (or omits the `tenant` block iff `subject` starts with `platform.`),
- [ ] sets `correlation.trace_id`,
- [ ] sets both `compliance.gdpr` and `compliance.ai_act` (booleans),
- [ ] sets `compliance.retention_years` as a non-negative integer,
- [ ] sets `evidence.required` and `evidence.immutable`,
- [ ] does NOT set `evidence.sha256` (that is the evidence runtime's exclusive write),
- [ ] does NOT include cross-tenant data anywhere in `payload`.
