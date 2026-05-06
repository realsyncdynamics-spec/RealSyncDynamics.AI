// Workflow callback — n8n posts terminal results here.
//
// POST /functions/v1/workflow-callback
// Authorization: Bearer <WORKFLOW_CALLBACK_SECRET>
// Body: {
//   run_id: uuid,
//   status: 'success' | 'error' | 'timeout' | 'cancelled',
//   output?: object,
//   error_code?: string,
//   error_message?: string,
//   cost_usd?: number,
// }
//
// 1. Validates shared bearer secret (n8n includes it from workflow-trigger payload)
// 2. UPDATEs workflow_runs row by id (status, output, error, cost, duration)
// 3. Trigger bumps workflows.last_run_at atomically
// 4. recordUsage('limit.workflow_runs_monthly') on success only

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { recordUsage } from '../_shared/usage.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SECRET = Deno.env.get('WORKFLOW_CALLBACK_SECRET');
  if (!SECRET) return jsonError(503, 'NOT_CONFIGURED', 'WORKFLOW_CALLBACK_SECRET not set');

  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SECRET}`) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid callback secret');
  }

  let body: {
    run_id?: string;
    status?: string;
    output?: Record<string, unknown>;
    error_code?: string;
    error_message?: string;
    cost_usd?: number;
  };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.run_id || !body.status) {
    return jsonError(400, 'BAD_REQUEST', 'run_id and status required');
  }

  const validStatus = ['success', 'error', 'timeout', 'cancelled'];
  if (!validStatus.includes(body.status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of: ${validStatus.join(', ')}`);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: run, error: runErr } = await admin
    .from('workflow_runs')
    .select('id, tenant_id, workflow_id, started_at, status')
    .eq('id', body.run_id).maybeSingle();
  if (runErr) return jsonError(500, 'INTERNAL', runErr.message);
  if (!run) return jsonError(404, 'NOT_FOUND', 'run not found');
  if (run.status !== 'pending' && run.status !== 'running') {
    return jsonError(409, 'ALREADY_FINISHED', `run already in status ${run.status}`);
  }

  const finishedAt = new Date();
  const startedAt = new Date(run.started_at);
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const { error: updateErr } = await admin.from('workflow_runs').update({
    status: body.status,
    output_payload: body.output ?? null,
    error_code: body.error_code ?? null,
    error_message: body.error_message ?? null,
    cost_usd: body.cost_usd ?? 0,
    duration_ms: durationMs,
    finished_at: finishedAt.toISOString(),
  }).eq('id', run.id);
  if (updateErr) return jsonError(500, 'INTERNAL', updateErr.message);

  // Quota — only count successful runs against the monthly cap.
  if (body.status === 'success') {
    try {
      await recordUsage(admin, run.tenant_id, 'limit.workflow_runs_monthly', 1, {
        run_id: run.id, workflow_id: run.workflow_id,
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
