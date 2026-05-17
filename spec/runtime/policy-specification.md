# RPS — Runtime Policy Specification

**Version:** 1.0
**Status:** Draft
**Schema:** [`schemas/policy.schema.json`](schemas/policy.schema.json)

The **Runtime Policy Specification** defines a machine-readable DSL for governance policies that the runtime can evaluate, version, audit and re-export. A policy is a typed rule that says: *"when these conditions hold, the runtime must perform these actions."*

RPS is the wire format. Policy *content* (what constitutes "high risk", which retention applies to which document class) is tenant- and jurisdiction-specific and lives in the policy table. RPS only constrains the **shape** every policy must take.

The premise: **a policy that is not machine-readable is not a policy. It is a comment.**

---

## 1. Why this exists

Without RPS, governance rules live in:

- Engineer's heads.
- Slack threads.
- "Final_v4_REALLY_FINAL.docx".
- Hard-coded constants in handler code.

None of those can be evaluated by the runtime, audited by a regulator, replayed against a historical event, or migrated to a new agent without re-reading prose. RPS makes every governance rule:

- **Executable** — the policy engine can apply it at dispatch time.
- **Auditable** — a regulator can read the policy and trace its evaluations.
- **Versionable** — a policy update is a new version, the old version remains evaluable against historical events.
- **Portable** — the same policy syntax works across tenants, runtimes, and exports.

---

## 2. Policy structure

```yaml
spec_version: "1.0"

policy:
  id:           "finance_export_policy"          # MUST — stable identifier, unique per tenant
  name:         "Finance Export Requires Review"  # MUST — human label
  version:      3                                # MUST — integer, monotonic per id
  type:         "guard"                          # guard | retention | classification | escalation
  tenant_id:    "tenant_123"                     # MUST — policies are tenant-scoped
  status:       "active"                         # draft | active | archived
  effective_from: "2026-01-01T00:00:00Z"         # MUST
  effective_until: null                          # MAY be null (open-ended)
  domain:       "finance"                        # which event category the policy gates

conditions:                                      # AND-combined; every clause MUST hold
  - subject_matches:   "finance.export.*"
  - context.governance.gdpr_mode: "strict"
  - context.tenant.region: "eu-central-1"
  - event.severity_at_least: "medium"

actions:                                         # MUST be a non-empty ordered list
  - prepare_export
  - require_human_review
  - notify_owner:
      template: "finance_export_review_pending"

metadata:                                        # OPTIONAL — author, jurisdiction, references
  author:      "u_01HXYZ..."
  jurisdiction: "DE"
  references:
    - "DSGVO Art. 28"
    - "AO § 147"
```

A handler that emits an event matching `domain` and `conditions` **MUST** apply every entry in `actions[]` in order before any other handler completes the event. The runtime **MUST** persist a `policy.evaluated` evidence record with `policy_id`, `policy_version` and `outcome` for every evaluation, irrespective of whether the policy matched.

---

## 3. Policy types

Each type has a fixed shape and semantics. New types **MUST** be introduced via a MINOR spec bump.

### 3a. `guard`

Refuses or gates an action. `actions[]` typically includes `require_human_review`, `refuse`, `notify_*`. A guard policy whose conditions match and whose first action is `refuse` **MUST** halt the downstream handler chain.

### 3b. `retention`

Sets or overrides `compliance.retention_years` on matching events. `actions[]` is constrained to `set_retention: <n>` and `redact_after_days: <n>`. The runtime applies the retention setter at evidence-seal time (ECS §8).

### 3c. `classification`

Re-classifies a matching event's `category`, `severity`, or `compliance.*` flags. `actions[]` is constrained to `set_category: <value>`, `set_severity: <value>`, `set_gdpr: <bool>`, `set_ai_act: <bool>`. Re-classification **MUST** be persisted in the evidence chain so the original and the re-classified form are both visible.

### 3d. `escalation`

Triggers HRP or notification chains. `actions[]` includes `require_human_review`, `escalate_to: <role>`, `notify_*`. An `escalation` policy with `require_human_review` **MUST** create a `governance.review.requested` evidence record per HRP §3.

