# EVC — Evidence Coupling Rules

**Version:** 1.0 (introduced in spec suite v1.1)
**Status:** Draft
**Schema:** [`schemas/evidence-coupling.schema.json`](schemas/evidence-coupling.schema.json)

The **Evidence Coupling Rules** specify which agents **MUST** produce evidence, which **MAY**, and which **MUST NOT**. Without this layer, an agent's relationship to the evidence chain is implicit — readable only by inspecting handler code. EVC makes it a normative declaration.

---

## 1. Why this exists

ECS v1.0 defines what an evidence chain link looks like and how it is sealed. EVC defines **who is obligated to produce one**.

Three concrete failure modes EVC prevents:

1. **Drift agents that quietly stop sealing.** A monitor produces evidence today. Tomorrow a refactor moves a write path off the evidence runtime. Six months later a regulator asks for the proof and there is a gap. EVC declares the obligation in the manifest, so the registry refuses to register an agent that violates its own coupling rule.
2. **Recommendation agents that over-seal.** A recommender that writes evidence for every internal heuristic floods the chain with low-value entries. EVC's `optional` mode marks evidence emission as a per-call decision; `forbidden` marks it as never-allowed.
3. **Linked agents that lose the link.** A policy generator emits a `policy.updated` event that references an evidence record. If the link is informal (URL string in a payload), it can rot. EVC's `linked` mode formalises the relationship: the producing agent must emit the reference in a structured `evidence_ref` field on its event, and the evidence runtime must hold a back-reference.

---

## 2. The four modes

```yaml
evidence_coupling:
  mode:            mandatory | optional | linked | forbidden
  hash_required:   true | false    # only valid when mode = mandatory
  ledger_required: true | false    # only valid when mode = mandatory
  linked_subject:  string          # only valid when mode = linked
```

### 2a. `mandatory`

Every output the agent produces **MUST** be sealed in the evidence chain before the agent's handler returns. The runtime **MUST**:

- intercept the handler return,
- compute the SHA-256 content hash (per ECS §3) if `hash_required = true`,
- append a chain link if `ledger_required = true` (per ECS §4),
- refuse the return if any of the above fails.

A `mandatory` agent that produces output without sealing is in **P0** violation.

### 2b. `optional`

Each output **MAY** be sealed; the agent decides per call by setting `event.evidence.required = true | false` per ESS §2. The runtime honours the per-event flag. There is no aggregate obligation across the agent's lifetime.

### 2c. `linked`

The agent does not write evidence directly, but every event it emits **MUST** reference at least one existing evidence record via a structured field:

```yaml
event:
  payload:
    ...
  evidence_ref:                    # MUST be present for `linked` agents
    - evidence_id: "ev_01HXYZ..."
      relation:    "derived_from"  # derived_from | references | rectifies
```

The evidence runtime **MUST** verify the `evidence_id` exists and is sealed before accepting the event onto the bus. An event from a `linked` agent without an `evidence_ref` is **non-conformant** and the bus **MUST** reject it.

The `linked_subject:` field optionally narrows: the linked agent's events **MUST** reference evidence whose `event_type` matches the listed subject. This pins, e.g., a remediation agent's plan to a finding's evidence link, not arbitrary chain entries.

### 2d. `forbidden`

The agent **MUST NOT** produce evidence under any circumstance. This is reserved for ephemeral observers and read-only dashboards. The runtime **MUST** refuse any `evidence.create` call from such an agent regardless of the agent's CPS `permissions` block.

`forbidden` is stronger than the absence of `evidence.create` permission — it is an explicit prohibition that survives any future permission grant.

---

## 3. How EVC interacts with the other specs

| | Interaction |
|---|---|
| **ESS** | The producer emits ESS events. EVC determines whether the emission triggers a sealing step. |
| **ACS** | The agent declares `evidence_coupling` in its manifest. The registry **MUST** validate this against the agent's `permissions` (e.g., `mandatory` requires `evidence.create` + `chain.append`). |
| **ECS** | EVC `mandatory` and `linked` modes both call into the evidence runtime; the runtime applies ECS rules (hash, append, seal). |
| **CPS** | The `forbidden` mode is enforced at the runtime boundary, equivalent to a CPS `restrictions[]` entry. |
| **HRP** | A `linked` agent's evidence reference **MAY** carry a `governance.review.approved` link, which satisfies HRP's chain-of-evidence requirement for decision-equivalent events. |

---

## 4. Worked examples per agent type

### Detection agent → `optional`

A drift detector that mostly observes but occasionally surfaces a confirmed finding. Most events do not warrant evidence; finding-grade events do.

```yaml
evidence_coupling:
  mode: optional
```

### Evidence agent → `mandatory`

The agent whose entire purpose is sealing. Every output is a chain link.

```yaml
evidence_coupling:
  mode:            mandatory
  hash_required:   true
  ledger_required: true
```

### Policy agent → `linked`

A policy generator never invents evidence. Every emitted policy delta references the evidence (drift, finding, audit gap) that justified it.

```yaml
evidence_coupling:
  mode:           linked
  linked_subject: "policy.evaluated"
```

### Remediation agent → `linked`

A remediation plan must be traceable to its source finding. The agent emits `remediation.plan.created` events whose `evidence_ref` points at the finding's evidence.

```yaml
evidence_coupling:
  mode:           linked
  linked_subject: "drift.detected"  # or 'consent.violation', etc.
```

(In practice a remediation agent that handles many finding types may set `linked_subject` to a glob like `*.detected` or omit it to accept any evidence type.)

### Read-only dashboard backend → `forbidden`

A consumer that aggregates evidence for display has no business writing into the chain.

```yaml
evidence_coupling:
  mode: forbidden
```

---

## 5. Conformance checklist

An agent is EVC-conformant at v1.0 if and only if:

- [ ] Its manifest declares `evidence_coupling.mode` from the closed enum in §2.
- [ ] If `mode = mandatory`: the manifest's `permissions[]` includes both `evidence.create` and `chain.append`.
- [ ] If `mode = mandatory` and `hash_required = true`: every output's content hash is computed before handler return.
- [ ] If `mode = mandatory` and `ledger_required = true`: every output appends to the chain before handler return.
- [ ] If `mode = optional`: each event explicitly sets `evidence.required` per ESS §2.
- [ ] If `mode = linked`: every emitted event carries a structured `evidence_ref[]` that the runtime verifies before accepting.
- [ ] If `mode = forbidden`: the runtime refuses `evidence.create` from this agent unconditionally.
- [ ] `linked_subject` is only set when `mode = linked`.
- [ ] `hash_required` and `ledger_required` are only set when `mode = mandatory`.
