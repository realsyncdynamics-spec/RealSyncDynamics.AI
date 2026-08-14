# RealSyncDynamics.AI — Modular SaaS Pricing v2

## Status

**Proposal / commercial architecture — not yet production pricing.**

This document deliberately does **not** change Stripe prices, plan keys, entitlements, or the pricing SSoT. It defines the target commercial model before those contracts are migrated.

## Commercial principle

RealSyncDynamics.AI has four independent value drivers:

1. **Transformation** — a one-time website transformation project.
2. **Capability** — regulatory, AI, automation, communication, and integration capabilities.
3. **Capacity** — how much of the platform is operated (websites/assets, runs, seats, storage, API volume).
4. **Enterprise operating model** — SSO, multi-tenant administration, white label, SLA, dedicated support.

Capability and capacity must remain independent. A customer with one highly regulated website must not be forced into a high-volume plan. An agency with many websites must not be forced to buy every advanced capability first.

## Target commercial stack

| Layer | Product | Pricing role | Initial target |
|---|---|---|---:|
| Entry | Public scan | Value-first acquisition | €0 |
| Transformation | Website Transformation | One-time project | €349 |
| Core | Core Governance | Minimum viable recurring platform | €79/mo |
| Capability | Compliance Packs | Industry/regulatory depth | +€29–59/mo |
| Capability | AI & Automation Packs | Automation and AI depth | +€29–99/mo |
| Capability | Integration Packs | External enterprise systems | +€29–99/mo |
| Capacity | Website Capacity | Number of managed websites/assets | +€19–249/mo |
| Enterprise | Enterprise operating model | SSO, multi-tenant, white label, SLA | Custom |

These prices are hypotheses for validation, not implementation constants.

## Core Governance

The €79 Core plan must be a complete, useful product rather than a deliberately crippled trial. It should cover the standard operating baseline for one customer environment:

- continuous monitoring
- evidence capture
- baseline DSGVO controls
- baseline accessibility, SEO and technical checks
- risk detection
- governance dashboard
- reports
- notifications
- basic AI analysis
- one managed website

The Core plan should answer: **"Can this customer operate their normal website with a credible governance baseline?"**

It should not answer every industry-specific regulatory question.

## Capability packs

Capabilities are sold as coherent outcome-oriented packs, not dozens of micro-features.

### Compliance Packs

Examples:

- **Legal** — legal-services-specific controls and review workflows.
- **Health** — healthcare/privacy-sensitive processing controls.
- **Finance** — financial-sector operational and third-party risk controls.
- **E-Commerce** — commerce, consent, tracking and customer-data controls.
- **AI Governance** — expanded AI-system inventory, risk classification, transparency and evidence workflows.

The exact regulatory scope must be defined per pack. A pack must never imply legal certification or legal advice.

### AI & Automation Packs

Examples:

- **AI Automation** — agents, remediation suggestions, workflow execution, scheduled AI tasks.
- **Communication AI** — WhatsApp, voice, chat and human handoff.
- **Developer Automation** — GitHub/PR workflows, code evidence and governed remediation.

Do not price every agent, workflow, skill or button separately. Packs should bundle a meaningful outcome.

### Integration Packs

Examples:

- Microsoft / Teams
- Jira
- Slack
- GitHub
- customer governance infrastructure

Integrations should be sold by operational value and setup/maintenance burden, not by arbitrary connector count.

## Capacity

Capacity is independent from capability.

Example progression:

- 1 website — included in Core
- 5 websites — small capacity add-on
- 25 websites — professional capacity
- 100 websites — high-volume capacity
- 500+ — negotiated / enterprise

A single-site customer can therefore purchase advanced compliance without entering an agency tier. An agency can purchase website capacity without purchasing every advanced compliance or AI feature.

## Customer examples

### Solo professional with complex compliance

Core €79 + Legal Pack €39 = **€118/mo**.

The customer gets deeper governance without paying an agency price merely because the regulatory requirements are complex.

### Small business

Core €79 = **€79/mo**.

No forced upgrade simply because additional capabilities exist.

### Small agency

Core €79 + 5-site capacity + selected automation = an incremental expansion rather than a jump from €79 to €699.

### Larger agency

Core + capacity + automation + integrations + optional white label. The account grows as its managed portfolio grows.

### Enterprise

Enterprise is justified by organizational complexity: SSO, multiple organizations/tenants, centralized policy administration, white label, SLA, procurement requirements and high operational volume — not merely by having a large number of websites.

## Website Transformation remains separate

The €349 Website Transformation is a one-time product and must remain outside the recurring plan ladder.

Flow:

```text
Public Scan
  -> AI Website Transformation
  -> 4 PageSpec variants
  -> Before / After Preview
  -> €349 Transformation
  -> Customer Dashboard
  -> Governance Gate
  -> Publish
  -> Optional recurring Core Governance
```

This gives the product a natural acquisition path:

**€0 scan → €349 transformation → €79+ recurring governance → capability/capacity expansion.**

## Dashboard / expansion UX

The customer should see an in-product capability marketplace rather than a repeated "upgrade plan" wall.

Example:

```text
Your platform

Core Governance                 Active
1 Website                      Active

Recommended

Legal Compliance               +€39/mo
AI Automation                  +€49/mo
5 Website Capacity             +€29/mo
GitHub Integration             +€39/mo
```

Every expansion must explain the customer outcome before showing the price.

## Migration rule

Do not immediately delete the current plan ladder. Existing customers, Stripe products, DB rows and entitlement grants need backward-compatible mapping.

The migration should be phased:

1. Freeze the current pricing SSoT as the compatibility contract.
2. Define capability/capacity entitlements independently.
3. Introduce pack IDs and capacity IDs without changing existing plan IDs.
4. Add grandfathering for existing subscriptions.
5. Migrate the public pricing UI to the modular model.
6. Only then retire or hide legacy plan comparisons.

## Guardrails

- Never hard-code Stripe Price IDs in the client.
- Never let a UI-only upgrade create entitlements.
- Entitlements remain server-side and tenant-scoped.
- Capability packs must map to explicit permissions/modules.
- Capacity must map to explicit quantitative limits.
- Do not gate website count behind unrelated capabilities.
- Do not imply that an automated scan constitutes legal advice, certification, or guaranteed compliance.
- Keep Website Transformation billing separate from recurring Governance billing.

## Next implementation decision

Before changing `shared/pricing.ts`, the following must be approved:

1. final pack taxonomy,
2. initial prices for each pack,
3. capacity bands and marginal prices,
4. which existing plan capabilities migrate into Core versus Packs,
5. grandfathering rules for `starter`, `growth`, `agency`, `enterprise`, and `partner`.

Only after that approval should the canonical pricing SSoT and Stripe catalog be migrated.
