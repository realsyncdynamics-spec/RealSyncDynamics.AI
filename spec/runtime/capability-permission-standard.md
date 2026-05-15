# CPS — Capability & Permission Standard

**Version:** 1.0
**Status:** Draft
**Schema:** [`schemas/capability.schema.json`](schemas/capability.schema.json)

The **Capability & Permission Standard** governs what each agent on the RealSync runtime is permitted to do, what it is forbidden from doing, when it must escalate, and what runtime isolation guarantees apply. It is the security backbone of the runtime — the layer that turns "agents can do X" (ACS §3) into a system where uncontrolled action is impossible by construction.

CPS extends ACS. Every conformant agent **MUST** declare a CPS block in its manifest in addition to its ACS contract.

---

## 1. Why this exists

ACS gives an agent a permission allow-list. That is necessary but not sufficient. Three failure classes remain after ACS alone:

1. **Implicit-deny gaps.** "What an agent must not do" is the absence of a permission. Negative absence is hard to audit: a reviewer must enumerate everything not in the list to know what is forbidden. **Explicit restrictions** turn this into a positive contract.
2. **Escalation invisibility.** Some actions are conditionally permitted: an agent **MAY** export tax data, but only under human review, only in the tenant's region, only with a fresh policy evaluation. ACS cannot express the conditional shape. CPS does.
3. **Privilege creep.** An agent of trust level "annotate" gradually accumulates permissions and ends up effectively at "autonomous". CPS pins a **trust level** to each agent and bounds its permission set from above.

CPS makes each of these explicit, machine-checkable and refusable at the runtime boundary.

---

## 2. The CPS block in an agent manifest

```yaml
capability:
  trust_level:    "execute_with_review"   # one of L0..L5; see §6
  permissions:                            # MUST be a subset of trust_level's allowed set
    - evidence.create
    - chain.append
    - policy.evaluate
  restrictions:                           # MUST be present, MAY be empty
    - evidence.modify
    - evidence.delete
    - tenant.delete
    - finance.export.unattended
  escalation_rules:                       # conditional permits — see §4
    - action: finance.export
      requires:
        - human_review: true
        - context.tenant.region: "eu-central-1"
        - policy.evaluated_within_ms: 60000
    - action: policy.activate
      requires:
        - reviewer.role: "owner"
        - policy.severity: "critical"
  isolation:
    network:       "egress_allowlist"     # none | egress_allowlist | egress_off
    egress_hosts:                         # required iff network = egress_allowlist
      - api.openai.com
      - api.anthropic.com
    fs_writes:     "none"                 # none | tmp_only | scoped_volume
    secret_scope:  ["openai_api_key"]     # exact secret names readable
```

A handler whose runtime behaviour exceeds any clause in this block **MUST** be intercepted at the runtime boundary, the violation **MUST** be recorded on the evidence chain as `policy.violation`, and the agent **MUST** transition to `status = 'error'`.

---

## 3. Restrictions — the explicit deny-list

`restrictions` is **closed and additive to** ACS's permission allow-list. Even if a permission is implicitly granted by virtue of trust level or accidental inclusion, an entry in `restrictions` **MUST** override and refuse the action.

The runtime defines these restriction primitives at v1.0:

| Restriction | Meaning |
|---|---|
| `evidence.modify` | Re-hash an existing chain link. (Never legal; chain is append-only by ECS.) |
| `evidence.delete` | Remove a chain link. (Never legal.) |
| `tenant.delete` | Tombstone a tenant. (Operator-only; no agent ever holds this.) |
| `policy.delete` | Hard-delete a policy. (Archive only, never delete.) |
| `finance.export.unattended` | Export financial records without human review. |
| `secret.read.*` | Read secrets the agent has not been explicitly granted. |
| `cross_tenant.read` | Read any data belonging to a tenant other than the dispatching one. |
| `cross_region.egress` | Send data outside the tenant's declared `region`. |

A `restrictions` entry takes precedence over `permissions` whenever both could conceivably apply. The intent is: it is impossible for the agent to lose its restrictions by accident.

---

## 4. Escalation rules — conditional permits

An escalation rule says: *the agent **MAY** perform `action` if and only if every clause in `requires` evaluates true at dispatch time.*

The runtime evaluates clauses against:

- The current RCS envelope (see RCS §1).
- The chain state for the trace (recent `policy.evaluated`, recent `governance.review.approved`).
- The producing event's `compliance` block.

Supported clause forms at v1.0:

