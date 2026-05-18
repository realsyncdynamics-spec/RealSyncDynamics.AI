// governance-event — Ingest endpoint for the Governance Signal family.
//
// POST /functions/v1/governance-event
// Headers:
//   x-rsd-tenant-key: <tenant uuid>     (Pflicht — wie telemetry-ai-event in
//                                        dieser PR. Folge-PR ergaenzt API-Key-
//                                        Lookup + HMAC-Signing.)
//   content-type:    application/json
//
// Body: a typed governance event matching the schema in
//       supabase/functions/_shared/governanceEvent.ts (mirror of
//       src/core/runtime/governanceEvents.ts).
//
// Behaviour:
//   1. Validate auth header (tenant uuid) and JSON body shape.
//   2. Hash the inner `payload` deterministically (canonical JSON + SHA-256).
//   3. If the caller supplied `evidence.hash`, it MUST match the computed
//      hash — otherwise the caller and we disagree on what was sent.
//   4. Insert into `runtime_events` (append-only by migration).
//
// Out of scope here: rate limiting, HMAC request signing, idempotency
// keys, evidence-vault fan-out. These layer in later PRs.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildRuntimeEventRow,
  validateIngestPayload,
  type IngestPayload,
} from '../_shared/governanceEvent.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-rsd-tenant-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_METHOD', 'POST only');

  const tenantKey = req.headers.get('x-rsd-tenant-key');
  if (!tenantKey) return jsonError(401, 'UNAUTHORIZED', 'missing x-rsd-tenant-key');
  if (!UUID_RE.test(tenantKey))
    return jsonError(401, 'UNAUTHORIZED', 'invalid tenant key (expected uuid in this PR)');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_JSON', 'request body must be valid JSON');
  }

  const errors = validateIngestPayload(body, tenantKey);
  if (errors.length > 0) {
    return jsonError(
      400,
      'VALIDATION',
      errors.map((e) => `${e.path}: ${e.message}`).join(' · '),
    );
  }

  let row;
  let bodyHash;
  try {
    const built = await buildRuntimeEventRow(body as IngestPayload, tenantKey);
    row = built.row;
    bodyHash = built.bodyHash;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonError(400, 'HASH_MISMATCH', message);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from('runtime_events')
    .insert(row)
    .select('id, occurred_at')
    .single();

  if (error || !data) {
    return jsonError(500, 'INSERT_FAILED', error?.message ?? 'unknown insert error');
  }

  return new Response(
    JSON.stringify({
      ok: true,
      event_id: data.id,
      body_hash: bodyHash,
    }),
    { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } },
  );
});

function jsonError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ ok: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, 'content-type': 'application/json' } },
  );
}
