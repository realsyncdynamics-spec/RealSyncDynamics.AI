// Automation-Skill callback — n8n posts progress/terminal results here.
//
// POST /functions/v1/automation-callback
// Authorization: Bearer <AUTOMATION_CALLBACK_SECRET>
// Body (terminal):
//   {
//     run_id: uuid,
//     status: 'success' | 'error' | 'timeout' | 'cancelled',
//     result?: object,
//     output_refs?: Array<{ output_type: 'report'|'document'|'ticket'|'protocol', storage_path?: string, metadata?: object }>,
//     error_code?: string,
//     error_message?: string,
//     cost_usd?: number,
//   }
// Body (progress, optional, run bleibt 'running'):
//   { run_id: uuid, event_type: 'progress' | 'log', payload?: object }
//
// 1. Validiert das geteilte Bearer-Secret (n8n erhält es im automation-trigger-Payload)
// 2. Bei event_type ohne status: INSERT automation_run_events (Fortschritt), Run bleibt unverändert
// 3. Bei gesetztem status: UPDATE automation_runs (terminal), INSERT automation_run_events + automation_outputs
// 4. recordUsage('limit.automation_runs_monthly') nur bei status='success'

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { recordUsage } from '../_shared/usage.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SECRET = Deno.env.get('AUTOMATION_CALLBACK_SECRET');
  if (!SECRET) return jsonError(503, 'NOT_CONFIGURED', 'AUTOMATION_CALLBACK_SECRET not set');

  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SECRET}`) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid callback secret');
  }

  let body: {
    run_id?: string;
    status?: string;
    event_type?: string;
    payload?: Record<string, unknown>;
    result?: Record<string, unknown>;
    output_refs?: Array<{ output_type?: string; storage_path?: string; metadata?: Record<string, unknown> }>;
    error_code?: string;
    error_message?: string;
    cost_usd?: number;
  };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.run_id) return jsonError(400, 'BAD_REQUEST', 'run_id required');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: run, error: runErr } = await admin
    .from('automation_runs')
    .select('id, tenant_id, skill_id, started_at, status')
    .eq('id', body.run_id).maybeSingle();
  if (runErr) return jsonError(500, 'INTERNAL', runErr.message);
  if (!run) return jsonError(404, 'NOT_FOUND', 'run not found');

  // Progress-Event ohne status: nur Event protokollieren, Run bleibt 'running'.
  if (!body.status) {
    const validEvents = ['queued', 'progress', 'log'];
    const eventType = body.event_type ?? 'progress';
    if (!validEvents.includes(eventType)) {
      return jsonError(400, 'BAD_REQUEST', `event_type must be one of: ${validEvents.join(', ')}`);
    }
    if (run.status !== 'pending' && run.status !== 'running') {
      return jsonError(409, 'ALREADY_FINISHED', `run already in status ${run.status}`);
    }
    const { error: eventErr } = await admin.from('automation_run_events').insert({
      run_id: run.id,
      event_type: eventType,
      payload: body.payload ?? {},
    });
    if (eventErr) return jsonError(500, 'INTERNAL', eventErr.message);
    return json({ ok: true });
  }

  const validStatus = ['success', 'error', 'timeout', 'cancelled'];
  if (!validStatus.includes(body.status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of: ${validStatus.join(', ')}`);
  }
  if (run.status !== 'pending' && run.status !== 'running') {
    return jsonError(409, 'ALREADY_FINISHED', `run already in status ${run.status}`);
  }

  const finishedAt = new Date();
  const startedAt = new Date(run.started_at);
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const { error: updateErr } = await admin.from('automation_runs').update({
    status: body.status,
    result: body.result ?? null,
    error_code: body.error_code ?? null,
    error_message: body.error_message ?? null,
    cost_usd: body.cost_usd ?? 0,
    duration_ms: durationMs,
    finished_at: finishedAt.toISOString(),
  }).eq('id', run.id);
  if (updateErr) return jsonError(500, 'INTERNAL', updateErr.message);

  await admin.from('automation_run_events').insert({
    run_id: run.id,
    event_type: body.status === 'success' ? 'result' : 'error',
    payload: { status: body.status, error_code: body.error_code ?? null, error_message: body.error_message ?? null },
  });

  const validOutputTypes = ['report', 'document', 'ticket', 'protocol'];
  const outputRefs = (body.output_refs ?? []).filter((o) => o.output_type && validOutputTypes.includes(o.output_type));
  if (outputRefs.length > 0) {
    const { error: outputErr } = await admin.from('automation_outputs').insert(
      outputRefs.map((o) => ({
        run_id: run.id,
        output_type: o.output_type,
        storage_path: o.storage_path ?? null,
        metadata: o.metadata ?? {},
      })),
    );
    if (outputErr) console.error('automation_outputs insert failed', outputErr.message);
  }

  // Quota — nur erfolgreiche Runs zählen gegen das monatliche Kontingent.
  if (body.status === 'success') {
    try {
      await recordUsage(admin, run.tenant_id, 'limit.automation_runs_monthly', 1, {
        run_id: run.id, skill_id: run.skill_id,
      });
    } catch (e) {
      console.error('recordUsage failed', (e as Error).message);
    }
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
