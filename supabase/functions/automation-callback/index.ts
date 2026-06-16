// Automation Skill callback — n8n posts progress/terminal results here.
//
// POST /functions/v1/automation-callback
// Authorization: Bearer <AUTOMATION_CALLBACK_SECRET>
// Body (progress event): {
//   run_id: uuid,
//   event_type: string,
//   payload?: object,
// }
// Body (terminal result): {
//   run_id: uuid,
//   status: 'success' | 'error' | 'timeout' | 'cancelled',
//   result?: object,
//   outputs?: { output_type: string; content: object; evidence_hash?: string }[],
//   error_code?: string,
//   error_message?: string,
//   cost_usd?: number,
// }
//
// 1. Validates shared bearer secret (n8n includes it from automation-trigger payload)
// 2. event_type without status  -> INSERT automation_run_events (progress only)
// 3. status present              -> UPDATE automation_runs (terminal), INSERT
//    automation_outputs for each entry in `outputs`, recordUsage on success.

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
    event_type?: string;
    payload?: Record<string, unknown>;
    status?: string;
    result?: Record<string, unknown>;
    outputs?: { output_type: string; content: Record<string, unknown>; evidence_hash?: string }[];
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

  // Progress event only (no terminal status) — append and return.
  if (!body.status) {
    if (!body.event_type) return jsonError(400, 'BAD_REQUEST', 'event_type or status required');
    await admin.from('automation_run_events').insert({
      run_id: run.id,
      event_type: body.event_type,
      payload: body.payload ?? {},
    });
    return json({ ok: true });
  }

  const validStatus = ['success', 'error', 'timeout', 'cancelled'];
  if (!validStatus.includes(body.status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of: ${validStatus.join(', ')}`);
  }
  if (run.status !== 'queued' && run.status !== 'running') {
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
    event_type: body.status,
    payload: { error_code: body.error_code ?? null },
  });

  if (body.outputs?.length) {
    await admin.from('automation_outputs').insert(
      body.outputs.map((o) => ({
        run_id: run.id,
        tenant_id: run.tenant_id,
        output_type: o.output_type,
        content: o.content,
        evidence_hash: o.evidence_hash ?? null,
      })),
    );
  }

  // Quota — only count successful runs against the monthly cap.
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
function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return json({ ok: false, error: { code, message, details } }, status);
}
