# EM — Escalation Matrix

**Version:** 1.0 (introduced in spec suite v1.1)
**Status:** Draft
**Schema:** [`schemas/escalation-matrix.schema.json`](schemas/escalation-matrix.schema.json)

The **Escalation Matrix** specifies the agent's behaviour as a function of the **severity** of the event it produces or consumes. It turns the binary "human review yes/no" axis (HRP) into a graduated severity-aware contract: at low severity the agent auto-continues, at medium it triages, at high it gates on review, at critical it can freeze the runtime.

---

## 1. Why this exists

Without EM:

- A handler treats every event the same way — either always-auto, or always-review. Both extremes are wrong.
- A reviewer is paged at 3 AM for a `severity = info` event because the handler doesn't know the difference.
- A `severity = critical` event silently gets auto-processed because the handler shrugs and continues.

EM makes the severity-action mapping a **per-agent declaration**, validated at registration and enforced at dispatch.

EM is complementary to HRP, not a replacement. HRP defines *what review looks like and when it is mandatory under the AI Act*. EM defines *the severity-tier behaviour, which feeds the HRP gate when a tier requires review*.

---

## 2. The matrix

```yaml
escalation_matrix:
  sev_info:
    auto_continue: true | false
    triage_required: true | false           # OPTIONAL, default false
    human_review_required: true | false     # OPTIONAL, default false
  sev_low:      <same shape>
  sev_medium:   <same shape>
  sev_high:     <same shape>
  sev_critical:
    <same shape>
    runtime_freeze_possible: true | false   # ONLY valid on sev_critical
```

Each tier **MUST** declare exactly one of:

- `auto_continue: true` — the agent processes the event without operator intervention.
- `triage_required: true` — the event lands in a per-tenant triage queue. A human triages (groups, prioritises, dismisses, or escalates) before any reviewer sees it.
- `human_review_required: true` — the event triggers HRP per HRP §3. Side effects are gated until approval.

Setting more than one to `true` for a single tier is non-conformant; the runtime **MUST** reject the manifest.

`runtime_freeze_possible` is exclusive to `sev_critical` and **MAY** be set when an agent's failure mode warrants pausing all further dispatches to it until an operator clears the queue. It is a circuit-breaker hint, not a guarantee.

---

## 3. Default matrix

If an agent omits `escalation_matrix` entirely, the runtime applies this default:

```yaml
escalation_matrix:
  sev_info:     { auto_continue: true }
  sev_low:      { auto_continue: true }
  sev_medium:   { auto_continue: true }
  sev_high:     { human_review_required: true }
  sev_critical: { human_review_required: true, runtime_freeze_possible: true }
```

This default is intentionally **conservative for `high`/`critical`** and permissive for the lower tiers. Agents that need a different shape **MUST** declare their own; the registry **MUST** persist the declared matrix verbatim and not coalesce with the default.

---

## 4. Triage queue semantics

A `triage_required = true` tier:

- The event is appended to `runtime_triage_queue` (per-tenant, per-agent).
- The agent's handler **MUST NOT** apply side effects until a triage decision arrives.
- A triager (role: `admin` or above) makes one of three decisions per event:
  - `dismiss` — the agent receives a `governance.triage.dismissed` event and **MUST** drop the original.
  - `process` — the agent receives a `governance.triage.processed` event and **MAY** proceed normally.
  - `escalate_to_review` — promotes the event to `human_review_required`, even though the tier originally only required triage. HRP applies from here on.

The triage queue **MUST** carry an SLA: if the queue is older than `triage_window_ms` (default 24 h), the runtime emits a `governance.triage.timed_out` event. Whether timeout means "auto-dismiss" or "auto-escalate" is the agent's manifest decision (`triage_timeout_action`, default `escalate_to_review`).

---

## 5. Runtime freeze

A `sev_critical` tier with `runtime_freeze_possible: true` is a circuit-breaker. The runtime **MAY** decide, based on signals it observes (e.g., three `sev_critical` events in 60 s from the same agent), to enter the agent's `frozen` state:

- the bus stops delivering events to the agent's `accepts[]` subscriptions,
- queued events accumulate in `runtime_frozen_inbox`,
- the agent's `status` becomes `frozen`,
- only an operator with `frozen.unfreeze` permission can clear the state.

`runtime_freeze_possible: false` (the default) means even repeated `sev_critical` events will not trigger an auto-freeze — the runtime continues to dispatch. This is appropriate for agents whose `sev_critical` is by-design expected (e.g., an incident-response agent that fires on critical events as its primary job).

---

## 6. Interaction with HRP

When a tier sets `human_review_required = true`, the event is fed to HRP per HRP §3. The HRP rules (review window per plan, valid reviewer roles, no self-review, no bulk-approval) apply unchanged. EM is the *trigger*; HRP is the *gate*.

When a tier sets `triage_required = true` and the triager chooses `escalate_to_review`, HRP is triggered with the triager's identity recorded as the escalator. The reviewer is still constrained by HRP §4 (different from triager).

---

## 7. Worked example — three agents on the same event

Imagine `consent.violation` arriving at `severity = high` for the same tenant. Three agents subscribe:

### Detection agent

```yaml
escalation_matrix:
  sev_high: { human_review_required: false, auto_continue: true }
```

The detection agent's job is to log/observe. It has no side effects. It simply records the event and emits a `drift.detected` follow-on. No review needed.

### Remediation agent

```yaml
escalation_matrix:
  sev_high: { human_review_required: true }
```

The remediation agent prepares fix snippets. Its outputs would be applied by humans, but its outputs themselves are decisions about what should change. At `sev_high` it gates on HRP — a reviewer must approve before the remediation plan is materialised in the tenant's surface.

### Tax-filing agent (irrelevant subscriber)

```yaml
escalation_matrix:
  sev_high: { auto_continue: true }
```

The tax agent is not subscribed to `consent.violation` at all (not in its `accepts[]`). EM only matters for events the agent actually consumes; for events outside `accepts[]` no tier applies.

---

## 8. Conformance checklist

An agent is EM-conformant at v1.0 if and only if:

- [ ] Its manifest declares `escalation_matrix` OR omits it (in which case the default matrix in §3 applies).
- [ ] If declared, every present tier has exactly one of `{ auto_continue, triage_required, human_review_required }` set to true.
- [ ] `runtime_freeze_possible` is only set under `sev_critical`.
- [ ] If any tier has `human_review_required = true`, the agent's contract has at least one `returns[]` entry with `requires_human_review = true` (HRP §3 alignment).
- [ ] If any tier has `triage_required = true`, the agent has a defined `triage_timeout_action` (`escalate_to_review` is the default; `dismiss` or `process` are explicit overrides).
- [ ] At runtime, the agent never applies side effects of an event whose tier requires review or triage, before the corresponding gate event arrives.
- [ ] At runtime, a `frozen` agent never receives bus deliveries until an operator unfreezes it.
