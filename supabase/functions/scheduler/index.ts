// scheduler — Verwaltung benutzerdefinierter, wiederkehrender Scans pro Tenant.
//
// POST /functions/v1/scheduler
// Auth: Authorization: Bearer <user JWT>
// Body:
//   { op: 'create', tenant_id, label?, domains: string[], frequency, hour, minute,
//     weekday?, day_of_month?, notify? }
//   { op: 'update', tenant_id, id, ...felder }
//   { op: 'pause'|'resume'|'delete', tenant_id, id }
//
// Gate: scheduler.enabled (ab Agency). next_run_at wird aus der Spec berechnet
// (identisch zu src/lib/scheduler/nextRun). Listen liest das Frontend RLS-sicher
// direkt (PostgREST). Ausführung übernimmt scheduler-dispatch (pg_cron).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { audit } from '../_shared/auditLog.ts';

type Frequency = 'daily' | 'weekly' | 'monthly';

// ── next-run (identisch zu src/lib/scheduler/nextRun.ts) ─────────────────────
interface Spec { frequency: Frequency; hour: number; minute: number; weekday?: number; dayOfMonth?: number }
function validate(s: Spec): string | null {
  if (!['daily', 'weekly', 'monthly'].includes(s.frequency)) return 'ungültige Frequenz';
  if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return 'Stunde 0–23';
  if (!Number.isInteger(s.minute) || s.minute < 0 || s.minute > 59) return 'Minute 0–59';
  if (s.frequency === 'weekly' && (!Number.isInteger(s.weekday) || s.weekday! < 0 || s.weekday! > 6)) return 'Wochentag 0–6';
  if (s.frequency === 'monthly' && (!Number.isInteger(s.dayOfMonth) || s.dayOfMonth! < 1 || s.dayOfMonth! > 28)) return 'Tag 1–28';
  return null;
}
function computeNextRun(s: Spec, fromMs: number): string {
  const base = new Date(fromMs);
  const utc = (h: number, m: number) => Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0, 0);
  const addDays = (ms: number, d: number) => ms + d * 86400000;
  if (s.frequency === 'daily') {
    let n = utc(s.hour, s.minute); if (n <= fromMs) n = addDays(n, 1); return new Date(n).toISOString();
  }
  if (s.frequency === 'weekly') {
    let n = utc(s.hour, s.minute);
    const delta = ((s.weekday ?? 0) - new Date(n).getUTCDay() + 7) % 7;
    n = addDays(n, delta); if (n <= fromMs) n = addDays(n, 7); return new Date(n).toISOString();
  }
  const dom = s.dayOfMonth ?? 1;
  let y = base.getUTCFullYear(); let mo = base.getUTCMonth();
  let n = Date.UTC(y, mo, dom, s.hour, s.minute, 0, 0);
  if (n <= fromMs) { mo += 1; if (mo > 11) { mo = 0; y += 1; } n = Date.UTC(y, mo, dom, s.hour, s.minute, 0, 0); }
  return new Date(n).toISOString();
}

function normalizeDomain(raw: string): string | null {
  const s = (raw ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/[^a-z0-9.\-]/g, '');
  if (!s || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null;
  return s;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '');
  if (!['create', 'update', 'pause', 'resume', 'delete'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'invalid op');
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    await gateFeature(admin, tenantId, 'scheduler.enabled');
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(402, 'PAYMENT_REQUIRED', 'Scheduler ist erst ab Agency verfügbar.');
    return jsonError(500, 'INTERNAL', 'entitlement check failed');
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  try {
    if (op === 'create' || op === 'update') {
      const spec: Spec = {
        frequency: body.frequency as Frequency,
        hour: Number(body.hour), minute: Number(body.minute),
        weekday: body.weekday === undefined || body.weekday === null ? undefined : Number(body.weekday),
        dayOfMonth: body.day_of_month === undefined || body.day_of_month === null ? undefined : Number(body.day_of_month),
      };
      const verr = validate(spec);
      if (verr) return jsonError(400, 'BAD_REQUEST', verr);

      const domains = Array.isArray(body.domains)
        ? [...new Set((body.domains as unknown[]).map((d) => normalizeDomain(String(d))).filter((d): d is string => !!d))]
        : [];
      if (op === 'create' && domains.length === 0) return jsonError(400, 'BAD_REQUEST', 'mindestens eine gültige Domain nötig');

      const nextRun = computeNextRun(spec, nowMs);
      const row: Record<string, unknown> = {
        tenant_id: tenantId,
        label: typeof body.label === 'string' ? body.label.trim().slice(0, 200) || null : null,
        frequency: spec.frequency, hour: spec.hour, minute: spec.minute,
        weekday: spec.weekday ?? null, day_of_month: spec.dayOfMonth ?? null,
        notify: (body.notify && typeof body.notify === 'object') ? body.notify : {},
        next_run_at: nextRun, updated_at: nowIso,
      };
      if (domains.length > 0) row.domains = domains;

      if (op === 'create') {
        row.created_by = userId;
        const { data, error } = await admin.from('scan_schedules').insert(row).select('id').single();
        if (error || !data) return jsonError(500, 'INTERNAL', 'could not create schedule');
        await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: 'scheduler.create', target_type: 'scan_schedule', target_id: data.id, payload: { frequency: spec.frequency, domains: domains.length } });
        return jsonResponse({ ok: true, id: data.id, next_run_at: nextRun });
      }

      const id = String(body.id ?? '');
      if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
      const { error } = await admin.from('scan_schedules').update(row).eq('id', id).eq('tenant_id', tenantId);
      if (error) return jsonError(500, 'INTERNAL', 'could not update schedule');
      await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: 'scheduler.update', target_type: 'scan_schedule', target_id: id, payload: {} });
      return jsonResponse({ ok: true, id, next_run_at: nextRun });
    }

    // pause / resume / delete
    const id = String(body.id ?? '');
    if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');

    if (op === 'delete') {
      await admin.from('scan_schedules').delete().eq('id', id).eq('tenant_id', tenantId);
    } else {
      await admin.from('scan_schedules').update({ paused: op === 'pause', updated_at: nowIso }).eq('id', id).eq('tenant_id', tenantId);
    }
    await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: `scheduler.${op}`, target_type: 'scan_schedule', target_id: id, payload: {} });
    return jsonResponse({ ok: true, id });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'scheduler_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'scheduler operation failed');
  }
});
