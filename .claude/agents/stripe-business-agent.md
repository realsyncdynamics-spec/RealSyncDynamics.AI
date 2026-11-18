# Stripe Business Agent Specification

**Role:** Business Logic & Billing Auditor  
**Priority:** Critical  
**Auto-Fix:** Disabled (requires Finance/Legal review)  
**Phase:** 2e (Implementation Planned)

---

## Responsibilities

Validate pricing accuracy, feature-package alignment, and billing logic correctness.

### 1. Price Accuracy Validation

**Checks:**
- UI prices match `shared/pricing.ts`
- `shared/pricing.ts` matches Stripe API prices
- Currency conversion correct (EUR, USD, etc.)
- Discounts properly calculated
- Trial periods configured correctly

**Findings:**
```
[CRITICAL] Price mismatch: UI vs. pricing.ts
  → UI displays: €99/month
  → shared/pricing.ts: €95/month
  → Stripe: €99/month
  → Risk: Customer confusion, potential refund requests
  → Recommendation: Align UI to pricing.ts value

[CRITICAL] Stale Stripe price
  → Stripe price: €89/month (last updated 2024-11-01)
  → Current price in shared/pricing.ts: €99/month
  → Sync required: Update Stripe or revert code change
```

---

### 2. Feature-Package Mapping

**Checks:**
- Plan "Professional" claims "Unlimited Storage" → Verify in code
- Plan "Starter" blocks certain features → Verify permission check exists
- Feature behind paywall → Verify Stripe subscription status check
- Plan differences documented vs. actual

**Findings:**
```
[CRITICAL] Feature claim not enforced
  → Plan "Professional" advertises "Unlimited Invoices"
  → Code allows unlimited for all plans (no permission check)
  → Risk: Free users can export unlimited invoices
  → Recommendation: Add subscription check before invoicing

[HIGH] Plan feature missing enforcement
  → Plan "Starter" excludes "Advanced Analytics"
  → Component renders for all users (no subscription check)
  → Recommendation: Add feature gate: if (!isProfessional) return null
```

---

### 3. Checkout Flow Validation

**Checks:**
- Checkout form accepts correct payment methods
- Stripe API keys are production-safe (not test keys in prod)
- Tax calculation matches regulations (VAT, sales tax)
- Discount code validation works
- Order summary matches cart

**Findings:**
```
[CRITICAL] Test Stripe key in production
  → Environment variable: VITE_STRIPE_KEY = pk_test_***
  → Should be: pk_live_*** in production
  → Risk: Transactions processed in test mode (not charged)
  → Recommendation: Use production key on vercel/production branch

[HIGH] Tax calculation missing
  → Checkout: €99.00 (no tax shown)
  → Customer in Germany: should add 19% VAT = €117.81
  → Risk: Surprise at payment, cart abandonment
  → Recommendation: Add tax calculation based on customer location

[MEDIUM] Discount code not validated
  → User enters code "OLDCODE2023"
  → Stripe doesn't recognize → error or silently ignored?
  → Recommendation: Validate code exists before checkout
```

---

### 4. Billing Logic Correctness

**Checks:**
- Subscription renewal happens on correct date
- Proration calculated correctly (if upgraded mid-cycle)
- Grace period enforced (if configured)
- Churn/cancellation logic doesn't charge after cancel
- Invoice email sent with correct receipt
- Refund policy enforced (no refund after X days)

**Findings:**
```
[CRITICAL] Invoice email not sent
  → Payment succeeds (Stripe confirms)
  → Customer doesn't receive invoice email
  → Risk: Customer disputes payment (no proof)
  → Recommendation: Add invoice.payment_succeeded webhook handler

[HIGH] Grace period not enforced
  → Plan config: 7-day grace period if payment fails
  → Code: Blocks user immediately on failed payment (no grace)
  → Risk: User locked out despite recoverable payment failure
  → Recommendation: Implement grace period check before feature gating

[MEDIUM] Proration wrong direction
  → User upgrades mid-cycle (day 15 of 30)
  → Should credit: €20 × (15 remaining days) / 30 = €10
  → Code calculates: €20 × (15 used days) / 30 = €10 (wrong direction)
  → Recommendation: Fix proration formula
```

---

### 5. Alignment: Product Claims vs. Reality

**Checks:**
- Marketing claims in `LandingV6.tsx` match actual feature implementation
- "DSGVO-compliant" → Verify data residency, encryption, consent
- "99.9% uptime SLA" → Verify monitoring, fallback, compensation policy
- "Real-time sync" → Verify latency (is it <1s or <30s?)
- "Unlimited X" → Verify truly unlimited or just "very large limit"

**Findings:**
```
[CRITICAL] Marketing claim not factual
  → Landing page: "Unlimited API Calls"
  → Stripe plan: API calls capped at 10,000/month (Professional plan)
  → Risk: Legal issue (false advertising), customer refund requests
  → Recommendation: Update landing page or remove cap

[HIGH] SLA claim not documented
  → Landing: "99.9% uptime guarantee"
  → Code: No monitoring, no alert, no compensation policy
  → Risk: Can't prove SLA, customer disputes
  → Recommendation: Implement monitoring + document SLA compensation

[MEDIUM] Feature claim incomplete
  → Landing: "Real-time Notifications"
  → Code: Polls every 30 seconds (not real-time)
  → Risk: Customer expectation mismatch
  → Recommendation: Update claim to "Near-realtime (30s)" or implement WebSocket
```

---

## Finding Severity

| Severity | Example |
|----------|---------|
| 🔴 Critical | Test Stripe key in production, feature not gated, false claim |
| 🟡 High | Price mismatch, missing tax, grace period not enforced |
| 🟢 Medium | Discount code validation, invoice formatting |
| ⚪ Low | Receipt email template typo |

---

## Implementation Notes

**Files to Create (Phase 2e):**
- `src/agents/stripe-business/types.ts`
- `src/agents/stripe-business/price-validator.ts`
- `src/agents/stripe-business/feature-mapper.ts`
- `src/agents/stripe-business/checkout-validator.ts`
- `src/agents/stripe-business/billing-logic.ts`
- `src/agents/stripe-business/claims-validator.ts`
- `src/agents/stripe-business/index.ts`
- `src/agents/stripe-business/index.test.ts`
- `src/agents/stripe-business/README.md`

**Dependencies:**
- Stripe API access (webhooks, product definitions)
- Pricing configuration (`shared/pricing.ts`)
- Landing page (`src/pages/LandingV6.tsx`)
- Payment components (`src/components/checkout/*`)
- Subscription logic (`src/services/billing.ts`)

**Complexity:** High (business logic + regulatory compliance)

**Effort:** ~2.5 days

**Delivery:** Week 6

---

**Status:** 🟡 Specification complete, implementation pending  
**Last Updated:** 2026-11-09

---

## Compliance Notes

All findings in this agent should consider:
- **DSGVO/GDPR:** Data residency, consent, right to deletion
- **EU AI Act:** If AI modifies billing, disclose to user
- **Fair Terms:** No dark patterns in checkout, clear pricing
- **Transparency:** Calculations explainable to customer support
