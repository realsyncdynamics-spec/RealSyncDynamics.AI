// Stripe Checkout creator.
//
// POST /functions/v1/stripe-checkout
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, plan_key: string, return_url?: string }
//
// 1. Verifies the caller is owner / admin of the tenant.
// 2. Resolves the Stripe Price ID for `plan_key` from public.products
//    (default_for_plan_key match). Falls back to 400 if no real Stripe
//    price is wired yet (sentinel `internal_default_*` prices won't work
//    against Stripe's API).
// 3. Re-uses or creates a Stripe Customer carrying metadata.tenant_id
//    so the existing stripe-webhook can sync the resulting subscription.
// 4. Creates a Stripe Checkout Session and returns its URL.
//
// `plan_key = 'free'` short-circuits with 400 — there's nothing to charge.

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')   return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  // Verify caller
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email;

  let body: { tenant_id?: string; plan_key?: string; return_url?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (!body.tenant_id || !body.plan_key) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and plan_key required');
  }
  if (body.plan_key === 'free') {
    return jsonError(400, 'BAD_REQUEST', 'free plan does not require checkout');
  }

  // Membership + role check
  const { data: membership, error: memberErr } = await userClient
    .from('memberships').select('role')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return jsonError(403, 'FORBIDDEN', 'only owner/admin may start checkout');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Resolve Stripe Price ID. We prefer a live Stripe Price (one that does NOT
  // start with the internal sentinel prefix); fall back is to refuse.
  const { data: products, error: prodErr } = await admin
    .from('products')
    .select('stripe_price_id, name')
    .eq('default_for_plan_key', body.plan_key);
  if (prodErr) return jsonError(500, 'INTERNAL', prodErr.message);

  const realPrice = (products ?? []).find((p) => !p.stripe_price_id.startsWith('internal_default_'));
  if (!realPrice) {
    return jsonError(400, 'PRICE_NOT_CONFIGURED',
      `no Stripe Price wired for plan_key=${body.plan_key}; insert a real price_xxx into public.products with default_for_plan_key=${body.plan_key}`);
  }

  // Re-use or create the tenant's Stripe Customer.
  let stripeCustomerId: string | null = null;
  const { data: existingSub } = await admin
    .from('subscriptions').select('stripe_customer_id')
    .eq('tenant_id', body.tenant_id).limit(1).maybeSingle();
  if (existingSub?.stripe_customer_id) {
    stripeCustomerId = existingSub.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: userEmail ?? undefined,
      metadata: { tenant_id: body.tenant_id },
    });
    stripeCustomerId = customer.id;
  }

  const origin = req.headers.get('origin') ?? body.return_url ?? '';
  const successUrl = `${origin || ''}/billing/usage?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin || ''}/billing/usage?checkout=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId!,
    line_items: [{ price: realPrice.stripe_price_id, quantity: 1 }],
    metadata: { tenant_id: body.tenant_id, plan_key: body.plan_key },
    subscription_data: {
      metadata: { tenant_id: body.tenant_id, plan_key: body.plan_key },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return json({ ok: true, url: session.url, session_id: session.id });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
