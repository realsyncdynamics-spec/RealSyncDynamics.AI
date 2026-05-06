// Stripe metered-billing sync — pulls current month usage_totals for every
// metered (tenant, entitlement_key) mapping and posts an absolute usage
// record to Stripe with action='set'. Idempotent.
//
// POST /functions/v1/stripe-meter-sync
// Authorization: Bearer <STRIPE_METER_SHARED_SECRET>     (NOT a user JWT)
//
// Auth: shared secret read from env first, falls back to Supabase Vault
// (public.get_app_secret('stripe_meter_shared_secret')) so cron + manual
// invocations work without a project-secret roundtrip in the dashboard.
// Same fallback for STRIPE_SECRET_KEY (vault name 'stripe_secret_key').

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const periodMonth = (d = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

async function getSecret(envVar: string, vaultName: string): Promise<string | null> {
  const fromEnv = Deno.env.get(envVar);
  if (fromEnv) return fromEnv;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  if (error) return null;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

interface MapRow {
  tenant_id: string;
  entitlement_key: string;
  stripe_subscription_item_id: string;
  stripe_unit_factor: number;
}

interface SummaryRow {
  tenant_id: string;
  entitlement_key: string;
  quantity: number;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('POST only', 405);

  const sharedSecret = await getSecret('STRIPE_METER_SHARED_SECRET', 'stripe_meter_shared_secret');
  if (!sharedSecret) return text('shared secret not configured', 500);

  const auth = req.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${sharedSecret}`) {
    return text('forbidden', 403);
  }

  const stripeKey = await getSecret('STRIPE_SECRET_KEY', 'stripe_secret_key');
  if (!stripeKey) return text('stripe key not configured', 500);
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: meteredKeys, error: cfgErr } = await admin
    .from('usage_limits_config')
    .select('entitlement_key')
    .eq('billing_mode', 'metered');
  if (cfgErr) return json({ ok: false, error: cfgErr.message }, 500);

  const meteredSet = new Set((meteredKeys ?? []).map((r) => r.entitlement_key));
  if (meteredSet.size === 0) return json({ ok: true, synced: 0, skipped: 0, errors: 0, results: [] });

  const { data: maps, error: mapErr } = await admin
    .from('metered_subscription_items')
    .select('tenant_id, entitlement_key, stripe_subscription_item_id, stripe_unit_factor')
    .in('entitlement_key', [...meteredSet]);
  if (mapErr) return json({ ok: false, error: mapErr.message }, 500);

  const period = periodMonth();
  const results: SummaryRow[] = [];

  for (const m of (maps ?? []) as MapRow[]) {
    try {
      const { data: total, error: totalErr } = await admin
        .from('usage_totals')
        .select('total')
        .eq('tenant_id', m.tenant_id)
        .eq('entitlement_key', m.entitlement_key)
        .eq('period_month', period)
        .maybeSingle();
      if (totalErr) throw new Error(totalErr.message);

      const internal = total?.total ?? 0;
      const quantity = Math.max(0, Math.round(internal * Number(m.stripe_unit_factor)));

      const { data: last } = await admin
        .from('usage_meter_sync')
        .select('last_quantity, last_status')
        .eq('tenant_id', m.tenant_id)
        .eq('entitlement_key', m.entitlement_key)
        .eq('period_month', period)
        .maybeSingle();

      if (last?.last_status === 'ok' && Number(last.last_quantity) === quantity) {
        results.push({ tenant_id: m.tenant_id, entitlement_key: m.entitlement_key, quantity, status: 'skipped' });
        continue;
      }

      await stripe.subscriptionItems.createUsageRecord(
        m.stripe_subscription_item_id,
        {
          quantity,
          action: 'set',
          timestamp: Math.floor(Date.now() / 1000),
        },
      );

      await admin.from('usage_meter_sync').upsert({
        tenant_id: m.tenant_id,
        entitlement_key: m.entitlement_key,
        period_month: period,
        last_quantity: quantity,
        last_synced_at: new Date().toISOString(),
        last_status: 'ok',
        last_error: null,
      });

      results.push({ tenant_id: m.tenant_id, entitlement_key: m.entitlement_key, quantity, status: 'ok' });
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      await admin.from('usage_meter_sync').upsert({
        tenant_id: m.tenant_id,
        entitlement_key: m.entitlement_key,
        period_month: period,
        last_quantity: 0,
        last_synced_at: new Date().toISOString(),
        last_status: 'error',
        last_error: message,
      });
      results.push({ tenant_id: m.tenant_id, entitlement_key: m.entitlement_key, quantity: 0, status: 'error', error: message });
    }
  }

  const synced = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;

  return json({ ok: errors === 0, synced, skipped, errors, period, results });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function text(s: string, status = 200): Response {
  return new Response(s, { status });
}
