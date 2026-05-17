# ECS — Evidence Chain Specification

**Version:** 1.0
**Status:** Draft
**Schema:** [`schemas/evidence-chain.schema.json`](schemas/evidence-chain.schema.json)

The **Evidence Chain** is the append-only, hash-linked, tenant-scoped audit substrate of the runtime. It exists so that the platform can answer, years after the fact and without trusting any single component:

- *Did this event actually happen?* (existence)
- *Was its content modified since?* (integrity)
- *Did anything happen between two events I know about?* (continuity)
- *In what order were these events observed?* (ordering)
- *Who or what produced this record?* (provenance)

A traditional audit log answers none of these *under attack*. A hash chain answers all four because each entry's hash includes its predecessor's hash, so any tampering invalidates every subsequent link.

---

## 1. Why this exists separately from ESS

ESS defines the **wire**. ECS defines the **history**. A runtime can be conformant with ESS and not produce evidence: the event flowed, no record persisted. ECS specifies what happens *after* the wire — what gets sealed, how, and what guarantees the sealing carries.

This separation matters because it lets non-runtime sources (a legacy connector, a customer-owned agent) emit ESS events without writing evidence, while the evidence runtime still seals everything that flows past it.

---

## 2. The chain link

Each entry in the chain is a JSON object of this exact shape:

```yaml
seq:           42                          # MUST be monotonic, no gaps
tenant_id:     "tenant_123"                # MUST
event_id:      "evt_01HXYZ..."             # MUST — references the ESS event
event_type:    "invoice.received"          # MUST — copy of ESS `subject`
source:                                    # MUST — who produced this link
  agent:       "evidence-agent"
  runtime:     "realsync-evidence-runtime"
previous_hash: "sha256:abc123..."          # MUST — empty string for seq=1
current_hash:  "sha256:def456..."          # MUST — see §3 for derivation
sealed_at:     "2026-05-15T11:23:05.001Z"  # MUST — set by the evidence runtime
payload:       { ... }                     # MUST — verbatim copy of the ESS event
```

A consumer that reads the chain **MUST** verify `current_hash` before treating any link as authoritative.

---

## 3. Hash derivation

```
current_hash = SHA-256(
  previous_hash
  || canonical_json(tenant_id, event_id, event_type, source, payload, sealed_at)
)
```

Where `canonical_json` is **JSON Canonicalization Scheme** (RFC 8785). The canonicalisation is what makes the hash deterministic: any two implementations that produce different `current_hash` values for the same logical input are non-conformant with this spec.

For `seq = 1`, `previous_hash = ""` (empty string, sixty-four-zero-byte digest in hex). The runtime **MUST NOT** initialise the chain with arbitrary seed material.

---

## 4. Append-only guarantees

The substrate **MUST** enforce append-only at three layers:

1. **Schema:** `audit_stream` table has no `UPDATE` or `DELETE` privilege granted to any application role. Service-role bypass is only available to the runtime's break-glass operator with explicit logging.
2. **Application:** the only public write path is `EvidenceService.create()`, which appends. No code path computes a rewrite.
3. **Verification:** a daily integrity job re-walks the chain. Any link whose `current_hash` no longer matches `SHA-256(previous_hash || canonical_json(...))` raises a P0 incident.

A rectification ("this invoice was actually for the wrong tenant, please remove") is **never** implemented as an in-place edit. The correct operation is to append a `replaces_id` link that supersedes the original. The original remains in the chain forever; readers honour the supersession.

---

## 5. Sealing latency

`sealed_at` is the moment the evidence runtime computes `current_hash` and persists the link. The interval between `payload.occurred_at` (the real-world event time) and `sealed_at` is the **sealing latency**.

Targets:

- `severity in (info, low)`: 95th percentile sealing latency **SHOULD** be < 5 s.
- `severity = medium`: 95th percentile **SHOULD** be < 2 s.
- `severity in (high, critical)`: 95th percentile **MUST** be < 1 s.

A runtime that cannot meet the `critical` target **MUST** drop to synchronous sealing for `severity = critical` events, accepting throughput loss to keep the latency guarantee.

---

## 6. Continuity verification

A consumer auditing the chain over a window `[t0, t1]` for `tenant_id = X` verifies:

