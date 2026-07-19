// Forward Stripe trial events to n8n webhooks.
//
// POST /functions/v1/automation-trigger-trial-webhook
// Authorization: Bearer <service role key>
// Body: { stripe_event_id, kind, tenant_id, subscription_id, customer_id, trial_end, occurred_at }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  // Service role auth (called from database trigger)
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: {
    stripe_event_id?: string;
    kind?: string;
    tenant_id?: string;
    subscription_id?: string;
    customer_id?: string;
    trial_end?: string;
    occurred_at?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const {
    stripe_event_id,
    kind,
    tenant_id,
    subscription_id,
    customer_id,
    trial_end,
    occurred_at,
  } = body;

  if (!stripe_event_id || !kind || !tenant_id || !subscription_id) {
    return jsonError(400, 'BAD_REQUEST', 'missing required fields');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Lookup active n8n webhook URL for this tenant
    const { data: webhooks, error: webhookErr } = await admin
      .from('governance_webhooks')
      .select('target_url, secret_hash, secret_prefix')
      .eq('tenant_id', tenant_id)
      .eq('enabled', true)
      .ilike('name', '%n8n%')
      .limit(1);

    if (webhookErr) {
      return jsonError(500, 'INTERNAL', `webhook lookup failed: ${webhookErr.message}`);
    }

    if (!webhooks || webhooks.length === 0) {
      // No webhook configured; silently return (n8n wiring optional in Phase 2B)
      return jsonResponse({ ok: true, skipped: true, reason: 'no_n8n_webhook_configured' });
    }

    const webhook = webhooks[0];

    // Map event kind to human-readable event name
    const eventNameMap: Record<string, string> = {
      trial_started: 'stripe_trial_started',
      trial_will_end: 'stripe_trial_will_end',
      converted: 'stripe_trial_converted',
      canceled: 'stripe_trial_canceled',
    };

    const eventName = eventNameMap[kind] || `stripe_trial_${kind}`;

    // Construct n8n webhook payload
    const payload = {
      event: eventName,
      tenant_id,
      subscription_id,
      customer_id,
      trial_end,
      occurred_at,
      stripe_event_id,
      timestamp: new Date().toISOString(),
    };

    // POST to n8n webhook (fire-and-forget, don't block on response)
    const postPromise = fetch(webhook.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhook.secret_prefix && {
          'X-Webhook-Secret': `${webhook.secret_prefix}.${webhook.secret_hash}`,
        }),
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          console.error(`n8n webhook returned ${res.status}: ${res.statusText}`);
        }
        return res;
      })
      .catch((err) => {
        console.error(`n8n webhook post failed: ${(err as Error).message}`);
      });

    // Log the webhook call attempt
    await admin
      .from('governance_webhooks')
      .update({
        last_called_at: new Date().toISOString(),
      })
      .eq('id', (webhooks[0] as any).id);

    // Return immediately (don't wait for n8n response)
    return jsonResponse({
      ok: true,
      event: eventName,
      posted_to: webhook.target_url,
    });
  } catch (e) {
    return jsonError(500, 'INTERNAL', `trigger failed: ${(e as Error).message}`);
  }
});
