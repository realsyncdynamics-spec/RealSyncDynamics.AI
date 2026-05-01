// Stripe webhook receiver — idempotent subscription sync.
//
// Endpoint: POST /functions/v1/stripe-webhook
// Stripe must be configured with the secret stored in STRIPE_WEBHOOK_SECRET.
// Tenant linkage:
//   We expect every Stripe Customer (or Subscription) to carry
//   `metadata.tenant_id` matching a row in public.tenants. Without it, we
//   cannot map a subscription back to a tenant and the event is rejected.

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync because Deno's WebCrypto is async.
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`signature verify failed: ${(err as Error).message}`, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Idempotency check — insert with ON CONFLICT DO NOTHING and treat the
  //    "already exists" branch as a no-op success.
  const { error: insertErr, data: insertData } = await admin
    .from('webhook_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as object })
    .select('id')
    .maybeSingle();

  if (insertErr && !/duplicate key/i.test(insertErr.message)) {
    return new Response(`idempotency store failed: ${insertErr.message}`, { status: 500 });
  }
  if (!insertData) {
    // Already processed (or insert raced) — acknowledge.
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 2. Business logic
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      // Add more handlers as the billing surface grows; ignore unknown types.
    }
  } catch (err) {
    // Roll back the idempotency row so Stripe will retry.
    await admin.from('webhook_events').delete().eq('id', event.id);
    return new Response(`handler failed: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

// deno-lint-ignore no-explicit-any
async function syncSubscription(admin: any, sub: Stripe.Subscription): Promise<void> {
  const tenantId =
    (sub.metadata && sub.metadata.tenant_id) ||
    (typeof sub.customer === 'object' ? sub.customer?.metadata?.tenant_id : undefined);

  if (!tenantId) {
    throw new Error(`subscription ${sub.id} has no metadata.tenant_id (set it on Customer or Subscription)`);
  }

  const item = sub.items.data[0];
  const planKey = item?.price?.metadata?.plan_key ?? 'free';

  const row = {
    tenant_id: tenantId,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    stripe_product_id: typeof item?.price?.product === 'string' ? item.price.product : item?.price?.product?.id ?? null,
    stripe_price_id: item?.price?.id ?? null,
    plan_key: planKey,
    billing_interval: item?.price?.recurring?.interval ?? 'month',
    status: sub.status,
    quantity: item?.quantity ?? 1,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  };

  const { error } = await admin
    .from('subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
}
