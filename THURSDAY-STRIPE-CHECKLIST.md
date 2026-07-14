# Thursday Stripe Verification — Action Checklist

**Goal:** Get Stripe payment flow working for MVP testing  
**Date:** July 15, 2026  
**Status:** ⏳ IN PROGRESS

---

## ✅ PHASE 1: Secrets & Configuration (15 min)

### Step 1: Get Stripe Test Credentials
- [ ] Open Stripe Dashboard: https://dashboard.stripe.com/test/dashboard
- [ ] Navigate to: Developers → API Keys
- [ ] Copy **Secret Key** (starts with `sk_test_...`)
- [ ] Copy **Publishable Key** (starts with `pk_test_...`)

### Step 2: Get Webhook Secret
- [ ] In Stripe Dashboard: Developers → Webhooks
- [ ] Create New Endpoint:
  - URL: `https://{your-project}.supabase.co/functions/v1/stripe-webhook`
  - Events: Select `customer.subscription.*`, `invoice.*`, `checkout.session.*`
- [ ] Copy **Signing Secret** (starts with `whsec_...`)

### Step 3: Set Supabase Secrets
```bash
# Option A: Via CLI (if you have it configured)
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Option B: Via Supabase Dashboard
# 1. Go to: Project Settings → Secrets → Add Secret
# 2. Name: STRIPE_SECRET_KEY
# 3. Value: sk_test_... (from Stripe)
# 4. Save
# 5. Repeat for STRIPE_WEBHOOK_SECRET
```

### Step 4: Set Frontend Config
```bash
# Check .env.local (or create if doesn't exist)
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env.local

# Restart dev server
npm run dev
```

---

## ✅ PHASE 2: Database Setup (10 min)

### Step 5: Verify Products Table Exists
```sql
-- In Supabase SQL Editor, run:
SELECT id, default_for_plan_key, stripe_price_id, name
FROM public.products
WHERE default_for_plan_key IN ('starter', 'growth', 'agency')
LIMIT 5;
```

**Expected Result:** Should show rows with `internal_default_*` or `price_` IDs

### Step 6: Create Stripe Product & Price (First-Time Setup)

**In Stripe Dashboard:**
1. Go to: Products → Add Product
2. Name: "Starter Plan"
3. Price: €79 / month
4. Copy the Price ID (format: `price_xxxxx...`)

**In Supabase SQL Editor:**
```sql
-- Insert test product
INSERT INTO public.products 
  (default_for_plan_key, name, stripe_price_id)
VALUES 
  ('starter', 'Starter Monthly (Test)', 'price_xxxxx')
ON CONFLICT (default_for_plan_key) 
DO UPDATE SET stripe_price_id = 'price_xxxxx';

-- Verify
SELECT * FROM public.products 
WHERE default_for_plan_key = 'starter';
```

---

## ✅ PHASE 3: Manual Payment Test (20 min)

### Step 7: Start Dev Server
```bash
npm run dev
# Should show: Local: http://localhost:3000
```

### Step 8: Create Test Tenant & User
1. Navigate to: http://localhost:3000
2. Sign up with test email: `test-stripe@example.com`
3. Create workspace/tenant (or use existing)
4. Copy the `tenant_id` from URL or database

### Step 9: Initiate Checkout
1. Navigate to: `http://localhost:3000/checkout/starter`
2. Should redirect to Stripe Checkout hosted page
3. If error: check browser console for error message

### Step 10: Complete Test Payment
**Stripe Test Card Details:**
- Card Number: `4242 4242 4242 4242`
- Expiry: `12/25` (any future month/year)
- CVC: `123` (any 3 digits)
- Postal Code: `12345` (any valid format)
- Country: `Germany` or any country

1. Enter card details
2. Click "Pay"
3. Should redirect to: `/checkout/success?session_id=cs_test_...`

### Step 11: Verify DB Sync
```sql
-- In Supabase SQL Editor, check if subscription was created:
SELECT 
  id,
  tenant_id, 
  plan_key, 
  status,
  stripe_subscription_id,
  created_at
FROM public.subscriptions
WHERE tenant_id = 'YOUR_TENANT_ID'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
| id | tenant_id | plan_key | status | stripe_subscription_id |
|---|---|---|---|---|
| uuid | uuid | starter | active | sub_test_xxxxx |
```

---

## ✅ PHASE 4: Webhook Verification (10 min)

### Step 12: Check Stripe Webhook Events
1. In Stripe Dashboard: Developers → Webhooks → Your Endpoint
2. Scroll to "Events" section
3. Should see `customer.subscription.created` with status `202 Accepted`

### Step 13: Check Supabase Function Logs
```bash
# In Supabase Dashboard → Edge Functions → stripe-webhook → Logs
# Should see entries like:
# ✅ Received event: customer.subscription.created
# ✅ Synced subscription to DB
```

### Step 14: Verify Webhook Events in DB
```sql
-- Check webhook events were logged
SELECT id, type, created_at 
FROM public.webhook_events
WHERE type LIKE 'customer.subscription%'
ORDER BY created_at DESC
LIMIT 5;
```

---

## ⚠️ TROUBLESHOOTING

### Problem: "Stripe secrets not configured"
**Solution:**
```bash
supabase secrets list
# Should show: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# If missing: use supabase secrets set command above
```

### Problem: "No Stripe Price wired for plan_key"
**Solution:** Follow Step 6 above — create product in Stripe, insert price_id in DB

### Problem: Checkout page shows blank/error
**Solution:**
1. Check browser console (F12) for error
2. Check `.env.local` has `VITE_STRIPE_PUBLISHABLE_KEY`
3. Restart dev server: `npm run dev`

### Problem: Webhook events not syncing
**Solution:**
1. Verify webhook URL in Stripe is correct
2. Verify STRIPE_WEBHOOK_SECRET is set in Supabase
3. Check Supabase function logs for errors
4. Verify RLS policies allow writes to subscriptions table

### Problem: Subscription created but status is "trialing"
**Solution:** This is correct if `pilot=true` in checkout. Normal behavior for 14-day trials.

---

## ✅ SUCCESS CHECKLIST

- [ ] Stripe test credentials obtained
- [ ] Supabase secrets set (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- [ ] Frontend publishable key configured
- [ ] Stripe product & price created
- [ ] Products table updated in DB
- [ ] Checkout flow initiates successfully
- [ ] Test payment completes (4242 card accepted)
- [ ] Subscription created in DB
- [ ] Status = 'active' or 'trialing'
- [ ] Webhook event received (202 Accepted)
- [ ] No errors in console/logs

---

## 📝 NEXT STEPS

**If All Tests Pass:**
1. ✅ Stripe integration verified for MVP
2. → Proceed to Friday: Landing Page (/audit)
3. → Proceed to Saturday-Sunday: End-to-end testing + deployment

**If Issues Found:**
1. Debug using TROUBLESHOOTING section above
2. Check STRIPE-INTEGRATION-STATUS.md for detailed architecture
3. Consult Stripe docs: https://stripe.com/docs/payments/checkout

---

**Time Estimate:** 1-2 hours (including troubleshooting)  
**Owner:** Thursday MVP verification  
**Status:** Ready to execute

