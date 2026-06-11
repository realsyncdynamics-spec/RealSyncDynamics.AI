---
title: Incident Response
owner: security
status: draft
sensitivity: internal
review_cycle: monthly
valid_until: 2026-06-30
tags: [security, incident, response, breach, gdpr]
---

# Incident Response

Operational procedure for detecting, classifying, containing, and
recovering from security incidents in the RealSync platform.
This document is the reference for on-call responders. It is
intentionally short, action-oriented, and free of marketing
language.

## Definitions

- **Event**: any observed deviation from expected runtime
  behaviour.
- **Incident**: an event with confirmed or suspected impact on
  confidentiality, integrity, availability, or compliance.
- **Breach**: an incident with confirmed unauthorised access to
  personal data (GDPR Art. 4(12)).

## Severity Levels

| Level | Name           | Examples                                                                  | Initial response time |
|-------|----------------|---------------------------------------------------------------------------|-----------------------|
| `S0`  | Critical       | Confirmed data breach; platform-wide outage; cryptographic key exposure   | 15 minutes            |
| `S1`  | High           | Tenant isolation failure; auth bypass; AI feature producing unsafe output | 30 minutes            |
| `S2`  | Medium         | Single-tenant outage; degraded provenance evidence; subprocessor incident | 2 hours               |
| `S3`  | Low            | Monitoring noise, transient errors, no user impact                        | next business day     |

Severity is the responder's first decision. It MUST be recorded
in the incident ticket and revised explicitly if the situation
changes.

## Escalation Matrix

| Severity | On-call responder | Engineering lead | Security lead | Compliance | Executive |
|----------|-------------------|------------------|---------------|------------|-----------|
| `S0`     | immediate         | immediate        | immediate     | immediate  | immediate |
| `S1`     | immediate         | immediate        | immediate     | within 1h  | within 2h |
| `S2`     | immediate         | within 1h        | within 2h     | within 4h  | next day  |
| `S3`     | within shift      | next business    | optional      | optional   | none      |

Contact roles are tracked in the on-call rotation outside this
repository. This table lists roles, not individuals.

## Response Flow

1. **Detect** — alert from Sentry, Supabase logs, or user report.
2. **Acknowledge** — on-call responder claims the incident in the
   ticket system within the response time of the assigned
   severity.
3. **Triage** — classify severity, identify affected boundaries
   (see `../30_compliance/gdpr/data-flow-map.md`).
4. **Contain** — apply the smallest possible mitigation that
   stops further impact (revoke key, disable feature flag,
   isolate tenant, scale down).
5. **Eradicate** — remove the cause (patch, rotate, redeploy).
6. **Recover** — restore normal operation, validate with
   automated checks and a manual smoke test.
7. **Post-incident review** — within 5 business days, regardless
   of severity, written and stored under
   `60_playbooks/post-incident/` (folder created on first use).

## Rollback Flow

| Component       | Rollback mechanism                                              |
|-----------------|-----------------------------------------------------------------|
| SPA (Vercel)    | Re-promote previous production deployment (see `../60_playbooks/deployment-vercel.md`) |
| Edge functions  | Redeploy previous git tag via Supabase CLI                      |
| Database schema | Forward-only migration with compensating migration              |
| VPS services    | PM2 reload to previous release directory (see `../60_playbooks/deployment-hostinger.md`) |
| Secrets         | Revoke and reissue via Supabase/Stripe/Sentry consoles          |

Rollback is preferred over hot-fixing during an active incident.
A hot-fix is allowed only when rollback would cause greater harm
(for example, a schema change that cannot be reverted without
data loss).

## Evidence Preservation

For every incident at `S2` or above:

- Capture relevant logs from `ai_tool_runs`, `workflow_runs`, and
  edge-function logs into the incident ticket.
- Hash captured artefacts (SHA-256) and record the hash in the
  ticket.
- Do not modify, redact, or rewrite captured logs. Annotation
  belongs in the ticket, not in the artefact.
- Reference the captured artefacts from the evidence chain (see
  `../50_runtime/evidence-chain.md`) where applicable.

## Customer Communication Flow

| Severity | Customer notification                                | Channel                |
|----------|------------------------------------------------------|------------------------|
| `S0`     | Within 1 hour of confirmation                        | status page + email    |
| `S1`     | Within 4 hours of confirmation                       | status page + email    |
| `S2`     | Within 24 hours if customer-visible                  | status page            |
| `S3`     | Only if customer-visible                             | status page or none    |

Communication is factual: what happened, what is the impact, what
is being done, when the next update is expected. No speculation,
no apologies that imply liability admission, no marketing tone.

## GDPR Breach Handling

If an incident is classified as a personal-data breach:

1. **Within 24 hours of confirmation**, the data protection
   contact is informed and an internal breach record is opened.
2. **Within 72 hours of becoming aware**, the supervisory
   authority is notified per Art. 33 GDPR, unless the breach is
   unlikely to result in a risk to the rights and freedoms of
   natural persons. The risk decision is documented in the
   breach record.
3. **Without undue delay**, affected data subjects are notified
   per Art. 34 GDPR when the breach is likely to result in a
   high risk.
4. The breach record retains:
   - nature of the breach, categories and approximate number of
     subjects and records;
   - likely consequences;
   - measures taken or proposed.

The breach record is stored outside this repository in the legal
log. This document references the procedure only.

## Open Items

- Post-incident review template (`60_playbooks/post-incident-template.md`).
- Tabletop exercise schedule.
- Out-of-band communication channel for `S0` incidents.
