# Pricing V2 — Entitlement Matrix

## Principle

Pricing is split into two independent dimensions:

1. **Capability** — what governance, automation or engagement function is enabled.
2. **Capacity** — how much the customer operates (websites, users, automation, AI actions, retention).

Legacy plans remain valid during migration. No Stripe Price IDs are introduced here.

## Core — €79/month target

Core must be a complete, useful continuous-governance product for one website:

- continuous monitoring
- baseline governance controls
- evidence
- audit trail
- risk visibility
- alerts
- core AI assistance
- customer dashboard

Core capacity defaults are defined in `shared/capability-entitlements.ts`.

## Capability packs

| Pack | Capabilities | Typical customer signal |
|---|---|---|
| Legal | `legal` | law firms, legal departments, regulated legal workflows |
| Health | `health` | medical practices, health processing, sensitive health data |
| Finance | `finance`, `dora` | financial services / ICT risk |
| AI Governance | `ai_governance` | AI systems, model inventory, AI Act workflows |
| Security / NIS2 | `nis2`, `iso_27001` | critical infrastructure / ISMS |
| Automotive | `tisax` | automotive supply chain |
| Automation | `automation`, `workflows`, `drift_detection`, `remediation` | customer wants the platform to act, not only report |
| Engagement | `ai_bots`, `voice`, `whatsapp`, `website_chat`, `api`, `webhooks`, `human_handoff` | customer-facing or system integrations |

The pack names are commercial groupings. Individual modules remain governed by the existing product/module SSoT.

## Capacity

Website count is **not** a proxy for organizational complexity.

Example:

- Solo lawyer + one complex website → Core + Legal pack.
- Small medical practice + one website → Core + Health pack.
- Agency + 25 websites → Core/capabilities + 25-site capacity.
- Enterprise + 500 websites → capability mix + enterprise capacity/integration terms.

This prevents a single-site specialist from being forced from €79 to an organization-sized plan merely because governance is complex.

## Upgrade UX

The product should recommend an entitlement from observed need:

> New requirement detected → capability missing → explain impact → show incremental monthly price → activate.

Never present a generic upgrade as the only path when a capability pack or capacity increment can satisfy the need.

## Migration rule

Do **not** replace `shared/pricing.ts`, Stripe mappings, or existing entitlement grants in this step. The modular layer is additive. Legacy plan access remains authoritative until a later migration explicitly maps each plan to capabilities and capacity.
