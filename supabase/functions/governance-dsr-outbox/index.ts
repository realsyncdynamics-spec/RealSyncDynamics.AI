// P0 DSR Evidence Outbox Drain. Cron-only; no user JWT or service-role Bearer
// accepted as an inbound credential. Mutations are inside dsr_outbox_drain()
// so event append and 'delivered' marking commit atomically.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireCronKey } from '../_shared/cronKey.ts';
import { ensureSubjectRef } from '../_shared/dsrSubjectRef.ts';
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
    // The existing durable outbox is the queue. Reconcile only tasks still
    // missing a subject anchor or the erasure marker; never put PII in logs.
    const { data: pending, error: pendingError } = await admin.rpc(
      'dsr_outbox_subject_pending', { p_batch_size: 25 },
    );
    if (pendingError || !Array.isArray(pending)) {
      console.error(JSON.stringify({ scope: 'dsr_subject_recovery', code: pendingError?.code ?? 'INVALID_PENDING' }));
      return jsonError(503, 'SUBJECT_RECOVERY_UNAVAILABLE', 'DSR subject recovery unavailable', corsHeaders);
    }

    let linked = 0;
    let pendingLinks = 0;
    for (const raw of pending) {
      // Service-role only RPC returns the requester email. It is processed
      // in memory to generate a pseudonymous reference, never reported.
      if (!raw || typeof raw.dsr_id !== 'string' ||
          typeof raw.tenant_id !== 'string' ||
          typeof raw.requester_email !== 'string' ||
          typeof raw.request_type !== 'string') {
        pendingLinks++;
        continue;
      }
      const subject = await ensureSubjectRef(admin, raw.tenant_id, raw.requester_email);
      if (!subject) {
        pendingLinks++;
        continue;
      }
      const { data: bound, error: bindError } = await admin.rpc('dsr_outbox_subject_link', {
        p_dsr_id: raw.dsr_id,
        p_tenant_id: raw.tenant_id,
        p_subject_ref: subject.subject_ref,
        p_key_version: subject.key_version,
      });
      if (bindError || bound !== true) {
        console.error(JSON.stringify({ scope: 'dsr_subject_recovery', code: bindError?.code ?? 'LINK_FAILED' }));
        pendingLinks++;
      } else {
        linked++;
      }
    }

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
      ok: pendingLinks === 0 && (counters.failed_in_batch ?? 0) === 0 && (counters.exhausted ?? 0) === 0,
      delivered: counters.delivered,
      failed_in_batch: counters.failed_in_batch,
      pending_retryable: counters.pending_retryable,
      exhausted: counters.exhausted,
      subject_links_repaired: linked,
      subject_links_pending: pendingLinks,
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
