---
title: Incident <ID> — <short title>
owner: security
status: draft
sensitivity: confidential
review_cycle: monthly
valid_until: <YYYY-MM-DD>
tags: [incident, post-mortem]
---

# Incident <ID> — <short title>

Post-incident record. Written within 5 business days of incident
closure per `../40_security/incident-response.md`.

## Summary

One paragraph stating what happened, when it happened, and the
impact in operational terms.

## Severity

| Final severity | Detected at | Mitigated at | Closed at |
|----------------|-------------|--------------|-----------|
| <S0 / S1 / S2 / S3> | ISO-8601 | ISO-8601 | ISO-8601 |

If severity was revised during the incident, list the
transitions and the reason.

## Detection

- Source of first detection (monitoring, user, internal probe).
- Time-to-detect from the initiating event.
- Was the detection automated?

## Timeline

| Time (UTC) | Event |
|------------|-------|
|            |       |

Use factual entries. Do not interpret.

## Impact

- Affected tenants (count and identifiers if internal-confidential).
- Affected features or boundaries.
- Personal-data impact (if any) — reference the GDPR breach
  record id, do not duplicate breach details here.

## Root Cause

Operational description of the root cause. Distinguish between
trigger and contributing factors. No blame language.

## Response Actions

| Action | Owner | Outcome |
|--------|-------|---------|
|        |       |         |

## Findings Created

List finding ids created as a result of this incident. Reference
`../50_runtime/finding-model.md` for the schema. Each finding
must have an owner and a due date.

| Finding id | Category | Severity | Owner |
|------------|----------|----------|-------|
|            |          |          |       |

## Lessons

Operational lessons. What process, monitoring, or invariant
needs to change? Avoid generic statements.

## Evidence References

List the evidence chain event ids and external artefact hashes
captured during the incident.
