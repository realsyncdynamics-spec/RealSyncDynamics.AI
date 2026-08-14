# Pricing v2 — Competitive Strategy & Expansion Guardrails

Status: product strategy / validation contract. No production pricing or Stripe catalog changes are made by this document.

## Market observation

Current competitors demonstrate two useful patterns:

- iubenda prices primarily per website/app and increases value through higher compliance depth, traffic, scanning frequency and additional capabilities. Its current public plans range from low-cost Essentials through Advanced and Ultimate, with agency and enterprise options. This validates a low-friction entry and expansion model.
- OneTrust packages broader governance solutions and uses value/usage meters such as admin users and inventory size. It is strongly enterprise-oriented and typically sells through customized pricing.

RealSyncDynamics should not compete by being the cheapest cookie/privacy utility. It should compete on **more governed outcomes per euro**: continuous monitoring + evidence + AI reasoning + website transformation + remediation + automation + integrations in one runtime.

## Strategic price position

Target position:

> More individual value per euro than traditional compliance-only tools, without an enterprise surcharge for capabilities that a small customer genuinely needs.

Avoid an unqualified public claim such as "cheapest" or "cheaper than every competitor". Competitor scopes differ and pricing changes. Use measurable value claims instead.

## Commercial architecture

### 1. Acquisition

Free first check / public preview.

The first check is not the recurring billing unit. It establishes context and creates the value-first transformation moment.

### 2. Transformation

Website Transformation — €349 one-time.

The customer receives the new landing-page transformation, not a recurring scan quota.

### 3. Core Governance

€79/month, one continuously monitored website.

Core must already be a complete and credible recurring product:

- continuous monitoring
- change/drift detection baseline
- evidence history
- governance/compliance status
- risk findings
- reports
- basic alerts
- basic AI analysis
- remediation tracking baseline

Do not cripple Core to manufacture upgrades.

### 4. Capability expansion

Customers add coherent outcome packs only when their actual requirements justify them:

- Legal / regulated-industry controls
- AI Governance
- Advanced automation
- AI agents
- Engagement / messaging / voice
- Developer / CI integration
- Enterprise integrations

### 5. Capacity expansion

Customers pay separately for scale:

- monitored websites
- seats
- AI usage
- automation executions
- evidence storage
- API volume
- bulk operations

Capacity never requires unrelated capability purchases.

## Competitive moat

The product must stay one step ahead by combining layers competitors commonly sell separately:

`Observe → Understand → Recommend → Transform → Govern → Automate → Prove`

### Observe
Continuous browser/runtime evidence and drift detection.

### Understand
Gemini reasoning over normalized evidence and governance context.

### Recommend
Prioritized findings, remediation and customer-facing explanation.

### Transform
Generate a new governed landing page from the observed site while preserving the backend.

### Govern
Policy, evidence, audit trail and fail-closed publish gate.

### Automate
Scheduled workflows, agents and integrations.

### Prove
Evidence-backed reports and immutable/auditable history.

The moat is the closed loop, not any individual feature.

## Expansion UX

The customer dashboard should calculate a contextual recommendation instead of presenting a generic upgrade wall.

Example:

> 1 website monitored
> 3 new third-party changes detected
> Health-related processing identified
>
> Recommended: Health Governance Pack
> +€49/month
>
> Why: adds the control set and evidence workflow relevant to this environment.

Another customer may see:

> 1 website monitored
> You now manage 5 domains
>
> Recommended: 5-site capacity
> +€29/month
>
> Why: manage all five websites from the same command center.

This turns expansion into a consequence of observed customer need rather than an arbitrary sales tier.

## Anti-price-cliff rules

1. No mandatory 3x jump from Core to access one important capability.
2. No regulatory requirement should force a small customer into an agency/enterprise tier merely because its compliance scope is complex.
3. No additional website should require purchasing every premium feature.
4. No feature should be split into tiny paid buttons when it can be packaged as one coherent outcome.
5. Core should be useful enough that a customer can stay on it indefinitely.
6. Every paid expansion must answer one question: **what additional customer outcome or variable operating cost does this pay for?**

## Future-proofing

Do not add a new top-level plan whenever a new capability appears.

New capabilities should first be classified as:

1. Core improvement — included for all relevant customers;
2. Capability Pack — incremental outcome;
3. Capacity — incremental consumption/scale;
4. Enterprise Operating Model — organizational complexity.

This prevents the product from returning to a five- or six-tier feature wall as the platform grows.

## Competitive monitoring rule

Review public competitor pricing and packaging at least quarterly. Track at minimum:

- iubenda
- OneTrust
- Usercentrics
- Cookiebot / Usercentrics Cookiebot
- Termly
- comparable AI governance and website governance platforms

Record changes in a dated market note before changing RealSync pricing.

The goal is not to copy competitor pricing. The goal is to maintain a deliberate value/price gap while preserving gross margin.

## Margin guardrail

"Cheaper" must never mean structurally loss-making.

Before activating a new pack price, validate:

- AI inference cost
- browser/runtime execution cost
- storage and evidence retention
- third-party API/telephony cost
- support burden
- Stripe fees
- expected gross margin

If a capability has materially variable cost, meter that capability transparently rather than hiding unlimited usage inside a low fixed price.

## Product north star

The customer should be able to start small and grow into a complete governance operating system without ever having to replace their plan architecture.

`€0 → €349 transformation → €79 monitoring → capabilities → capacity → enterprise operating model`

Every step should be understandable from the customer's current environment and usage.
