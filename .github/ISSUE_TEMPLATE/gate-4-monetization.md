---
name: "🚪 Gate 4 Closure: Monetization"
about: "Validate Phase 4 completion before Revenue Gate validation"
title: "🚪 Gate 4 Closure Validation — Monetization"
labels: ["gate", "phase-4", "monetization"]
---

## Gate 4: Monetization

**Objective:** Validate that all payment infrastructure, pricing logic, and subscription flows are functional.

### Pre-Closure Checklist

#### Phase 4 Issues Complete
- [ ] #921 Stripe Integration — merged
- [ ] #922 Pricing Logic & Tier Calculations — merged
- [ ] #923 Checkout Experience — merged ⚠️ **CRITICAL: No placeholder price IDs**
- [ ] #924 Trial & Onboarding Flow — merged
- [ ] #925 Invoicing & Billing — merged

#### Stripe Integration Validation
- [ ] Stripe account connected
- [ ] API keys stored in GitHub Secrets
- [ ] Products created in Stripe: Free, Starter, Growth, Agency, Enterprise
- [ ] Webhook endpoints configured: `charge.succeeded`, `charge.failed`, `customer.subscription.updated`
- [ ] Webhook signatures validated
- [ ] Billing portal accessible
- [ ] Test mode fully functional

#### Pricing Logic Validation
- [ ] All tier definitions in `src/config/pricing.ts`
- [ ] Free plan: $0/month (unlimited scans, basic features)
- [ ] Starter: €79/month (5 users, daily monitoring)
- [ ] Growth: €249/month (10 users, advanced features)
- [ ] Agency: €699/month (multi-tenant, white-label)
- [ ] Enterprise: €1,500+/month (custom SLA, support)
- [ ] Usage meters calculated correctly per tier
- [ ] Proration logic tested (upgrade/downgrade mid-cycle)
- [ ] Trial period logic: 14-day free access
- [ ] EU VAT calculation correct per country
- [ ] Unit tests passing for all tier transitions

#### Checkout Experience Validation
- [ ] Checkout form functional (email, payment method, billing address)
- [ ] Stripe Elements card input working
- [ ] **✅ All `internal_default_*` placeholders replaced with real `price_xxx` IDs**
- [ ] Test checkout succeeds in Stripe test mode
- [ ] Test checkout fails gracefully with declined card
- [ ] Success page displays subscription details
- [ ] Confirmation emails sent within 1 minute
- [ ] No HTTP 400 errors on checkout
- [ ] Session state persisted correctly

#### Trial & Onboarding Validation
- [ ] Trial activation on sign-up
- [ ] Trial grants all Growth tier features (14 days)
- [ ] Trial countdown visible in dashboard
- [ ] Upgrade prompt appears on day 13
- [ ] Free features available post-trial (graceful downgrade)
- [ ] Upgrade to any paid tier from trial
- [ ] Trial data stored in user profile
- [ ] Email reminder sent day 13

#### Invoicing & Billing Validation
- [ ] Invoice generated on successful charge
- [ ] PDF invoice includes: bill-to, line items, tax, total
- [ ] Invoice email sent within 1 minute of payment
- [ ] Customer can download invoices from billing portal
- [ ] Tax calculation per EU country rules
- [ ] Invoice data synced from Stripe webhooks
- [ ] No duplicate invoices
- [ ] Invoice numbering sequential

### Critical Blocker Validation
- [ ] ❌ **VERIFY: No `internal_default_*` price IDs in production code**
- [ ] ✅ All Stripe `price_xxx` IDs validated and tested
- [ ] ✅ Checkout endpoint returns 200 (not 400) on payment attempt

### Sign-Off

| Role | Name | Date | Approval |
|------|------|------|----------|
| Finance Lead | — | — | ⏳ |
| Product Lead | — | — | ⏳ |
| Backend Lead | — | — | ⏳ |

### Gate Closure
**Status:** ⏳ Pending validation  
**Timeline:** End of Week 5

### Next Phase
→ Proceed to **Gate 4B: Revenue Gate** (#926)

---

**Related Roadmap:** `docs/RELEASE_ROADMAP_INTEGRATION_ORDER.md`
