// checkout-website-rebuild — Stripe-Checkout-Session-Creator für den
// DSGVO-Website-Rebuild-Tier. Self-service / Cold-Lead — kein Auth nötig,
// Stripe-Checkout sammelt Email + Bezahlung selbst.
//
// POST /functions/v1/checkout-website-rebuild
// verify_jwt = false (öffentlich, Public-Pricing-Page-CTA)
//
// Body:
//   source_url:    https://kunde.de              (required)
//   tier?:         'managed' | 'premium' | 'enterprise'   default 'managed'
//   audit_id?:     uuid (verlinkt vorhandenen DSGVO-Audit)
//   tenant_id?:    uuid (für eingeloggte Customer mit bereits vorhandenem Tenant)
//   company?:      'ACME GmbH'
//   return_url?:   z.B. window.location.origin
//
// Response:
//   { ok: true, url: 'https://checkout.stripe.com/...', session_id: 'cs_...' }
//
// Die Session bekommt metadata.product_type='managed_website' + source_url +
// tier — der stripe-webhook erkennt das und queued den Rebuild-Job sobald
// checkout.session.completed reinkommt.
//
// Preisresolution: Stripe-Price-ID via products-Tabelle, plan_key:
//   - tier=managed     → 'website_rebuild_managed'
//   - tier=premium     → 'website_rebuild_premium'
//   - tier=enterprise  → 'website_rebuild_enterprise'
// Wenn kein Price konfiguriert ist, antwortet die Function mit
// PRICE_NOT_CONFIGURED — das Frontend kann auf Contact-Sales fallback.

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const TIER_PLAN_KEY: Record<string, string> = {
  managed:    'website_rebuild_managed',
  premium:    'website_rebuild_premium',
  enterprise: 'website_rebuild_enterprise',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: {
    source_url?: string;
    tier?: 'managed' | 'premium' | 'enterprise';
    audit_id?: string;
    tenant_id?: string;
    company?: string;
    return_url?: string;
  };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const sourceUrl = (body.source_url ?? '').trim();
  if (!URL_RE.test(sourceUrl)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');

  let domain = '';
  try { domain = new URL(sourceUrl).hostname.toLowerCase(); }
  catch { return jsonError(400, 'INVALID_URL', 'unparsable url'); }

  const tier = (body.tier && TIER_PLAN_KEY[body.tier]) ? body.tier : 'managed';
  const planKey = TIER_PLAN_KEY[tier];

  // Stripe-Price-ID aus products-Tabelle.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: products, error: prodErr } = await admin
    .from('products')
    .select('stripe_price_id, name')
    .eq('default_for_plan_key', planKey);
  if (prodErr) return jsonError(500, 'INTERNAL', prodErr.message);

  const realPrice = (products ?? []).find((p) => !p.stripe_price_id.startsWith('internal_default_'));
  if (!realPrice) {
    return jsonError(400, 'PRICE_NOT_CONFIGURED',
      `no Stripe Price for plan_key=${planKey}; insert price_xxx into public.products with default_for_plan_key=${planKey}`);
  }

  const origin = req.headers.get('origin') ?? body.return_url ?? '';
  const successUrl = `${origin}/dsgvo-website/danke?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/dsgvo-website?checkout=cancelled`;

  // Mode: managed-tier ist Subscription (laufendes Hosting), V1 nutzt
  // dasselbe Schema. Wenn das eingespielte Stripe-Price recurring ist,
  // ist mode='subscription' — sonst mode='payment'. Stripe Checkout zeigt
  // einen Fehler an wenn die Werte nicht zusammenpassen, also lookup
  // wir die Recurring-Property der Price.
  const price = await stripe.prices.retrieve(realPrice.stripe_price_id);
  const mode: 'payment' | 'subscription' = price.recurring ? 'subscription' : 'payment';

  // Metadata-Vertrag — stripe-webhook liest exakt diese Keys.
  const meta: Record<string, string> = {
    product_type: 'managed_website',
    source_url:   sourceUrl,
    tier,
  };
  if (body.audit_id)  meta.audit_id  = body.audit_id;
  if (body.tenant_id) meta.tenant_id = body.tenant_id;
  if (body.company)   meta.company   = body.company;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode,
    line_items: [{ price: realPrice.stripe_price_id, quantity: 1 }],
    metadata: meta,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    customer_creation: mode === 'payment' ? 'always' : undefined,
    custom_text: {
      submit: { message: `DSGVO-konformer Rebuild für ${domain} — Bestätigung & Setup-Link kommen per E-Mail.` },
    },
    // Subscription-mode kopiert metadata auch in die subscription_data,
    // damit der Stripe-Webhook für customer.subscription.* den tenant_id
    // tag findet (falls mitgegeben).
    ...(mode === 'subscription' && body.tenant_id
      ? { subscription_data: { metadata: { tenant_id: body.tenant_id, plan_key: planKey } } }
      : {}),
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (e) {
    return jsonError(500, 'STRIPE_CREATE_FAILED', (e as Error).message);
  }

  return json({
    ok: true,
    url: session.url,
    session_id: session.id,
    tier,
    mode,
    domain,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
