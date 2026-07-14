# Stripe Setup Guide — Week 1 MVP

Get Stripe payment flow working for MVP testing. Estimated time: **45 minutes** (setup + test).

## Overview

**Goal:** Enable test payments so users can:
1. Click "Upgrade" on scan results
2. Proceed to Stripe Checkout
3. Complete test payment (card: 4242 4242 4242 4242)
4. Verify subscription synced to database

**Prerequisites:**
- Stripe account (free tier OK for testing)
- Supabase project access
- Access to update environment variables

---

## Phase 1: Get Stripe Test Credentials (5 min)

### Step 1: Log into Stripe Dashboard

```
https://dashboard.stripe.com/test/dashboard
```

Make sure you're in **Test Mode** (toggle in top-right corner should show "Test data").

### Step 2: Get API Keys

Navigate to: **Developers → API keys**

You'll see two test keys:

1. **Publishable Key** (starts with `pk_test_`)
   - Safe to share (used in frontend)
   - Copy it — you'll need this

2. **Secret Key** (starts with `sk_test_`)
   - ⚠️ KEEP SECRET (never commit to git)
   - Copy it — you'll store in Supabase

**Example:**
```
Publishable: pk_test_51234567890abcdefghijklmnop
Secret:      sk_test_0987654321zyxwvutsrqponmlkji
```

### Step 3: Get Webhook Secret

Navigate to: **Developers → Webhooks**

Create a new endpoint:
- **Endpoint URL:** `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook`
- **Events:** Select these:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.created`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Click "Add endpoint" and copy the **Signing Secret** (starts with `whsec_`).

**Example:**
```
Signing Secret: whsec_test_abcdefghijklmnopqrstuvwxyz123456
```

---

## Phase 2: Store Secrets in Supabase (10 min)

### Option A: Via Supabase CLI (if configured)

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_test_...

# Verify they're set
supabase secrets list
```

### Option B: Via Supabase Dashboard (Recommended for web)

1. Open Supabase Dashboard: https://app.supabase.com
2. Go to: **Project → Settings → Secrets**
3. Click **New Secret**
4. Add first secret:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** `sk_test_...` (from Step 2)
   - Click **Save**
5. Add second secret:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_test_...` (from Step 3)
   - Click **Save**

**Verify:** Should see both secrets listed (values masked).

---

## Phase 3: Frontend Configuration (5 min)

### Update `.env.local`

Create or update `.env.local` in project root:

```bash
# Get this from Stripe (Publishable Key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Restart Dev Server

```bash
npm run dev
# Stops and restarts with new env vars
```

The frontend can now talk to Stripe!

---

## Phase 4: Database Setup (10 min)

### Verify Products Table

```sql
-- Open Supabase Dashboard → SQL Editor
-- Run this query:

SELECT id, default_for_plan_key, stripe_price_id, name
FROM public.products
WHERE default_for_plan_key IN ('starter', 'growth', 'agency', 'scale')
LIMIT 10;
```

**Expected result:** Rows with Stripe price IDs (format: `price_xxxxx`)

If empty or missing `stripe_price_id`, continue to next step.

### Create Stripe Product (First-Time Setup)

**In Stripe Dashboard:**

1. Go to: **Products → Add Product**
2. Fill in:
   - **Name:** `Starter Monthly (MVP Test)`
   - **Price:** €79.00 / month
   - **Billing period:** Monthly
   - Click **Save**
3. Copy the **Price ID** (format: `price_xxxxx`)

**In Supabase SQL Editor:**

```sql
-- Insert or update product with real Stripe price ID
INSERT INTO public.products 
  (default_for_plan_key, name, stripe_price_id)
VALUES 
  ('starter', 'Starter Monthly (MVP Test)', 'price_xxxxx')
ON CONFLICT (default_for_plan_key) 
DO UPDATE SET 
  stripe_price_id = 'price_xxxxx',
  name = 'Starter Monthly (MVP Test)';

-- Verify it worked
SELECT * FROM public.products 
WHERE default_for_plan_key = 'starter';
```

---

## Phase 5: Manual Payment Test (15 min)

### Step 1: Start Dev Server

```bash
npm run dev
```

Visit: http://localhost:3000

### Step 2: Create Test User

1. Click **Sign In** (top right)
2. Create new account:
   - Email: `test-payment@example.com`
   - Password: `TempPass123!`
   - Accept terms
3. Create workspace or use existing
4. Note your **Tenant ID** (from URL or user profile)

### Step 3: Go to Checkout

Navigate to: `http://localhost:3000/checkout/starter`

Should show Stripe Checkout page with:
- Price: €79.00
- Billing period: Monthly
- "Pay" button

### Step 4: Complete Test Payment

Enter these details exactly:

```
Card Number:    4242 4242 4242 4242
Expiry Date:    12/25 (or any future date)
CVC:            123 (or any 3 digits)
Postal Code:    12345 (or any valid postal)
Country:        Germany (or any country)
Full Name:      Test User (or any name)
```

Click **Pay**

### Step 5: Verify Success