---

## 4. Condition operators

The condition list is **AND-combined**. To express OR, declare two policies with overlapping `actions`. The runtime's order of evaluation is undefined; policies **MUST** be commutative — applying policy A then B **MUST** yield the same result as B then A.

Supported operators at v1.0:

| Operator | Type | Meaning |
|---|---|---|
| `subject_matches: <pattern>` | glob | `event.subject` matches the glob (e.g., `finance.export.*`). |
| `category: <value>` | equality | `event.category` equals. |
| `severity_at_least: <value>` | ordered | `event.severity` is at or above the listed value. |
| `severity_at_most: <value>` | ordered | `event.severity` is at or below. |
| `compliance.gdpr: <bool>` | equality | `event.compliance.gdpr` equals. |
| `compliance.ai_act: <bool>` | equality | `event.compliance.ai_act` equals. |
| `context.<path>: <value>` | equality on RCS | RCS field at dotted path equals. |
| `context.<path> in [...]` | membership on RCS | RCS field is one of. |
| `payload.<path>.exists` | presence | Payload has a non-null value at the path. |
| `payload.<path>.equals: <value>` | equality on payload | Use sparingly — couples policy to payload schema. |

Conditions **MUST NOT** reference state outside the (event, RCS envelope, current trace). Policies that depend on historical state are non-conformant; that's what evidence chain queries are for.

---

## 5. Action allow-list

Actions are a closed set at v1.0:

| Action | Semantics |
|---|---|
| `refuse` | Halt the handler chain. Persist `policy.violation` evidence. The producing handler returns 403 or refuses the dispatch. |
| `prepare_export` | Materialise an export artefact but mark it `state = "pending_review"`. |
| `require_human_review` | Emit `governance.review.requested`; the side-effect handler waits per HRP. |
| `notify_owner` | Send a notification through the tenant's configured channel. Parameter: `template:` referencing a registered template id. |
| `notify_dpo` | As above, but to the tenant's DPO if `governance.dpo_present`. |
| `escalate_to: <role>` | Wake the runtime's escalation chain at the specified role (`owner | admin | dpo`). |
| `set_retention: <n>` | Override `compliance.retention_years` to `<n>` (retention policy only). |
| `redact_after_days: <n>` | Schedule a `redacted_at` marker for the evidence link after `<n>` days. |
| `set_category: <v>` / `set_severity: <v>` | Classification action only; persists original and override in chain. |
| `set_gdpr: <bool>` / `set_ai_act: <bool>` | Classification action only. |
| `archive_policy: <id>` | Reserved — used only by policy-management policies. |

Custom actions are **forbidden** at v1.0. A tenant or operator wanting a new action **MUST** wait for a MINOR spec bump.

---

## 6. Evaluation semantics

For each event arriving at the bus, the policy engine:

1. Loads all policies for the event's `tenant_id` where:
   - `status = 'active'`
   - `effective_from <= occurred_at < (effective_until OR ∞)`
   - `domain` matches `event.category`
2. Filters to those whose `conditions[]` AND-evaluate to true against (event, RCS, trace).
3. Sorts the matched policies by `(type_priority, policy_id)` where `type_priority` is `guard(0), classification(1), escalation(2), retention(3)`.
4. Applies each policy's `actions[]` in order.
5. Persists a `policy.evaluated` evidence record per matched policy AND a single `policy.evaluation_completed` record per event.

If any policy's action returns `refuse`, the chain halts at that point. Subsequent policies in the sort order **MUST NOT** be evaluated. The `policy.evaluation_completed` record carries the refusal cause.

---

## 7. Versioning and historical evaluation

Policy versions are immutable. Once `policy.version = 3` exists, that exact bytes-and-clauses pair is frozen forever. A new version is `policy.version = 4` with a fresh `effective_from`.

Historical evaluation:

- An evidence chain query asking "what would policy v3 have done to this event in 2026-Q2?" **MUST** be answerable from the persisted policy version, not from the current `active` policy.
- The runtime **MUST** retain archived policy versions for at least the maximum tenant retention period.

