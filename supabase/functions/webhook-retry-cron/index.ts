// Webhook Retry Engine — Cron Job
//
// Runs every 5 minutes to retry failed webhook deliveries.
// Uses exponential backoff: 5s, 25s, 125s between retries.
// Gives up after 3 attempts (configurable per subscription).
//
// POST /functions/v1/webhook-retry-cron
// Authorization: Bearer <WEBHOOK_RETRY_SECRET>

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function signPayload(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, data);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface RetryResult {
  delivery_id: string;
  status: 'retried' | 'max_retries_exceeded' | 'still_failed' | 'error';
  http_status?: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  const secret = Deno.env.get('WEBHOOK_RETRY_SECRET');
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return jsonError(403, 'FORBIDDEN', 'invalid auth');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const results: RetryResult[] = [];
  let retried = 0, exceeded = 0, errors = 0;

  try {
    // 1. Find deliveries ready for retry (next_retry_at <= now)
    const { data: deliveries, error: fetchErr } = await admin
      .from('webhook_deliveries')
      .select(
        'id, subscription_id, url, request_body, error_message, status_code, attempt_number, next_retry_at'
      )
      .eq('status', 'failed')
      .not('next_retry_at', 'is', null)
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(100);

    if (fetchErr) {
      return jsonError(500, 'INTERNAL', fetchErr.message);
    }

    if (!deliveries || deliveries.length === 0) {
      return jsonResponse({ ok: true, retried: 0, total: 0, results: [] });
    }

    // 2. Fetch subscription details (secret, headers, max_retries)
    const subIds = [...new Set(deliveries.map((d) => (d as any).subscription_id))];
    const { data: subs, error: subErr } = await admin
      .from('webhook_subscriptions')
      .select('id, secret, headers, max_retries')
      .in('id', subIds);

    if (subErr) {
      return jsonError(500, 'INTERNAL', subErr.message);
    }

    const subMap = new Map((subs || []).map((s: any) => [s.id, s]));

    // 3. Retry each delivery
    for (const d of deliveries) {
      const delivery = d as any;
      const sub = subMap.get(delivery.subscription_id);
      if (!sub) {
        results.push({
          delivery_id: delivery.id,
          status: 'error',
          error: 'subscription not found',
        });
        errors++;
        continue;
      }

      const attempt = delivery.attempt_number + 1;

      // Check max retries
      if (attempt > sub.max_retries) {
        // Mark as failed permanently
        await admin
          .from('webhook_deliveries')
          .update({ status: 'failed', next_retry_at: null })
          .eq('id', delivery.id);

        results.push({
          delivery_id: delivery.id,
          status: 'max_retries_exceeded',
        });
        exceeded++;
        continue;
      }

      // Retry delivery
      try {
        const payload = delivery.request_body;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'RealSyncDynamics-Webhook-Retry/1.0',
          'X-Retry-Attempt': String(attempt),
          ...(sub.headers || {}),
        };

        if (sub.secret) {
          const signature = await signPayload(payload, sub.secret);
          headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }

        const response = await fetch(delivery.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        const success = response.status >= 200 && response.status < 300;
        const responseBody = await response.text();

        // Calculate next retry time (exponential backoff: 5s → 25s → 125s)
        const baseDelay = 5000; // 5 seconds
        const nextRetryMs = baseDelay * Math.pow(5, attempt - 1);
        const nextRetryAt = new Date(Date.now() + nextRetryMs).toISOString();

        // Update delivery record
        const { error: updateErr } = await admin
          .from('webhook_deliveries')
          .update({
            status: success ? 'delivered' : 'failed',
            status_code: response.status,
            response_body: responseBody.slice(0, 1000),
            attempt_number: attempt,
            next_retry_at: success ? null : nextRetryAt,
            delivered_at: success ? new Date().toISOString() : null,
          })
          .eq('id', delivery.id);

        if (updateErr) throw updateErr;

        results.push({
          delivery_id: delivery.id,
          status: success ? 'retried' : 'still_failed',
          http_status: response.status,
        });

        if (success) retried++;
      } catch (e) {
        results.push({
          delivery_id: delivery.id,
          status: 'error',
          error: (e as Error).message,
        });
        errors++;
      }
    }

    return jsonResponse({
      ok: errors === 0,
      retried,
      max_retries_exceeded: exceeded,
      errors,
      results,
    });
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
