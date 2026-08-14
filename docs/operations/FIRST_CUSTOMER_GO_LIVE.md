# First-Customer Go-Live Gate

## Objective

The shortest trustworthy path from an external website owner to the first paid Governance Launch customer is:

`public audit → concrete findings → transformation preview → authenticated tenant → Stripe Checkout → paid webhook → entitlement grant → SiteOS onboarding`

The product must not claim a successful sale until the Stripe webhook has created the corresponding `entitlement_grants` record.

## Product offer

**Governance Launch — €349 one-time**.

This is deliberately an additive one-time purchase. It must never overwrite an existing subscription. The purchase is represented by `entitlement_grants`; the grant points to the canonical `products` row and inherits its `product_entitlements`.

## Funnel acceptance criteria

### 1. Public acquisition

- `/audit` is reachable without an account.
- Visitor can enter a website and email address.
- `gdpr-audit` accepts the anonymous request and returns a report.
- Report contains a score and concrete findings.
- Report can be opened through its result/permalink route.

### 2. Transformation handoff

- The website owner can move from the audit outcome to the SiteOS transformation flow.
- The original `source_url` survives the authentication handoff.
- Authentication is required before tenant-scoped generation or purchase; this is intentional because the resulting purchase must be bound to the authenticated tenant.
- The SiteOS flow generates a real blueprint/preview, not merely a marketing screenshot.

### 3. Checkout

The browser never supplies a Stripe Price ID. The server resolves `governance_launch` through `public.products.default_for_plan_key` and rejects placeholder prices.

The server must enforce:

- authenticated tenant membership;
- `redesign === true` for Governance Launch;
- valid HTTP(S) source URL;
- a real Stripe Price;
- non-recurring Stripe Price;
- Stripe Checkout `mode=payment`;
- tenant/source/project metadata.

### 4. Payment → entitlement

For `checkout.session.completed` with `mode=payment`:

1. resolve the canonical plan key;
2. resolve the product;
3. require a product with matching entitlements;
4. write an `entitlement_grants` row;
5. use the Checkout Session ID as the idempotency reference;
6. only grant active rights when Stripe reports the payment as paid.

A webhook failure must return non-2xx so Stripe retries. A successful payment without a grant is a release-blocking defect.

### 5. First-customer acceptance test

Run this against the production environment with a real test/live Stripe configuration appropriate to the environment:

1. Open `/audit` in a fresh browser session.
2. Scan a real customer candidate website.
3. Confirm the report renders and contains actionable findings.
4. Enter the transformation flow using that exact source URL.
5. Authenticate/create the customer workspace.
6. Generate the SiteOS preview.
7. Select Governance Launch.
8. Confirm Stripe Checkout shows the expected one-time amount.
9. Complete payment.
10. Confirm the success route opens `/app/siteos`.
11. Confirm the Stripe webhook is received successfully.
12. Confirm exactly one active `entitlement_grants` row exists for the Checkout Session ID.
13. Confirm the tenant receives the Governance Launch entitlements.
14. Confirm the SiteOS/admin workflow has the source URL and project metadata.

## Hard production gates

Do **not** call the product first-customer ready when any of these is true:

- `governance_launch` still points to `internal_default_governance_launch`;
- the production Stripe secret/webhook secret is missing;
- `checkout-website-rebuild` is not deployed from the intended branch/release;
- `entitlement_grants` migration is not applied;
- webhook delivery fails or returns 5xx;
- payment succeeds but no entitlement grant is created;
- the grant is created for the wrong tenant;
- a repeated webhook creates a second grant;
- the transformation preview cannot be generated;
- the public audit is blocked by authentication;
- the source URL is lost during authentication.

## Security invariants

Stripe Price IDs and secrets never belong in frontend code. Tenant entitlement writes must remain server-side. Browser input may identify the source website and tenant context, but it may not directly grant permissions.

## Operational truth

The repository already contains the canonical pricing rule that Governance Launch is a one-time €349 product and that one-time products use `entitlement_grants` rather than `subscriptions`. Keep that model intact; do not create a second purchase/entitlement implementation.
