// Stripe AI Token Metering Sync
//
// Aggregates LLM tokens consumed from tenant_cost_ledger for the current
// month and syncs to Stripe as metered usage for billing.
//
// Runs daily via scheduler. Posts usage to Stripe metered subscription
// items for entitlement_key = 'limit.ai_tokens_monthly'.
//
// POST /functions/v1/stripe-token-meter-sync
// Authorization: Bearer <STRIPE_METER_SHARED_SECRET>

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

interface SyncResult {
  tenant_id: string;
  total_tokens: number;
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

  const period = periodMonth();
  const results: SyncResult[] = [];
  let synced = 0, skipped = 0, errors = 0;

  try {
    // 1. Find all subscriptions with ai token metering enabled
    const { data: mappings, error: mapErr } = await admin
      .from('metered_subscription_items')
      .select('tenant_id, stripe_subscription_item_id, stripe_unit_factor')
      .eq('entitlement_key', 'limit.ai_tokens_monthly');
    if (mapErr) return json({ ok: false, error: mapErr.message }, 500);

    if (!mappings || mappings.length === 0) {
      return json({ ok: true, synced: 0, skipped: 0, errors: 0, period, results: [] });
    }

    // 2. For each mapped tenant, aggregate tokens from cost_ledger
    for (const m of mappings) {
      try {
        // Sum tokens (input + output) for this month
        const { data: tokenData, error: tokenErr } = await admin.rpc(
          'count_ai_tokens_by_tenant',
          { p_tenant_id: m.tenant_id, p_period_month: period }
        );

        let totalTokens = 0;
        if (!tokenErr && tokenData && typeof tokenData === 'number') {
          totalTokens = Math.round(tokenData);
        } else if (!tokenErr && Array.isArray(tokenData) && tokenData.length > 0) {
          // Fallback: raw query result
          totalTokens = Math.round((tokenData[0] as any).total_tokens || 0);
        }

        // Convert tokens to metered units (stripe_unit_factor)
        const quantity = Math.max(0, Math.round(totalTokens * Number(m.stripe_unit_factor)));

        // Check if we should skip (no change since last sync)
        const { data: lastSync } = await admin
          .from('usage_meter_sync')
          .select('last_quantity, last_status')
          .eq('tenant_id', m.tenant_id)
          .eq('entitlement_key', 'limit.ai_tokens_monthly')
          .eq('period_month', period)
          .maybeSingle();

        if (lastSync?.last_status === 'ok' && Number(lastSync.last_quantity) === quantity) {
          results.push({ tenant_id: m.tenant_id, total_tokens: totalTokens, quantity, status: 'skipped' });
          skipped++;
          continue;
        }

        // Post to Stripe
        await stripe.subscriptionItems.createUsageRecord(
          m.stripe_subscription_item_id,
          {
            quantity,
            action: 'set',
            timestamp: Math.floor(Date.now() / 1000),
          }
        );

        // Log sync
        await admin.from('usage_meter_sync').upsert({
          tenant_id: m.tenant_id,
          entitlement_key: 'limit.ai_tokens_monthly',
          period_month: period,
          last_quantity: quantity,
          last_synced_at: new Date().toISOString(),
          last_status: 'ok',
          last_error: null,
        });

        results.push({ tenant_id: m.tenant_id, total_tokens: totalTokens, quantity, status: 'ok' });
        synced++;
      } catch (e) {
        const message = (e as Error).message ?? String(e);

        // Log error
        await admin.from('usage_meter_sync').upsert({
          tenant_id: m.tenant_id,
          entitlement_key: 'limit.ai_tokens_monthly',
          period_month: period,
          last_quantity: 0,
          last_synced_at: new Date().toISOString(),
          last_status: 'error',
          last_error: message,
        });

        results.push({
          tenant_id: m.tenant_id,
          total_tokens: 0,
          quantity: 0,
          status: 'error',
          error: message,
        });
        errors++;
      }
    }
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    return json({ ok: false, error: message }, 500);
  }

  return json({
    ok: errors === 0,
    synced,
    skipped,
    errors,
    period,
    results,
  });
});

// RPC helper: count tokens for a tenant in a month
// Returns total_tokens (input + output)
// This will be called via Supabase RPC, so we need to create the function in a migration

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function text(s: string, status = 200): Response {
  return new Response(s, { status });
}
