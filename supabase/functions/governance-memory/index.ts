/**
 * governance-memory — RFC-003 Memory Read/Write/Query API
 *
 * Aktionen (POST, { action, ... }):
 *   write     — neues Memory-Item anlegen (Hard-Regeln §2 werden geprüft)
 *   read      — Item per id lesen; effective_freshness wird mitberechnet,
 *               last_accessed_at/access_count werden fortgeschrieben
 *   query     — Items filtern (classification, state, key-Präfix); purged
 *               ist standardmäßig ausgeschlossen
 *   supersede — Re-Klassifikation/Korrektur: neue Zeile mit supersedes_id,
 *               alte Zeile wird archiviert (UPDATE des Inhalts ist verboten)
 *   set_hold  — regulatory_hold / incident_hold setzen oder lösen
 *
 * Tenant-Isolation: alle Lese-/Schreibzugriffe laufen über den User-JWT,
 * RLS (tenant_id = auth.uid()) erzwingt die Trennung. Service-Role wird nur
 * für den Prüfpfad (runtime_events) und Access-Counter genutzt.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const corsHeaders = buildCorsHeaders('POST, OPTIONS');

type Classification = 'fact' | 'inference' | 'correlation' | 'risk_signal';

interface WritePayload {
  classification: Classification;
  key: string;
  value: unknown;
  pii_class?: 'public' | 'eu_resident' | 'sensitive';
  evidence_refs?: string[];
  derived_from?: string[];
  retention_class?: string;
  confidence?: number;
  relevance?: number;
  subject_ref?: string | null;
  correlation_id?: string | null;
  computation_id?: string | null;
  tags?: string[];
  supersedes_id?: string | null;
}

/**
 * Hard-Regeln RFC-003 §2 — Spiegel von validateMemoryOnInsert()
 * (src/core/governance/rfc003-memory.ts). Die DB-Constraints prüfen dasselbe;
 * hier liefern wir dem Client eine verständliche Fehlermeldung statt eines
 * CHECK-Violation-Textes.
 */
function validateWrite(p: WritePayload): string | null {
  if (!p.classification || !p.key) return 'classification and key are required';
  if (p.classification === 'fact' && (!p.evidence_refs || p.evidence_refs.length === 0)) {
    return 'Fact must have at least one evidence_ref (RFC-003 §2.1)';
  }
  if (p.classification === 'risk_signal' && !p.computation_id) {
    return 'Risk Signal must have computation_id (RFC-003 §2.4)';
  }
  if (
    (p.classification === 'inference' || p.classification === 'correlation') &&
    (!p.derived_from || p.derived_from.length === 0)
  ) {
    return `${p.classification} must reference source items via derived_from`;
  }
  if (p.classification === 'correlation' && (!p.evidence_refs || p.evidence_refs.length < 2)) {
    return 'Correlation must reference at least two evidence_refs';
  }
  return null;
}

/** freshness = exp(-age_days / half_life_days); Facts decayen nicht. */
function effectiveFreshness(row: {
  classification: string;
  created_at: string;
  freshness_half_life: string | null;
}): number {
  if (row.classification === 'fact') return 1.0;
  const ageDays = (Date.now() - new Date(row.created_at).getTime()) / 86_400_000;
  const halfLifeDays = parseIntervalDays(row.freshness_half_life) ?? 30;
  return Math.exp(-ageDays / halfLifeDays);
}

/** Postgres-INTERVAL ('30 days', '90 days 00:00:00') → Tage. */
function parseIntervalDays(interval: string | null): number | null {
  if (!interval) return null;
  const m = interval.match(/(\d+)\s*day/);
  if (m) return Number(m[1]);
  const hours = interval.match(/(\d+):(\d+):(\d+)/);
  if (hours) return Number(hours[1]) / 24;
  return null;
}

