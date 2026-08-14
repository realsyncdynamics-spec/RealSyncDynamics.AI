// checkout-website-bundle — one Checkout Session for €349 transformation + recurring governance.
// Stripe is authoritative. The one-time launch price is attached to the initial
// subscription invoice; the webhook grants the transformation entitlement only
// after a verified paid Checkout Session.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const LAUNCH_PLAN = 'governance_launch';

async function requireTenantMember(req: Request, tenantId: string) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { error: jsonError(401, 'UNAUTHORIZED', 'login required') };
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(SUPABASE_URL, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userResp, error: userErr } = await client.auth.getUser();
  if (userErr || !userResp.user) return { error: jsonError(401, 'UNAUTHORIZED', 'invalid token') };
  const { data: membership, error } = await client.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userResp.user.id).maybeSingle();
  if (error) return { error: jsonError(500, 'INTERNAL', error.message) };
  if (!membership) return { error: jsonError(403, 'FORBIDDEN', 'not a member of this tenant') };
  return { userId: userResp.user.id };
}

async function resolvePrice(admin: ReturnType<typeof createClient>, planKey: string) {
  const { data, error } = await admin.from('products').select('stripe_price_id,name').eq('default_for_plan_key', planKey);
  if (error) throw new Error(error.message);
  const row = (data ?? []).find((p: { stripe_price_id?: string | null }) => typeof p.stripe_price_id === 'string' && !p.stripe_price_id.startsWith('internal_default_'));
  if (!row?.stripe_price_id) throw new Error(`PRICE_NOT_CONFIGURED:${planKey}`);
  const price = await stripe.prices.retrieve(row.stripe_price_id);
  return { row, price };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { tenant_id?: string; source_url?: string; plan_key?: string; site_slug?: string; project_name?: string; return_url?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const tenantId = body.tenant_id?.trim();
  const sourceUrl = body.source_url?.trim() ?? '';
  const planKey = body.plan_key?.trim() ?? '';
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!URL_RE.test(sourceUrl)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  if (!planKey || planKey === LAUNCH_PLAN) return jsonError(400, 'INVALID_PLAN', 'a recurring governance plan is required');

  let domain = '';
  try { domain = new URL(sourceUrl).hostname.toLowerCase(); } catch { return jsonError(400, 'INVALID_URL', 'unparsable url'); }

  const member = await requireTenantMember(req, tenantId);
  if ('error' in member) return member.error;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let recurring: Awaited<ReturnType<typeof resolvePrice>>;
  let launch: Awaited<ReturnType<typeof resolvePrice>>;
  try {
    [recurring, launch] = await Promise.all([resolvePrice(admin, planKey), resolvePrice(admin, LAUNCH_PLAN)]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'price lookup failed';
    if (message.startsWith('PRICE_NOT_CONFIGURED:')) return jsonError(400, 'PRICE_NOT_CONFIGURED', message);
    return jsonError(502, 'STRIPE_PRICE_LOOKUP_FAILED', message);
  }

  if (!recurring.price.recurring) return jsonError(400, 'INVALID_PRODUCT_MODE', `${planKey} must use a recurring Stripe Price`);
  if (launch.price.recurring) return jsonError(400, 'INVALID_PRODUCT_MODE', 'Governance Launch must use a one-time Stripe Price');

  const origin = req.headers.get('origin') ?? body.return_url ?? '';
  if (!origin) return jsonError(400, 'BAD_REQUEST', 'return_url required');

  const metadata: Record<string, string> = {
    product_type: 'website_transformation_bundle',
    tenant_id: tenantId,
    source_url: sourceUrl,
    domain,
    plan_key: planKey,
    launch_plan_key: LAUNCH_PLAN,
    redesign: 'true',
    ...(body.site_slug ? { site_slug: body.site_slug.trim() } : {}),
    ...(body.project_name ? { project_name: body.project_name.trim() } : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        { price: recurring.price.id, quantity: 1 },
        { price: launch.price.id, quantity: 1 },
      ],
      metadata,
      subscription_data: { metadata: { tenant_id: tenantId, plan_key: planKey, launch_plan_key: LAUNCH_PLAN, product_type: 'website_transformation_bundle' } },
      success_url: `${origin}/app/siteos?checkout=success&session_id={CHECKOUT_SESSION_ID}&site=${encodeURIComponent(body.site_slug ?? '')}`,
      cancel_url: `${origin}/app/siteos?checkout=cancelled&site=${encodeURIComponent(body.site_slug ?? '')}`,
      allow_promotion_codes: true,
      customer_creation: 'always',
      custom_text: { submit: { message: `Website-Transformation für ${domain} + Governance-Paket — €349 einmalig plus laufendes Paket.` } },
    });
    return jsonResponse({ ok: true, url: session.url, session_id: session.id, mode: session.mode, domain, plan_key: planKey, launch_plan_key: LAUNCH_PLAN });
  } catch (error) {
    return jsonError(500, 'STRIPE_CREATE_FAILED', error instanceof Error ? error.message : 'Stripe Checkout konnte nicht erstellt werden.');
  }
});
