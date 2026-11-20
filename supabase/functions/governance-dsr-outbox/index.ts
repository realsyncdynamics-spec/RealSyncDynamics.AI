// P0 DSR Evidence Outbox Drain. Cron-only; no user JWT or service-role Bearer
// accepted as an inbound credential. Mutations are inside dsr_outbox_drain()
// so event append and 'delivered' marking commit atomically.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireCronKey } from '../_shared/cronKey.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', corsHeaders);

  const auth = await requireCronKey(req, 'CRON_DSR_OUTBOX_KEY', 'cron_dsr_outbox_key', corsHeaders);
  if (auth) return auth;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return jsonError(503, 'NOT_CONFIGURED', 'database credentials unavailable', corsHeaders);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    const { data, error } = await admin.rpc('dsr_outbox_drain', { p_batch_size: 25 });
    if (error) {
      console.error(JSON.stringify({ scope: 'dsr_outbox_drain_failed', error: error.code ?? 'DB_ERROR' }));
      return jsonError(503, 'DRAIN_FAILED', 'DSR evidence drain could not complete', corsHeaders);
    }

    const counters = data as {
      delivered?: number; failed_in_batch?: number;
      pending_retryable?: number; exhausted?: number;
    } | null;
    const required = ['delivered', 'failed_in_batch', 'pending_retryable', 'exhausted'] as const;
    if (!counters || required.some(k => {
      const value = counters[k];
      return typeof value !== 'number' || !Number.isFinite(value);
    })) {
      return jsonError(503, 'INVALID_DRAIN_RESULT', 'invalid DSR outbox response', corsHeaders);
    }

    const result = {
      ok: (counters.failed_in_batch ?? 0) === 0 && (counters.exhausted ?? 0) === 0,
      delivered: counters.delivered,
      failed_in_batch: counters.failed_in_batch,
      pending_retryable: counters.pending_retryable,
      exhausted: counters.exhausted,
    };
    console.log(JSON.stringify({ scope: 'dsr_outbox_drain', ...result }));

    if (!result.ok) {
      return jsonResponse({ ...result, error: { code: 'DSR_EVIDENCE_BACKLOG', message: 'evidence retry or exhausted work requires investigation' } }, 503, corsHeaders);
    }
    return jsonResponse(result, 200, corsHeaders);
  } catch {
    console.error(JSON.stringify({ scope: 'dsr_outbox_drain_failed', error: 'UNEXPECTED' }));
    return jsonError(503, 'DRAIN_FAILED', 'internal error', corsHeaders);
  }
});
