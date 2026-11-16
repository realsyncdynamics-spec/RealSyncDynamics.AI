# Customer Journey Agent Specification

**Role:** Journey Flow Validator  
**Priority:** High  
**Auto-Fix:** Disabled (requires PMO review)  
**Phase:** 2b (Implementation Planned)

---

## Responsibilities

Validate customer journey flows are complete, unbroken, and discoverable.

### 1. Signup Flow Validation

**Path:** Landing → Email → Confirm → OnboardingSetup → Preferences → Ready

**Checks:**
- All pages exist and are routable
- Forms are complete (all required fields)
- Success → next step transitions work
- Error messages are clear and actionable
- Timeout/expiry handling (email confirm links expire after X hours)
- Accessibility: form labels, error indicators, keyboard navigation

**Findings:**
- Missing confirmation page
- Expired links not caught
- Form validation messages unclear
- CTA button missing or hidden

---

### 2. Onboarding Flow Validation

**Path:** Checklist → FeatureDiscovery → HelpAccess → WelcomeEmail

**Checks:**
- Onboarding checklist items are achievable
- Feature discovery shows relevant features for user role
- Help documentation accessible (not hidden behind 3 clicks)
- Welcome email sent with next steps
- Skip/accelerate options available
- Completion tracking works

**Findings:**
- Missing checklist items
- Features not discoverable
- Dead help links
- Skipped users don't get follow-up

---

### 3. Checkout Flow Validation

**Path:** Cart → ShippingInfo → Payment → Confirmation → Invoice

**Checks:**
- Cart editing works (add, remove, quantity)
- Address validation (required fields, format)
- Shipping options display correctly
- Payment methods work (Stripe, cards)
- Tax calculation correct
- Confirmation shows order summary
- Invoice email sent with receipt

**Findings:**
- Cart persists across sessions
- Address required fields missing
- Shipping cost not calculated
- Payment fails silently
- Confirmation page doesn't match order

---

### 4. Success Flow Validation

**Path:** Signup → First Feature Use → Support Access → Retention Trigger

**Checks:**
- User knows how to use product after onboarding
- Support contact method obvious (in-app, email, chat)
- Success metrics tracked (features used, time on site)
- Upsell triggers fire appropriately (not too early, not too late)
- Renewal reminders sent before expiry
- Churn prevention flows (winback, pause options)

**Findings:**
- First feature use obscured
- Support contact missing or hard to find
- Usage tracking not firing
- Upsell too aggressive or dormant
- Churn emails not sent

---

### 5. Dead-End Detection

**Checks:**
- Pages without exit path (no next CTA, no back button)
- Orphaned features (feature exists but user can't find it)
- Broken redirects (URL changed, old links not handled)
- Missing feedback loops (user action → no confirmation)

**Findings:**
- Success page with no "Continue" button
- Feature hidden behind permission denied
- Redirect chain (old → new → newer)
- Form submitted but no confirmation shown

---

## Finding Severity

| Severity | Example |
|----------|---------|
| 🔴 Critical | Signup form can't be submitted (blocking acquisition) |
| 🟡 High | Checkout page missing (blocking revenue) |
| 🟢 Medium | Onboarding skippable but should require 1 step |
| ⚪ Low | Help link goes to old documentation URL |

---

## Implementation Notes

**Files to Create (Phase 2b):**
- `src/agents/customer-journey/types.ts`
- `src/agents/customer-journey/flow-mapper.ts`
- `src/agents/customer-journey/journey-validator.ts`
- `src/agents/customer-journey/index.ts`
- `src/agents/customer-journey/index.test.ts`
- `src/agents/customer-journey/README.md`

**Dependencies:**
- Routing data (`src/App.tsx`)
- Form definitions (`src/components/forms/*`)
- Page structure (`src/pages/*`)

**Effort:** ~2 days (flows are complex, need UI interaction testing)

**Delivery:** Week 3

---

**Status:** 🟡 Specification complete, implementation pending  
**Last Updated:** 2026-11-09
