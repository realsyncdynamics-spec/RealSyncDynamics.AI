# ACS — Agent Contract Standard

**Version:** 1.0
**Status:** Draft
**Schema:** [`schemas/agent-contract.schema.json`](schemas/agent-contract.schema.json)

Every agent on the RealSync runtime ships with an **Agent Contract**: a declarative manifest that says, in machine-readable form, what the agent consumes, what it emits, what it is allowed to do, and what runtime context it needs. The contract is loaded into the agent registry by `realsync-runtime-core` at registration time and is consulted by the bus, the evidence runtime and the policy engine for every dispatch.

The premise: **no contract, no dispatch.** An agent without a valid manifest is invisible to the runtime.

---

## 1. Why this exists

Without ACS, three classes of bug are unprovable but inevitable:

1. **Permission creep.** An agent quietly starts writing evidence or appending to the chain. There is no boundary to enforce because no one wrote one down.
2. **Context drift.** An agent assumes `tenant.region == "eu-central-1"`. One day a tenant signs up in `eu-west-3`. The agent does the wrong thing silently.
3. **Audit gap.** A regulator asks "what can the OCR agent do?" The answer lives in five files and in someone's head.

ACS makes each of these explicit, immutable, and checkable at boot.

---

## 2. Required manifest fields

```yaml
spec_version: "1.0"

agent:
  name:         "evidence-agent"          # MUST be unique per tenant per type
  type:         "evidence"                # ocr | tax | inventory | compliance | evidence | custom
  version:      "1.4.0"                   # SemVer of the agent code itself
  description:  "Hash and seal incoming governance events."
  owner:        "realsync-platform"       # team or vendor

permissions:                              # closed allow-list — agent can ONLY do these
  - evidence.create
  - chain.append
  - hash.generate

accepts:                                  # event subjects this agent subscribes to
  - subject: "governance.event"
    min_severity: "low"                   # OPTIONAL filter
  - subject: "audit.event"

returns:                                  # event subjects this agent may emit
  - subject: "evidence.created"
  - subject: "evidence.export.ready"
    requires_human_review: false

runtime_context:                          # what fields of RCS this agent reads
  required:
    - tenant.tenant_id
    - tenant.region
    - governance.gdpr_mode
  optional:
    - finance.tax_year

deployment:
  endpoint:     null                      # null for bus-only agents; URL for HTTP-callable
  health_path:  "/health"                 # MUST exist when endpoint is set
  concurrency:  4                         # max parallel dispatches

compliance:
  ai_act_role:  "limited_risk"            # high_risk | limited_risk | minimal_risk | excluded
  decides:      false                     # true iff agent makes binding automated decisions
```

---

## 3. The `permissions` allow-list

The runtime defines a closed set of permission strings at v1.0:

| Permission | Capability |
|---|---|
| `event.publish` | Emit any event whose subject is also in `returns` |
| `evidence.create` | Append a new evidence record |
| `evidence.read` | Read evidence records of the agent's tenant |
| `chain.append` | Add a link to the immutable audit chain |
| `hash.generate` | Produce a content hash for incoming payloads |
| `policy.evaluate` | Call the policy engine for a compliance decision |
| `agent.dispatch` | Invoke another agent by id |
| `tenant.read` | Read tenant metadata (slug, plan, region) |
| `secret.read.{name}` | Read a specific named secret (e.g. `secret.read.openai_api_key`) |

An agent that attempts an operation outside its `permissions` set **MUST** be denied at the boundary, the attempt **MUST** be persisted to the evidence chain as a `policy.violation` event, and the agent **MUST** be transitioned to `status = 'error'`.

New permissions **MUST** be introduced via a MINOR spec bump. The allow-list is not extensible by tenants.

---

## 4. `accepts` and `returns` are part of the contract

Both lists are **closed**. An agent that publishes a subject not in its `returns` is in violation of its own contract and the runtime **MUST** reject the publication.

The reason is reversibility: if an agent could emit any subject at any time, no consumer could decide, ahead of dispatch, whether the resulting events are within their scope. The closed lists let the runtime compute, statically:

- Which agents *can* trigger which agents (`returns` ∩ `accepts`).
- Which events a tenant *could ever* see based on the agents installed.
- Which compliance scope each agent operates in (aggregated from `returns[].compliance`).

This is what makes the runtime *certifiable* rather than merely *deployed*.

---

## 5. `runtime_context.required` and `optional`

An agent's manifest **MUST** list every RCS field it reads. Reading a field not declared as `required` or `optional` is a contract violation.

This serves three purposes:

- **Tenant suspension:** a tenant whose `governance.gdpr_mode` is incompatible with an agent's required fields can be refused dispatch *before* the agent is invoked, with a structured error.
- **Schema migrations:** when RCS adds a field in v1.x, the registry can answer "which existing agents read field X?" by scanning manifests — no code archaeology.
- **Audit:** a regulator asking "what tenant attributes does this agent see?" gets a list, not a search.

---

## 6. `compliance.decides` and `ai_act_role`

`decides = true` means the agent makes a **binding automated decision** in the AI Act sense — its output is the system's final answer with no human review. These agents:

- **MUST** declare `ai_act_role = "high_risk"` if the decision domain falls under Annex III of Regulation (EU) 2024/1689.
- **MUST** declare `requires_human_review` on at least one `returns[]` entry, in conformance with HRP §3 ("decision-equivalent" events).
- **MUST** emit a `policy.evaluated` event before the decision-equivalent event, so the chain shows what rules were applied.

`decides = false` agents prepare, classify, or recommend; they do not finalise.

---

## 7. Registration lifecycle

```
   agent boot
       │
       ▼
   load manifest from disk / config
       │
       ▼
   POST /agents (manifest)  ───▶  validate against schema
                                  │
                                  ├─ invalid ─▶ refuse boot, log to evidence chain
                                  │
                                  └─ valid ──▶ persist to agents table
                                                │
                                                ▼
                                          subscribe to `accepts[]`
                                                │
                                                ▼
                                          status = 'idle' → ready to receive
```

A manifest update **MUST** be a new registration with a bumped `agent.version`. The runtime **MUST** keep both versions live until the operator explicitly retires the old one, so in-flight events are processed by the contract they were dispatched under.

---

## 8. Conformance checklist

An agent is ACS-conformant at v1.0 if and only if:

- [ ] It declares `spec_version = "1.0"`.
- [ ] `agent.name` is unique within its tenant scope and matches `/^[a-z][a-z0-9-]{1,62}$/`.
- [ ] `agent.type` is one of the enum values in §2.
- [ ] `agent.version` is a valid SemVer string.
- [ ] Every `permissions[]` entry is from the closed list in §3.
- [ ] Every `accepts[].subject` matches the ESS subject pattern.
- [ ] Every `returns[].subject` matches the ESS subject pattern.
- [ ] `runtime_context.required[]` only references fields defined in RCS v1.x.
- [ ] If `compliance.decides = true`, at least one `returns[]` entry has `requires_human_review = true` OR `compliance.ai_act_role` is `"minimal_risk"` or `"excluded"`.
- [ ] At runtime, the agent never publishes a subject not in `returns[]`.
- [ ] At runtime, the agent never invokes a permission not in `permissions[]`.

Two failing checks on the same agent within a 24 h window **SHOULD** trigger an operator alert; three **MUST** auto-disable the agent.
