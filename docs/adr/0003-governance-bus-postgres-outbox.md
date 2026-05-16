# ADR 0003 — Governance-Bus: Postgres-Outbox over Event-Sourced Topic

**Status:** Proposed
**Date:** 2026-05-16
**Author:** Architecture working group (Runtime + Governance)
**Supersedes / amends:** none
**Related:** `docs/architecture/runtime-governance-social.md` §17 (Open Question 1), §8 (Event replay / recovery), §18 (Sequencing recommendation); `docs/architecture/agent-os.md`

## Context

The runtime-governance-social plan (`docs/architecture/runtime-governance-social.md`, merged in PR #273) leaves one decision explicitly open before any Phase-1.2 migration can ship:

> Open Question 1 — Outbox vs. event-sourced topic: do we double-write to outbox + a Kafka-like stream, or stay outbox-only? Resolve before drafting the Phase-1.2 migration.

The plan calls for a durable, replay-safe event bus that:

- carries `GovernanceEvent`s normalised from `RuntimeEvent`, `marketing_events`, cookie-scan, audit and manual sources,
- delivers at-least-once to subscribers (evidence anchor, social orchestrator, notifier),
- preserves per-`correlation_id` order (never global order),
- supports a 90-day replay window,
- never inlines PII (hashes + source refs only).

Three implementation shapes are realistic given the existing stack (`docs/adr/0001-stay-on-supabase-gh-pages-for-v1.md` keeps us on Supabase + Postgres for v1):

1. **Postgres outbox** — events written into a Postgres table in the same transaction as the producing row; a drain worker reads, delivers, marks processed. LISTEN/NOTIFY wakes the worker.
2. **Event-sourced topic** — a separate streaming substrate (Kafka, Redpanda, NATS JetStream, AWS MSK). Producers write to topics; subscribers are consumer groups.
3. **Hybrid** — outbox in Postgres for durability + topic for fan-out/back-pressure.

The choice constrains every subsequent layer (evidence anchor, social orchestrator, replay tooling, observability, ops). Deferring it past Phase-1.2 forces a rework of the migration; making it now keeps the layered PRs (`docs/architecture/runtime-governance-social.md` §18) sequential.

### Constraints we don't get to negotiate

- **Stay on Supabase for v1** (ADR-0001). Adding a Kafka cluster contradicts that decision and the cost model behind it.
- **EU-native deployment**. Any managed streaming service must be available in `eu-central-1` / `eu-west-3` with a DPA we can sign. Three of the obvious candidates fail this in our procurement timeline.
- **Pre-PMF scale** (low-five-digit tenants). Stream throughput requirements remain well inside what Postgres outbox can carry (back-of-envelope: 100 events/sec sustained, bursts to 1k/sec).
- **One PR per layer** (`docs/architecture/runtime-governance-social.md` §18). Whatever we pick must be drainable into a 1–2 week migration PR, not a multi-month infrastructure project.
- **Replay-safe subscriber contract is already specified**. The bus shape doesn't change it.

## Decision

**Adopt a Postgres-outbox bus with LISTEN/NOTIFY wake-ups. No streaming substrate in v1.**

Concretely:

- `runtime_event_outbox` (new table, Phase-1.2 PR) is written **inside the same transaction** as the producing row (e.g. `runtime_executions`, `marketing_events`).
- A long-running drain worker reads pending rows, fans out to subscribers, marks them `processed_at`. Workers are horizontally scalable; row-level `FOR UPDATE SKIP LOCKED` arbitrates between instances.
- Postgres `LISTEN/NOTIFY` wakes idle workers on insert; a 1-second poll is the fallback if a notification is missed.
- Subscriber bookkeeping (idempotency dedupe, last-acked cursor) lives in subscriber-owned tables, not in the outbox.
- The in-memory `EventBus` (`src/core/runtime/events.ts`) **stays** as the in-process delivery path for tests and synchronous fast-feedback. The outbox is added alongside; both paths are valid and subscribers tolerate both per the replay-safe contract.

### Decision criteria (scored)

| Criterion | Outbox-only | Hybrid (outbox + stream) | Stream-only |
| --------- | ----------- | ------------------------ | ----------- |
| Fits ADR-0001 (stay on Supabase)                        | ✅ trivial             | ⚠️ adds a substrate              | ❌ violates    |
| Time-to-Phase-1.2 PR                                    | ✅ 1–2 weeks           | ⚠️ 3–4 weeks                     | ❌ multi-month |
| EU-only operability                                     | ✅ same Postgres       | ⚠️ requires EU broker selection | ⚠️ same       |
| Operational surface (ops on call)                       | ✅ single substrate    | ❌ two                            | ❌ new one    |
| Throughput headroom (pre-PMF)                           | ✅ sufficient (~k/sec) | ✅ over-provisioned              | ✅ over-prov. |
| Replay tooling (existing SQL skill)                     | ✅ SQL queries         | ⚠️ stream tooling                | ❌ new tooling |
| Multi-region future                                     | ⚠️ via logical repl.  | ✅ native                         | ✅ native     |
| Per-subscriber back-pressure isolation                  | ⚠️ subscriber-local   | ✅ consumer groups               | ✅ groups     |
| Cost at 0 → 50 tenants                                  | ✅ €0                  | ❌ broker fixed cost              | ❌ broker     |

Outbox wins on every criterion that gates v1 shipping. The two areas where it loses (multi-region, per-subscriber back-pressure) are not v1 requirements and have known migration paths (see Consequences → Future migration).

## Begründung

1. **The decision must not break ADR-0001.** Adding Kafka/NATS is the single biggest deviation from "stay on Supabase for v1" we could make. Doing it now would also re-open ADR-0001 itself, which we just confirmed.

2. **Outbox handles our actual load.** Back-of-envelope: at our target of low-five-digit tenants with the current skill mix (read-heavy, infrequent writes), peak governance-event rate sits well below 1k/sec. Postgres comfortably ingests 5–10k row/sec on the existing instance class. Outbox-as-table is not the bottleneck.

3. **One substrate = one paging rotation.** A streaming substrate doubles operational surface — broker upgrades, consumer-group rebalance debugging, retention tuning, dead-letter handling, separate monitoring stack. We have neither the headcount nor the incident-budget for that in v1.

4. **SQL is our highest-skilled tooling.** Replay, debugging, audit and recovery (§8 of the plan doc) are all expressible as SQL queries against the outbox + subscriber dedupe tables. Operators already know this. Stream tooling adds a learning curve.

5. **The contract is what subscribers depend on, not the transport.** §8 of the plan doc specifies the replay-safe subscriber contract. The contract is identical whether the transport is Postgres rows or Kafka offsets. Migrating later — if we ever need to — does not touch subscribers.

6. **At-least-once + idempotent subscribers is enough.** We explicitly do not need exactly-once. The plan's idempotency requirement on subscribers means we already pay the cost of dedupe; outbox's "process, then mark" pattern fits naturally.

7. **EU-native procurement is faster with Postgres.** Adding a broker means a new DPA, a new sub-processor entry (`docs/legal/sub-processors`), customer notification. Outbox needs none of those.

## Consequences

### Positive

- **Phase-1.2 migration is a single PR.** Drain worker + table + subscriber stub, no new infra.
- **Recovery is `SELECT … WHERE NOT processed`.** Operators can investigate without new tooling.
- **No new sub-processor.** Compliance surface stays unchanged.
- **In-memory bus stays useful.** Tests and dev path don't need a broker.
- **Per-tenant rate-limits map cleanly** to row-level WHERE filters on the drain worker.

### Negative / accepted trade-offs

- **No native multi-region** out of the box. Mitigated by (a) we don't need it in v1, (b) Postgres logical replication exists if we do.
- **Per-subscriber back-pressure is subscriber-local.** A slow subscriber doesn't slow others (they read independently), but its own backlog grows in the outbox. Mitigation: per-subscriber max-lag alert (Section 11 metrics).
- **Outbox table is hot.** Mitigation: partition by month + index on `(processed, tenant_id)`. Add to the Phase-1.2 migration up-front.
- **No streaming consumers** (e.g. realtime UI feeds). Mitigation: deliberate non-goal in v1; admin UI rides Supabase Realtime later if needed.
- **Heavy poller load on `LISTEN/NOTIFY` reliability.** Mitigation: 1-second fallback poll + drift detection alert.

### Migration triggers

This ADR should be re-opened if **two or more** of the following become true:

1. Sustained governance-event rate exceeds 5k/sec across the fleet.
2. Subscriber count exceeds ~20 with widely divergent latency requirements.
3. Multi-region active-active becomes a customer requirement (not just nice-to-have).
4. A streaming substrate appears in our existing stack for unrelated reasons (e.g. customer-facing realtime).

Until then, the outbox is the bus.

## Alternatives considered

### A. Hybrid (outbox + Kafka/NATS topic)

Producers write outbox + topic in the same transaction. Subscribers prefer topic, fall back to outbox.

Rejected because:

- Doubles operational surface immediately, for capacity we don't need.
- Producers must coordinate two writes, complicating transactional guarantees.
- Adds a sub-processor and DPA work before v1 customers exist.
- Resolving subscriber dedupe across two transports is harder than across one.

May revisit at Migration Trigger 3 (multi-region active-active).

### B. Stream-only (Kafka / Redpanda / NATS JetStream)

Producers write directly to topics; subscribers are consumer groups.

Rejected because:

- Violates ADR-0001 directly.
- Requires new ops competency we don't have in v1.
- Producer transactional integrity with Postgres requires a sidecar or transactional outbox anyway — so we still ship outbox, just for less benefit.

### C. Supabase Realtime as the bus

Use Supabase Realtime (Postgres LISTEN/NOTIFY + Phoenix Channels) as the primary delivery path.

Rejected because:

- Realtime is a delivery channel, not a durable log. No replay, no consumer-group bookkeeping.
- Designed for UI subscriptions, not backend fan-out.
- We will likely use Realtime for the admin UI subscription onto the outbox, but as a *secondary* path, not as the bus.

### D. Skip the bus, write subscribers as DB triggers

Wire each subscriber as a Postgres trigger on producer tables.

Rejected because:

- Triggers run inside the producer transaction → slow producers when a subscriber is slow.
- No backlog or replay semantics — failed triggers either swallow errors or block writes.
- No clean ordering or correlation across multiple producer tables.
- Operational debugging of trigger-based fan-out is poor.

## Implementation notes (non-binding sketch for Phase-1.2 PR)

The Phase-1.2 PR is **not** part of this ADR. It will be drafted separately after ADR-0003 is Accepted. As a non-binding sketch:

- New migration: `runtime_event_outbox` partitioned by month; indexes on `(processed, tenant_id, occurred_at)` and `(correlation_id)`.
- New module: `src/core/governance-bus/outbox.ts` implementing the `EventBus` contract over Postgres.
- New worker: `worker/governance-drain/` (Node, long-running) with `FOR UPDATE SKIP LOCKED` row leasing.
- Subscribers register cursors in their own tables (e.g. `evidence_anchor_cursor`, `social_publisher_cursor`).
- The in-memory bus stays as the default for tests; the Postgres bus is opt-in via env config.

Each follow-up subscriber (evidence anchor, social orchestrator) gets its own PR per `docs/architecture/runtime-governance-social.md` §18.

## Acceptance

This ADR is Proposed. It moves to Accepted once:

1. Reviewer-approved on this PR.
2. Status updated in this file in the same merge.

No code changes ship with this ADR.
