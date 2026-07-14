# Stripe Integration Status & Testing Guide

**Status:** ✅ **MOSTLY COMPLETE** (Need to verify test payment flow)  
**Date:** July 15, 2026 (Thursday)  
**Task:** Verify Stripe setup is production-ready for MVP

---

## Implementation Status

### 1. ✅ Stripe Setup & Configuration

**Already Implemented:**
- Test mode configured in `src/config/company.ts`
- Publishable key loaded from environment: `VITE_STRIPE_PUBLISHABLE_KEY`
- Secret key setup for Edge Functions: `STRIPE_SECRET_KEY` (in Supabase secrets)
- Webhook secret setup: `STRIPE_WEBHOOK_SECRET` (in Supabase secrets)

**Current Mode:** `test` (ready to switch to `live` for production)

**Database Schema:**
- ✅ `subscriptions` table (tracks active subscriptions, status, stripe IDs)
- ✅ `subscription_plans` table (tier definitions)
- ✅ `feature_usage` table (quota tracking)
- ✅ Helper functions: `get_tenant_plan_key()`, `has_feature()`, `get_feature_quota()`, `check_feature_usage()`

---

### 2. ✅ Edge Functions (Backend)

All three Stripe Edge Functions are implemented:

#### `stripe-checkout` (`supabase/functions/stripe-checkout/index.ts`)
- Creates Stripe Checkout sessions
- Validates user is tenant owner/admin
- Resolves Stripe Price ID from database
- Supports 14-day trial for pilot mode
- Returns checkout URL for redirect

**Endpoint:** `POST /functions/v1/stripe-checkout`  
**Auth:** Bearer token (user JWT)  
**Body:** `{ tenant_id: uuid, plan_key: string, pilot?: boolean }`

#### `stripe-webhook` (`supabase/functions/stripe-webhook/index.ts`)
- Receives and verifies Stripe webhook events
- Idempotent event processing (prevents duplicates)
- Handles:
  - `customer.subscription.created` → syncs to DB
  - `customer.subscription.updated` → syncs to DB
  - `customer.subscription.deleted` → marks as cancelled
  - `invoice.paid` → sends receipt email
  - `checkout.session.completed` → triggers onboarding

**Endpoint:** `POST /functions/v1/stripe-webhook`  
**Signature Verification:** Stripe signature header

#### `stripe-portal` (`supabase/functions/stripe-portal/index.ts`)
- Creates Stripe Customer Portal session
- Allows customers to manage billing, cancel subscription
- Returns portal URL for redirect

**Endpoint:** `POST /functions/v1/stripe-portal`  
**Auth:** Bearer token (user JWT)

---

### 3. ✅ Frontend Integration

**Client Utilities (`src/lib/stripe.ts`):**
- `createCheckoutSession()` - calls stripe-checkout function
- `openCustomerPortal()` - calls stripe-portal function
- `isStripeConfigured()` - checks if publishable key is set
- `formatPrice()` - German EUR formatting
- `getPlanById()`, `isPlanFixedPrice()`, `getStripeProductMetadata()`

**Checkout Flow (`src/features/billing/checkout.ts`):**
- `createCheckoutSession()` - handles pilot mode detection
- Plan key validation
- Error handling

**UI Components:**
- `CheckoutPage` - full checkout page
- `CheckoutSuccessPage` - post-purchase confirmation
- `CheckoutCancelPage` - cancellation handling
- `PlanUpgradeModal` - modal for quick upgrade
- `BillingView` - subscription management dashboard
- `UsageView` - feature usage tracking
- `PricingPage` - public pricing page

---

### 4. ⚠️ Configuration & Secrets

**Frontend (.env / CI/CD):**
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` - must be set
- ⚠️ Individual price IDs (`VITE_STRIPE_PRICE_STARTER`, etc.) - optional but recommended for build transparency

**Backend (Supabase Secrets):**
- ⚠️ `STRIPE_SECRET_KEY` - must be configured in Supabase
- ⚠️ `STRIPE_WEBHOOK_SECRET` - must be configured in Supabase
- ⚠️ `public.products` table - must be seeded with real Stripe Price IDs (currently has `internal_default_*` sentinel values)

---

## What's Missing for MVP

### 1. Stripe Secrets Configuration ⏳
**Action Required:**
```bash
# In Supabase dashboard:
# 1. Go to Project Settings → Secrets
# 2. Add secret: STRIPE_SECRET_KEY = sk_test_... (or sk_live_... for production)
# 3. Add secret: STRIPE_WEBHOOK_SECRET = whsec_... (from Stripe webhook endpoint)
```

### 2. Stripe Products & Prices Setup ⏳
**Current State:** Database has `internal_default_*` sentinel values (not real Stripe prices)

**Action Required:**
1. Create product in Stripe dashboard
2. Create price (monthly + yearly variants)
3. Copy price IDs: `price_xxxxx`
4. Seed database via SQL:
   ```sql
   UPDATE public.products
   SET stripe_price_id = 'price_xxxxx'
   WHERE default_for_plan_key = 'starter';
   ```

### 3. Webhook Endpoint Registration ⏳
**Current State:** Edge Function exists but webhook not registered in Stripe dashboard

**Action Required:**
1. Get Edge Function URL: `https://{project-id}.supabase.co/functions/v1/stripe-webhook`
2. In Stripe Dashboard → Webhooks → Add endpoint
3. URL: `https://{project-id}.supabase.co/functions/v1/stripe-webhook`
4. Events: `customer.subscription.*`, `invoice.*`, `checkout.session.*`
5. Copy signing secret → set as `STRIPE_WEBHOOK_SECRET` in Supabase

