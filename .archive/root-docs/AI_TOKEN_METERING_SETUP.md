# AI Token Monetization — Setup Guide

## Overview

This guide documents the implementation of AI token monetization for RealSyncDynamicsAI. Token usage is now tracked and synced to Stripe for metered billing.

## Architecture

### 1. **Token Tracking Pipeline**

```
ai-invoke function
  ↓ (recordUsage after each LLM call)
usage_events table
  ↓ (DB trigger aggregates into)
usage_totals table (monthly sum per tenant)
  ↓ (daily cron: stripe-token-meter-sync)
Stripe usage meters (charged at month end)
```

### 2. **Files Modified/Created**

| File | Change | Purpose |
|------|--------|---------|
| `supabase/migrations/20260705100000_enable_ai_token_metering.sql` | **NEW** | Adds entitlement, config, and RPC helpers |
| `supabase/functions/stripe-token-meter-sync/index.ts` | **NEW** | Daily sync of tokens to Stripe meters |
| `supabase/functions/ai-invoke/index.ts` | **MODIFIED** | Records token usage after each call |

### 3. **Database Changes**

#### New Entitlement
```sql
INSERT INTO public.entitlements (key, description, kind)
VALUES ('limit.ai_tokens_monthly', 'LLM tokens per month', 'limit');
```

#### Token Limits per Plan
| Plan | Monthly Token Limit | Overage Rate |
|------|---------------------|--------------|
| Starter Governance (€39) | 100k | €0.01 per 1k |
| Professional (€149) | 500k | €0.01 per 1k |
| Governance OS (€599) | 5M | €0.01 per 1k |
| Enterprise | Unlimited | Custom |

#### New Functions
- `count_ai_tokens_by_tenant(tenant_id, period_month)` — RPC to aggregate tokens
- View: `ai_token_daily_totals` — Daily token breakdown by tenant

### 4. **Required Stripe Configuration**

Before tokens are charged, complete this Stripe setup:

1. **Create a Metered Billing Meter**
   - Go to Stripe Dashboard → Products → Billing Meters
   - Create meter named: `ai_tokens_monthly`
   - Event name: `ai_tokens_monthly`
   - Display name: "AI Tokens per Month"

2. **Create a Tiered Price**
   - Attach meter to existing prices for Starter, Professional, Governance OS
   - Configure overage tiers:
     ```
     Tier 1: 0 to included_units (Starter: 100k, Prof: 500k, OS: 5M) @ €0 (included)
     Tier 2: included_units+ @ €0.01 per 1k tokens
     ```

3. **Map Stripe Meter to RealSync**
   - Find your Stripe subscription item IDs
   - Insert into `metered_subscription_items`:
     ```sql
     INSERT INTO public.metered_subscription_items (
       tenant_id, entitlement_key, stripe_subscription_item_id, stripe_unit_factor
     ) VALUES (
       '...', 'limit.ai_tokens_monthly', 'si_xxx', 1.0
     );
     ```
   - `stripe_unit_factor`: 1.0 = 1 token = 1 unit on meter

### 5. **Deploying the Changes**

1. **Apply Migration**
   ```bash
   supabase db push
   # or in production:
   supabase db remote push
   ```

2. **Deploy Stripe Token Meter Sync Function**
   ```bash
   supabase functions deploy stripe-token-meter-sync
   ```

3. **Set Up Cron Trigger** (Daily at 00:05 UTC)
   
   Option A: Via Supabase Dashboard
   - Go to Edge Functions
   - Click stripe-token-meter-sync
   - Add cron schedule: `5 0 * * *`
   - Set required headers:
     ```
     Authorization: Bearer <STRIPE_METER_SHARED_SECRET>
     ```

   Option B: Via Supabase CLI (if available)
   ```bash
   supabase functions deploy stripe-token-meter-sync --cron "5 0 * * *"
   ```

### 6. **Monitoring & Debugging**

