/**
 * memory-decay-worker — RFC-003 Decay-Loop (Cron)
 *
 * Cron-Schedule (pg_cron, stündlich):
 *   SELECT cron.schedule(
 *     'memory-decay-hourly',
 *     '0 * * * *',
 *     $$ SELECT net.http_post(
 *       url := current_setting('app.supabase_url') || '/functions/v1/memory-decay-worker',
 *       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
 *     ) $$
 *   );
 *
 * Was dieser Job tut:
 * 1. governance_memory_decay_tick() — alle Zustandsübergänge des RFC-003
 *    State-Machines (active→cooling→archived→expired→purged) in einer
 *    Transaktion; Holds blockieren, purge tilgt Inhalte (Tombstone).
 * 2. runtime_events: pro getilgtem Item ein 'memory.purged'-Event (T0,
 *    compliance-relevant) + ein Summary-Event pro Lauf.
 * 3. governance_memory_refresh_views() — Materialized Views aktualisieren.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const corsHeaders = buildCorsHeaders('POST, OPTIONS');

interface PurgedItem {
  id: string;
  tenant_id: string;
  classification: string;
  subject_ref: string | null;
}

interface DecayTickResult {
  cooled: number;
  archived: number;
  expired: number;
  purged: PurgedItem[];
}

// runtime_events-Insert ist best-effort: ein fehlgeschlagenes Event darf den
// Decay-Lauf nicht abbrechen (die Zustandsübergänge sind bereits committed).
async function emitEvent(args: {
  tenant_id: string;
  type: string;
  severity?: string;
  subject_ref?: string | null;
  payload: Record<string, unknown>;
  correlation_id?: string | null;
}): Promise<void> {
  try {
    const { error } = await admin.from('runtime_events').insert({
      tenant_id: args.tenant_id,
      type: args.type,
      severity: args.severity ?? 'info',
      source: 'memory-decay-worker',
      spec_version: '0.2',
      subject_ref: args.subject_ref ?? null,
      payload: args.payload,
      correlation_id: args.correlation_id ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.error(`[memory-decay-worker] runtime_events insert failed (${args.type}):`, err);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  // Nur Service-Role darf ticken — die RPCs sind ohnehin auf service_role
  // beschränkt, aber wir lehnen fremde Tokens früh und explizit ab.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return jsonResponse({ error: 'service role required' }, 401, corsHeaders);
  }

  const runId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const { data, error } = await admin.rpc('governance_memory_decay_tick');
    if (error) throw error;

    const result = data as DecayTickResult;
    const purged = result.purged ?? [];

    // T0-Event pro getilgtem Item — DSGVO Art. 5 (Speicherbegrenzung) braucht
    // den nachweisbaren Löschzeitpunkt je Item, nicht nur eine Summe.
    for (const item of purged) {
      await emitEvent({
        tenant_id: item.tenant_id,
        type: 'memory.purged',
        severity: 'notice',
        subject_ref: item.subject_ref,
        payload: {
          memory_id: item.id,
          classification: item.classification,
          run_id: runId,
        },
        correlation_id: runId,
      });
    }

    // Summary-Events pro betroffenem Tenant (purged) + globale Zähler im Log
    const tenants = [...new Set(purged.map((p) => p.tenant_id))];
    for (const tenantId of tenants) {
      await emitEvent({
        tenant_id: tenantId,
        type: 'memory.decay_run',
        payload: {
          run_id: runId,
          purged_count: purged.filter((p) => p.tenant_id === tenantId).length,
        },
        correlation_id: runId,
      });
    }

    const { error: refreshError } = await admin.rpc('governance_memory_refresh_views');
    if (refreshError) {
      // Views sind Performance-Cache, kein Korrektheitskriterium — loggen,
      // aber den Lauf als Erfolg werten.
      console.error('[memory-decay-worker] view refresh failed:', refreshError);
    }

    const summary = {
      run_id: runId,
      cooled: result.cooled,
      archived: result.archived,
      expired: result.expired,
      purged: purged.length,
      views_refreshed: !refreshError,
      duration_ms: Date.now() - startedAt,
    };
    console.log('[memory-decay-worker] tick complete', summary);
    return jsonResponse({ success: true, ...summary }, 200, corsHeaders);
  } catch (err) {
    console.error('[memory-decay-worker] tick failed:', err);
    return jsonResponse({ error: (err as Error).message, run_id: runId }, 500, corsHeaders);
  }
});