You should see:
- ✅ Redirect to `/checkout/success?session_id=cs_test_...`
- ✅ Success message displayed
- ✅ No console errors (F12 → Console)

### Step 6: Verify Database Sync

**In Supabase SQL Editor:**

```sql
SELECT 
  id,
  tenant_id, 
  plan_key, 
  status,
  stripe_subscription_id,
  current_period_end,
  created_at
FROM public.subscriptions
WHERE created_at > NOW() - interval '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected result:**

```
id                  | uuid
tenant_id           | uuid (matches your test user)
plan_key            | starter
status              | active OR trialing
stripe_subscription_id | sub_test_xxxxx
current_period_end  | 30 days from now
created_at          | just now
```

If you see this, **Stripe integration works! ✅**

---

## Phase 6: Webhook Verification (10 min)

### Step 1: Check Stripe Webhook Events

In Stripe Dashboard:

1. **Developers → Webhooks**
2. Click your webhook endpoint
3. Scroll to **Events**
4. Should see `customer.subscription.created` with status **202 Accepted**

If status is **Failed** or missing:
- Check webhook URL is correct
- Verify Supabase function is deployed: `supabase functions list`
- Check function logs: `supabase functions get stripe-webhook --logs`

### Step 2: Verify Webhook Logs in Supabase

**In Supabase Edge Functions:**

1. Dashboard → Edge Functions → `stripe-webhook`
2. Click **Logs** tab
3. Should see entries like:
   ```
   ✅ Received event: customer.subscription.created
   ✅ Synced subscription to DB
   ```

If errors appear, check:
- Are `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set? (Settings → Secrets)
- Is RLS policy allowing writes to `subscriptions` table?

---

## Troubleshooting

### Problem: "Stripe key not configured"

**Solution:**
```bash
# Check .env.local exists
cat .env.local | grep VITE_STRIPE

# Should show:
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# If missing: add it and restart dev server
npm run dev
```

### Problem: Checkout page blank or shows error

**Solution:**
1. F12 → Console tab
2. Look for red errors (usually about missing key)
3. If error mentions "publishable key":
   - Verify `VITE_STRIPE_PUBLISHABLE_KEY` in `.env.local`
   - Restart dev server: `npm run dev`

### Problem: Payment succeeds but subscription not in DB

**Solution:**
1. Check webhook events in Stripe:
   - Developers → Webhooks → Your endpoint → Events
   - Click `customer.subscription.created` event
   - Should show status **202 Accepted**
2. If status is **Failed**:
   - Click event to see error details
   - Common issues:
     - Webhook URL incorrect
     - `STRIPE_WEBHOOK_SECRET` not set in Supabase
     - RLS policy blocking writes

### Problem: "No Stripe price wired for plan_key=starter"

**Solution:** You missed **Phase 4** (Database Setup). Run this:

```sql
-- In Supabase SQL Editor:
UPDATE public.products 
SET stripe_price_id = 'price_xxxxx'
WHERE default_for_plan_key = 'starter';
```

Replace `price_xxxxx` with your real Stripe Price ID from Step 1.

### Problem: Test card declined

**Solution:** This shouldn't happen with `4242 4242 4242 4242` in test mode. If it does:
1. Make sure you're in **Test Mode** in Stripe (toggle top-right)
2. Try different expiry: `12/99`
3. Check browser console for detailed error

### Problem: Can't access Stripe Dashboard

**Solution:**
- Create free account: https://stripe.com
- Enable **Test Mode** toggle
- Get test keys (not live keys!)

---

## Success Checklist

- [ ] Stripe test credentials obtained (pk_test_*, sk_test_*, whsec_*)
- [ ] Supabase secrets set (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- [ ] `.env.local` has VITE_STRIPE_PUBLISHABLE_KEY
- [ ] Products table has real stripe_price_id
- [ ] Dev server restarted (`npm run dev`)
- [ ] Test payment completes (4242 card accepted)
- [ ] Redirect to success page works
- [ ] Subscription appears in DB within 1 minute
- [ ] Status = `active` or `trialing`
- [ ] No console errors
- [ ] Webhook shows 202 Accepted in Stripe

---

## Next Steps

**If All Tests Pass:**
1. ✅ Stripe integration ready for production testing
2. → User can now complete upgrade flow in Phase 1 E2E test
3. → Proceed to Phase 2: Cross-browser testing
4. → Proceed to Phase 3: Mobile responsiveness

**If Issues Found:**
1. Use Troubleshooting section above
2. Check Stripe & Supabase logs
3. Verify all 6 phases completed
4. Re-run payment test after fixes

---

## Production Setup (Week 2+)

When ready for production:

1. Switch to **Live Mode** in Stripe (top-right toggle)
2. Get **Live** API keys (pk_live_*, sk_live_*)
3. Update Supabase secrets with live keys
4. Update `.env` with live publishable key
5. Update Stripe dashboard:
   - Webhook endpoint URL
   - Add production events
6. Test with real card (or use test numbers in live mode: 4242 4242 4242 4242 still works)

---

**Created:** Saturday, July 17, 2026  
**Time Estimate:** 45 minutes (setup + test)  
**Status:** Ready to execute anytime
