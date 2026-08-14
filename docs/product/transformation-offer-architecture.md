# Website Transformation Offer Architecture

## Purpose

Define the commercial and UX contract for the €349 Website Transformation without changing production Stripe prices yet.

## Offer

**Website Transformation — €349 one-time**

The customer is not buying generic AI-generated HTML. The customer is buying a governed transformation of an existing website.

Included:

1. Existing-domain evidence/baseline context
2. AI-assisted analysis and transformation reasoning
3. Four landing-page variants
4. Deterministic SiteOS rendering
5. Before/after preview
6. Governance validation
7. Backend preservation (`preserve_all`)
8. Publish path after entitlement and governance checks

## Pricing strategy

- €349 is the regular reference price.
- €249 may be used only as an explicitly controlled acquisition experiment or launch offer.
- The client must never receive two unexplained prices for the same offer.
- All prices must originate from the pricing SSoT.
- No frontend component may hard-code the price.

## Why €349 is defensible

The offer is positioned as a transformation, not a page generator. The value chain is:

`evidence → analysis → redesign → variants → deterministic rendering → governance validation → publish`

The backend/application infrastructure remains protected and is not replaced by AI-generated application code.

## Funnel

`public entry → domain/evidence → transformation preview → offer → checkout → entitlement → /app/siteos → build/gate → publish`

The preview is the sales moment. The customer should see the new landing page before payment whenever the evidence and generation pipeline can safely produce it.

## Subscription expansion

The transformation is independent of recurring monitoring.

After transformation, the natural recurring offer is:

**Core Governance — €79/month**

for continuous monitoring of one website.

The product must not present monitoring as a number of monthly scans.

## Bundle principle

A transformation purchase plus Core Governance may be offered as a bundle, but the commercial UI must clearly distinguish:

- one-time transformation value
- recurring monitoring value

## Experiment design

If a €249 launch price is tested, record at minimum:

- offer exposure
- preview completion
- CTA click-through
- checkout initiation
- successful payment
- Core subscription activation
- 30-day retention
- 90-day revenue per acquired customer

Do not choose the winning price from checkout conversion alone.

## Guardrails

- Do not reduce the reference price merely because AI generation becomes cheaper.
- Do not promise legal certainty; describe technical/documentary indicators and governance validation.
- Do not claim SEO/performance improvements unless supported by measured evidence.
- Do not mutate customer backend/application logic.
- Do not bypass entitlement or governance gates.
