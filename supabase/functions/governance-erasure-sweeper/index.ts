// Governance Erasure Sweeper — cron-triggered DSAR fulfilment (DSGVO Art. 17).
//
// POST /functions/v1/governance-erasure-sweeper
//   verify_jwt = false; auth via Bearer secret (Vault: governance_erasure_sweeper_token)
//
// Drains the subject-erasure queue and finalizes the linked DSR records.
// process_subject_erasure_queue() carries an auth.role()='service_role' guard,
// so it cannot run from pg_cron SQL directly — this function runs with the
// service-role key and is what pg_cron hits.
//
// Order matters:
//   1. process_subject_erasure_queue()    — soft-erase mappings past the
//      retention hold, emit dsr.erasure_completed
//   2. dsr_finalize_erased_requests()      — redact plaintext PII still held
//      in dsr_requests for those subjects, close the request
//
// Both steps are idempotent: re-running picks up only rows not yet processed.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonError(status: number, code: string, detail: string): Response {
  return json(status, { ok: false, error: { code, detail } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(500, 'NOT_CONFIGURED', 'env missing');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Bearer auth via Vault — same pattern as agent-os-runner.
  const { data: token, error: secretErr } = await admin
    .rpc('get_app_secret', { secret_name: 'governance_erasure_sweeper_token' });
  if (secretErr || !token) {
    return jsonError(500, 'NOT_CONFIGURED', `vault token missing: ${secretErr?.message ?? 'empty'}`);
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${token}`) return jsonError(401, 'UNAUTHORIZED', 'invalid bearer');

  const started_at = new Date().toISOString();
  const t0 = Date.now();

  // 1. Soft-erase mappings past the retention hold.
  const { data: erased, error: queueErr } = await admin.rpc('process_subject_erasure_queue');
  if (queueErr) return jsonError(500, 'QUEUE_FAILED', queueErr.message);

  // 2. Redact plaintext PII in the linked DSR records and close them.
  const { data: finalized, error: finErr } = await admin.rpc('dsr_finalize_erased_requests', { p_tenant_id: null });
  if (finErr) return jsonError(500, 'FINALIZE_FAILED', finErr.message);

  const report = {
    ok: true,
    started_at,
    duration_ms: Date.now() - t0,
    erased_mappings: typeof erased === 'number' ? erased : 0,
    finalized_requests: typeof finalized === 'number' ? finalized : 0,
  };
  console.log(JSON.stringify({ level: 'info', scope: 'erasure_sweep', ...report }));
  return json(200, report);
});
