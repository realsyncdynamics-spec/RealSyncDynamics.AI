/**
 * browser-execution-sweep — schließt hängende Browser-Ausführungen ab.
 *
 * Logik und Begründung: ./logic.ts. Tests: test/edge/browser-execution-sweep.test.ts.
 *
 * Auth: Bearer == CRON_BROWSER_SWEEP_KEY (Function Secret; Fallback Vault
 * `cron_browser_sweep_key` über _shared/cronKey.ts). Fail-closed: kein Key →
 * 500 CRON_KEY_MISSING, falscher/fehlender Bearer → 401 „cron only“.
 * verify_jwt = false (config.toml), weil ein Cron-Key kein JWT ist.
 *
 * Nicht aktiviert. Zum Einschalten (Einzelfreigabe, eigene Migration):
 *   1. Vault-Eintrag `cron_browser_sweep_key` anlegen.
 *   2. SELECT cron.schedule('browser-execution-sweep', '*\/10 * * * *',
 *        $$ SELECT public.dispatch_cron_function('browser-execution-sweep',
 *             'cron_browser_sweep_key', jsonb_build_object('trigger','cron')) $$);
 *   Ohne Zeitplan läuft der Job nur bei manuellem Aufruf mit dem Key.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireCronKey } from '../_shared/cronKey.ts';
import { jsonError, jsonResponse } from '../_shared/gateway.ts';
import { sweepBrowserExecutions, type SweepRepo } from './logic.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');
  const denied = await requireCronKey(req, 'CRON_BROWSER_SWEEP_KEY', 'cron_browser_sweep_key');
  if (denied) return denied;

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !srk) return jsonError(500, 'CONFIG_MISSING', 'supabase env missing');
  const admin = createClient(url, srk, { auth: { persistSession: false } });

  const repo: SweepRepo = {
    async listStale(cutoffIso, limit) {
      const { data, error } = await admin
        .from('browser_executions')
        .select('id, tenant_id, approval_id, detail, reserved_at')
        .eq('status', 'reserved')
        .lt('reserved_at', cutoffIso)
        .order('reserved_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(`browser_executions: ${error.message}`);
      return data ?? [];
    },
    async hasEvent(tenantId, executionId, eventType) {
      const { data, error } = await admin
        .from('governance_events')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('event_type', eventType)
        .eq('payload->>browser_execution_id', executionId)
        .limit(1);
      if (error) throw new Error(`governance_events: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async finish(executionId, status, detail) {
      const { data, error } = await admin.rpc('finish_browser_execution', {
        p_execution_id: executionId,
        p_status: status,
        p_detail: detail,
      });
      if (error) throw new Error(`finish_browser_execution: ${error.message}`);
      return data === true;
    },
    async insertEvent(event) {
      const { error } = await admin.from('governance_events').insert(event);
      if (error) throw new Error(`governance_events insert: ${error.message}`);
    },
  };

  try {
    const summary = await sweepBrowserExecutions(repo, Date.now());
    console.log(JSON.stringify({ level: 'info', scope: 'browser_execution_sweep', ...summary }));
    return jsonResponse({ ok: true, ...summary });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'browser_execution_sweep', error: String((e as Error)?.message ?? e) }));
    return jsonError(500, 'SWEEP_FAILED', 'sweep could not list executions; nothing was changed');
  }
});
