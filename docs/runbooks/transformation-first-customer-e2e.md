# First-Customer Transformation E2E Gate

## Purpose

This is the operator gate for the first real Website Transformation purchase. It complements automated CI; it does not replace it.

## Required configuration

- [ ] Staging/production-like URL is known and reachable.
- [ ] Stripe is in **test mode** for the first run.
- [ ] The €349 transformation product has a real Stripe test Price ID configured through the pricing SSoT.
- [ ] `checkout-website-rebuild` is deployed with the required server-side Stripe/Supabase secrets.
- [ ] Stripe `checkout.session.completed` webhook is deployed and points to the correct environment.
- [ ] The webhook signing secret is configured server-side.
- [ ] Test customer/tenant account exists and is authorized for the target project.
- [ ] `TRANSFORMATION_LIVE_E2E=true` is set only in the dedicated test environment when running the opt-in live E2E.

## Happy path

1. Open the public transformation entry without an authenticated session.
2. Submit a permitted test domain.
3. Confirm evidence/audit data is real and the generated preview is the primary sales moment.
4. Confirm four variants are available.
5. Select one variant.
6. Click the single primary transformation CTA.
7. Confirm `checkout_started` is recorded once.
8. Complete the Stripe test payment.
9. Confirm `checkout.session.completed` is received by the webhook.
10. Confirm exactly one active entitlement grant exists for the purchase reference.
11. Confirm exactly one `transformation_paid` event exists for the same purchase.
12. Open the post-checkout route and confirm `/app/siteos` is used for transformation purchases.
13. Confirm the transformation project is visible to the authorized tenant.
14. Build the selected transformation.
15. Confirm governance gate evaluates the build.
16. Confirm publish is available only when payment, tenant authorization, evidence, build validity, backend preservation, and governance conditions pass.

## Negative cases

### Payment not verified

Visit the success URL without a corresponding server-side entitlement. Expected: pending/retry/error state; no transformation access and no publish action.

### Unauthorized tenant

Attempt to open another tenant's transformation project. Expected: access denied/not found; no project data exposed.

### Governance blocked

Use a fixture/build that intentionally fails the governance gate. Expected: build may exist, but publish remains unavailable.

### Duplicate webhook delivery

Replay the same Stripe completion event. Expected: entitlement grant remains idempotent and `transformation_paid` is not duplicated.

## Evidence to record

Record only identifiers and pass/fail results needed for the release decision:

- test tenant ID
- transformation/project ID
- Stripe checkout session ID
- entitlement grant ID(s)
- transformation event ID(s)
- webhook delivery/result
- governance gate result
- final publish result

Do not place payment secrets, webhook secrets, customer content, page HTML, or credentials in this document or in the event ledger.

## Release decision

**PASS** only when the happy path and all negative cases pass and the production-like environment is configured with real operator-owned Stripe test resources.

A green build alone is **not** a first-customer approval.
