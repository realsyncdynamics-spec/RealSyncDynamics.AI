// bulk-scan — Massen-Scan-Batches einreichen / abbrechen.
//
// POST /functions/v1/bulk-scan
// Auth: Authorization: Bearer <user JWT>
// Body:
//   { op: 'submit', tenant_id, domains?: string[], csv?: string, label?, priority? }
//   { op: 'cancel', tenant_id, batch_id }
//
// Ablauf submit:
//   1. JWT prüfen → userId
//   2. Tenant-Mitgliedschaft prüfen
//   3. Feature-Gate: bulk.jobs
//   4. Domains parsen/normalisieren/dedupen (identisch zu src/lib/bulk/domains)
//   5. Monats-Quota zählen: limit.bulk_jobs_monthly (1 pro Batch)
//   6. Batch + Items (service_role) anlegen, Audit-Log
//
// Fortschritt/Listen liest das Frontend RLS-sicher direkt (PostgREST +
// RPC bulk_scan_batch_progress). Die Ausführung der Scans übernimmt der
// Worker-Pool via RPC bulk_scan_claim_next (Folge-Integration).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { consumeUsage, UsageError } from '../_shared/usage.ts';
import { audit } from '../_shared/auditLog.ts';

// Höchstzahl Domains pro Batch-Submit (Schutz gegen Riesen-Payloads).
const MAX_DOMAINS_PER_BATCH = 5000;

// ── Domain-Parsing (identisch zu src/lib/bulk/domains.ts) ────────────────────
function normalizeDomain(raw: string): string | null {
  const s = (raw ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.\-]/g, '');
  if (!s) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null;
  return s;
}
function parseDomainList(input: string): { valid: string[]; rejected: Array<{ raw: string; reason: string }>; duplicates: number } {
  const tokens = (input ?? '').split(/[\s,;]+/).map((t) => t.trim()).filter((t) => t.length > 0);
  const valid: string[] = [];
  const rejected: Array<{ raw: string; reason: string }> = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const raw of tokens) {
    const norm = normalizeDomain(raw);
    if (!norm) { rejected.push({ raw, reason: 'kein gültiger Domainname' }); continue; }
    if (seen.has(norm)) { duplicates++; continue; }
    seen.add(norm); valid.push(norm);
  }
  return { valid, rejected, duplicates };
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
  if (!['submit', 'cancel'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'op must be submit|cancel');
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. Verify caller
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 2. Tenant membership
  const { data: member } = await admin
    .from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    if (op === 'cancel') {
      const batchId = String(body.batch_id ?? '');
      if (!batchId) return jsonError(400, 'BAD_REQUEST', 'batch_id required');
      const { data: batch } = await admin
        .from('bulk_scan_batches').select('id').eq('id', batchId).eq('tenant_id', tenantId).maybeSingle();
      if (!batch) return jsonError(404, 'NOT_FOUND', 'batch not found');

      await admin.from('bulk_scan_batches').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', batchId);
      await admin.from('bulk_scan_items').update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('batch_id', batchId).in('status', ['queued', 'running']);

      await audit(admin, {
        tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
        action: 'bulk_scan.cancel', target_type: 'bulk_scan_batch', target_id: batchId, payload: {},
      });
      return jsonResponse({ ok: true, batch_id: batchId, status: 'cancelled' });
    }

    // op === 'submit'
    // 3. Feature gate
    try {
      await gateFeature(admin, tenantId, 'bulk.jobs');
    } catch (e) {
      if (e instanceof EntitlementError) return jsonError(402, 'PAYMENT_REQUIRED', 'Bulk-Jobs sind erst ab Agency verfügbar.');
      return jsonError(500, 'INTERNAL', 'entitlement check failed');
    }

    // 4. Parse domains (aus domains[] und/oder csv)
    const rawList = [
      ...(Array.isArray(body.domains) ? (body.domains as unknown[]).map(String) : []),
      ...(typeof body.csv === 'string' ? [body.csv] : []),
    ].join('\n');
    const parsed = parseDomainList(rawList);
    if (parsed.valid.length === 0) {
      return jsonError(400, 'BAD_REQUEST', 'keine gültigen Domains gefunden', undefined, { rejected: parsed.rejected });
    }
    if (parsed.valid.length > MAX_DOMAINS_PER_BATCH) {
      return jsonError(400, 'BAD_REQUEST', `zu viele Domains (max ${MAX_DOMAINS_PER_BATCH} pro Batch)`);
    }

    // 5. Monats-Quota: 1 Batch zählt gegen limit.bulk_jobs_monthly
    try {
      await consumeUsage(admin, tenantId, 'limit.bulk_jobs_monthly', 1);
    } catch (e) {
      if (e instanceof UsageError) return jsonError(429, 'QUOTA_EXCEEDED', 'Monats-Kontingent für Bulk-Jobs erschöpft.');
      return jsonError(500, 'INTERNAL', 'quota check failed');
    }

    const priority = Number.isFinite(Number(body.priority)) ? Math.trunc(Number(body.priority)) : 0;
    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 200) : null;
    const nowIso = new Date().toISOString();

    // 6. Batch + Items anlegen
    const { data: batch, error: batchErr } = await admin
      .from('bulk_scan_batches')
      .insert({ tenant_id: tenantId, label, status: 'queued', priority, total_count: parsed.valid.length, created_by: userId })
      .select('id').single();
    if (batchErr || !batch) return jsonError(500, 'INTERNAL', 'could not create batch');

    const items = parsed.valid.map((domain) => ({
      batch_id: batch.id, tenant_id: tenantId, domain, status: 'queued', priority, created_at: nowIso,
    }));
    const { error: itemsErr } = await admin.from('bulk_scan_items').insert(items);
    if (itemsErr) {
      // Batch ohne Items ist nutzlos → aufräumen
      await admin.from('bulk_scan_batches').delete().eq('id', batch.id);
      return jsonError(500, 'INTERNAL', 'could not enqueue items');
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: 'bulk_scan.submit', target_type: 'bulk_scan_batch', target_id: batch.id,
      payload: { domains: parsed.valid.length, rejected: parsed.rejected.length, duplicates: parsed.duplicates, priority },
    });

    return jsonResponse({
      ok: true, batch_id: batch.id,
      accepted: parsed.valid.length, rejected: parsed.rejected, duplicates: parsed.duplicates,
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'bulk_scan_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'bulk-scan operation failed');
  }
});
