# HRP — Human Review Protocol

**Version:** 1.0
**Status:** Draft

The **Human Review Protocol** defines when an automated action **MUST** be paused for explicit human approval before its side effects fire. It is the runtime's AI-Act-facing surface and the platform's primary defence against the failure mode "the AI did something nobody asked it to and now we are liable".

HRP is not a UX pattern; it is a gate enforced by the runtime. A handler that bypasses HRP — even with good intent — is in violation of its agent contract.

---

## 1. The two questions HRP answers

| Question | Answer surface |
|---|---|
| **When MUST review happen?** | §3 — Decision-equivalent events |
| **What constitutes review?** | §4 — Reviewer identity, intent capture, evidence trail |

Everything else (UI flow, notification channel, reviewer pool composition) is implementation detail.

---

## 2. Why this exists separately from ACS

ACS (§6) lets an agent declare `compliance.decides = true`. HRP defines what that declaration **costs the agent at runtime**. Without HRP, an agent's manifest could claim "I decide" and the runtime would have no protocol to honour that claim.

HRP is also what makes the AI Act Annex-III obligations operationalisable. The regulation says "human oversight"; HRP says, in concrete terms, what oversight looks like.

---

## 3. Decision-equivalent events — when review is mandatory

A **decision-equivalent event** is an event whose `payload` represents the system's final answer in a domain that affects the tenant's downstream operations, with no further automated step that could correct it. HRP **MUST** be triggered when **any** of the following is true:

1. **Annex-III gate** — RCS envelope has `governance.ai_act_profile = "annex_iii"` AND the producing agent has `compliance.decides = true`.
2. **High-severity decision** — event `severity in (high, critical)` AND the producing agent has `compliance.decides = true`.
3. **Money-out gate** — `category = "finance"` AND the event commits funds (filings, transfers, vendor approvals).
4. **Personal-data egress** — `compliance.gdpr = true` AND the action sends data to a non-EU upstream that the tenant has not pre-acknowledged.
5. **Explicit producer flag** — the producing agent's manifest has the matching `returns[].requires_human_review = true`.

A consumer **MUST NOT** apply side effects of a decision-equivalent event until it has received a corresponding `governance.review.approved` event for the same `event_id` and `trace_id`.

A consumer **MAY** still consume the event for non-side-effect purposes (display, metrics, evidence sealing). HRP gates **effects**, not **observability**.

---

## 4. What constitutes review

A valid `governance.review.approved` event:

- **MUST** reference the original event by `event_id` and `trace_id`.
- **MUST** carry `reviewer.user_id` of a human user whose role is `owner` or `admin` for the tenant. (Members and viewers cannot approve.)
- **MUST** carry `reviewer.method`: `"in_app" | "email" | "out_of_band"`.
- **MUST** carry `intent` — a free-text reason recorded for the chain (max 4 KiB). The runtime **MUST NOT** auto-fill it from the event payload.
- **MUST** carry `approved_at` (RFC3339 UTC).
- **MUST** be issued within `review_window_ms` of the original event (default 7 days, configurable by tenant plan; see §6).

A `governance.review.rejected` event has the same shape and forbids the side effects from ever firing. A subsequent re-approval **MUST** be a new event with a fresh trace, not a flip of the rejected one.

---

## 5. Forbidden patterns

HRP **MUST NOT** be satisfied by:

1. **Pre-authorisation tokens** — "tenant approved Annex-III actions in onboarding". Review is per-decision, not per-tenant.
2. **Automated agents** — a second AI that "checks the first AI". The reviewer is human.
3. **Implicit approval via inaction** — silence is never approval. The default state of an un-reviewed decision-equivalent event is *blocked*, not *permitted*.
4. **Reviewer == producer** — the user whose action triggered the producing agent **MUST NOT** be the same user who reviews its decision. Two distinct human approvers (4-eyes) are recommended for `severity = critical`; the runtime **MAY** enforce this when `plan = enterprise`.
5. **Bulk approval** — a reviewer approving N events with a single `approve_all` action is non-conformant. Each `governance.review.approved` event **MUST** be 1:1 with the original.

---

## 6. Review windows

| Tenant plan | Default review window | Maximum |
|---|---|---|
| `free` | 24 h | 72 h |
| `starter` | 72 h | 7 d |
| `pro` | 7 d | 14 d |
| `enterprise` | 14 d | 30 d |

If `approved_at - occurred_at > review_window_ms`, the runtime **MUST** treat the approval as expired and the event as never having received review. A new review event with a fresh `intent` and a current `approved_at` re-arms the gate.

This prevents the failure mode where an old, stale approval is reused against a re-emitted event.

---

## 7. Evidence implications

Every HRP-gated event chain produces three evidence links:

```
[N+0]  ai.risk.classified              (decision-equivalent, side effects gated)
[N+1]  governance.review.requested     (system enqueues the gate)
[N+2]  governance.review.approved      (or .rejected)
[N+3]  agent.executed                  (only emitted if [N+2] was .approved)
```

A regulator inspecting the chain sees the request, the human's approval (with `user_id` and `intent`), and only then the execution. The chain is the proof that human oversight was not a UX pattern but a wire-level guarantee.

---

## 8. Operational obligations

A runtime that implements HRP **MUST**:

- Expose a per-tenant queue of `governance.review.requested` events awaiting decision (`pending_reviews` API).
- Surface aged pending reviews (75 % of window elapsed) to the tenant's owners via the configured notification channel.
- Refuse to start the producing agent's next invocation if its previous decision-equivalent event has been pending for > `review_window_ms`.
- Persist a `governance.review.timed_out` event when the window expires, ensuring the evidence chain shows the absence of approval as a positive fact.

A runtime that implements HRP **MUST NOT**:

- Auto-promote `governance.review.requested` to approved under any circumstance.
- Allow operators to insert review-approved events into the chain directly. The path is reviewer → API → evidence runtime, not operator → SQL.

---

## 9. Worked example

`ai.risk.classified` arrives for a tenant on `ai_act_profile = annex_iii`. Producing agent `risk-agent` has `compliance.decides = true`. The event's `payload.risk = "high"`.

Sequence under HRP:

```
t0   bus receives evt_01H... (ai.risk.classified, side effects: block tenant from new invoices)
t0+ε runtime emits evt_01J... (governance.review.requested)
       reviewer queue receives entry
t0+5m owner clicks "Approve" in dashboard, types intent: "verified false positive on supplier S-042"
       runtime emits evt_01K... (governance.review.approved) with user_id, intent, approved_at
t0+5m runtime invokes risk-agent's effect handler, which emits evt_01L... (agent.executed)
       evidence chain shows: classified → review.requested → review.approved → executed
```

If the owner had clicked "Reject" instead, the chain would have shown `governance.review.rejected` and **no** `agent.executed`. The system's state would be: classification observed, decision blocked, evidence preserved, no side effects.

---

## 10. Conformance checklist

A runtime is HRP-conformant at v1.0 if and only if:

- [ ] It identifies decision-equivalent events using the rules in §3.
- [ ] It refuses to apply side effects of decision-equivalent events without a matching `governance.review.approved` event.
- [ ] It validates `reviewer.role in (owner, admin)` on every approval.
- [ ] It enforces `reviewer.user_id != producer.user_id` (no self-review).
- [ ] It rejects bulk approval API calls.
- [ ] It honours `review_window_ms` per plan and emits `governance.review.timed_out` on expiry.
- [ ] All four chain links (requested, approved-or-rejected, executed-iff-approved, plus the original) are persisted to the evidence chain.
- [ ] Operator break-glass paths into the chain are absent or, if present, themselves emit a `policy.violation` event.
