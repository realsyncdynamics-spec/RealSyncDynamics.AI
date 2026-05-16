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
import { reportServerConversion } from '../_shared/conversions-api.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Vault-first, env-fallback. Lets an operator rotate a secret via
//   select public.set_app_secret('stripe_secret_key', 'sk_test_...');
// without a function redeploy, and overrides a stale placeholder env var.
async function getSecret(envVar: string, vaultName: string): Promise<string | null> {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await admin.rpc('get_app_secret', { secret_name: vaultName });
    if (typeof data === 'string' && data.length > 0) return data;
  } catch { /* RPC missing or vault empty — fall through to env */ }
  return Deno.env.get(envVar) ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });

  const STRIPE_SECRET = await getSecret('STRIPE_SECRET_KEY', 'stripe_secret_key');
  const WEBHOOK_SECRET = await getSecret('STRIPE_WEBHOOK_SECRET', 'stripe_webhook_secret');
  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    return new Response('stripe secrets not configured (neither vault nor env)', { status: 500 });
  }
  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await sendOnboardingWelcome(admin, session);
        await triggerWebsiteRebuildIfApplicable(admin, session);
        await reportPurchaseToAdPlatforms(session, req);
        break;
      }
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

// deno-lint-ignore no-explicit-any
async function sendOnboardingWelcome(admin: any, session: Stripe.Checkout.Session): Promise<void> {
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) {
    console.log("[stripe-webhook] checkout.session.completed: no email — skip welcome");
    return;
  }

  const RESEND_KEY = await getSecret('RESEND_API_KEY', 'resend_api_key');
  const FROM = Deno.env.get("RESEND_FROM") ?? "RealSync Dynamics <hello@realsyncdynamicsai.de>";
  const SITE = Deno.env.get("PUBLIC_SITE_URL") ?? "https://RealSyncDynamicsAI.de";

  // Plan-Key + Produkt aus Line-Items für Email-Personalisierung.
  // Verwende eine einfache Detection: amount_total + currency + first line description.
  const amount = session.amount_total ?? 0;
  const currency = (session.currency ?? "eur").toUpperCase();
  const isOneTime = session.mode === "payment";
  const isSubscription = session.mode === "subscription";
  const productLabel = isSubscription
    ? "RealSync Cookie-SDK Pro"
    : isOneTime
      ? "RealSync Audit-Pro"
      : "RealSync Dynamics";

  // Setup-Wizard-URL mit session-id für Auto-Linking
  const setupUrl = `${SITE}/welcome?session=${encodeURIComponent(session.id)}&product=${encodeURIComponent(productLabel)}`;

  // Persistiere Onboarding-State (idempotent — falls Webhook retry, nichts kaputt)
  await admin
    .from("customer_onboarding")
    .upsert(
      {
        stripe_session_id: session.id,
        email,
        product_label: productLabel,
        amount_cents: amount,
        currency,
        mode: session.mode,
        completed_at: null,
      },
      { onConflict: "stripe_session_id" }
    )
    .select()
    .single();

  if (!RESEND_KEY) {
    console.log("[stripe-webhook] RESEND_API_KEY missing — onboarding state saved, email skipped");
    return;
  }

  const subject = `Willkommen bei RealSync Dynamics — ${productLabel}`;
  const html = `<!doctype html>
<html lang="de">
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;margin:0;padding:24px;color:#374151;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px 28px;border:1px solid #e5e7eb">
    <h1 style="font-size:22px;color:#0f172a;font-weight:700;margin:0 0 16px">Willkommen — Kauf bestätigt.</h1>
    <p style="margin:0 0 16px"><strong>Produkt:</strong> ${productLabel}<br /><strong>Betrag:</strong> ${(amount / 100).toFixed(2)} ${currency}</p>
    <p style="margin:0 0 24px">Nächster Schritt: 3-Klick-Setup. Dort generierst du deinen API-Key, verbindest deine Domain und lädst das Embed-Snippet.</p>
    <a href="${setupUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;border-radius:0">Setup starten</a>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:11px;color:#9ca3af;margin:0 0 8px">RealSync Dynamics · Schwarzburger Str. 31, 98724 Neuhaus am Rennweg · Made in Germany · EU-Hosted</p>
    <p style="font-size:11px;color:#9ca3af;margin:0">Bei Fragen: <a href="mailto:hello@realsyncdynamicsai.de" style="color:#9ca3af">hello@realsyncdynamicsai.de</a></p>
  </div>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [email], subject, html }),
  });
}

// Trigger den Website-Rebuild-Workflow wenn der Checkout den
// Managed-Website-Tier gekauft hat. Stripe-Checkout-Session muss in metadata:
//   product_type: 'managed_website'
//   source_url:   'https://kunde.de'
//   tier?:        'managed' | 'premium' | 'enterprise'   (default: 'managed')
//   tenant_id?:   uuid
//   audit_id?:    uuid    (verlinkt vorhandenen DSGVO-Audit)
//   company?:     'ACME GmbH'
// gesetzt haben. Insert ist synchron (sichtbar im Admin sofort), Workflow-Run
// läuft via EdgeRuntime.waitUntil im Hintergrund — Webhook acked sofort.
//
// deno-lint-ignore no-explicit-any
async function triggerWebsiteRebuildIfApplicable(admin: any, session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata ?? {};
  if (meta.product_type !== 'managed_website') return;

  const sourceUrl = meta.source_url;
  const email = session.customer_details?.email ?? session.customer_email;
  if (!sourceUrl || !email) {
    console.warn(`[stripe-webhook] managed_website checkout ${session.id}: missing source_url or email — skip rebuild`);
    return;
  }

  let domain = '';
  try { domain = new URL(sourceUrl).hostname.toLowerCase(); }
  catch {
    console.warn(`[stripe-webhook] managed_website ${session.id}: invalid source_url ${sourceUrl}`);
    return;
  }

  const tier = (['managed', 'premium', 'enterprise'].includes(meta.tier ?? '') ? meta.tier : 'managed') as
    'managed' | 'premium' | 'enterprise';

  // Insert queued row — Admin sieht ihn sofort, auch wenn waitUntil-Trigger
  // verloren geht ist der Job sichtbar und manuell resumebar.
  const { data: rebuild, error } = await admin
    .from('website_rebuilds')
    .insert({
      tenant_id:      meta.tenant_id ?? null,
      audit_id:       meta.audit_id ?? null,
      source_url:     sourceUrl,
      source_domain:  domain,
      customer_email: String(email).toLowerCase(),
      company:        meta.company ?? null,
      tier,
      status:         'queued',
    })
    .select('id')
    .single();

  if (error || !rebuild) {
    console.error(`[stripe-webhook] failed to queue website_rebuild for ${session.id}: ${error?.message}`);
    return;
  }

  // Fire-and-forget — Webhook muss in <30s acken, Workflow läuft im Hintergrund.
  const triggerPromise = fetch(`${SUPABASE_URL}/functions/v1/rebuild-website`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ rebuild_id: rebuild.id }),
  }).then(async (r) => {
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error(`[stripe-webhook] rebuild-website trigger ${rebuild.id} failed: ${r.status} ${txt}`);
    } else {
      console.log(`[stripe-webhook] rebuild-website ${rebuild.id} triggered for ${domain}`);
    }
  }).catch((e) => {
    console.error(`[stripe-webhook] rebuild-website trigger ${rebuild.id} threw: ${(e as Error).message}`);
  });

  // @ts-ignore — EdgeRuntime is provided by Supabase Edge Runtime
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    // @ts-ignore
    EdgeRuntime.waitUntil(triggerPromise);
  }
}

/**
 * Server-side Purchase fan-out to ad platforms. Uses Stripe `session.id` as
 * the dedup eventId so a corresponding client-side pixel (if it ever fires
 * from a /success page) is merged by Meta instead of double-counted.
 *
 * Failures are intentionally swallowed — ad attribution loss must not roll
 * back the subscription write, since Stripe will retry the webhook on 500.
 */
async function reportPurchaseToAdPlatforms(
  session: Stripe.Checkout.Session,
  req: Request,
): Promise<void> {
  const amount = session.amount_total ?? 0;
  if (amount <= 0) return;

  try {
    await reportServerConversion({
      eventName: session.mode === 'subscription' ? 'Subscribe' : 'Purchase',
      eventId: session.id,
      eventTime: Math.floor(Date.now() / 1000),
      value: amount / 100,
      currency: (session.currency ?? 'eur').toUpperCase(),
      user: {
        email: session.customer_details?.email ?? session.customer_email ?? undefined,
        phone: session.customer_details?.phone ?? undefined,
        city: session.customer_details?.address?.city ?? undefined,
        country: session.customer_details?.address?.country ?? undefined,
        clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
        userAgent: req.headers.get('user-agent') ?? undefined,
      },
      sourceUrl: session.success_url ?? undefined,
    });
  } catch (err) {
    console.warn('[stripe-webhook] purchase fan-out failed:', (err as Error).message);
  }
}