This makes audits time-travelable: a regulator inspecting a 5-year-old decision sees the policy as it was, not as it is.

---

## 8. Worked examples

### 8a. Guard — finance export

```yaml
policy:
  id: finance_export_policy
  name: "EU finance exports require owner review"
  version: 1
  type: guard
  tenant_id: tenant_123
  status: active
  effective_from: "2026-01-01T00:00:00Z"
  effective_until: null
  domain: finance

conditions:
  - subject_matches: "finance.export.*"
  - context.governance.gdpr_mode: "strict"
  - context.tenant.region: "eu-central-1"

actions:
  - prepare_export
  - require_human_review
  - notify_owner:
      template: "finance_export_review_pending"

metadata:
  jurisdiction: "DE"
  references: ["DSGVO Art. 28", "AO § 147"]
```

### 8b. Retention — invoice 10-year rule

```yaml
policy:
  id: invoice_retention_de
  name: "DE invoices: 10-year retention"
  version: 2
  type: retention
  tenant_id: tenant_123
  status: active
  effective_from: "2026-01-01T00:00:00Z"
  domain: finance

conditions:
  - subject_matches: "invoice.*"
  - context.tenant.region: "eu-central-1"
  - context.finance.legal_form in ["gmbh", "ug", "ag"]

actions:
  - set_retention: 10
```

### 8c. Escalation — AI Act high-risk emission

```yaml
policy:
  id: ai_high_risk_escalation
  name: "Annex-III emissions notify DPO"
  version: 1
  type: escalation
  tenant_id: tenant_123
  status: active
  effective_from: "2026-01-01T00:00:00Z"
  domain: ai

conditions:
  - subject_matches: "ai.*"
  - context.governance.ai_act_profile: "annex_iii"
  - severity_at_least: "high"

actions:
  - require_human_review
  - notify_dpo
  - escalate_to: "owner"
```

### 8d. Classification — reclassify suspect events

```yaml
policy:
  id: low_confidence_reclassify
  name: "AI classifications below 0.5 confidence become 'recommended' not 'classified'"
  version: 1
  type: classification
  tenant_id: tenant_123
  status: active
  effective_from: "2026-05-01T00:00:00Z"
  domain: ai

conditions:
  - subject_matches: "ai.risk.classified"
  - payload.confidence.exists
  - payload.confidence.equals: "low"

actions:
  - set_severity: "low"
  - set_category: "ai"
```

---

## 9. Interaction with CPS and HRP

- A CPS `escalation_rule` is a per-agent guard, evaluated **before** the policy engine runs. The agent simply cannot reach the bus without satisfying it.
- An RPS `guard` policy is a per-tenant rule, evaluated **after** the event hits the bus. It can refuse, gate or reclassify regardless of which agent produced the event.
- An RPS action `require_human_review` is what triggers HRP. The chain is: *event arrives → policies evaluated → if HRP required, side effects waited → reviewer acts → side effects fire.*

The three specs are nested: CPS bounds agents, RPS bounds tenants, HRP bounds AI Act decisions. A handler that walks all three is the runtime's tightest security trace.

---

## 10. Conformance checklist

A policy is RPS-conformant at v1.0 if and only if:

- [ ] `spec_version = "1.0"`.
- [ ] `policy.id` is unique per `tenant_id` and stable across versions.
- [ ] `policy.version` is a positive integer, monotonic per `id`.
- [ ] `policy.type` is one of `guard | retention | classification | escalation`.
- [ ] `policy.tenant_id` is present (system-wide policies are not v1.0 surface).
- [ ] `policy.status` is `draft | active | archived`.
- [ ] `policy.effective_from` is RFC3339 UTC.
- [ ] `policy.domain` matches an ESS top-level category.
- [ ] Every `conditions[]` clause uses an operator from §4.
- [ ] `actions[]` is non-empty; every action is from the allow-list in §5.
- [ ] For `type = retention`, `actions[]` contains only retention actions.
- [ ] For `type = classification`, `actions[]` contains only classification actions.
- [ ] Archived policy versions are retained for at least the tenant's maximum retention period.
- [ ] Every evaluation produces a `policy.evaluated` evidence record.
