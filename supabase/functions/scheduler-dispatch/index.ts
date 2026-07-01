// scheduler-dispatch — von pg_cron (alle 15 Min) aufgerufen.
//
// Führt fällige scan_schedules aus:
//   1. fällige Zeitpläne holen (scan_schedules_due)
//   2. pro Zeitplan einen bulk_scan-Batch + Items anlegen (Wiederverwendung
//      der Bulk-Jobs-Queue)
//   3. next_run_at fortschreiben (identisch zu src/lib/scheduler/nextRun) +
//      last_run_at setzen
//   4. optional benachrichtigen: governance_webhooks (Slack/Teams/Generic)
//
// Auth: Bearer == SERVICE_ROLE_KEY (Cron-Aufruf). verify_jwt bleibt an —
// der Service-Role-Key ist ein gültiges JWT; zusätzlich prüfen wir explizit.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { detectFormat, formatPayload, type WebhookEnvelope } from '../_shared/webhookFormat.ts';

type Frequency = 'daily' | 'weekly' | 'monthly';
interface Schedule {
  id: string; tenant_id: string; label: string | null; domains: string[];
  frequency: Frequency; hour: number; minute: number; weekday: number | null; day_of_month: number | null;
  notify: { email?: string; webhook_id?: string } | null;
  created_by: string | null;
}

function computeNextRun(s: Schedule, fromMs: number): string {
  const base = new Date(fromMs);
  const utc = (h: number, m: number) => Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0, 0);
  const addDays = (ms: number, d: number) => ms + d * 86400000;
  if (s.frequency === 'daily') { let n = utc(s.hour, s.minute); if (n <= fromMs) n = addDays(n, 1); return new Date(n).toISOString(); }
  if (s.frequency === 'weekly') {
    let n = utc(s.hour, s.minute);
    const delta = ((s.weekday ?? 0) - new Date(n).getUTCDay() + 7) % 7;
    n = addDays(n, delta); if (n <= fromMs) n = addDays(n, 7); return new Date(n).toISOString();
  }
  const dom = s.day_of_month ?? 1;
  let y = base.getUTCFullYear(); let mo = base.getUTCMonth();
  let n = Date.UTC(y, mo, dom, s.hour, s.minute, 0, 0);
  if (n <= fromMs) { mo += 1; if (mo > 11) { mo = 0; y += 1; } n = Date.UTC(y, mo, dom, s.hour, s.minute, 0, 0); }
  return new Date(n).toISOString();
}

async function notifyWebhook(admin: ReturnType<typeof createClient>, sched: Schedule, batchId: string, count: number) {
  const webhookId = sched.notify?.webhook_id;
  if (!webhookId) return;
  const { data: wh } = await admin
    .from('governance_webhooks').select('target_url, enabled, revoked_at')
    .eq('id', webhookId).eq('tenant_id', sched.tenant_id).maybeSingle<{ target_url: string; enabled: boolean; revoked_at: string | null }>();
  if (!wh || !wh.enabled || wh.revoked_at) return;

  const env: WebhookEnvelope = {
    event_id: batchId,
    tenant_id: sched.tenant_id,
    event: {
      event_type: 'scheduled_scan.started',
      event_source: 'scheduler',
      title: `Geplanter Scan gestartet${sched.label ? `: ${sched.label}` : ''}`,
      summary: `${count} Domains eingereiht (${sched.frequency}).`,
      risk_level: 'info',
      payload: { batch_id: batchId, domains: count },
    },
    decision: null,
  };
  try {
    const fmt = detectFormat(wh.target_url);
    await fetch(wh.target_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: formatPayload(env, fmt) });
    await admin.from('governance_webhooks').update({ last_called_at: new Date().toISOString(), last_status: 'ok' }).eq('id', webhookId);
  } catch (e) {
    await admin.from('governance_webhooks').update({ last_status: 'error', last_error: String((e as Error)?.message ?? e).slice(0, 300) }).eq('id', webhookId);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SERVICE_ROLE}`) return jsonError(401, 'UNAUTHORIZED', 'cron only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: due, error } = await admin.rpc('scan_schedules_due', { p_limit: 100 });
  if (error) return jsonError(500, 'INTERNAL', 'could not load due schedules');
  const schedules = (due ?? []) as Schedule[];

  let dispatched = 0;
  for (const sched of schedules) {
    try {
      const domains = Array.isArray(sched.domains) ? sched.domains : [];
      if (domains.length > 0) {
        const { data: batch } = await admin
          .from('bulk_scan_batches')
          .insert({ tenant_id: sched.tenant_id, label: `⏱ ${sched.label ?? 'Geplanter Scan'}`, status: 'queued', priority: 0, total_count: domains.length, created_by: sched.created_by ?? null })
          .select('id').single();
        if (batch) {
          await admin.from('bulk_scan_items').insert(
            domains.map((domain) => ({ batch_id: batch.id, tenant_id: sched.tenant_id, domain, status: 'queued', priority: 0, created_at: nowIso })),
          );
          await notifyWebhook(admin, sched, batch.id, domains.length);
        }
      }
      await admin.from('scan_schedules')
        .update({ next_run_at: computeNextRun(sched, nowMs), last_run_at: nowIso, updated_at: nowIso })
        .eq('id', sched.id);
      dispatched++;
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', scope: 'scheduler_dispatch_item', schedule_id: sched.id, error: (e as Error)?.message ?? String(e) }));
    }
  }

  return jsonResponse({ ok: true, dispatched, considered: schedules.length });
});
