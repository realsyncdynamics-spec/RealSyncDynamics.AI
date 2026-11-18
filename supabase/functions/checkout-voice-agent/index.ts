// Checkout für das eigenständige Voice-Agent-Abo (Starter / Professional /
// Kanzlei-Praxis aus VOICE_STANDALONE_OFFERS in shared/pricing.ts).
//
// Der Browser schickt nur tenant_id und offer_id. Price-ID, Betrag,
// Freigabe und Berechtigung bestimmt ausschließlich der Server:
//   - VOICE_CHECKOUT_ENABLED muss exakt 'true' sein, sonst 503 (fail-closed).
//   - Login + Rolle owner/admin im Mandanten.
//   - Angebot freigegeben (Minutenkontingent + Leistungsumfang bestätigt).
//   - Stripe-Price aus Edge-Secret STRIPE_PRICE_VOICE_<ID>, aktiv, monatlich,
//     betragsgleich zum SSoT-Preis.
//   - Kein zweites aktives Voice-Abo je Mandant.
// Die Freischaltung schreibt allein stripe-webhook (entitlement_grants,
// source 'voice_subscription'). Regeln: ../_shared/voice-agent-checkout.ts.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { PRICING_TAX_MODE } from '../_shared/pricing.generated.ts';
import { checkoutTaxParams, invoiceFooter } from '../_shared/checkout-tax.ts';
import {
  checkVoiceStripePrice,
  isVoiceCheckoutEnabled,
  resolveVoiceOfferForCheckout,
  VOICE_AGENT_PRODUCT_TYPE,
  VOICE_GRANT_SOURCE,
  voiceCheckoutReturnBase,
  voicePriceEnvName,
} from '../_shared/voice-agent-checkout.ts';
import {
  customerIdempotencyKey,
  customerSearchQuery,
  isRealStripeCustomerId,
  isValidTenantId,
  STRIPE_ERROR_PUBLIC_MESSAGE,
} from '../stripe-checkout/customer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://realsyncdynamicsai.de';

// deno-lint-ignore no-explicit-any
async function getStripeSecret(admin: any): Promise<string | null> {
  // Vault zuerst, Env als Rückfall — wie stripe-checkout.
  try {
    const { data, error } = await admin.rpc('get_app_secret', { secret_name: 'stripe_secret_key' });
    if (!error && typeof data === 'string' && data.length > 0) return data;
  } catch { /* Env-Rückfall */ }
  return Deno.env.get('STRIPE_SECRET_KEY') ?? null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  if (!isVoiceCheckoutEnabled(Deno.env.get('VOICE_CHECKOUT_ENABLED'))) {
    return jsonError(503, 'CHECKOUT_DISABLED', 'Der Voice-Agent-Checkout ist noch nicht freigeschaltet.');
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'login required');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: { tenant_id?: unknown; offer_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  if (!isValidTenantId(body.tenant_id)) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  const tenantId = body.tenant_id;

  const resolved = resolveVoiceOfferForCheckout(body.offer_id);
  if (!resolved.ok) {
    return resolved.code === 'UNKNOWN_OFFER'
      ? jsonError(400, 'UNKNOWN_OFFER', 'unbekanntes Voice-Angebot')
      : jsonError(409, 'OFFER_NOT_RELEASED', 'Leistungsumfang dieses Pakets ist noch nicht bestätigt.');
  }
  const offer = resolved.offer;

  // Rolle prüfen (RLS auf memberships: der Nutzer sieht nur eigene Zeilen).
  const { data: membership, error: membershipError } = await userClient
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) return jsonError(500, 'INTERNAL', 'membership lookup failed');
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return jsonError(403, 'FORBIDDEN', 'only owner/admin may start checkout');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Ein Voice-Abo je Mandant. Paketwechsel läuft über das Kundenportal.
  const { data: activeGrant, error: grantErr } = await admin
    .from('entitlement_grants')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source', VOICE_GRANT_SOURCE)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (grantErr) return jsonError(500, 'INTERNAL', 'grant lookup failed');
  if (activeGrant) return jsonError(409, 'ALREADY_SUBSCRIBED', 'Für diesen Mandanten läuft bereits ein Voice-Agent-Abo.');

  const priceId = Deno.env.get(voicePriceEnvName(offer.id))?.trim();
  if (!priceId) return jsonError(503, 'PRICE_NOT_CONFIGURED', `kein Stripe-Price für ${offer.name} hinterlegt`);

  const secret = await getStripeSecret(admin);
  if (!secret) return jsonError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  try {
    const price = await stripe.prices.retrieve(priceId);
    const check = checkVoiceStripePrice(price, offer);
    if (!check.ok) {
      console.error('[checkout-voice-agent] price mismatch', {
        offer_id: offer.id, price_id: priceId, reason: check.reason,
        unit_amount: price.unit_amount, currency: price.currency, active: price.active,
        interval: price.recurring?.interval ?? null, interval_count: price.recurring?.interval_count ?? null,
      });
      return jsonError(409, 'PRICE_MISMATCH',
        `Der hinterlegte Stripe-Preis für ${offer.name} passt nicht zum angezeigten Preis. Der Checkout ist gesperrt.`);
    }

    // Vorhandenen Stripe-Customer des Mandanten wiederverwenden.
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    let customerId: string;
    if (isRealStripeCustomerId(existingSub?.stripe_customer_id)) {
      customerId = existingSub!.stripe_customer_id!;
    } else {
      const found = await stripe.customers.search({ query: customerSearchQuery(tenantId), limit: 1 });
      if (found.data[0]?.id) {
        customerId = found.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userResp.user.email ?? undefined,
          metadata: { tenant_id: tenantId },
        }, { idempotencyKey: customerIdempotencyKey(tenantId, userId) });
        customerId = customer.id;
      }
    }
    await stripe.customers.update(customerId, { invoice_settings: { footer: invoiceFooter(PRICING_TAX_MODE) } });

    const metadata = {
      tenant_id: tenantId,
      product_type: VOICE_AGENT_PRODUCT_TYPE,
      voice_offer_id: offer.id,
    };
    const base = voiceCheckoutReturnBase(req.headers.get('origin'), SITE);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: tenantId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: `${base}/voice/checkout/${offer.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/voice/checkout/${offer.id}?checkout=cancelled`,
      allow_promotion_codes: true,
      ...checkoutTaxParams({ sessionMode: 'subscription', existingCustomer: true, taxMode: PRICING_TAX_MODE }),
    });

    return jsonResponse({ ok: true, url: session.url, session_id: session.id, offer_id: offer.id });
  } catch (error) {
    console.error('[checkout-voice-agent] stripe error', (error as Error).message);
    return jsonError(502, 'STRIPE_ERROR', STRIPE_ERROR_PUBLIC_MESSAGE);
  }
});
