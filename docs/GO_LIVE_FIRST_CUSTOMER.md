# First Customer Go-Live Path

## North-star

Ship the shortest trustworthy path from an anonymous website URL to a paid Governance Launch website transformation.

```text
URL
→ audit
→ evidence
→ modernization value
→ 3 redesign previews
→ variant selection
→ lead capture / account
→ Governance Launch checkout
→ Stripe webhook
→ entitlement grant
→ SiteOS project dashboard
→ governed build
→ publish
```

## Product rules

- Do not claim legal compliance as a fact; report technical/documentary indicators with evidence.
- Keep the existing backend/business logic unchanged during website transformation.
- Gemini performs reasoning; Playwright captures evidence; SiteOS renders deterministic PageSpec output.
- Stripe remains authoritative for payment. The webhook remains authoritative for entitlement grants.
- Never expose Stripe Price IDs or Gemini API keys to the browser.
- Governance Launch is a one-time €349 product and is not part of the recurring plan ladder.

## Revenue gate

Before a real customer is sent to payment, all of these must be true:

1. The production `checkout-website-rebuild` function is deployed.
2. `products.default_for_plan_key = governance_launch` has a real non-placeholder Stripe Price ID.
3. Stripe reports the price as one-time (`price.recurring` absent/null).
4. The production `stripe-webhook` function is deployed and receives `checkout.session.completed`.
5. `entitlement_grants` exists in production and can be written by the webhook.
6. The resulting grant resolves through the existing product entitlement catalog.
7. The SiteOS dashboard reads the entitlement and exposes the project.

## Funnel acceptance

The public journey must not ask for company/name/email before the first visual value moment. The first interaction is the website URL. After the scan, the product should show redesign potential and variants before demanding payment.

## Manual first-customer test

Use one real but authorized test domain and one internal/test tenant:

- URL accepted and normalized.
- Scan completes.
- Evidence/score is rendered.
- Three redesign variants appear.
- Selected variant survives reload/navigation.
- Checkout session is created server-side.
- Stripe Checkout opens.
- Successful payment produces exactly one active `entitlement_grants` row.
- Dashboard becomes accessible from the returned session.
- No duplicate grant appears on webhook retry.
- Failed/abandoned checkout does not grant access.

## Do not merge on assumptions

A real Stripe Price ID, production secrets, production Supabase deployment state, and a production webhook endpoint cannot be invented from source code. These are final operator/configuration gates and must be verified against the connected environments before live customer traffic.
