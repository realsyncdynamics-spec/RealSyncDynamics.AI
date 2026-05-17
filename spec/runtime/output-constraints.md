# OC — Output Constraints

**Version:** 1.0 (introduced in spec suite v1.1)
**Status:** Draft
**Schema:** [`schemas/output-constraints.schema.json`](schemas/output-constraints.schema.json)

The **Output Constraints** specify the **shape, validation, and reasoning surface** of an agent's outputs. Without this layer, a downstream consumer must guess what the agent's output looks like, and an LLM-backed agent can drift toward free-form prose that the rest of the runtime cannot parse, audit, or validate.

OC turns "the agent returns something useful" into a typed, machine-checkable contract.

---

## 1. Why this exists

LLM-backed agents are particularly prone to four failure modes that OC eliminates by declaration:

1. **Format drift.** The agent returned JSON yesterday; today it returns Markdown with embedded JSON; tomorrow it returns prose. OC pins `format = strict_json | json | markdown | text` per agent.
2. **Schema-free responses.** The agent returns JSON, but the keys vary. Downstream consumers break. OC's `schema_validation = required` makes the registry attach an output JSON Schema and the runtime refuses non-validating responses.
3. **Hallucinated reasoning.** The agent volunteers paragraphs of free-text reasoning that ends up in the evidence chain unverified. OC's `free_text_reasoning = forbidden | limited | allowed` bounds this.
4. **Missing confidence.** A classifier returns a class but no confidence score. The downstream cannot distinguish "AI is sure" from "AI is guessing". OC's `confidence_score = mandatory` requires it on every output.

Every binding is a declaration the runtime enforces, not an aspirational comment.

---

## 2. The constraint block

```yaml
output_constraints:
  format:                 "strict_json" | "json" | "markdown" | "text"
  schema_validation:      "required" | "optional" | "none"        # default "none"
  free_text_reasoning:    "forbidden" | "limited" | "allowed"     # default "allowed"
  confidence_score:       "mandatory" | "optional" | "forbidden"  # default "optional"
  jurisdiction_required:  true | false                            # default false
  template_locked:        true | false                            # default false
  hallucination_sensitive: true | false                           # default false
```

### 2a. `format`

| Value | Behaviour |
|---|---|
| `strict_json` | Output **MUST** parse as JSON. The runtime applies `JSON.parse()` and refuses unparseable output. No JSON-with-prose-around-it ("Here is the JSON: {...}") is allowed; the response body is the JSON object. |
| `json` | Output **MUST** contain a JSON object somewhere. The runtime extracts the first balanced `{...}` block. Tolerant of LLM markdown wrapping. |
| `markdown` | Output is rendered Markdown. No structural validation beyond syntactic sanity (no broken code blocks). |
| `text` | Output is opaque text. No structural validation. The least-constrained option, used for chat-style agents. |

### 2b. `schema_validation`

When `format = strict_json` or `json`, the agent **MAY** declare an output JSON Schema. `schema_validation` controls how strictly the runtime applies it:

- `required` — every output **MUST** validate. Non-validating responses are refused; the runtime emits a `policy.violation` event and the agent transitions to `status = error`.
- `optional` — the runtime validates and logs failures, but does not refuse the response. Useful during agent rollout.
- `none` — no validation. Use only when the schema cannot be expressed (e.g., free-form objects).

### 2c. `free_text_reasoning`

LLM agents often want to "explain their work". OC bounds this:

- `forbidden` — only the structured fields are allowed. The agent **MUST NOT** include any natural-language reasoning. Refuse `notes`, `summary`, `rationale` fields beyond the schema.
- `limited` — reasoning is allowed only in named fields (e.g., `notes`, `summary`, `rationale`) declared in the agent's output schema. The runtime **MUST** truncate any reasoning text exceeding 4 KiB total.
- `allowed` — no constraint. Reserved for chat-style agents where the entire output is conversational.

### 2d. `confidence_score`

- `mandatory` — every output **MUST** include a top-level `confidence` field, a number in `[0.0, 1.0]`. The runtime refuses outputs missing it.
- `optional` — `confidence` is allowed but not required.
- `forbidden` — `confidence` **MUST NOT** be present. Used for deterministic agents whose outputs are not probabilistic (e.g., a hash-and-seal agent).

### 2e. `jurisdiction_required`

When `true`, every output **MUST** include a `jurisdiction` field containing an ISO-3166-1 alpha-2 code (`DE`, `FR`, `EU`) or a recognised supranational marker. Used for agents whose outputs are jurisdictional (privacy text, tax filings, regulatory references). Refuse outputs missing it.

