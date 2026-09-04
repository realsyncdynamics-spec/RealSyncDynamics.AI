// One-shot admin function: list/update Stripe webhook endpoints, and store
// the working key in vault so future Edge calls don't depend on the
// placeholder STRIPE_SECRET_KEY env var.
//
// Auth: Bearer <stripe_meter_shared_secret>
// Body: {
//   action: 'list' | 'fix' | 'persist',
//   stripe_key: 'sk_test_...' (required — overrides broken env),
//   dead_host?: string,
//   new_url?: string,
// }

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

async function getVaultSecret(name: string): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data } = await admin.rpc('get_app_secret', { secret_name: name });
  return typeof data === 'string' && data.length > 0 ? data : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  try {
    const shared = await getVaultSecret('stripe_meter_shared_secret');
    if (!shared) return json({ ok: false, step: 'shared_secret_missing' }, 500);
    if (req.headers.get('Authorization') !== `Bearer ${shared}`) {
      return new Response('forbidden', { status: 403 });
    }

    let body: { action?: string; stripe_key?: string; dead_host?: string; new_url?: string } = {};
    try { body = await req.json(); } catch { /* */ }

    // Use stripe_key from body, fallback to vault, fallback to env
    let stripeKey = body.stripe_key;
    if (!stripeKey) stripeKey = (await getVaultSecret('stripe_secret_key')) ?? undefined;
    if (!stripeKey) stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? undefined;
    if (!stripeKey) return json({ ok: false, step: 'no_stripe_key', hint: 'pass stripe_key in body, or set vault.stripe_secret_key' }, 400);

    const keyShape = {
      len: stripeKey.length,
      prefix: stripeKey.slice(0, 8),
      is_test: stripeKey.startsWith('sk_test_'),
      is_live: stripeKey.startsWith('sk_live_'),
    };

    const action = body.action ?? 'list';

    if (action === 'persist') {
      // Store the (real) key in vault so other functions can use it
      const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
      const { error } = await admin.rpc('set_app_secret', { secret_name: 'stripe_secret_key', secret_value: stripeKey });
      if (error) return json({ ok: false, step: 'set_app_secret', error: error.message }, 500);
      return json({ ok: true, action, persisted: 'vault.stripe_secret_key', key_shape: keyShape });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    let list;
    try {
      list = await stripe.webhookEndpoints.list({ limit: 100 });
    } catch (e) {
      return json({ ok: false, step: 'list_endpoints', key_shape: keyShape, error: (e as Error).message }, 500);
    }

    const all = list.data.map(e => ({ id: e.id, url: e.url, status: e.status, enabled_events_count: e.enabled_events.length }));

    if (action === 'list') return json({ ok: true, action, key_shape: keyShape, total: all.length, endpoints: all });

    if (action === 'fix') {
      const dead = body.dead_host;
      const next = body.new_url;
      if (!dead || !next) return json({ ok: false, error: 'dead_host_and_new_url_required' }, 400);
      const fixed: unknown[] = [];
      for (const ep of list.data) {
        if (ep.url.includes(dead)) {
          const updated = await stripe.webhookEndpoints.update(ep.id, { url: next });
          fixed.push({ id: ep.id, old_url: ep.url, new_url: updated.url, status: updated.status, enabled_events: updated.enabled_events });
        }
      }
      return json({ ok: true, action, key_shape: keyShape, total_endpoints: all.length, fixed_count: fixed.length, fixed, all });
    }

    return json({ ok: false, error: 'unknown_action', received: action }, 400);
  } catch (e) {
    return json({ ok: false, step: 'outer_catch', error: (e as Error).message, stack: (e as Error).stack?.split('\n').slice(0, 6) }, 500);
  }
});
