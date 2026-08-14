# Pricing v2 — Modular Commercial Catalog

This is the proposed commercial catalog for validation. It is intentionally **not** yet the production Stripe catalog. `shared/pricing.ts` remains authoritative until this proposal is approved and migrated with compatibility tests.

## Entry

### Free Audit — €0
- One public audit/scan
- Evidence summary
- Governance score
- Preview/offer entry point
- No recurring entitlement

### Website Transformation — €349 one-time
- Scan + evidence context
- Gemini-driven transformation
- Four landing-page variants
- SiteOS deterministic rendering
- Before/after preview
- Governance validation before publish
- Backend preservation: `preserve_all`
- Separate from subscription and website capacity

## Core

### Core Governance — €79/month

Designed to be a complete, credible one-website governance product.

Includes:
- 1 website/domain
- continuous monitoring
- DSGVO baseline
- basic AI governance analysis
- Audit Center
- Evidence Vault baseline
- compliance reports
- basic alerts
- remediation tracking baseline
- 1 seat
- standard support

The customer does **not** need to buy another tier to make the base product legitimate.

## Compliance packs

### Legal Pack — €39/month
For legal-services and other legal-risk operating contexts.

Includes:
- legal-specific control set
- enhanced evidence/reporting controls
- review workflow
- legal-risk dashboard views

### Health Pack — €49/month
For health/medical contexts with increased privacy and operational sensitivity.

Includes:
- health-specific control set
- enhanced privacy evidence
- sensitive-data workflow controls
- review workflow

### Finance Pack — €59/month
For financial-services contexts.

Includes:
- finance-specific control set
- enhanced resilience/governance checks
- evidence and review workflow

### AI Governance Pack — €49/month
For customers operating material AI systems.

Includes:
- EU AI Act controls
- AI risk register
- policy engine extensions
- AI governance reporting

### Standards Pack — €49/month
For customers requiring additional management-system frameworks.

Includes:
- ISO 27001
- NIS2
- TISAX
- DORA where applicable

The final legal/regulatory scope of each pack must be validated before marketing claims are published.

## AI & Automation packs

### AI Automation — €49/month
- scheduled workflows
- drift detection
- automated findings routing
- remediation suggestions
- automation quota

### AI Agents — €59/month
- additional governance agents
- agent workflows
- review-required actions
- expanded AI usage quota

### AI Engagement — €39/month
- website chat
- governance bot capabilities
- expanded response quota

### Messaging — €49/month
- WhatsApp/Telegram channels where technically supported
- multi-channel workflows
- messaging usage quota

### Voice — €99/month + usage
- voice channel
- IVR
- speech-to-text / text-to-speech
- metered telephony costs remain separate

## Integration packs

### Developer Integration — €49/month
- REST API
- webhooks
- CI/CD integration
- GitHub governance integration

### Automation Integration — €39/month
- n8n
- workflow connectors
- event-driven automation

### Enterprise Integration — €99/month
- Microsoft/Teams
- Jira/Slack
- customer governance infrastructure connectors
- advanced integration controls

Actual connector availability is subject to the customer's connected services and permissions.

## Capacity

Capacity is independent from capability.

### Website Capacity

| Capacity | Increment |
|---|---:|
| 1 website | included |
| 5 websites | +€29/month |
| 25 websites | +€99/month |
| 100 websites | +€249/month |
| 500+ | negotiated |

### Optional usage capacity

Usage-based expansions should be added only where infrastructure cost materially scales with consumption:

- AI inference/answer quota
- automation runs
- evidence storage
- API calls
- bulk operations
- seats

These should be represented as coherent capacity packs, not dozens of micro-add-ons.

## Enterprise operating model

Enterprise is not the place where ordinary compliance suddenly becomes available. It is for organizational complexity.

### Enterprise — from €499/month, final price negotiated

Potential entitlements:
- SSO
- advanced RBAC
- multi-tenant administration
- white-label dashboard
- white-label reports
- advanced retention/legal hold
- bulk operations
- high API limits
- dedicated support/SLA
- customer-specific governance integrations

The €499 figure is a positioning floor for validation, not a production price commitment.

## Example customer configurations

### Solo professional — one normal website
Core = €79/month.

### Solo professional — complex legal requirements
Core €79 + Legal Pack €39 = **€118/month**.

### Medical practice — one website
Core €79 + Health Pack €49 = **€128/month**.

### Small company — five websites
Core €79 + Website Capacity €29 = **€108/month**.

### Agency — 25 websites + automation
Core €79 + Capacity €99 + AI Automation €49 + Developer Integration €49 = **€276/month**.

### Enterprise governance team
Core + required compliance/integration capabilities + organizational Enterprise layer; negotiated according to users, tenants, storage, API and SLA requirements.

## Commercial rules

1. €349 transformation is independent of subscription tier.
2. Core must be sufficient for a normal single-site customer.
3. Regulatory depth is sold through coherent packs, not forced tier jumps.
4. Website capacity is sold independently from feature capability.
5. No customer is forced to purchase AI, Voice, White Label or Agency functionality to add websites.
6. No customer is forced into Enterprise solely because its regulatory requirements are complex.
7. Packs are outcome-oriented; avoid one-feature pricing wherever possible.
8. Usage pricing is introduced only where variable infrastructure cost justifies it.
9. Existing plan keys remain compatible during migration.
10. Stripe Price IDs remain server-side and are resolved from canonical plan/product keys.
11. The production SSoT must be updated only after this catalog passes product, margin, entitlement and migration review.
