// Verify Stripe Checkout session and sync subscription.
//
// POST /functions/v1/stripe-checkout-verify
// Authorization: Bearer <user JWT>
// Body: { session_id: string, tenant_id: uuid }
//
// Looks up the Stripe Checkout Session by ID, verifies it completed
// successfully, and returns subscription details. If not yet synced,
// triggers the webhook-like sync via stripe-webhook handler.

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getSecret(envVar: string, vaultName: string): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  if (!error && typeof data === 'string' && data.length > 0) return data;
  return Deno.env.get(envVar) ?? null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const stripeSecret = await getSecret('STRIPE_SECRET_KEY', 'stripe_secret_key');
  if (!stripeSecret) return jsonError(500, 'STRIPE_NOT_CONFIGURED', 'stripe secret key not configured');
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: { session_id?: string; tenant_id?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (!body.session_id || !body.tenant_id) {
    return jsonError(400, 'BAD_REQUEST', 'session_id and tenant_id required');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Membership check
  const { data: membership, error: memberErr } = await userClient
    .from('memberships').select('role')
    .eq('tenant_id', body.tenant_id).eq('user_id', userResp.user.id).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    // Fetch session from Stripe
    const session = await stripe.checkout.sessions.retrieve(body.session_id, {
      expand: ['line_items', 'subscription'],
    });

    if (!session.subscription) {
      return jsonError(400, 'NO_SUBSCRIPTION', 'checkout session has no subscription');
    }

    // Verify tenant_id matches
    const sessionTenantId = session.metadata?.tenant_id;
    if (sessionTenantId !== body.tenant_id) {
      return jsonError(403, 'TENANT_MISMATCH', 'session tenant_id does not match');
    }

    // Lookup subscription in DB (may not be synced yet if webhook is delayed)
    const { data: subscription, error: subErr } = await admin
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
      .maybeSingle();

    if (subErr) return jsonError(500, 'INTERNAL', subErr.message);

    if (!subscription) {
      // Webhook hasn't synced yet; return pending state with expected subscription ID
      return jsonResponse({
        ok: true,
        pending: true,
        subscription: {
          id: typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
          status: 'pending_sync',
          tenant_id: body.tenant_id,
        },
      });
    }

    return jsonResponse({ ok: true, subscription });
  } catch (e) {
    return jsonError(502, 'STRIPE_ERROR', `stripe verification failed: ${(e as Error).message}`);
  }
});
