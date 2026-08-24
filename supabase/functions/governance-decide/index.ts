// governance-decide — synchroner Policy Decision Point (PDP v2, Plan P0-3).
//
// Vertrag: POST mit DecisionRequest (contract v1, siehe _shared/pdp/core.ts),
// Antwort DecisionResult. Externe PEPs (SDK-Preflight, CI-Gates, eigene
// Services) rufen VOR der Aktion hier an und setzen das Verdikt durch;
// interne Edge-Function-PEPs importieren decide() direkt (kein HTTP-Hop).
//
// Auth: API-Key-basiert wie governance-ingest (rsd_gov_-Prefix, SHA-256-Hash
// gegen governance_ingest_keys) — verify_jwt ist false, externe Aufrufer
// haben kein Supabase-JWT. tenant_id kommt AUSSCHLIESSLICH aus dem Key,
// nie aus dem Body (Cross-Tenant-Guard).
//
// Governance-Zweck / EU-AI-Act Art. 12+14, DSGVO Art. 32: Jede Entscheidung
// ungleich allow/log_only erzeugt einen Evidence-Eintrag in
// ai_evidence_events — der Pruefpfad entsteht am Entscheidungspunkt selbst,
// nicht erst beim nachgelagerten Reporting.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/hash.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { decide } from '../_shared/pdp/decide.ts';
import type { DecisionRequest } from '../_shared/pdp/core.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only', corsHeaders);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token', corsHeaders);
  }
  const token = auth.slice('Bearer '.length).trim();
  if (!token.startsWith('rsd_gov_')) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token prefix', corsHeaders);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const tokenHash = await sha256Hex(token);
  const { data: keyRow, error: keyErr } = await admin
    .from('governance_ingest_keys')
    .select('id, tenant_id, allowed_sources, revoked_at')
    .eq('key_hash', tokenHash)
    .maybeSingle();
  if (keyErr) return jsonError(500, 'INTERNAL', keyErr.message, corsHeaders);
  if (!keyRow) return jsonError(401, 'UNAUTHORIZED', 'unknown token', corsHeaders);
  if (keyRow.revoked_at) return jsonError(401, 'UNAUTHORIZED', 'token revoked', corsHeaders);

  // Body-Grenze vor dem Parsen (derselbe DoS-Schutz wie governance-ingest)
  const rawBody = await req.text();
  if (rawBody.length > 65_536) return jsonError(413, 'BODY_TOO_LARGE', 'max 64 KB', corsHeaders);
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
  }

  if (body.contract !== 'v1') {
    return jsonError(400, 'BAD_REQUEST', "contract must be 'v1'", corsHeaders);
  }
  const action = body.action as Record<string, unknown> | undefined;
  if (!action || !isNonEmptyString(action.verb) || !isNonEmptyString(action.channel)) {
    return jsonError(400, 'BAD_REQUEST', 'action.verb and action.channel are required', corsHeaders);
  }

  // allowed_sources des Keys begrenzt die Kanaele, fuer die er entscheiden
  // darf — gleiche Semantik wie event_source beim Ingest.
  const allowedSources = (keyRow.allowed_sources ?? []) as string[];
  if (allowedSources.length > 0 && !allowedSources.includes(action.channel as string)) {
    return jsonError(403, 'FORBIDDEN', `channel '${action.channel}' not in allowed_sources`, corsHeaders);
  }

  // tenant_id im Body wird ignoriert — der Key bestimmt den Tenant.
  const request: DecisionRequest = {
    ...(body as unknown as DecisionRequest),
    contract: 'v1',
    tenant_id: keyRow.tenant_id,
  };

  try {
    const result = await decide(admin, request);

    // Evidence am Entscheidungspunkt: alles, was einschraenkt, ist belegbar.
    let evidenceId: string | null = null;
    if (result.decision !== 'allow' && result.decision !== 'log_only') {
      const { data: ev } = await admin
        .from('ai_evidence_events')
        .insert({
          tenant_id: keyRow.tenant_id,
          policy_id: result.primary_policy_id,
          event_type: 'pdp:decision',
          event_summary: result.reasons[0]?.text_de
            ?? `PDP-Entscheidung: ${result.decision} (${request.action.channel})`,
          risk_level: result.decision === 'block' ? 'high' : 'medium',
          evidence: {
            decision: result.decision,
            channel: request.action.channel,
            verb: request.action.verb,
            matched_policy_ids: result.matched_policy_ids,
            snapshot_version: result.snapshot_version,
            request_id: request.context?.request_id ?? null,
          },
        })
        .select('id')
        .maybeSingle();
      evidenceId = ev?.id ?? null;
    }

    return jsonResponse({ ok: true, ...result, evidence_id: evidenceId }, 200, corsHeaders);
  } catch (e) {
    // Kein stilles Verdikt bei Engine-Fehler: Der PEP entscheidet anhand
    // seines lokalen Snapshots/Ausfallverhaltens (Plan K3), nicht wir hier.
    console.error('[governance-decide] engine error', e);
    return jsonError(500, 'ENGINE_UNAVAILABLE',
      'policy engine unavailable — apply per-policy fail mode', corsHeaders);
  }
});