| Clause | Type | Meaning |
|---|---|---|
| `human_review: true` | boolean | Trace must contain a fresh `governance.review.approved`. See HRP §4. |
| `context.<path>: <value>` | equality | RCS field at `<path>` equals `<value>`. |
| `context.<path> in [...]` | membership | RCS field at `<path>` is one of the listed values. |
| `policy.evaluated_within_ms: <n>` | recency | A `policy.evaluated` event for this trace occurred within the last `<n>` ms. |
| `reviewer.role: <role>` | role | The approving reviewer's role meets the requirement (`owner > admin > member`). |
| `event.severity_at_most: <sev>` | upper bound | The producing event's severity is at or below `<sev>`. |

Failure of any clause **MUST** refuse the action. The refusal **MUST** be persisted as `policy.violation` with the failing clause(s) named, so a reviewer can later see *exactly which precondition was unmet*.

Combining rules: all clauses in a single `requires:` list are AND-ed. To express OR, declare two escalation rules for the same action.

---

## 5. Runtime isolation

CPS specifies three orthogonal isolation primitives:

### 5a. Network egress

| Mode | Behaviour |
|---|---|
| `none` | The agent's process has no outbound network access. Typically L0/L1 trust. |
| `egress_allowlist` | Outbound traffic is permitted **only** to the hosts in `egress_hosts[]`. The runtime **MUST** enforce this at the network layer (iptables / NetworkPolicy / Cilium / outbound proxy), not in application code. |
| `egress_off` | Reserved for sandboxed evaluation; equivalent to `none` but explicit. |

A runtime that cannot enforce egress at the network layer **MUST** refuse to schedule agents whose CPS declares anything other than `none`.

### 5b. Filesystem writes

| Mode | Behaviour |
|---|---|
| `none` | Read-only filesystem. The agent's writes go through APIs only. |
| `tmp_only` | `/tmp/<agent>/` is writable; everything else is read-only. Cleared on every dispatch. |
| `scoped_volume` | A named volume at a fixed mount point is writable. The volume is **per-tenant** and **MUST** carry the tenant_id in its name so cross-tenant writes are structurally impossible. |

### 5c. Secret scope

`secret_scope[]` is the **exact** list of named secrets the agent's process **MAY** read. The runtime **MUST**:

- Provision only those secrets into the agent's environment / Vault binding.
- Reject any `secret.read.{name}` call for a name not in `secret_scope`.
- Audit each successful read with a `secret.accessed` evidence record (without the secret value).

---

## 6. Runtime Trust Levels

Every CPS-conformant agent declares a `trust_level` from the closed enum below. The trust level is the **maximum** capability the agent can attain; permissions are subset-constrained by the level. The runtime **MUST** refuse to register an agent whose `permissions[]` exceeds the level's allowed set.

### L0 — `observe_only`

Read-only. Used for monitors, dashboards, drift detectors.

- **Allowed:** `evidence.read`, `tenant.read`, `policy.evaluate` (read-only paths).
- **Forbidden:** any `*.create`, `*.append`, `*.modify`, `*.delete`, `*.dispatch`.
- **Network:** `none` typical; `egress_allowlist` permitted for read-only API calls (e.g., status pages).
- **Filesystem:** `none`.

### L1 — `annotate`

Reads, marks, classifies. Cannot synthesise new artefacts.

- **Allowed:** L0 set, plus `hash.generate`, emission of `evidence.created` events whose `payload` references but does not invent data.
- **Forbidden:** emission of any event whose `payload` introduces new substantive content.
- **Typical:** content-hash agents, integrity verifiers.

### L2 — `recommend`

Generates suggestions; cannot prepare or finalise.

- **Allowed:** L1 set, plus emission of `*.recommended` subjects.
- **Forbidden:** preparing artefacts that downstream agents would treat as ready (no `*.prepared` emissions).
- **Typical:** policy generators, risk advisors.

### L3 — `prepare`

Builds artefacts but never commits them to a tenant-facing surface.

- **Allowed:** L2 set, plus emission of `*.prepared` subjects (exports prepared, deltas prepared, documents drafted).
- **Forbidden:** emission of `*.finalised`, `*.submitted`, `*.executed` subjects.
- **Network:** `egress_allowlist` typical.
- **Typical:** export builders, document drafters.

### L4 — `execute_with_review`

May produce binding effects, **but only after HRP approval** for each effect.

- **Allowed:** L3 set, plus emission of `*.finalised`, `*.submitted`, `*.executed` — gated by a corresponding `governance.review.approved` event for each effect.
- **Forbidden:** ungated effects. The runtime **MUST** intercept and refuse.
- **Typical:** tax-filing agents, vendor approval agents.

### L5 — `autonomous_runtime`

