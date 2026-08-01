# Stripe Trial Events → n8n Webhook Integration

## Overview

When Stripe webhooks fire subscription trial events (`customer.subscription.created`, `customer.subscription.trial_will_end`, etc.), the `stripe-webhook` Edge Function automatically logs them to the `stripe_trial_events` table.

This document describes how to wire those events to an n8n automation workflow.

## Database Schema

Events are persisted in `public.stripe_trial_events`:

```sql
CREATE TABLE public.stripe_trial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  tenant_id UUID,
  kind TEXT NOT NULL, -- 'trial_started' | 'trial_will_end' | 'converted' | 'canceled'
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL,
  raw JSONB, -- Full Stripe webhook payload
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Multi-tenant RLS**: Each row is isolated to `tenant_id` (service_role only).

## Triggering n8n Workflows

### Option 1: Edge Function Webhook (Recommended)

Add a new Edge Function `automation-trigger-trial-webhook` that:

1. Listens for `stripe_trial_events` inserts via `database.webhooks` trigger
2. Filters by `kind` (e.g., only `trial_will_end`)
3. POSTs to n8n webhook URL with:

```json
{
  "event": "stripe_trial_will_end",
  "tenant_id": "uuid",
  "subscription_id": "sub_...",
  "customer_id": "cus_...",
  "trial_end": "2026-08-15T12:00:00Z",
  "occurred_at": "2026-08-10T12:00:00Z"
}
```

### Option 2: Database Webhook (Simpler)

Configure `public.governance_webhooks` or create a `trial_event_webhooks` table:

```sql
INSERT INTO public.governance_webhooks (
  tenant_id,
  event_type,
  webhook_url,
  active
) VALUES (
  tenant_id_here,
  'stripe_trial_will_end',
  'https://webhook.n8n.cloud/webhook/your-n8n-workflow',
  true
);
```

Then add a database trigger on `stripe_trial_events` INSERT:

```sql
CREATE TRIGGER trial_event_notify
AFTER INSERT ON public.stripe_trial_events
FOR EACH ROW
EXECUTE FUNCTION notify_webhook(NEW);
```

## n8n Workflow Configuration

### Webhook Trigger Setup

1. **Create new n8n workflow**
2. **Add Webhook node**:
   - Authentication: None (or Bearer token if secured)
   - HTTP method: POST
   - Parameters: Extract from JSON body
3. **Map incoming fields**:
   - `event`: workflow discriminator
   - `tenant_id`: route to correct Slack/Email channel
   - `subscription_id`: lookup customer name
   - `trial_end`: calculate days remaining
4. **Send Email/Slack**:
   - "Your trial ends on [trial_end], click here to upgrade"
   - Link: `https://realsyncdynamicsai.de/app/billing?subscription={subscription_id}`

### Example Payload

```json
{
  "event": "stripe_trial_will_end",
  "tenant_id": "12345678-1234-1234-1234-123456789012",
  "subscription_id": "sub_1Iu7dkAISfJ30N7iouic5bxM",
  "customer_id": "cus_9s6XWovQFl1p6q",
  "trial_end": "2026-08-15T23:59:59Z",
  "occurred_at": "2026-08-08T10:00:00Z"
}
```

## Current State (Phase 2B ✅ COMPLETE)

✅ Database schema ready (`stripe_trial_events` table exists)
✅ Stripe webhook logs trial events (stripe-webhook function)
✅ n8n workflow trigger WIRED via Edge Function + database trigger

### Implementation (Phase 2B)

**Edge Function**: `supabase/functions/automation-trigger-trial-webhook/`
- Receives trial event from database trigger
- Looks up active n8n webhook URL in `governance_webhooks` table (by tenant)
- POSTs formatted payload to n8n webhook URL
- Fire-and-forget (async, non-blocking)
- Graceful degradation: skips silently if no webhook configured

**Database Trigger**: `supabase/migrations/20260719000000_stripe_trial_webhook_trigger.sql`
- Fires on `stripe_trial_events` INSERT
- Calls `trigger_trial_webhook()` function via pg_net.http_post()
- Passes event data to Edge Function asynchronously
- Non-blocking (errors logged but don't fail the insert)

**Setup Required**:
1. Deploy Edge Function: `supabase functions deploy automation-trigger-trial-webhook`
2. Apply migration: `supabase db push`
3. Configure n8n webhook in Supabase Dashboard:
   - Table: `governance_webhooks`
   - Insert row with:
     - `tenant_id`: your workspace ID
     - `name`: "n8n Trial Events Webhook"
     - `target_url`: your n8n webhook URL
     - `enabled`: true
     - `secret_hash` + `secret_prefix`: optional HMAC signing

## Testing

### Local Simulation

```bash
# Insert test trial event
supabase db push

INSERT INTO public.stripe_trial_events (
  stripe_event_id,
  stripe_subscription_id,
  stripe_customer_id,
  tenant_id,
  kind,
  trial_start,
  trial_end,
  occurred_at
) VALUES (
  'evt_test_trial_will_end',
  'sub_test_123',
  'cus_test_456',
  'your-tenant-id',
  'trial_will_end',
  now(),
  now() + INTERVAL '7 days',
  now()
);

# Check if webhook was triggered (monitor n8n logs)
```

## Security Notes

- **Tenant isolation**: All events filtered by tenant_id via RLS
- **Webhook signing**: If using external webhook, validate HMAC-SHA256 signature
- **Rate limiting**: n8n webhook should dedupe by `stripe_event_id` (UNIQUE constraint ensures no duplicates)
- **Error handling**: Failed webhooks should retry with exponential backoff

## Next Steps

1. Wire `stripe_trial_events` → n8n webhook (Phase 2B)
2. Create email template for "Trial ends in X days" (Resend)
3. Monitor trial-to-paid conversion rates
4. Add dunning flow for failed payments (Phase 3)
