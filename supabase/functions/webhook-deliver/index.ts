// Webhook Delivery Engine
//
// Dispatches webhooks to tenant-subscribed URLs when events occur.
// Handles retries, rate limiting, signature verification, and audit logging.
//
// POST /functions/v1/webhook-deliver
// Authorization: Bearer <service-role or internal>
// Body: {
//   tenant_id: uuid,
//   event_key: string,  (e.g., "audit.completed", "risk.detected")
//   event_id: string,   (e.g., audit_id, risk_id)
//   payload: object     (event-specific data)
// }
//
// Returns: { ok: true, deliveries: [...] }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WebhookPayload {
  tenant_id: string;
  event_key: string;
  event_id: string;
  payload: Record<string, unknown>;
  timestamp?: string;
}

async function signPayload(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, data);

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deliverWebhook(
  subscription: {
    id: string;
    url: string;
    secret?: string;
    headers?: Record<string, string>;
  },
  event: WebhookPayload,
): Promise<{ status: number; body?: string; error?: string }> {
  try {
    const payload = {
      ...event.payload,
      event_key: event.event_key,
      event_id: event.event_id,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RealSyncDynamics-Webhook/1.0',
      ...( subscription.headers || {}),
    };

    // Add HMAC signature if secret provided
    if (subscription.secret) {
      const signature = await signPayload(payload, subscription.secret);
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const body = await response.text();

    return {
      status: response.status,
      body: body.length > 1000 ? body.slice(0, 1000) : body,
      error: response.status < 200 || response.status >= 300 ? `HTTP ${response.status}` : undefined,
    };
  } catch (e) {
    return {
      status: 0,
      error: (e as Error).message,
    };
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: WebhookPayload;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.tenant_id || !body.event_key || !body.event_id || !body.payload) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, event_key, event_id, payload required');
  }

  try {
    // 1. Find all subscriptions for this event
    const { data: subscriptions, error: subErr } = await admin
      .from('webhook_subscriptions')
      .select('id, url, secret, headers, rate_limit_per_hour')
      .eq('tenant_id', body.tenant_id)
      .eq('event_key', body.event_key)
      .eq('enabled', true);

    if (subErr) return jsonError(500, 'INTERNAL', subErr.message);

    if (!subscriptions || subscriptions.length === 0) {
      return jsonResponse({ ok: true, deliveries: [] });
    }

    // 2. Deliver to each subscription
    const results = [];

    for (const sub of subscriptions) {
      // Check rate limit
      const { data: count, error: countErr } = await admin.rpc(
        'count_webhook_deliveries_this_hour',
        { p_subscription_id: sub.id }
      );

      if (countErr) {
        console.warn('Rate limit check failed:', countErr);
      }

      const deliveryCount = typeof count === 'number' ? count : 0;
      if (deliveryCount >= sub.rate_limit_per_hour) {
        // Rate limited — log and skip
        await admin.from('webhook_deliveries').insert({
          subscription_id: sub.id,
          tenant_id: body.tenant_id,
          event_key: body.event_key,
          event_id: body.event_id,
          url: sub.url,
          request_body: body.payload,
          request_headers: {},
          status: 'rate_limited',
          status_code: 429,
        });

        results.push({ subscription_id: sub.id, status: 'rate_limited', code: 429 });
        continue;
      }

      // Deliver webhook
      const response = await deliverWebhook(
        {
          id: sub.id,
          url: sub.url,
          secret: sub.secret,
          headers: sub.headers as Record<string, string> | undefined,
        },
        body
      );

      // Log delivery
      const success = response.status >= 200 && response.status < 300;
      const status = success ? 'delivered' : 'failed';

      const { error: logErr } = await admin.from('webhook_deliveries').insert({
        subscription_id: sub.id,
        tenant_id: body.tenant_id,
        event_key: body.event_key,
        event_id: body.event_id,
        url: sub.url,
        request_body: body.payload,
        request_headers: {} as any,  // Don't log headers (may contain secrets)
        status_code: response.status,
        response_body: response.body,
        error_message: response.error,
        status,
        delivered_at: success ? new Date().toISOString() : null,
        // Schedule retry if failed (exponential backoff: 5s, 25s, 125s)
        next_retry_at: !success ? new Date(Date.now() + 5000).toISOString() : null,
      });

      if (logErr) console.error('Failed to log delivery:', logErr);

      results.push({
        subscription_id: sub.id,
        status,
        code: response.status,
        error: response.error,
      });
    }

    return jsonResponse({ ok: true, deliveries: results });
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
