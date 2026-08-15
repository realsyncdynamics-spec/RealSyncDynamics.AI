# Transformation Funnel Metrics

## Objective

Measure the economic outcome of Website Transformation, not vanity conversion alone.

## Funnel

1. Public entry
2. Evidence/preview started
3. Preview completed
4. Transformation CTA viewed
5. Checkout initiated
6. Transformation paid
7. Transformation build completed
8. Core Governance activated
9. 30-day retained
10. 90-day retained

## Primary metrics

- Preview completion rate
- Preview → checkout rate
- Checkout → paid rate
- Paid → build completion rate
- Transformation → Core activation rate
- 30-day retention
- 90-day retention
- Revenue per acquired customer at 30/90 days
- Gross margin per acquired customer
- Average monitored websites per customer
- Capability-pack attach rate
- Capacity expansion rate

## Pricing experiment

Reference offer: €349 one-time.

Optional acquisition experiment: €249 one-time.

The experiment must be controlled by the canonical pricing configuration. Do not hard-code either value in UI components.

The winner is determined by cumulative economics, not checkout conversion alone. A lower price only wins if the resulting customer cohort produces better contribution margin/LTV after accounting for transformation delivery cost, AI inference, monitoring, support and subscription retention.

## Product rules

- The public scan is an acquisition/baseline event, not a recurring usage unit.
- Core Governance is continuous monitoring for one website.
- Website capacity is separate from capability packs.
- The customer should see one primary transformation CTA after preview.
- Governance and capability expansion should be contextual recommendations after the transformation purchase or during the ongoing dashboard experience.

## Instrumentation requirements

Every funnel stage should carry a stable anonymous/session identifier before authentication. Once the customer authenticates, the identifier must be safely linked to the tenant without exposing another tenant's data.

Record offer version and price variant with each checkout attempt so €249 and €349 cohorts cannot be mixed during analysis.

Do not collect or store unnecessary personal data for funnel analytics.
