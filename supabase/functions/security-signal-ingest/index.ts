// Security Signal Integration Layer — Ingest API.
//
// POST /functions/v1/security-signal-ingest
// Header: x-rsd-api-key: <key>
// Content-Type: application/json
//
// Body: beliebiger Provider-Payload (blacklens, cloudflare, github, siem,
//       generic). Optional kann der Provider via `?provider=` oder im
//       Payload-Feld `provider` erzwungen werden; sonst wird er erraten.
//
// Flow:
//   1. API-Key (x-rsd-api-key) → sha256 → security_signal_sources lookup
//   2. normalizeSecuritySignal(provider, payload)
//   3. upsert security_signals  (tenant_id, provider, external_id)
//   4. mapSignalToGovernance(signal) → frameworks/controls/tasks/evidence
//   5. insert governance_risk_links (Control-Mapping, idempotent)
//   6. best-effort Governance-Chain: governance_event + governance_evidence
//      + governance_approval (Risk Review) für high/critical
//
// verify_jwt = false — Auth ist API-Key-basiert. Keine Secrets werden geloggt.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/hash.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  normalizeSecuritySignal,
  mapSignalToGovernance,
  type GovernanceMapping,
  type NormalizedSecuritySignal,
} from '../_shared/securitySignals.ts';

// x-rsd-api-key zusätzlich zu den Standard-Headern erlauben.
const CORS = {
  ...corsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-rsd-api-key',
};

// Begrenzung des Body vor dem Parsen (DoS-Schutz auf diesem Public-Webhook).
const MAX_BODY = 1_048_576; // 1 MB

Deno.serve(async (req) => {
  const preflight = handleOptions(req, CORS);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', CORS);

  const apiKey = req.headers.get('x-rsd-api-key')?.trim();
  if (!apiKey) return jsonError(401, 'UNAUTHORIZED', 'missing x-rsd-api-key header', CORS);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SRK) return jsonError(500, 'CONFIG', 'server not configured', CORS);
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // 1. API-Key auflösen (nur der Hash ist gespeichert).
  const keyHash = await sha256Hex(apiKey);
  const { data: source, error: srcErr } = await admin
    .from('security_signal_sources')
    .select('id, tenant_id, provider, status')
    .eq('api_key_hash', keyHash)
    .maybeSingle();
  if (srcErr) return jsonError(500, 'INTERNAL', srcErr.message, CORS);
  if (!source) return jsonError(401, 'UNAUTHORIZED', 'unknown api key', CORS);
  if (source.status !== 'active') return jsonError(403, 'SOURCE_INACTIVE', `source is ${source.status}`, CORS);

  // 2. Body lesen + normalisieren.
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY) return jsonError(413, 'BODY_TOO_LARGE', 'max 1 MB', CORS);
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json', CORS); }
  if (!payload || typeof payload !== 'object') {
    return jsonError(400, 'BAD_REQUEST', 'payload must be a JSON object', CORS);
  }

  const url = new URL(req.url);
  const providerHint = url.searchParams.get('provider') ?? source.provider ?? undefined;

  let signal: NormalizedSecuritySignal;
  let mapping: GovernanceMapping;
  try {
    signal = normalizeSecuritySignal(payload, providerHint);
    mapping = mapSignalToGovernance(signal);
  } catch (e) {
    return jsonError(422, 'NORMALIZE_FAILED', e instanceof Error ? e.message : 'normalize failed', CORS);
  }
  if (!signal.externalId || !signal.title) {
    return jsonError(422, 'INCOMPLETE_SIGNAL', 'could not derive external_id/title from payload', CORS);
  }

  const nowIso = new Date().toISOString();

  // 3. Upsert security_signals (tenant_id + provider + external_id).
  // Existierende Zeile wird per onConflict aktualisiert; first_seen_at bleibt
  // erhalten (wir setzen es nur, wenn der Payload ein Datum liefert — der
  // Upsert überschreibt es; daher unten der Read-before-write für first_seen).
  const { data: existing } = await admin
    .from('security_signals')
    .select('id, first_seen_at, status')
    .eq('tenant_id', source.tenant_id)
    .eq('provider', signal.provider)
    .eq('external_id', signal.externalId)
    .maybeSingle();

  const firstSeen = existing?.first_seen_at ?? signal.firstSeenAt ?? nowIso;
  const lastSeen = signal.lastSeenAt ?? nowIso;

  const signalRow = {
    tenant_id: source.tenant_id,
    source_id: source.id,
    provider: signal.provider,
    external_id: signal.externalId,
    event_type: signal.eventType,
    severity: signal.severity,
    title: signal.title,
    description: signal.description || null,
    asset_ref: signal.assetRef || null,
    raw_payload: signal.rawPayload,
    normalized_payload: { ...signal.normalizedPayload, governance: mapping },
    // Status bei bestehenden Signalen NICHT zurücksetzen (Nutzer kann
    // acknowledged/accepted gesetzt haben).
    status: existing?.status ?? 'open',
    first_seen_at: firstSeen,
    last_seen_at: lastSeen,
  };

  const { data: upserted, error: upErr } = await admin
    .from('security_signals')
    .upsert(signalRow, { onConflict: 'tenant_id,provider,external_id' })
    .select('id')
    .single();
  if (upErr) return jsonError(500, 'UPSERT_FAILED', upErr.message, CORS);

  const signalId = upserted.id as string;
  const createdOrUpdated = existing ? 'updated' : 'created';

  // 4./5. Control-Mapping persistieren (idempotent dank UNIQUE-Index).
  if (mapping.controls.length > 0) {
    const linkRows = mapping.controls.map((c) => ({
      tenant_id: source.tenant_id,
      signal_id: signalId,
      risk_id: null,
      framework: c.framework,
      control_ref: c.controlRef,
      mapping_reason: c.reason,
    }));
    const { error: linkErr } = await admin
      .from('governance_risk_links')
      .upsert(linkRows, { onConflict: 'signal_id,framework,control_ref', ignoreDuplicates: true });
    // Mapping-Fehler dürfen den Ingest nicht killen — best-effort, aber loggen
    // (ohne Secrets) als Teil der Response.
    if (linkErr) {
      return jsonResponse({
        ok: true,
        signal_id: signalId,
        risk_level: mapping.riskLevel,
        mapped_controls: [],
        created_or_updated: createdOrUpdated,
        warning: `control mapping skipped: ${linkErr.message}`,
      }, 200, CORS);
    }
  }

  // 6. Best-effort Governance-Chain (Event → Evidence → Approval/Task).
  //    Jeder Schritt ist isoliert gekapselt; Fehler beeinflussen den Ingest nicht.
  const governance = await buildGovernanceChain(admin, source.tenant_id, signal, mapping);

  // API-Key-Nutzung stempeln (best-effort).
  await admin.from('security_signal_sources')
    .update({ last_used_at: nowIso })
    .eq('id', source.id)
    .then(() => {}, () => {});

  return jsonResponse({
    ok: true,
    signal_id: signalId,
    risk_level: mapping.riskLevel,
    mapped_controls: mapping.controls.map((c) => `${c.framework}:${c.controlRef}`),
    created_or_updated: createdOrUpdated,
    governance,
  }, 200, CORS);
});

