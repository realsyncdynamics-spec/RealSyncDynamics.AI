// One-shot admin provisioning for the classic Stripe webhook endpoint.
// Gated by a single-use token header (x-provision-token). Uses the
// server-side STRIPE_SECRET_KEY (env-first, vault-fallback) so the key never
// leaves the Edge runtime, creates/repairs the CLASSIC webhook endpoint, and
// writes its signing secret straight into the Vault via set_app_secret.
//
// The signing secret is NEVER returned in the response.
//
// ─── ARCHIV-HINWEIS ──────────────────────────────────────────────────────────
// Das GATE-Token stand im Original als Literal im Quelltext. Es ist hier durch
// einen Platzhalter ersetzt, damit es nicht in die Git-History wandert. Der
// Originalwert ist mit dem Loeschen der Live-Function gegenstandslos; wird die
// Function je reaktiviert, gehoert das Token in den Vault, nicht in den Code.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GATE = '<REDACTED — lag im Original als Klartext-Literal im Quelltext>';
const WEBHOOK_URL = 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook';
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
];

function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
async function getSecret(envVar: string, vaultName: string, admin: any): Promise<string | null> {
  const e = Deno.env.get(envVar);
  if (e) return e;
  try {
    const { data } = await admin.rpc('get_app_secret', { secret_name: vaultName });
    if (typeof data === 'string' && data.length > 0) return data;
  } catch { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  if (req.headers.get('x-provision-token') !== GATE) return json({ ok: false, error: 'forbidden' }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const sk = await getSecret('STRIPE_SECRET_KEY', 'stripe_secret_key', admin);
  if (!sk) return json({ ok: false, error: 'STRIPE_SECRET_KEY not configured (env nor vault)' }, 500);
  const stripe = new Stripe(sk, { apiVersion: '2024-06-20' });

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean };
  const dryRun = body.dry_run === true;

  const out: Record<string, unknown> = { ok: true, dry_run: dryRun, key_mode: sk.startsWith('rk_') ? 'restricted' : sk.startsWith('sk_live') ? 'live' : sk.startsWith('sk_test') ? 'test' : 'unknown' };

  // 1. List classic webhook endpoints (/v1/webhook_endpoints).
  let classic: Stripe.WebhookEndpoint[] = [];
  try {
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    classic = list.data;
  } catch (e) {
    return json({ ...out, ok: false, error: `list webhook_endpoints failed: ${(e as Error).message}` }, 502);
  }
  out.classic_endpoints = classic.map((e) => ({ id: e.id, url: e.url, status: e.status, api_version: e.api_version, events: e.enabled_events }));

  // 2. Best-effort: list v2 event destinations (the source of the v2 pings).
  try {
    const r = await fetch('https://api.stripe.com/v2/core/event_destinations', {
      headers: { Authorization: `Bearer ${sk}`, 'Stripe-Version': '2025-03-31.basil' },
    });
    if (r.ok) {
      const j = await r.json();
      out.v2_event_destinations = (j.data ?? []).map((d: Record<string, unknown>) => ({ id: d.id, name: d.name, status: d.status, url: (d.webhook_endpoint as Record<string, unknown>)?.url, event_payload: d.event_payload }));
    } else {
      out.v2_event_destinations = `lookup http ${r.status}`;
    }
  } catch (e) {
    out.v2_event_destinations = `lookup failed: ${(e as Error).message}`;
  }

  if (dryRun) return json(out);

  // 3. Ensure a classic endpoint at WEBHOOK_URL with the signing secret captured.
  //    The secret is only returned on CREATE, so to obtain a Vault-storable
  //    secret we (re)create the endpoint at our URL.
  try {
    const dupes = classic.filter((e) => e.url === WEBHOOK_URL);
    for (const d of dupes) {
      await stripe.webhookEndpoints.del(d.id);
    }
    const ep = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: EVENTS as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
      description: 'RealSync classic subscription webhook (provisioned)',
    });
    out.created_endpoint_id = ep.id;
    out.replaced_count = dupes.length;
    out.enabled_events = EVENTS;

    if (ep.secret) {
      const { error } = await admin.rpc('set_app_secret', { secret_name: 'stripe_webhook_secret', secret_value: ep.secret });
      out.secret_stored_in_vault = !error;
      if (error) out.secret_store_error = error.message;
    } else {
      out.secret_stored_in_vault = false;
      out.secret_store_error = 'create returned no secret';
    }
  } catch (e) {
    return json({ ...out, ok: false, error: `provision failed: ${(e as Error).message}` }, 502);
  }

  return json(out);
});