### 2f. `template_locked`

When `true`, the agent's output **MUST** be assembled from a registered template (e.g., a privacy-policy template stored in `policy_templates`). The agent's role is to fill template slots, not to generate prose from scratch. The runtime **MUST** verify the output references a known `template_id` and refuse otherwise.

This is the strongest anti-hallucination guarantee: the prose is fixed, the agent only chooses values for slots.

### 2g. `hallucination_sensitive`

A hint to the runtime and to operators that this agent's outputs benefit from extra checks (cross-reference validation, sanity bounds). When `true`, the runtime **SHOULD**:

- attach `hallucination_check_passed: bool` to the output's evidence record,
- log full prompt + response to the agent's debug stream when `confidence < 0.5`,
- prefer reviewers over auto-continue when EM is ambiguous.

This is a `SHOULD` because not every runtime can implement the deeper checks; conformance is a soft target.

---

## 3. Interaction with the other specs

| | Interaction |
|---|---|
| **ESS** | OC constrains the **payload shape** of events the agent emits. The runtime applies OC validation before the event reaches the bus. |
| **ACS** | OC is declared in the agent's manifest. The registry validates manifest consistency (e.g., `template_locked = true` requires the agent to have `tenant.read` permission to load templates). |
| **EVC** | OC validation outcome (passed/failed) **SHOULD** be part of the evidence record metadata for `mandatory` and `linked` evidence-coupling agents. |
| **CPS** | An OC violation is a runtime contract violation; CPS treats it identically to a permission violation — emit `policy.violation`, transition to `error`. |
| **HRP** | OC `hallucination_sensitive: true` is one of the signals that **MAY** elevate an event to HRP review even when EM did not require it. |

---

## 4. Worked examples

### 4a. Strict classification agent

```yaml
output_constraints:
  format:                 strict_json
  schema_validation:      required
  free_text_reasoning:    limited       # allowed in `notes` only
  confidence_score:       mandatory
  jurisdiction_required:  false
  template_locked:        false
  hallucination_sensitive: true
```

A risk classifier whose output has rigid shape, includes a confidence, and is flagged for hallucination caution.

### 4b. Policy generator (template-locked)

```yaml
output_constraints:
  format:                 markdown
  schema_validation:      none           # template structure handles it
  free_text_reasoning:    forbidden
  confidence_score:       forbidden
  jurisdiction_required:  true           # DE/FR/EU per output
  template_locked:        true
  hallucination_sensitive: true
```

A privacy-policy generator that must produce output assembled from a template, with jurisdiction tagging, no free-text wandering.

### 4c. Hash-and-seal evidence agent

```yaml
output_constraints:
  format:                 strict_json
  schema_validation:      required
  free_text_reasoning:    forbidden
  confidence_score:       forbidden     # deterministic
  jurisdiction_required:  false
  template_locked:        false
  hallucination_sensitive: false
```

A purely deterministic agent. No reasoning, no confidence (it's a hash), no jurisdiction.

### 4d. Conversational chat agent

```yaml
output_constraints:
  format:                 text
  schema_validation:      none
  free_text_reasoning:    allowed
  confidence_score:       optional
  jurisdiction_required:  false
  template_locked:        false
  hallucination_sensitive: false
```

A chat-style assistant. The least-constrained legitimate profile. Note: even this profile **SHOULD** carry `hallucination_sensitive: true` if the chat is on regulatory subjects.

---

## 5. Conformance checklist

An agent is OC-conformant at v1.0 if and only if:

- [ ] `output_constraints.format` is one of `strict_json | json | markdown | text`.
- [ ] If `format in (strict_json, json)` and `schema_validation = required`: an output JSON Schema is registered alongside the agent.
- [ ] If `free_text_reasoning = forbidden`: no field on the output carries natural-language prose.
- [ ] If `free_text_reasoning = limited`: total prose across reasoning fields ≤ 4 KiB.
- [ ] If `confidence_score = mandatory`: every output carries a numeric `confidence` in `[0.0, 1.0]`.
- [ ] If `confidence_score = forbidden`: no output carries `confidence`.
- [ ] If `jurisdiction_required = true`: every output carries an ISO-3166-1 jurisdiction code or supranational marker.
- [ ] If `template_locked = true`: every output references a known `template_id`.
- [ ] At runtime, an output that violates any of the above **MUST** be refused at the boundary; the violation **MUST** be persisted as `policy.violation`; the agent **MUST** transition to `status = error` after the second violation in any 1 h window.