interface GovernanceChainResult {
  event_id: string | null;
  evidence_id: string | null;
  task_id: string | null;
}

// Erzeugt — sofern die Governance-Tabellen vorhanden sind — eine Event-/
// Evidence-/Approval-Spur. Bewusst best-effort: das Security-Signal-Layer
// ist auch ohne das vollständige Governance OS funktionsfähig.
async function buildGovernanceChain(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  signal: NormalizedSecuritySignal,
  mapping: GovernanceMapping,
): Promise<GovernanceChainResult> {
  const result: GovernanceChainResult = { event_id: null, evidence_id: null, task_id: null };

  try {
    // governance_events.event_source erlaubt u.a. 'api'; risk_level deckt sich.
    const { data: ev, error: evErr } = await admin
      .from('governance_events')
      .insert({
        tenant_id: tenantId,
        event_type: `security_signal.${signal.provider}`,
        event_source: 'api',
        title: signal.title.slice(0, 300),
        summary: (signal.description || signal.eventType).slice(0, 1000),
        risk_level: mapping.riskLevel,
        payload: {
          provider: signal.provider,
          external_id: signal.externalId,
          asset_ref: signal.assetRef,
          frameworks: mapping.frameworks,
          controls: mapping.controls,
        },
      })
      .select('id')
      .single();
    if (evErr || !ev) return result;
    result.event_id = ev.id;

    // Evidence-Snapshot (best-effort).
    const evidenceItem = mapping.evidenceItems[0];
    const { data: evi } = await admin
      .from('governance_evidence')
      .insert({
        tenant_id: tenantId,
        event_id: ev.id,
        evidence_type: 'json',
        title: evidenceItem?.title ?? 'Security Signal Snapshot',
        metadata: {
          provider: signal.provider,
          external_id: signal.externalId,
          severity: signal.severity,
          normalized: signal.normalizedPayload,
          mapping,
        },
      })
      .select('id')
      .maybeSingle();
    if (evi) result.evidence_id = evi.id;

    // Risk-Review-Task als Approval (nur high/critical) — UNIQUE(event_id).
    if (mapping.riskLevel === 'critical' || mapping.riskLevel === 'high') {
      const { data: appr } = await admin
        .from('governance_approvals')
        .insert({
          tenant_id: tenantId,
          event_id: ev.id,
          status: 'pending',
          requested_action: 'risk_review',
        })
        .select('id')
        .maybeSingle();
      if (appr) result.task_id = appr.id;
    }
  } catch {
    /* swallow — Governance-Chain ist optional */
  }

  return result;
}
