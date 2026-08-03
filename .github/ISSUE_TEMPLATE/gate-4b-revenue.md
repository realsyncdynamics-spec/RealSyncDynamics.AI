---
name: "🚪 Gate 4B Closure: Revenue (NEW)"
about: "Comprehensive payment flow validation before go-live"
title: "🚪 Gate 4B Closure Validation — Revenue Gate (Payment Flow)"
labels: ["gate", "phase-4b", "monetization", "revenue"]
---

## Gate 4B: Revenue Gate (NEW)

**Objective:** Comprehensive validation of entire payment flow and monetization scenarios in staging before production release.

### Pre-Closure Checklist

#### Issue Complete
- [ ] #926 Revenue Gate - Payment Flow Validation — testing complete

#### Test Scenario 1: Sign-up → Trial Activation
- [ ] User can sign up with email/password
- [ ] Trial automatically activated (14-day expiry)
- [ ] No immediate charge
- [ ] Trial status visible in dashboard
- [ ] Full Growth tier features accessible
- [ ] ✅ All scenarios completed

#### Test Scenario 2: Trial Expiry → Upgrade Prompt
- [ ] Trial countdown shown (days remaining)
- [ ] Day 13: Upgrade prompt displayed
- [ ] Upgrade CTA links to checkout
- [ ] Email reminder sent day 13
- [ ] Trial expires after 14 days
- [ ] ✅ All scenarios completed

#### Test Scenario 3: Checkout → Payment Success
- [ ] Checkout form accessible
- [ ] Stripe Elements card input working
- [ ] Payment processes without errors
- [ ] Subscription activated immediately
- [ ] Invoice generated and emailed
- [ ] Stripe webhook logged successfully
- [ ] ✅ All scenarios completed

#### Test Scenario 4: Checkout → Payment Failure
- [ ] Declined card triggers error message
- [ ] User can retry payment
- [ ] No partial charges on failure
- [ ] Error message helpful and clear
- [ ] ✅ All scenarios completed

#### Test Scenario 5: Cancel Subscription
- [ ] User can cancel from billing portal
- [ ] Next billing cancelled (no charge)
- [ ] Access revoked after current period
- [ ] Cancellation confirmed via email
- [ ] ✅ All scenarios completed

#### Test Scenario 6: Upgrade (Starter → Growth)
- [ ] Upgrade option available
- [ ] Prorated credit calculated correctly
- [ ] New plan active immediately
- [ ] Invoice shows proration adjustment
- [ ] ✅ All scenarios completed

#### Test Scenario 7: Downgrade (Growth → Starter)
- [ ] Downgrade option available
- [ ] Refund calculated for unused portion
- [ ] Downgrade effective next billing cycle
- [ ] Invoice adjusted
- [ ] ✅ All scenarios completed

#### Test Scenario 8: Invoice Retrieval
- [ ] Customer can download PDF from portal
- [ ] Invoice contains all required info
- [ ] Invoice numbering sequential
- [ ] No missing or corrupted PDFs
- [ ] ✅ All scenarios completed

#### Test Scenario 9: Tax Calculation
- [ ] VAT calculated per EU rules
- [ ] Different rates for different countries
- [ ] Tax line item shown on invoice
- [ ] Total includes tax
- [ ] ✅ All scenarios completed

#### Test Scenario 10: Webhook Integrity
- [ ] All Stripe events logged in audit table
- [ ] Webhook signatures validated
- [ ] Event ordering preserved
- [ ] No missed events
- [ ] ✅ All scenarios completed

#### Test Scenario 11: Stripe Dashboard Sync
- [ ] Customer data matches between app and Stripe
- [ ] Subscription data synchronized
- [ ] Charges recorded correctly
- [ ] No discrepancies
- [ ] ✅ All scenarios completed

#### Test Scenario 12: Idempotency
- [ ] Duplicate webhook events handled gracefully
- [ ] No duplicate charges
- [ ] No duplicate invoice generation
- [ ] Idempotency keys working
- [ ] ✅ All scenarios completed

#### Data Consistency Checks
- [ ] No data inconsistencies between app and Stripe
- [ ] All charges recorded in database
- [ ] Customer records updated correctly
- [ ] Subscription state consistent

#### Webhook & Retry Logic
- [ ] Webhook retry logic validated
- [ ] Failed webhooks eventually succeed
- [ ] Duplicate prevention working
- [ ] Error logs captured

#### Refund & Chargeback Handling
- [ ] Refund process tested
- [ ] Chargeback notifications received
- [ ] Handling procedure documented
- [ ] Team trained on process

#### Support Documentation
- [ ] Common payment issues documented
- [ ] Troubleshooting guide created
- [ ] Support team trained
- [ ] Escalation procedures clear

### Data Validation
- [ ] No orphaned charges
- [ ] No missing invoice records
- [ ] Payment status accurate in all systems
- [ ] Customer communication templates tested

### Performance Validation
- [ ] Checkout completes in < 5s
- [ ] Invoice generation in < 2s
- [ ] Webhook processing in < 1s
- [ ] No timeout issues

### Production Readiness
- [ ] Stripe account configured for live mode
- [ ] Live API keys ready (not deployed yet)
- [ ] Monitoring alerts configured
- [ ] Runbooks for common issues created
- [ ] Rollback plan documented

### Sign-Off

| Role | Name | Date | Approval |
|------|------|------|----------|
| Finance Lead | — | — | ⏳ |
| Product Manager | — | — | ⏳ |
| Backend Lead | — | — | ⏳ |
| Support Lead | — | — | ⏳ |

### Gate Closure
**Status:** ⏳ Pending validation  
**Timeline:** 3 days (Week 5 end)

### Critical Decision
- [ ] ✅ All 12 payment flow scenarios passing in staging
- [ ] ✅ No production-impacting bugs identified
- [ ] ✅ Team sign-off obtained

**Gate Status:** ⏳ Ready to proceed to Phase 5 QA

---

**Related Roadmap:** `docs/RELEASE_ROADMAP_INTEGRATION_ORDER.md` (see Phase 4B Revenue Gate section for full scenario details)
