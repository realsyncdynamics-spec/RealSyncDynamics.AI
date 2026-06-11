---
title: GDPR Data Flow Map
owner: compliance
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-08-31
tags: [gdpr, data-flow, privacy, compliance]
---

# GDPR Data Flow Map

Operational map of personal data flows across the RealSync
platform. Maintained for Article 30 records of processing
activities, Data Protection Impact Assessment (DPIA) input, and
data-subject request handling.

## System Boundaries

The RealSync platform is composed of the following data-processing
boundaries. Each boundary is a distinct trust zone and a distinct
RLS scope.

| Boundary              | Description                                              | Hosting region |
|-----------------------|----------------------------------------------------------|----------------|
| `spa`                 | React SPA executing in the user browser                  | client-side    |
| `edge-functions`      | Supabase Edge Functions (Deno runtime)                   | EU             |
| `postgres`            | Supabase Postgres with RLS                               | EU             |
| `storage`             | Supabase Storage buckets, tenant-scoped                  | EU             |
| `vps-ollama`          | Self-hosted Ollama (model `qwen3:4b`) for local AI       | EU             |
| `vps-n8n`             | Self-hosted n8n workflow engine                          | EU             |
| `cloud-ai`            | External AI APIs (Anthropic / Google / OpenAI)           | per vendor     |
| `stripe`              | Billing processor                                        | EU/US per Stripe contract |
| `sentry`              | Error and performance monitoring                         | EU             |

## User Data Categories

| Category                  | Examples                                          | Source boundary |
|---------------------------|---------------------------------------------------|-----------------|
| Account identifiers       | email, user id, tenant id                         | `spa`           |
| Authentication artefacts  | session tokens, refresh tokens                    | `edge-functions`|
| Content metadata          | filenames, sizes, MIME, upload timestamp          | `spa`           |
| Content payloads          | uploaded media subject to provenance workflows    | `spa`           |
| Workflow inputs/outputs   | prompts, AI tool inputs, results                  | `spa` / `edge-functions` |
| Provenance records        | C2PA assertions, hashes, signatures               | `edge-functions`|
| Billing data              | plan, invoice metadata, payment status            | `stripe`        |
| Telemetry                 | error reports, performance traces (no payloads)   | `sentry`        |

Each category MUST be classified in DPIA documentation as
ordinary, sensitive, or special-category personal data.

## Processing Purposes

| Purpose                            | Legal basis (Art. 6 GDPR)        | Categories used |
|------------------------------------|----------------------------------|-----------------|
| Account creation and authentication| Contract (b)                     | Account, Auth   |
| Provenance workflow execution      | Contract (b)                     | Content, Workflow |
| AI invocation (cloud or local)     | Contract (b); Consent for cloud  | Workflow inputs |
| Billing and invoicing              | Contract (b); Legal obligation (c)| Billing        |
| Error monitoring                   | Legitimate interest (f)          | Telemetry       |
| Security incident response         | Legal obligation (c)             | Logs, Auth      |

Consent for cloud AI must be explicit when content payloads leave
the EU boundary. The consent state is recorded per tenant and per
workflow invocation.

## Storage Locations

| Data class            | Primary store           | Secondary store      | Retention default |
|-----------------------|-------------------------|----------------------|-------------------|
| Account records       | `postgres` (EU)         | none                 | account lifetime + 30 days |
| Content payloads      | `storage` (EU)          | none                 | tenant policy, default 90 days |
| Workflow runs         | `postgres.ai_tool_runs` | none                 | 365 days          |
| Provenance evidence   | `postgres` + `storage`  | none                 | indefinite (audit) |
| Billing records       | `stripe`                | mirror in `postgres` | legal retention (10 years) |
| Telemetry             | `sentry`                | none                 | 90 days           |

## Retention Logic

- Default deletion runs nightly via a scheduled edge function.
- Tenant-overridable retention is bounded by an upper limit
  defined in `60_playbooks/` (to be added).
- Evidence records and provenance assertions are retained
  indefinitely; deletion of the underlying content payload does
  NOT delete the hash, signature, or evidence reference.

## Subprocessors

| Subprocessor | Role                       | Region          | Data categories shared        |
|--------------|----------------------------|-----------------|-------------------------------|
| Supabase     | Hosted Postgres, Auth, Storage, Functions | EU | Account, Auth, Content, Workflow |
| Stripe       | Payment processing         | EU/US           | Billing                       |
| Sentry       | Error monitoring           | EU              | Telemetry                     |
| Anthropic    | Cloud AI provider          | per vendor      | Workflow inputs (opt-in)      |
| Google       | Cloud AI provider          | per vendor      | Workflow inputs (opt-in)      |
| OpenAI       | Cloud AI provider          | per vendor      | Workflow inputs (opt-in)      |
| Hostinger    | VPS hosting (Ollama, n8n)  | EU              | Workflow inputs (local AI)    |

The authoritative subprocessor list and Data Processing Agreements
are tracked outside this repository. This table is a runtime
reference only.

## Export and Deletion Paths

### Data Subject Access Request (Art. 15)

1. Identity is verified against the authenticated session.
2. The `gdpr-export` edge function aggregates account, workflow,
   and content metadata into a signed archive.
3. The archive is delivered via a time-limited, tenant-scoped
   download URL.

### Right to Erasure (Art. 17)

1. The `gdpr-erase` edge function marks the user as `pending_erase`.
2. Content payloads are deleted from `storage`.
3. Account records are anonymised in `postgres`; foreign keys are
   nullified or replaced with synthetic identifiers.
4. Evidence and provenance records are retained with subject
   identifiers replaced by synthetic identifiers.
5. The deletion event is logged in `ai_tool_runs` for audit.

### Portability (Art. 20)

Output of the access request export is structured (JSON) and
includes a machine-readable manifest with hashes.

## Open Items

- DPIA per high-risk workflow is tracked in
  `30_compliance/ai-act/risk-classification.md`.
- Subprocessor contract registry is referenced externally and must
  not be duplicated here.
