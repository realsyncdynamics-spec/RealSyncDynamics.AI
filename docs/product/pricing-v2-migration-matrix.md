# RealSyncDynamics.AI — Pricing v2 Migration Matrix

Status: design contract. This document maps the existing runtime capabilities into the proposed modular SaaS model before the canonical pricing SSoT is changed.

## Commercial layers

| Layer | Customer buys | Rule |
|---|---|---|
| Transformation | Website Transformation, €349 one-time | New landing/page transformation. Independent of subscription tier. |
| Core | Continuous governance foundation | Must be useful for a one-website customer without forcing an upgrade. |
| Compliance Packs | Additional regulatory depth | Industry/regulatory complexity, not company size. |
| AI & Automation Packs | More autonomous operation | Workflows, remediation, agents, automation capacity. |
| Integration Packs | Existing enterprise stack connectivity | API, webhooks, n8n, GitHub/CI, Microsoft/Jira/Slack etc. |
| Capacity | More domains/websites, runs, seats, storage | Usage/scale independent of capability. |
| Enterprise | Organizational operating model | SSO, multi-tenant, white-label, SLA, dedicated support. |

## Existing capability mapping

### Core Governance — target inclusion

These capabilities form the minimum credible recurring product for a single website:

- DSGVO baseline
- Audit Center
- Monitoring
- Compliance Reports
- Evidence Vault baseline
- basic alerts
- basic AI analysis / governance bot where operationally required
- website transformation entitlement is separate and remains one-time

**Important:** existing `starter` limits and permissions are implementation details, not the commercial definition. A capability belongs in Core when withholding it would make the base governance promise materially incomplete.

### Compliance Packs

| Existing capability | Target pack | Notes |
|---|---|---|
| `dsgvo` | Core / Advanced DSGVO | Baseline in Core; advanced industry controls may be an add-on. |
| `eu_ai_act` | AI Governance Pack | Keep distinct from website-only baseline. |
| `iso_27001` | ISMS Pack | Regulatory/standard depth, not capacity. |
| `nis2` | NIS2 Pack | Sector/risk dependent. |
| `dora` | Financial Resilience Pack | Enterprise/finance-specific. |
| `tisax` | Automotive Pack | Industry-specific. |
| `policy_engine` | Governance Advanced Pack | Custom policy definition/versioning. |
| `risk_register` | Governance Advanced Pack | Deeper governance operations. |
| `audit_center` | Core; Pro features later | Basic audit visibility must not be paywalled. |
| `evidence_vault` | Core baseline; Advanced retention/legal hold as pack | Evidence is foundational; advanced retention is premium. |

### AI & Automation Packs

| Existing capability | Target pack |
|---|---|
| `scheduler` | Automation Pack |
| `workflows` | Automation Pack |
| `n8n` | Integration / Automation Pack |
| `kodee` | Ops Automation Pack |
| `bulk_jobs` | Scale Automation Pack |
| `automation_engine` | Automation Pack |
| `alerts` | Core baseline; advanced routing in Automation Pack |
| `drift_detection` | Automation Pack |
| `remediation` | AI Remediation Pack |
| `background_jobs` | Core infrastructure; exposed capabilities tiered by usage |
| `ai_bots` | AI Engage Pack |
| `website_chat` | AI Engage Pack |
| `voice` | Voice Pack |
| `whatsapp` | Messaging Pack |
| `telegram` | Messaging Pack |
| `multi_channel_messaging` | Messaging Pack |
| `human_handoff` | Engage Pro Pack |

### Integration Packs

| Existing capability | Target pack |
|---|---|
| `api` | Developer Integration Pack |
| `webhooks` | Developer Integration Pack |
| `n8n` | Automation/Integration Pack |
| GitHub / CI governance | Developer Integration Pack |
| Microsoft / Teams | Enterprise Integration Pack |
| Jira / Slack | Enterprise Integration Pack |
| existing customer governance infrastructure | Enterprise Integration Pack |

### Capacity

Capacity must be independent of capability.

| Dimension | Target model |
|---|---|
| Websites/domains | 1 included, then capacity bands |
| Seats | Included baseline, then capacity |
| Automation runs | Pack entitlement + usage quota |
| AI answers/inferences | Pack entitlement + usage quota |
| Evidence storage | Capacity quota |
| API calls | Developer capacity quota |
| Bulk jobs | Capacity quota |
| Tenants | Enterprise operating model |

Recommended initial website bands for validation, not final pricing:

- 1 website: included in Core
- 5 websites: small capacity add-on
- 25 websites: growth capacity add-on
- 100 websites: agency capacity add-on
- 500+: negotiated/Enterprise

## Existing plans — migration direction

| Current | Target role | Migration principle |
|---|---|---|
| Free Audit | Free entry | Keep as acquisition; no recurring entitlement. |
| Starter €79 | Core | Preserve price initially; broaden foundational governance rather than forcing Growth. |
| Growth €249 | Core + selected packs | Do not retain as a mandatory cliff. Split its capabilities into modules/capacity. |
| Agency €699 | Capacity + Automation + Integration + Enterprise operating features | Decompose rather than map 1:1. |
| Enterprise €1,249 | Enterprise | Preserve as negotiated/organizational tier; avoid using it as the only route to advanced compliance. |
| Partner €1,999 | Reseller/Partner | Keep as specialized operating model. |
| Governance Launch €349 | Transformation | Keep as one-time purchase, outside subscription ladder. |

## Pricing guardrails

1. No customer must buy an unrelated capability merely to unlock another website.
2. A complex single-site customer can buy deeper compliance without paying an agency price.
3. A multi-site customer can buy capacity without buying every AI/integration capability.
4. Core must be credible enough to operate one website continuously.
5. Packs should represent coherent outcomes, not individual buttons.
6. Enterprise pricing is justified by organizational complexity, support/SLA, isolation and integrations — not merely by feature count.
7. Existing Stripe products must not be deleted or remapped until entitlement compatibility is proven.
8. New prices must originate from the canonical SSoT; no client-side hard-coded amounts.
9. €349 Transformation remains independent of subscription capability and website capacity.
10. Existing customers must have an explicit migration/legacy-plan path.

## Proposed initial commercial catalog for validation

This is a proposal for product validation, not yet a Stripe catalog:

- Free Audit — €0
- Core Governance — €79/month
- Compliance Packs — approximately €29–59/month each, depending on scope
- AI & Automation Packs — approximately €29–99/month each
- Integration Packs — approximately €29–99/month each
- Website Capacity — approximately €19–249/month depending on band
- Enterprise — negotiated
- Website Transformation — €349 one-time

The exact amounts must be validated against infrastructure cost, AI/token usage, support burden, Stripe economics and competitor positioning before production activation.