async function emitEvent(args: {
  tenant_id: string;
  type: string;
  subject_ref?: string | null;
  payload: Record<string, unknown>;
  correlation_id?: string | null;
}): Promise<void> {
  try {
    const { error } = await admin.from('runtime_events').insert({
      tenant_id: args.tenant_id,
      type: args.type,
      severity: 'info',
      source: 'governance-memory',
      spec_version: '0.2',
      subject_ref: args.subject_ref ?? null,
      payload: args.payload,
      correlation_id: args.correlation_id ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.error(`[governance-memory] runtime_events insert failed (${args.type}):`, err);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', corsHeaders);
  }

  const auth = req.headers.get('Authorization');
  if (!auth) return jsonError(401, 'UNAUTHORIZED', 'missing Authorization header', corsHeaders);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token', corsHeaders);
  }
  const tenantId = userResp.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid JSON body', corsHeaders);
  }
  const action = body.action as string;

  try {
    switch (action) {
      case 'write': {
        const payload = body.item as WritePayload;
        if (!payload) return jsonError(400, 'BAD_REQUEST', 'item is required', corsHeaders);
        const validationError = validateWrite(payload);
        if (validationError) {
          return jsonError(422, 'VALIDATION_FAILED', validationError, corsHeaders);
        }

        const { data, error } = await userClient
          .from('governance_memory')
          .insert({
            tenant_id: tenantId,
            classification: payload.classification,
            key: payload.key,
            value: payload.value ?? {},
            pii_class: payload.pii_class ?? 'public',
            evidence_refs: payload.evidence_refs ?? [],
            derived_from: payload.derived_from ?? [],
            retention_class: payload.retention_class ?? '1y',
            confidence: payload.confidence ?? 1.0,
            relevance: payload.relevance ?? 1.0,
            subject_ref: payload.subject_ref ?? null,
            correlation_id: payload.correlation_id ?? null,
            computation_id: payload.computation_id ?? null,
            tags: payload.tags ?? [],
            supersedes_id: payload.supersedes_id ?? null,
            created_by: userResp.user.email ?? tenantId,
          })
          .select()
          .single();
        if (error) throw error;

        await emitEvent({
          tenant_id: tenantId,
          type: 'memory.created',
          subject_ref: data.subject_ref,
          payload: { memory_id: data.id, classification: data.classification, key: data.key },
          correlation_id: data.correlation_id,
        });
        return jsonResponse({ success: true, item: data }, 201, corsHeaders);
      }

      case 'read': {
        const id = body.id as string;
        if (!id) return jsonError(400, 'BAD_REQUEST', 'id is required', corsHeaders);

        const { data, error } = await userClient
          .from('governance_memory')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;

        // Access-Tracking läuft über Service-Role: Inhalts-UPDATEs sind für
        // Clients verboten, der Zähler ist reine Betriebsstatistik.
        await admin
          .from('governance_memory')
          .update({
            last_accessed_at: new Date().toISOString(),
            access_count: (data.access_count ?? 0) + 1,
          })
          .eq('id', id);

        return jsonResponse(
          { success: true, item: { ...data, effective_freshness: effectiveFreshness(data) } },
          200,
          corsHeaders,
        );
      }

      case 'query': {
        let q = userClient.from('governance_memory').select('*');
        if (body.classification) q = q.eq('classification', body.classification as string);
        if (body.state) q = q.eq('state', body.state as string);
        else q = q.neq('state', 'purged');
        if (body.key_prefix) q = q.like('key', `${body.key_prefix as string}%`);
        if (body.subject_ref) q = q.eq('subject_ref', body.subject_ref as string);
        q = q.order('state_transitioned_at', { ascending: false })
          .limit(Math.min(Number(body.limit ?? 50), 200));

        const { data, error } = await q;
        if (error) throw error;

        const items = (data ?? []).map((row) => ({
          ...row,
          effective_freshness: effectiveFreshness(row),
        }));
        return jsonResponse({ success: true, items, count: items.length }, 200, corsHeaders);
      }

      case 'supersede': {
        const id = body.id as string;
        const payload = body.item as WritePayload;
        if (!id || !payload) {
          return jsonError(400, 'BAD_REQUEST', 'id and item are required', corsHeaders);
        }

        const { data: oldItem, error: oldErr } = await userClient
          .from('governance_memory')
          .select('*')
          .eq('id', id)
          .single();
        if (oldErr) throw oldErr;
        if (oldItem.state === 'purged') {
          return jsonError(409, 'CONFLICT', 'purged items cannot be superseded', corsHeaders);
        }

        const validationError = validateWrite(payload);
        if (validationError) {
          return jsonError(422, 'VALIDATION_FAILED', validationError, corsHeaders);
        }

        const { data: newItem, error: insErr } = await userClient
          .from('governance_memory')
          .insert({
            tenant_id: tenantId,
            classification: payload.classification,
            key: payload.key ?? oldItem.key,
            value: payload.value ?? {},
            pii_class: payload.pii_class ?? oldItem.pii_class,
            evidence_refs: payload.evidence_refs ?? [],
            derived_from: payload.derived_from ?? [],
            retention_class: payload.retention_class ?? oldItem.retention_class,
            confidence: payload.confidence ?? 1.0,
            relevance: payload.relevance ?? 1.0,
            subject_ref: payload.subject_ref ?? oldItem.subject_ref,
            correlation_id: payload.correlation_id ?? oldItem.correlation_id,
            computation_id: payload.computation_id ?? null,
            tags: payload.tags ?? oldItem.tags,
            supersedes_id: id,
            created_by: userResp.user.email ?? tenantId,
          })
          .select()
          .single();
        if (insErr) throw insErr;

        // Alte Zeile aus dem aktiven Bestand nehmen — Holds respektieren.
        if (!oldItem.regulatory_hold && !oldItem.incident_hold && oldItem.state !== 'archived') {
          await admin
            .from('governance_memory')
            .update({ state: 'archived', state_transitioned_at: new Date().toISOString() })
            .eq('id', id);
        }

        await emitEvent({
          tenant_id: tenantId,
          type: 'memory.superseded',
          subject_ref: newItem.subject_ref,
          payload: { memory_id: newItem.id, supersedes_id: id },
          correlation_id: newItem.correlation_id,
        });
        return jsonResponse({ success: true, item: newItem, superseded_id: id }, 201, corsHeaders);
      }

      case 'set_hold': {
        const id = body.id as string;
        const holdType = body.hold_type as 'regulatory_hold' | 'incident_hold';
        const holdValue = body.value as boolean;
        if (!id || !['regulatory_hold', 'incident_hold'].includes(holdType) || typeof holdValue !== 'boolean') {
          return jsonError(400, 'BAD_REQUEST',
            'id, hold_type (regulatory_hold|incident_hold) and value (boolean) are required', corsHeaders);
        }

        // Ownership über RLS-gescoptes SELECT prüfen, dann Hold via Service-Role
        // setzen (Client-UPDATEs auf Inhaltszeilen bleiben gesperrt).
        const { data: item, error: selErr } = await userClient
          .from('governance_memory')
          .select('id, tenant_id, subject_ref')
          .eq('id', id)
          .single();
        if (selErr) throw selErr;

        const { error: updErr } = await admin
          .from('governance_memory')
          .update({ [holdType]: holdValue })
          .eq('id', id);
        if (updErr) throw updErr;

        await emitEvent({
          tenant_id: tenantId,
          type: holdValue ? 'memory.hold_set' : 'memory.hold_released',
          subject_ref: item.subject_ref,
          payload: { memory_id: id, hold_type: holdType },
        });
        return jsonResponse({ success: true, id, [holdType]: holdValue }, 200, corsHeaders);
      }

      default:
        return jsonError(400, 'BAD_REQUEST',
          `unknown action '${action}' (expected write|read|query|supersede|set_hold)`, corsHeaders);
    }
  } catch (err) {
    console.error(`[governance-memory] ${action} failed:`, err);
    return jsonError(500, 'INTERNAL', (err as Error).message, corsHeaders);
  }
});
