# Safety Review & Incident Control v1

**Status:** Internal architecture baseline  
**Public claim:** None  
**Depends on:** internal safety control plane + fail-closed runtime safety gate

## Purpose

This layer implements the domain rules behind YELLOW and RED without giving any AI agent authority to approve or resume execution.

It deliberately separates:

- the specialist/implementation agent;
- three isolated safety reviewers;
- the read-only synthesis agent;
- the human decision;
- RED emergency protection;
- post-RED recovery.

## YELLOW

A YELLOW runtime result means the original execution stops.

A safety case freezes:

- exact action fingerprint;
- action hash;
- evidence hash and immutable evidence references;
- policy version;
- execution identity;
- three reviewer identities and isolation contexts.

Exactly three reviewers are assigned.

Each reviewer receives the same frozen case/evidence identity and **no peer report**.

A reviewer cannot:

- see another review;
- change the frozen action;
- change policy;
- approve execution;
- execute a handler;
- resume the blocked execution.

After all three original reports exist, they are shown to the human unchanged.

There is no majority vote. One RED report cannot be outvoted by two GREEN reports.

## Synthesis

A synthesis agent may receive all three reports only after the three independent reports are complete.

The synthesis agent is advisory and read-only.

It may identify:

- agreement;
- disagreement;
- missing considerations;
- remaining uncertainty;
- a recommended option.

It cannot authorize execution.

The human always retains access to the three original reports and must not be forced to rely on the synthesis.

## Human decision

A human decision is bound to:

- safety case ID;
- frozen case version;
- exact case fingerprint;
- user identity;
- explicit intent.

Silence is not approval.

A producer cannot approve their own case when a producer user ID is known.

Even after human approval, the safety review coordinator does **not** resume the original execution. A subsequent improvement/execution path must create a separately governed action, preserving exact-version approval semantics.

## RED

RED stops normal work.

The RED incident controller always attempts a minimum protective plan:

1. pause workflow;
2. block new executions;
3. disable write operations;
4. preserve logs;
5. preserve evidence;
6. create incident snapshot;
7. notify a human.

Additional actions may be requested only from the fixed emergency-safety allowlist.

Unknown actions are rejected and cannot be smuggled into the emergency path.

A failure of one protective action does not prevent later protective actions such as evidence preservation or human notification from being attempted.

Repeated RED signals for the same execution are idempotent and do not re-run emergency actions.

## Important circuit-breaker distinction

The repository contains generic reliability circuit breakers. They are **not** safety-authority components.

In particular, a reliability helper that fails open when its backing state is unavailable must never be reused as the RED safety controller.

Safety control fails closed.

## Recovery

RED never self-clears.

Recovery requires all of:

- root cause identified;
- remediation applied;
- independent safety review complete;
- verification passed;
- regression tests passed;
- permissions revalidated;
- residual risk documented;
- explicit human restart approval;
- reduced-autonomy restart.

Completion moves the incident only to **reduced_autonomy**.

It does not restore the previous autonomous mode.

The system may then accept a **new automation request**, which requires a fresh policy/risk/approval trail.

## Current boundaries

This PR provides the domain/reference implementation and tests.

It does not yet provide:

- model-provider calls for Reviewer A/B/C;
- a model call for the synthesis agent;
- durable database persistence for safety cases/incidents;
- UI for the human review bundle;
- automatic resume of a blocked execution;
- arbitrary RED remediation;
- deployment.

Those integrations must preserve the invariants defined here rather than weakening them for convenience.