May produce binding effects without per-effect review. Restricted to risk-bounded domains.

- **Allowed:** L4 set, plus ungated `*.finalised`/`*.executed` emissions **iff** the agent's `compliance.ai_act_role` is `minimal_risk` or `excluded` AND its actions are reversible at substrate level (idempotent or compensable).
- **Forbidden under any circumstance:** Annex-III decisions, irreversible financial commitments, personal-data egress to non-EU upstream.
- **Typical:** in-tenant routing, low-risk classification, evidence sealing.

### Level promotion

An agent's trust level **MUST NOT** change at runtime. Promoting to a higher level **MUST** be a new manifest registration with a bumped `agent.version`. The runtime **SHOULD** retain the previous-level manifest until the operator retires it (ACS §7) so in-flight effects are processed under the contract they were dispatched under.

---

## 7. Worked examples

### 7a. Detection agent — L1 annotate

```yaml
capability:
  trust_level: "annotate"
  permissions:
    - tenant.read
    - hash.generate
    - evidence.read
  restrictions:
    - policy.activate
    - evidence.modify
    - finance.export.unattended
    - cross_region.egress
  escalation_rules: []
  isolation:
    network: "egress_allowlist"
    egress_hosts: ["api.openai.com"]
    fs_writes: "tmp_only"
    secret_scope: ["openai_api_key"]
```

The detection agent inspects payloads, generates hashes, calls an LLM for classification. It cannot mutate the substrate. Any attempt to do so is refused at the boundary.

### 7b. Tax-filing agent — L4 execute-with-review

```yaml
capability:
  trust_level: "execute_with_review"
  permissions:
    - evidence.create
    - evidence.read
    - chain.append
    - policy.evaluate
    - tenant.read
  restrictions:
    - finance.export.unattended
    - cross_region.egress
    - tenant.delete
  escalation_rules:
    - action: tax.submit
      requires:
        - human_review: true
        - reviewer.role: "owner"
        - policy.evaluated_within_ms: 60000
        - context.tenant.region: "eu-central-1"
    - action: tax.export
      requires:
        - human_review: true
        - context.governance.dpo_present: true
  isolation:
    network: "egress_allowlist"
    egress_hosts: ["api.elster.de"]
    fs_writes: "scoped_volume"
    secret_scope: ["elster_certificate", "elster_pin"]
```

The tax-filing agent **may** call ELSTER but **must** have a fresh `governance.review.approved` event in the trace and a fresh `policy.evaluated`, and the tenant **must** be EU-resident. Three orthogonal locks; missing any one refuses the action.

### 7c. Evidence agent — L5 autonomous

```yaml
capability:
  trust_level: "autonomous_runtime"
  permissions:
    - evidence.create
    - hash.generate
    - chain.append
  restrictions:
    - evidence.modify
    - evidence.delete
    - cross_tenant.read
    - cross_region.egress
  escalation_rules: []
  isolation:
    network: "none"
    fs_writes: "none"
    secret_scope: []
```

The evidence agent runs autonomously because its job is hash-and-seal — a pure, reversible-at-substrate, AI-Act-minimal-risk function. It has no network egress, no filesystem writes, no secrets. Maximum trust on the smallest possible attack surface.

---

## 8. Conformance checklist

An agent is CPS-conformant at v1.0 if and only if:

- [ ] `capability.trust_level` is one of `observe_only | annotate | recommend | prepare | execute_with_review | autonomous_runtime`.
- [ ] Every entry in `permissions[]` is allowed under the declared `trust_level`.
- [ ] `restrictions[]` is present (MAY be empty) and contains only primitives from §3 or a future MINOR addition.
- [ ] Every `escalation_rules[].action` has at least one clause in `requires:`.
- [ ] Every `escalation_rules[].requires[]` clause uses an operator from §4.
- [ ] `isolation.network in (none, egress_allowlist, egress_off)`.
- [ ] `isolation.egress_hosts[]` is present iff `isolation.network = egress_allowlist`.
- [ ] `isolation.fs_writes in (none, tmp_only, scoped_volume)`.
- [ ] `isolation.secret_scope[]` lists exact secret names, never wildcards.
- [ ] At runtime, the agent never performs an action listed in its own `restrictions`.
- [ ] At runtime, the agent never performs an `escalation_rules.action` without all clauses satisfied.
- [ ] At runtime, the agent never opens an outbound connection to a host not in `egress_hosts` (if `egress_allowlist`).
- [ ] At runtime, the agent never reads a secret not in `secret_scope`.
- [ ] Trust level changes only via a new manifest registration with a bumped `agent.version`.
