# Internal Safety Control Plane v1

**Status:** Internal architecture baseline  
**Scope:** Advisory safety classification and escalation contracts  
**Public marketing claim:** None

## 1. Objective

RealSyncDynamics.AI is designed toward a highly controlled European multi-agent architecture in which human safety, human authority, evidence, least privilege and bounded execution take precedence over autonomy or speed.

This document does **not** claim that the platform is "the safest agent system in Europe". That is an internal engineering direction that must be supported by measurable evidence rather than marketing language.

## 2. Compatibility with HRP

This specification does not weaken or replace `spec/runtime/human-review-protocol.md`.

The Human Review Protocol remains authoritative for human approval. Automated safety reviewers are advisory and **cannot** satisfy a human-review gate.

Three AI reviewers may analyse a YELLOW case independently, but:

- they cannot approve execution;
- they cannot see each other's reports;
- they cannot change the original evidence;
- they cannot alter policy or permissions;
- their output is delivered to a human;
- the human remains the approval authority.

## 3. Specialized-agent principle

Prefer many small agents with narrow responsibility, context and permissions over one all-powerful agent.

Each specialist receives only the minimum required:

- context;
- tools;
- tenant scope;
- data classes;
- capabilities;
- execution rights.

Small scope reduces cost and blast radius, but does not by itself make an agent safe. Safety depends on isolation, deterministic policy enforcement, independent review, evidence and human authority.

## 4. Separation of duties

| Role | Authority |
|---|---|
| Specialist agent | Analyse or propose within a narrow task |
| Policy engine | Deterministically allow, deny, pause or require approval |
| Safety controller | Compute GREEN/YELLOW/RED from trusted signals |
| Reviewer A/B/C | Independent advisory risk analysis |
| Synthesis agent | Read-only comparison of the three reports |
| Human | Final authority for escalated consequential decisions |
| Evidence system | Append-only/integrity-protected record |

No role may silently assume the complete authority of the others.

## 5. Traffic-light semantics

### GREEN

GREEN means an action remains within an already-authorized bounded policy and no escalation signal is present.

GREEN does **not** mean "risk-free".

Normal logging, verification and evidence obligations remain active.

### YELLOW

YELLOW means material uncertainty, policy concern or consequential change requires review.

At YELLOW:

1. stop side effects;
2. freeze the reviewed action/version;
3. start exactly three isolated reviewers;
4. preserve each original report;
5. show all three reports to a human;
6. optionally run a read-only synthesis agent;
7. wait for an explicit human decision.

No silence-as-consent and no automatic continuation.

### RED

RED means normal work stops immediately.

Only pre-authorized emergency safety actions may run, such as:

- pause workflow;
- block new executions;
- disable write operations;
- revoke temporary token;
- isolate session;
- close connection;
- freeze queue;
- preserve logs/evidence;
- create incident snapshot;
- notify a human.

RED is never a blanket authorization to "fix" production.

Deployments, data migrations, destructive deletion, customer communication, policy changes and privilege expansion are not emergency actions merely because RED occurred.

## 6. Reviewer isolation

Exactly three reviewers are used for a YELLOW escalation.

Each reviewer must have:

- a distinct reviewer identity;
- a distinct isolation context;
- the same frozen factual evidence;
- no visibility into peer reports;
- no ability to alter the source evidence;
- no execution capability.

Three identical instances of one model are not automatically independent. Where practical, common-mode failure should be reduced by varying models, providers, prompts, rule sets or evaluation methods.

A RED review can never be outvoted by two GREEN reviews.

Even three GREEN reports remain advisory; the human decides.

## 7. Synthesis agent

The synthesis agent is read-only.

It may:

- identify agreement;
- identify disagreement;
- identify missing considerations;
- explain trade-offs;
- propose options.

It may not:

- modify source reports;
- suppress a report;
- approve execution;
- alter policy;
- grant permissions;
- reclassify itself into authority.

The human must always be able to inspect the three original reports independently of the synthesis.

## 8. Fail-closed rules

The system pauses or denies when any of the following cannot be established:

- tenant identity;
- authorization;
- policy version;
- required approval;
- action scope;
- evidence integrity;
- side-effect boundaries;
- control-plane availability.

Unknown is not GREEN.

## 9. Human safety

Safety is broader than cybersecurity.

Risk analysis must consider, where relevant:

- physical safety;
- privacy and personal data;
- economic consequences;
- employment consequences;
- discrimination;
- legal consequences;
- reputation;
- information integrity;
- irreversible or difficult-to-reverse effects.

Human safety and human decision authority take precedence over system throughput.

## 10. Post-RED recovery

RED never self-clears.

Recovery requires all of:

1. root cause identified;
2. remediation applied;
3. independent safety review complete;
4. verification passed;
5. regression tests passed;
6. permissions revalidated;
7. residual risk documented;
8. explicit human restart approval;
9. restart at reduced autonomy.

After RED, previous automation approval is not automatically reusable. A later automation escalation is a new request with a new risk assessment and approval trail.

## 11. Engineering rule

No agent is trusted because it is intelligent.

No action is safe merely because an agent says it is safe.

Safety must come from architecture:

`Identity → Tenant → Policy → Scope → Risk → Safety State → Approval → Execution → Verification → Evidence`

For escalated cases:

`YELLOW → Review A/B/C → Original reports → Read-only synthesis → Human decision`

For incidents:

`RED → Stop → Bounded emergency actions → Evidence preservation → Human notification → Recovery protocol`

## 12. Current implementation slice

The first implementation slice is intentionally side-effect free:

- deterministic GREEN/YELLOW/RED classification;
- fixed RED emergency-action allowlist;
- validation of exactly three isolated reviewer reports;
- no-majority-vote handling;
- explicit human-decision requirement;
- post-RED recovery gate.

It does not yet:

- invoke reviewer models;
- wire into the runtime executor;
- create database tables;
- deploy migrations;
- change production behavior.

Runtime integration should be a separate PR after the pure safety contracts are reviewed and tested.
