// Authenticated SiteOS transformation checkout.
// The browser never supplies a Stripe Price ID or grants an entitlement.
// The server resolves the canonical Governance Launch product, verifies
// tenant membership, and Stripe/webhook remain authoritative.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PLAN_KEY = 'governance_launch';

async function getStripeSecret(): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    const { data } = await admin.rpc('get_app_secret', { secret_name: 'stripe_secret_key' });
    if (typeof data === 'string' && data) return data;
  } catch { /* env fallback */ }
  return Deno.env.get('STRIPE_SECRET_KEY') ?? null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'login required');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: {
    tenant_id?: string;
    source_url?: string;
    site_slug?: string;
    project_name?: string;
    redesign?: boolean;
    return_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = body.tenant_id?.trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (body.redesign !== true) return jsonError(400, 'BAD_REQUEST', 'redesign confirmation required');

  const sourceUrl = body.source_url?.trim() ?? '';
  if (!/^https?:\/\/[^\s]+$/i.test(sourceUrl)) {
    return jsonError(400, 'INVALID_URL', 'valid http(s) source_url required');
  }

  const { data: membership, error: membershipError } = await userClient
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userResp.user.id)
    .maybeSingle();
  if (membershipError) return jsonError(500, 'INTERNAL', membershipError.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: product, error: productError } = await admin
    .from('products')
    .select('id, stripe_price_id, name, default_for_plan_key')
    .eq('default_for_plan_key', PLAN_KEY)
    .not('stripe_price_id', 'like', 'internal_default_%')
    .limit(1)
    .maybeSingle();
  if (productError) return jsonError(500, 'INTERNAL', productError.message);
  if (!product?.stripe_price_id) return jsonError(400, 'PRICE_NOT_CONFIGURED', `no Stripe Price configured for ${PLAN_KEY}`);

  const secret = await getStripeSecret();
  if (!secret) return jsonError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(product.stripe_price_id);
  } catch (error) {
    return jsonError(502, 'STRIPE_PRICE_LOOKUP_FAILED', (error as Error).message);
  }
  if (price.recurring) return jsonError(400, 'INVALID_PRODUCT_MODE', 'Governance Launch must use a one-time Stripe Price');

  const origin = req.headers.get('origin') ?? body.return_url ?? '';
  if (!origin) return jsonError(400, 'BAD_REQUEST', 'return_url required');

  const metadata: Record<string, string> = {
    tenant_id: tenantId,
    plan_key: PLAN_KEY,
    product_type: 'managed_website',
    redesign: 'true',
    source_url: sourceUrl,
  };
  if (body.site_slug) metadata.site_slug = body.site_slug.trim();
  if (body.project_name) metadata.project_name = body.project_name.trim();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: product.stripe_price_id, quantity: 1 }],
      metadata,
      success_url: `${origin}/app/siteos?checkout=success&session_id={CHECKOUT_SESSION_ID}&site=${encodeURIComponent(body.site_slug ?? '')}`,
      cancel_url: `${origin}/app/siteos?checkout=cancelled&site=${encodeURIComponent(body.site_slug ?? '')}`,
      allow_promotion_codes: true,
      customer_creation: 'always',
    });

    return jsonResponse({
      ok: true,
      url: session.url,
      session_id: session.id,
      mode: session.mode,
      plan_key: PLAN_KEY,
    });
  } catch (error) {
    return jsonError(500, 'STRIPE_CREATE_FAILED', (error as Error).message);
  }
});
