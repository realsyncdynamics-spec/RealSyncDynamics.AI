# MOON vs. RealSync SaaS — Stripe Checkout routing hardening (2026-10-31)

**Release state: NO-GO.** This patch runs only on a review branch. Do not merge, deploy, publish a checkout, or enable supplier fulfillment without explicit release approval.

## Scope and invariants

- The existing SaaS webhook at `supabase/functions/stripe-webhook/index.ts` verifies Stripe's signature, then retrieves the Checkout Session and **all** line items from Stripe before recording the event or triggering SaaS side effects.
- `prod_VXiTuIuISpw59Z` / `price_1UWd2qIEauIvbZDCbEqrrt5G` is MOON hardware. A single exact-match hardware price + product is **acknowledged but ignored** by the SaaS webhook, including legacy Payment Links without a `product_line` marker.
- Mixed carts, unknown prices/products, incompatible metadata, missing tenant IDs, truncated Stripe results, and unavailable catalog lookups are **quarantined** (no tenant, license, Voice bot, onboarding email, or website rebuild).
- Existing SaaS sessions without `product_line` are supported **only** when all prices are in the `products` SaaS catalog (and for subscription-only add-ons, `plan_addons`). New SaaS Checkout sessions, subscriptions, and PaymentIntents are tagged `product_line=saas_governance`.
- The MOON webhook remains a **separate** service with its own test-only signing secret and persistent store. No event is forwarded by the SaaS webhook to a supplier or MOON handler.
- No product ID or price ID is created or modified by this patch. No Stripe account or Supabase production secrets/configuration were altered.

## Evidence and open gates

- Local TypeScript strict check of the pure routing helper: PASS.
- 15 executable local route assertions: PASS (hardware, mixed, tagged, legacy, unknown).
- Existing MOON sandbox backend tests: 28/28 PASS (simulated Stripe transport).
- New repository Vitest test file: `test/billing/stripe-product-line-routing.test.ts`. Full project CI/build must pass separately; local full repo build not possible without repository dependencies.
- Real Stripe sandbox session/transaction + webhook delivery: NOT tested; the current Stripe connector returned **only the live account**.
- Fig project `8735df2b-606d-40d4-8d4f-4e3542b33706` is not exposed through the connected tools. `src/components/CheckoutModal.tsx` and `src/components/StoreFooter.tsx` remain unchanged. The previous handoff package contains a Fig integration module, but it is not deployed.

## Hardware-shop legal review required before any checkout release

1. Verify fixed, published versioned hardware-shop AGB at a shop-specific URL; never point MOON checkout at governance/Voice SaaS conditions.
2. Verify withdrawal information and functionality, shop identity, shipping/delivery, returns, warranties and applicable EPR/battery compliance with qualified legal review.
3. Confirm Stripe-hosted legal links do not point to account-global SaaS terms. Keep Stripe's own terms checkbox disabled until the global URL is appropriate for the hardware shop; retain the versioned pre-checkout hardware acceptance in the MOON order server.
4. Test Android Chrome, iOS Safari, popup blockers (same-tab navigation), and Apple Pay availability as actually displayed by Stripe.

## Rollout

Do not manually merge this branch or deploy functions to production until CI, product-catalog reconciliation, real Sandbox E2E, Fig implementation, legal review, and a separate user GO.
