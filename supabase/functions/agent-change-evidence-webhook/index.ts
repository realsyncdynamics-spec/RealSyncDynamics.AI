// POST /functions/v1/agent-change-evidence-webhook
//
// GitHub webhook for push + pull_request → one evidence row per delivery.
// Record-only (decision=recorded). Never blocks deploys.
//
// Auth: X-Hub-Signature-256 (HMAC-SHA256) with env GITHUB_WEBHOOK_SECRET.
// Tenant: lookup github_repo_tenant_bindings by repository.full_name —
//   never from URL / query / payload tenant fields.
// Idempotency: UNIQUE(delivery_id) on X-GitHub-Delivery.
//
// verify_jwt = false (external GitHub callers have no Supabase JWT).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  buildEvidenceRow,
  extractChangeSet,
  isUniqueViolation,
  readBodyLimited,
  verifyGithubSignature,
} from '../_shared/agentChangeEvidence/githubWebhook.ts';

const MAX_BODY = 2_097_152; // 2 MB
const CORS = {
  ...corsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery',
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req, CORS);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', CORS);

  const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET')?.trim() ?? '';
  if (!secret) {
    return jsonError(503, 'CONFIG', 'GITHUB_WEBHOOK_SECRET not configured', CORS);
  }

  // Grenze in Bytes, beim Lesen durchgesetzt — nicht erst nach req.text().
  const rawBody = await readBodyLimited(req.body, req.headers.get('content-length'), MAX_BODY);
  if (rawBody === null) {
    return jsonError(413, 'BODY_TOO_LARGE', 'max 2 MB', CORS);
  }

  const signature = req.headers.get('x-hub-signature-256');
  const ok = await verifyGithubSignature(rawBody, signature, secret);
  if (!ok) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid or missing X-Hub-Signature-256', CORS);
  }

  const eventName = (req.headers.get('x-github-event') ?? '').trim().toLowerCase();
  const deliveryId = (req.headers.get('x-github-delivery') ?? '').trim();
  if (!deliveryId) {
    return jsonError(400, 'BAD_REQUEST', 'missing X-GitHub-Delivery', CORS);
  }

  // Ignore other events after signature verification (ack without writing).
  if (eventName !== 'push' && eventName !== 'pull_request') {
    return jsonResponse({ ok: true, ignored: true, event: eventName || null }, 200, CORS);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', CORS);
  }

  const change = extractChangeSet(eventName, payload);
  if (!change) {
    return jsonError(422, 'INCOMPLETE', 'could not extract repo/change from payload', CORS);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SRK) {
    return jsonError(500, 'CONFIG', 'server not configured', CORS);
  }
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Tenant from server-side binding only — not URL/query/body tenant_id.
  const { data: binding, error: bindErr } = await admin
    .from('github_repo_tenant_bindings')
    .select('tenant_id, status')
    .eq('repo_full_name', change.repo)
    .maybeSingle();

  if (bindErr) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'agent_change_evidence_binding',
      msg: bindErr.message,
    }));
    return jsonError(500, 'INTERNAL', 'binding lookup failed', CORS);
  }
  if (!binding || binding.status !== 'active') {
    // Known delivery, unknown/inactive repo — ack so GitHub does not retry forever.
    return jsonResponse({
      ok: true,
      recorded: false,
      reason: 'no_active_repo_binding',
      repo: change.repo,
    }, 200, CORS);
  }

  let prNumber: number | null = null;
  if (change.event === 'pull_request' && payload && typeof payload === 'object') {
    const pr = (payload as { pull_request?: { number?: unknown } }).pull_request;
    if (pr && typeof pr.number === 'number') prNumber = pr.number;
  }

  const row = await buildEvidenceRow({
    tenantId: binding.tenant_id,
    deliveryId,
    change,
    prNumber,
  });

  const { error: insertErr } = await admin.from('agent_change_evidence').insert(row);
  if (insertErr) {
    if (isUniqueViolation(insertErr)) {
      return jsonResponse({
        ok: true,
        recorded: false,
        duplicate: true,
        delivery_id: deliveryId,
      }, 200, CORS);
    }
    console.error(JSON.stringify({
      level: 'error',
      scope: 'agent_change_evidence_insert',
      msg: insertErr.message,
      code: (insertErr as { code?: string }).code,
    }));
    return jsonError(500, 'INTERNAL', 'insert failed', CORS);
  }

  return jsonResponse({
    ok: true,
    recorded: true,
    delivery_id: deliveryId,
    risk_level: row.risk_level,
    decision: row.decision,
    hit_classes: row.payload_ref.hit_classes,
  }, 200, CORS);
});
