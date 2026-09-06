// Stripe Customer Portal session creator.
//
// POST /functions/v1/stripe-portal
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, return_url?: string, flow?: 'payment_method_update' }
//
// 1. JWT verify + tenant membership (owner/admin only — Portal can change billing)
// 2. Look up subscription.stripe_customer_id for this tenant
// 3. Create a Stripe billingPortal.sessions.create({customer, return_url})
// 4. Return { url }
//
// `flow` (seit 2026-09-06, P0-Recovery): Ohne Angabe entsteht die volle
// Portal-Sitzung wie bisher — Plan wechseln, kündigen, Rechnungen. Mit
// `payment_method_update` entsteht eine Sitzung, die **nur** das
// Zahlungsmittel erneuern kann; Stripe schneidet den Rest ab.
//
// Warum das serverseitig steht und nicht in der Oberfläche: `/app/billing`
// verlangt AAL2, `/app/billing/recover` nicht. Diese Ausnahme ist nur
// vertretbar, solange der eingeschränkte Umfang **durchgesetzt** ist und
// nicht bloß behauptet wird. Ein Client, der `flow` weglässt, bekommt keine
// erweiterte Sitzung geschenkt — er bekommt die Sitzung, die er auch über
// `/app/billing` bekäme, und dorthin führt weiterhin nur der AAL2-Pfad.

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { observeAal2 } from '../_shared/requireAal2.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Vault-first, env-fallback — see stripe-checkout/index.ts for rationale.
// Vault wins so an operator can override a stale/placeholder env var via
// set_app_secret() without a function redeploy.
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
  if (!stripeSecret) return jsonError(500, 'STRIPE_NOT_CONFIGURED', 'stripe secret key not configured (neither env nor vault)');
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  // P0d Phase 1 — OBSERVE ONLY: AAL2-Status protokollieren, NICHT blocken.
  observeAal2(auth, 'stripe-portal');

  let body: { tenant_id?: string; return_url?: string; flow?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  // Allowlist statt Durchreichen: ein unbekannter Wert ist ein Fehler, kein
  // stiller Rückfall auf die volle Sitzung.
  if (body.flow !== undefined && body.flow !== 'payment_method_update') {
    return jsonError(400, 'BAD_REQUEST', "flow must be 'payment_method_update' when set");
  }

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

  const returnUrl = body.return_url ?? 'https://RealSyncDynamicsAI.de/billing/usage';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
      ...(body.flow === 'payment_method_update'
        ? {
            flow_data: {
              type: 'payment_method_update' as const,
              after_completion: {
                type: 'redirect' as const,
                redirect: { return_url: returnUrl },
              },
            },
          }
        : {}),
    });
    return jsonResponse({ url: session.url });
  } catch (e) {
    return jsonError(502, 'STRIPE_ERROR', (e as Error).message);
  }
});

