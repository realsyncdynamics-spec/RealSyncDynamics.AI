// checkout-website-rebuild — canonical Stripe checkout for website rebuilds.
// Public rebuild tiers remain self-service. Governance Launch is tenant-scoped
// and requires an authenticated member so the resulting entitlement cannot be
// assigned to an arbitrary tenant from browser input.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const TIER_PLAN_KEY: Record<string, string> = {
  managed: 'website_rebuild_managed', premium: 'website_rebuild_premium',
  enterprise: 'website_rebuild_enterprise', governance_launch: 'governance_launch',
};
type Tier = keyof typeof TIER_PLAN_KEY;

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

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');
  let body: { source_url?: string; tier?: Tier; audit_id?: string; tenant_id?: string; company?: string; return_url?: string; redesign?: boolean; site_slug?: string; project_name?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  const sourceUrl = (body.source_url ?? '').trim();
  if (!URL_RE.test(sourceUrl)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  let domain = ''; try { domain = new URL(sourceUrl).hostname.toLowerCase(); } catch { return jsonError(400, 'INVALID_URL', 'unparsable url'); }
  const tier: Tier = body.tier && TIER_PLAN_KEY[body.tier] ? body.tier : 'managed';
  const planKey = TIER_PLAN_KEY[tier];
  if (tier === 'governance_launch') {
    const tenantId = body.tenant_id?.trim();
    if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
    if (body.redesign !== true) return jsonError(400, 'BAD_REQUEST', 'redesign confirmation required');
    const member = await requireTenantMember(req, tenantId);
    if ('error' in member) return member.error;
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: products, error: prodErr } = await admin.from('products').select('stripe_price_id, name').eq('default_for_plan_key', planKey);
  if (prodErr) return jsonError(500, 'INTERNAL', prodErr.message);
  const realPrice = (products ?? []).find((p) => typeof p.stripe_price_id === 'string' && !p.stripe_price_id.startsWith('internal_default_'));
  if (!realPrice) return jsonError(400, 'PRICE_NOT_CONFIGURED', `no Stripe Price for plan_key=${planKey}`);
  let price: Stripe.Price;
  try { price = await stripe.prices.retrieve(realPrice.stripe_price_id); } catch (e) { return jsonError(502, 'STRIPE_PRICE_LOOKUP_FAILED', (e as Error).message); }
  const mode: 'payment' | 'subscription' = price.recurring ? 'subscription' : 'payment';
  if (tier === 'governance_launch' && mode !== 'payment') return jsonError(400, 'INVALID_PRODUCT_MODE', 'Governance Launch must use a one-time Stripe Price');
  const origin = req.headers.get('origin') ?? body.return_url ?? '';
  if (!origin) return jsonError(400, 'BAD_REQUEST', 'return_url required');
  const meta: Record<string, string> = {
    product_type: 'managed_website', source_url: sourceUrl, tier, plan_key: planKey,
    ...(body.tenant_id ? { tenant_id: body.tenant_id.trim() } : {}),
    ...(body.audit_id ? { audit_id: body.audit_id } : {}), ...(body.company ? { company: body.company } : {}),
    ...(body.site_slug ? { site_slug: body.site_slug.trim() } : {}), ...(body.project_name ? { project_name: body.project_name.trim() } : {}),
    ...(tier === 'governance_launch' ? { redesign: 'true' } : {}),
  };
  const successPath = tier === 'governance_launch' ? '/app/siteos' : '/dsgvo-website/danke';
  const cancelPath = tier === 'governance_launch' ? '/app/siteos' : '/dsgvo-website';
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode, line_items: [{ price: realPrice.stripe_price_id, quantity: 1 }], metadata: meta,
    success_url: `${origin}${successPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}&site=${encodeURIComponent(body.site_slug ?? '')}`,
    cancel_url: `${origin}${cancelPath}?checkout=cancelled&site=${encodeURIComponent(body.site_slug ?? '')}`,
    allow_promotion_codes: true, customer_creation: mode === 'payment' ? 'always' : undefined,
    custom_text: { submit: { message: `DSGVO-konformer Rebuild für ${domain} — Bestätigung & Setup-Link kommen per E-Mail.` } },
    ...(mode === 'subscription' && body.tenant_id ? { subscription_data: { metadata: { tenant_id: body.tenant_id, plan_key: planKey } } } : {}),
  };
  try { const session = await stripe.checkout.sessions.create(sessionParams); return jsonResponse({ ok: true, url: session.url, session_id: session.id, tier, mode, domain, plan_key: planKey }); }
  catch (e) { return jsonError(500, 'STRIPE_CREATE_FAILED', (e as Error).message); }
});
