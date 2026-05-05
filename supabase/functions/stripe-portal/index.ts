// Stripe Customer Portal session creator.
//
// POST /functions/v1/stripe-portal
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, return_url?: string }
//
// 1. JWT verify + tenant membership (owner/admin only — Portal can change billing)
// 2. Look up subscription.stripe_customer_id for this tenant
// 3. Create a Stripe billingPortal.sessions.create({customer, return_url})
// 4. Return { url }

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
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: { tenant_id?: string; return_url?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  // Membership + role check (owner/admin only, since Portal can cancel/upgrade)
  const { data: membership, error: memberErr } = await userClient
    .from('memberships').select('role')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return jsonError(403, 'FORBIDDEN', 'only owner/admin may open billing portal');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: sub, error: subErr } = await admin
    .from('subscriptions').select('stripe_customer_id')
    .eq('tenant_id', body.tenant_id).maybeSingle();
  if (subErr) return jsonError(500, 'INTERNAL', subErr.message);
  if (!sub?.stripe_customer_id) {
    return jsonError(404, 'NO_CUSTOMER',
      'Kein aktives Stripe-Kundenkonto für diesen Tenant — bitte erst einen Plan über /pricing buchen.');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: body.return_url ?? 'https://realsyncdynamicsai.de/billing/usage',
    });
    return json({ url: session.url });
  } catch (e) {
    return jsonError(502, 'STRIPE_ERROR', (e as Error).message);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
