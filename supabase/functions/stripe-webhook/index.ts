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

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });

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
      case 'checkout.session.completed':
        await sendOnboardingWelcome(admin, event.data.object as Stripe.Checkout.Session);
        break;
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

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("RESEND_FROM") ?? "RealSync Dynamics <hello@realsyncdynamicsai.de>";
  const SITE = Deno.env.get("PUBLIC_SITE_URL") ?? "https://realsyncdynamicsai.de";

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