---

## Testing Checklist

### Phase 1: Local Testing (Localhost)

```bash
npm run dev
# Verify environment:
# - VITE_STRIPE_PUBLISHABLE_KEY is set
# - Supabase secrets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured
```

**Test 1: Checkout Flow**
1. Navigate to http://localhost:3000/checkout/starter
2. Stripe Checkout should open (hosted page)
3. Enter test card: `4242 4242 4242 4242`
4. Expiry: any future date (e.g., 12/25)
5. CVC: any 3 digits (e.g., 123)
6. Billing postal code: any valid format (e.g., 12345)
7. Click Pay
8. Should redirect to `/checkout/success?session_id=...`

**Expected Outcome:**
- ✅ Checkout completes without errors
- ✅ Test subscription created in Stripe dashboard (visible in Customers → Subscriptions)
- ✅ Webhook event received (visible in Stripe Logs)
- ✅ Subscription synced to DB (`SELECT * FROM subscriptions WHERE stripe_subscription_id = '...'`)
- ✅ Status shows `trialing` (if pilot=true) or `active`

**Test 2: Subscription Status in DB**
```sql
-- Verify subscription was synced
SELECT id, tenant_id, plan_key, status, stripe_subscription_id 
FROM public.subscriptions 
WHERE tenant_id = 'YOUR_TENANT_ID'
LIMIT 1;

-- Should show:
-- status: 'trialing' or 'active'
-- stripe_subscription_id: 'sub_xxxxx'
```

**Test 3: Billing Portal**
1. Navigate to http://localhost:3000/settings/billing
2. Click "Manage Subscription"
3. Stripe Portal should open
4. Can cancel subscription, update payment method, view invoices
5. Cancelling should sync back to DB

**Expected Outcome:**
- ✅ Portal opens without errors
- ✅ User can view/manage subscription
- ✅ Cancellation syncs to DB (status → `canceled`)

---

### Phase 2: Staging Deployment

```bash
# After local tests pass:
git add -A
git commit -m "feat: Verify Stripe integration E2E with test payment"
git push -u origin claude/realsync-roadmap-strategy-fqe70b
# Create PR for manual testing in staging
```

**In Staging:**
1. Repeat Phase 1 tests on production URL
2. Verify email receipts are sent (if email is configured)
3. Test with different browsers/devices
4. Simulate failed payment: use card `4000 0000 0000 0002` (declines)
5. Verify error handling is user-friendly

---

## Pricing Configuration for MVP

According to `WEEK-1-PLAN.md`, MVP should have:
- **Professional Plan:** €99/month
- **Annual Option:** €990/year (10 months' discount)
- Free trial: 5 scans (no payment method required)
- 14-day paid trial after sign-up

**Current Implementation:**
- ✅ Database supports multiple tiers (free, starter, growth, agency, scale, enterprise)
- ✅ Each tier has monthly + yearly variant
- ✅ Trial period support built-in
- ⚠️ Need to simplify to 1 plan for MVP or adjust UI to show only starter tier

**Options:**
1. Keep complex pricing (UI shows all 6 tiers) - more future-proof
2. Hide tiers in MVP UI (show only "Professional" → starter tier internally)
3. Simplify to single plan - would require schema changes

**Recommendation:** Keep complex schema (enables fast feature expansion), but MVP UI shows only "Professional" → `starter` plan (€79/month → adjust copy to €99/month if preferred).

---

## Next Steps (If Issues Found)

### Issue: "Stripe secrets not configured"
**Solution:**
```bash
# Verify in Supabase:
supabase secrets list
# Should show: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

### Issue: "No Stripe Price wired for plan_key"
**Solution:**
1. Go to Stripe Dashboard → Products
2. Create new product "Starter Plan"
3. Create price: €79/month (monthly), €790/year (yearly)
4. Copy price IDs
5. Update DB:
   ```sql
   INSERT INTO public.products (default_for_plan_key, stripe_price_id, name)
   VALUES ('starter', 'price_xxxxx_monthly', 'Starter Monthly')
   ON CONFLICT DO NOTHING;
   ```

### Issue: Webhook not syncing subscription
**Solution:**
1. Check Stripe Webhook Logs → should show `202 Accepted`
2. Check Supabase Logs → navigate to stripe-webhook function
3. If 401/403, check `STRIPE_WEBHOOK_SECRET` is correct
4. If SQL error, check RLS policies on subscriptions table

---

## Success Criteria

✅ **MVP-Ready:**
- [ ] Stripe test mode configured
- [ ] Checkout flow completes end-to-end (test card)
- [ ] Subscription syncs to DB
- [ ] Subscription status updates correctly (trialing → active → canceled)
- [ ] Webhook receives all events
- [ ] No errors in Supabase logs
- [ ] No errors in browser console

✅ **Production-Ready (Dec 31):**
- [ ] Switch `STRIPE_SECRET_KEY` to `sk_live_...`
- [ ] Register real webhook in Stripe
- [ ] Seed real Stripe Price IDs in DB
- [ ] Switch `stripeAccountMode` to `'live'` in company.ts
- [ ] Test with real payment (use your own card)

---

## Documentation References

- **Stripe Checkout:** https://stripe.com/docs/payments/checkout
- **Webhook Handling:** https://stripe.com/docs/webhooks
- **Customer Portal:** https://stripe.com/docs/billing/subscriptions/customer-portal
- **Test Cards:** https://stripe.com/docs/testing#cards

---

**Status:** Ready for manual testing on local environment  
**Owner:** Thursday (July 15)  
**Assigned:** Verify secrets, seed products, test payment flow

