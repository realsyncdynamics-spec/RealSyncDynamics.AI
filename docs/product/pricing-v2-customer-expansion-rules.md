# Pricing v2 — Customer Expansion Rules

Status: implementation contract for the future modular pricing UI.

## Principle

The platform must recommend an expansion from observed customer context, not from a generic "upgrade" CTA.

## Expansion dimensions

| Signal | Recommendation | Billing dimension |
|---|---|---|
| 1 monitored website | no upgrade | Core |
| additional websites | website capacity | Capacity |
| regulatory/industry complexity | relevant governance pack | Capability |
| AI systems detected | AI Governance | Capability |
| repeated manual actions | Automation | Capability |
| GitHub/CI usage | Developer Integration | Capability |
| Microsoft/Jira/Slack stack | Enterprise Integration | Capability |
| growing evidence volume | evidence/storage capacity | Capacity |
| high AI/automation volume | usage capacity | Capacity |
| multiple organizations/tenants | Enterprise operating model | Enterprise |

## Recommendation UX

Each recommendation must contain:

1. observed signal;
2. customer impact;
3. capability gained;
4. incremental monthly price;
5. one-click activation where entitlement and checkout support it.

Example:

> **3 websites are now monitored.**
> Add 5-site capacity for +€29/month and manage all websites from one command center.

Avoid generic language such as "Upgrade to Growth".

## Customer control

Customers can decline a recommendation. The product continues to work at the current entitlement unless a hard operational limit is reached.

Recommendations must never be used to create artificial compliance gaps.

## Implementation guardrail

Pricing UI must consume the canonical catalog and entitlement state. It must not hard-code Stripe Price IDs or independently infer plan permissions.