```
1. Load all links where tenant_id = X AND sealed_at IN [t0, t1] ordered by seq.
2. Confirm seq is contiguous (no gaps).
3. For each link except the first:
     expected_previous = previous_link.current_hash
     assert link.previous_hash == expected_previous
4. For each link:
     recomputed = SHA-256(link.previous_hash || canonical_json(...link without current_hash...))
     assert recomputed == link.current_hash
```

Any failure of step 2, 3 or 4 is **prima facie evidence of tampering or substrate failure** and **MUST** produce:

- A P0 alert.
- A `policy.violation` event with the failing `seq`.
- An immediate freeze of further appends until an operator clears the incident.

This is the "no, I cannot give you that report" answer to "did you delete anything?" The answer is shaped like a proof, not a promise.

---

## 7. Cross-tenant isolation

The chain is **partitioned by tenant**. There is exactly one chain per tenant; `previous_hash` of tenant A's link never references tenant B's link. This is enforced by:

- The `tenant_id` column being part of the implicit partition key on `audit_stream`.
- Hash computation including `tenant_id` so a swap would change the hash.
- The verifier loading links per-tenant and refusing to mix.

A "platform chain" for system-level events (`platform.*` from ESS §3) is a separate, distinct chain with `tenant_id = NULL`. It **MUST NOT** reference any tenant chain and vice versa.

---

## 8. Retention

`compliance.retention_years` from each ESS event sets the per-link retention. The chain **MUST**:

- Honour the maximum across links: if any link in a chain has 10-year retention, the entire chain is retained for 10 years from that link's `sealed_at`. (You cannot prune a predecessor of a link you must keep.)
- Surface tenant-requested deletion as a **redaction** of `payload` (replaced with `null` and a `redacted_at` marker), not as deletion of the link itself. The `seq`, hashes, and `event_type` remain, so continuity holds.

Redaction is a one-way operation. A redacted link cannot be un-redacted; the original payload is gone.

---

## 9. Worked example — three-link chain

```json
[
  {
    "seq": 1,
    "tenant_id": "tenant_123",
    "event_id": "evt_01H...",
    "event_type": "invoice.received",
    "source": { "agent": "detection-agent", "runtime": "realsync-runtime-core" },
    "previous_hash": "",
    "current_hash": "sha256:8c1f...",
    "sealed_at": "2026-05-15T11:23:05.001Z",
    "payload": { "invoice_number": "RE-2026-0042", "amount_gross": 1190.0 }
  },
  {
    "seq": 2,
    "tenant_id": "tenant_123",
    "event_id": "evt_01J...",
    "event_type": "ai.risk.classified",
    "source": { "agent": "risk-agent", "runtime": "realsync-runtime-core" },
    "previous_hash": "sha256:8c1f...",
    "current_hash": "sha256:b6a3...",
    "sealed_at": "2026-05-15T11:23:05.342Z",
    "payload": { "evt_link": "evt_01H...", "risk": "low" }
  },
  {
    "seq": 3,
    "tenant_id": "tenant_123",
    "event_id": "evt_01K...",
    "event_type": "agent.executed",
    "source": { "agent": "tax-agent", "runtime": "realsync-runtime-core" },
    "previous_hash": "sha256:b6a3...",
    "current_hash": "sha256:f001...",
    "sealed_at": "2026-05-15T11:23:05.781Z",
    "payload": { "outcome": "filed", "tax_year": 2026 }
  }
]
```

A regulator verifying this chain can answer:

- "Was the invoice received before it was classified?" → Yes, `seq=1` precedes `seq=2`.
- "Was the risk classification altered after the tax agent acted?" → No, `seq=3`'s `previous_hash` matches `seq=2`'s `current_hash`.
- "Did the runtime drop anything between them?" → No, `seq` is contiguous.

---

## 10. Conformance checklist

An evidence runtime is ECS-conformant at v1.0 if and only if:

- [ ] Every appended link follows the schema in §2.
- [ ] `seq` is monotonic and gap-free per tenant chain.
- [ ] `current_hash = SHA-256(previous_hash || JCS(...))` for every link.
- [ ] `previous_hash` of `seq = 1` is the empty string `""`.
- [ ] No code path performs `UPDATE` or `DELETE` on the chain table.
- [ ] A daily verifier walks every tenant chain end-to-end and reports any mismatch as P0.
- [ ] Sealing latency targets in §5 are met or `severity = critical` falls back to synchronous sealing.
- [ ] Cross-tenant `previous_hash` references are structurally impossible.
- [ ] Retention deletion is implemented as redaction-in-place, never as link deletion.
