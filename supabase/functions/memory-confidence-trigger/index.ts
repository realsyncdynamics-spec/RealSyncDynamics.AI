/**
 * memory-confidence-trigger — RFC-003 §3.2 Confidence Decay bei neuer Evidence
 *
 * Wird von Evidence-Ingestion-Pfaden (governance-ingest, Evidence-Handler)
 * service-seitig aufgerufen, wenn ein evidence.created-Event einen
 * subject_ref oder eine correlation_id trägt, die bestehende Memory-Items
 * berühren könnte.
 *
 * POST { tenant_id, subject_ref?, correlation_id?, trigger_event_id? }
 *
 * Ablauf:
 * 1. governance_memory_confidence_reassess() — §3.2-Matrix in einer
 *    Transaktion (≥0.8 revalidate, 0.5–0.8 cooling+revalidate, <0.5 archive)
 * 2. Pro betroffenem Item ein memory.confidence_decayed-Event (T1) nach
 *    runtime_events, Payload gemäß RFC-003 §7 Event-Vertrag.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const corsHeaders = buildCorsHeaders('POST, OPTIONS');

interface AffectedItem {
  id: string;
  from_state: string;
  to_state: string;
  confidence: number;
  classification: string;
  subject_ref: string | null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', corsHeaders);
  }

  // Service-zu-Service-Endpoint: nur die Service-Role darf Confidence-Decay
  // auslösen — Clients erreichen Memory ausschließlich über governance-memory.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return jsonError(401, 'UNAUTHORIZED', 'service role required', corsHeaders);
  }

  let body: {
    tenant_id?: string;
    subject_ref?: string;
    correlation_id?: string;
    trigger_event_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid JSON body', corsHeaders);
  }

  if (!body.tenant_id || (!body.subject_ref && !body.correlation_id)) {
    return jsonError(400, 'BAD_REQUEST',
      'tenant_id and at least one of subject_ref/correlation_id are required', corsHeaders);
  }

  try {
    const { data, error } = await admin.rpc('governance_memory_confidence_reassess', {
      p_tenant_id: body.tenant_id,
      p_subject_ref: body.subject_ref ?? null,
      p_correlation_id: body.correlation_id ?? null,
      p_trigger_event_id: body.trigger_event_id ?? null,
    });
    if (error) throw error;

    const affected = (data?.affected ?? []) as AffectedItem[];

    // T1-Event pro Item — Payload-Vertrag RFC-003 §7. Best-effort: ein
    // fehlgeschlagenes Event macht die bereits committete Reassessment
    // nicht rückgängig.
    for (const item of affected) {
      const { error: evtErr } = await admin.from('runtime_events').insert({
        tenant_id: body.tenant_id,
        type: 'memory.confidence_decayed',
        severity: item.to_state === 'archived' ? 'medium' : 'low',
        source: 'memory-confidence-trigger',
        spec_version: '0.2',
        subject_ref: item.subject_ref,
        payload: {
          memory_id: item.id,
          classification: item.classification,
          subject_ref: item.subject_ref,
          from_state: item.from_state,
          to_state: item.to_state,
          trigger: 'confidence',
          trigger_event_id: body.trigger_event_id ?? null,
        },
        correlation_id: body.correlation_id ?? null,
        causation_id: body.trigger_event_id ?? null,
      });
      if (evtErr) {
        console.error('[memory-confidence-trigger] runtime_events insert failed:', evtErr);
      }
    }

    return jsonResponse({
      success: true,
      affected_count: affected.length,
      affected,
    }, 200, corsHeaders);
  } catch (err) {
    console.error('[memory-confidence-trigger] reassess failed:', err);
    return jsonError(500, 'INTERNAL', (err as Error).message, corsHeaders);
  }
});