#### Check Token Usage
```sql
-- Tokens consumed this month by tenant
SELECT
  tenant_id,
  entitlement_key,
  total,
  period_month
FROM public.usage_totals
WHERE entitlement_key = 'limit.ai_tokens_monthly'
  AND period_month = DATE_TRUNC('month', NOW())::DATE
ORDER BY total DESC;

-- Daily breakdown
SELECT
  tenant_id,
  day,
  total_tokens,
  cost_usd
FROM public.ai_token_daily_totals
WHERE tenant_id = '<TENANT_ID>'
  AND day >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY day DESC;
```

#### Check Stripe Sync Status
```sql
-- Last sync results per tenant
SELECT
  tenant_id,
  entitlement_key,
  period_month,
  last_quantity,
  last_synced_at,
  last_status,
  last_error
FROM public.usage_meter_sync
WHERE entitlement_key = 'limit.ai_tokens_monthly'
ORDER BY last_synced_at DESC;
```

#### View Function Logs
```bash
supabase functions list
supabase functions logs stripe-token-meter-sync
```

### 7. **Testing**

1. **Manual Test - Invoke an Agent**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/ai-invoke \
     -H "Authorization: Bearer <USER_JWT>" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "<TENANT_ID>",
       "tool_key": "governance-agent",
       "input": "What are my DSGVO obligations?"
     }'
   ```

2. **Verify Token Tracking**
   ```sql
   SELECT * FROM usage_events
   WHERE tenant_id = '<TENANT_ID>'
     AND entitlement_key = 'limit.ai_tokens_monthly'
   ORDER BY created_at DESC LIMIT 5;
   ```

3. **Test Stripe Sync** (via cron or manual POST)
   ```bash
   curl -X POST http://localhost:54321/functions/v1/stripe-token-meter-sync \
     -H "Authorization: Bearer <STRIPE_METER_SHARED_SECRET>"
   ```

### 8. **Cost Calculation**

Token costs are calculated as:
```
Cost = (input_tokens * input_price_per_M) / 1,000,000
      + (output_tokens * output_price_per_M) / 1,000,000
```

Current LLM pricing:
| Model | Input Price | Output Price |
|-------|-------------|--------------|
| Claude Sonnet 4 | $3.00/M | $15.00/M |
| Claude Haiku 4.5 | $0.80/M | $4.00/M |
| GPT-4 Turbo | $10.00/M | $30.00/M |

Typical token usage:
- Governance Agent (multi-turn): 2k-5k tokens
- Risk Classification: 1k-2k tokens
- Simple Q&A: 500-1k tokens

### 9. **Billing Examples**

**Starter Plan (100k tokens/month @ €0.01 per 1k overage)**
- Usage: 150k tokens
- Billing: Base €39 + (150k - 100k) × €0.01/1k = €39 + €0.50 = **€39.50**

**Growth Plan (500k tokens/month @ €0.01 per 1k overage)**
- Usage: 2M tokens (high agent usage)
- Billing: Base €149 + (2M - 500k) × €0.01/1k = €149 + €15 = **€164**

### 10. **FAQ**

**Q: Why count input + output tokens?**
A: Fair pricing — both consume LLM resources. Some vendors count only output, but we're transparent about total cost.

**Q: Are cached tokens charged?**
A: No. Cached tokens appear in the response but are excluded from `limit.ai_tokens_monthly` usage. (Stripe only charges for billable tokens anyway.)

**Q: Can users exceed their token quota?**
A: Yes (soft quota). If usage exceeds the plan limit, they'll be billed for overage. We don't hard-block requests.

**Q: When are tokens charged?**
A: At month-end, Stripe invoice includes overage charges. Daily sync ensures real-time visibility.

**Q: How do we monitor for billing accuracy?**
A: Check `usage_meter_sync` table for daily Stripe sync status. Monitor Stripe webhook events for meter updates.

---

## Next Steps

1. ✅ Apply migration (`20260705100000_enable_ai_token_metering.sql`)
2. ✅ Deploy `stripe-token-meter-sync` function
3. ⏳ Configure Stripe meter + prices (requires Stripe access)
4. ⏳ Enable cron schedule for daily sync
5. ⏳ Update plan-config.ts with token limits (optional, if frontend needs display)
6. ⏳ Monitor & communicate to customers
