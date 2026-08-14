# Customer Expansion Rules

## Objective

Expansion must follow customer value and observed needs, not arbitrary plan boundaries.

## Recommendation contract

Every in-product expansion recommendation must contain:

1. **Signal** — what the platform observed or what the customer configured.
2. **Need** — why the current entitlement is insufficient.
3. **Capability** — what the customer gains.
4. **Price** — incremental recurring or one-time cost.
5. **Scope** — what remains unchanged.
6. **Action** — activate, configure, or dismiss.

Example:

> 5 websites are now under management. Add Website Capacity 5 for +€29/month to monitor them from one command center.

## Do not recommend

- an entire higher plan when one pack solves the need;
- unrelated features;
- upgrades based only on company size;
- upgrades based only on employee count;
- scan quotas as the recurring value proposition;
- an enterprise tier merely because the customer needs one advanced compliance framework.

## Recommended expansion dimensions

### Capability

Examples:

- Legal Governance
- Health Governance
- Finance Governance
- AI Governance
- AI Automation
- Developer Automation
- Communication AI
- Enterprise Integrations

### Capacity

Examples:

- monitored websites
- AI inference volume
- automation executions
- evidence retention
- API volume
- seats

### Operating model

Enterprise-only value should include organizational requirements such as:

- SSO / identity federation
- multiple tenants or organizations
- centralized policy administration
- white label
- SLA / dedicated support
- procurement and security requirements

## Dashboard behavior

The command center should expose a capability marketplace/context panel. It should show:

- current entitlements,
- active websites,
- utilization,
- detected unmet needs,
- recommended packs,
- marginal prices,
- projected monthly total.

The customer should be able to understand the entire commercial state without contacting sales.

## Price-cliff rule

Avoid jumps where a customer must approximately triple monthly spend to unlock one additional capability.

If a requested feature can be isolated into a coherent pack, prefer the pack.

If several packs are repeatedly purchased together, consider consolidating them into a bundle only after usage data demonstrates a real customer pattern.

## Growth rule

The platform should support this progression without redesigning the customer's account:

`1 website → 5 → 25 → 100 → 500+`

while independently allowing:

`Core → Compliance → AI/Automation → Integrations → Enterprise`.

## Measurement

Track expansion quality using:

- activation rate per recommendation,
- time from recommendation to activation,
- retained revenue after 90/180 days,
- downgrade/cancellation rate after expansion,
- capability utilization,
- gross margin by pack,
- support burden per pack.

Do not optimize for upgrade clicks alone. Optimize for retained customer value and sustainable gross margin.
