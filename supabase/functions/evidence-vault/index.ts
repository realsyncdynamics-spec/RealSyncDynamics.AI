// evidence-vault — Evidence Vault Advanced (Snapshots + Legal-Hold).
//
// POST /functions/v1/evidence-vault
// Auth: Authorization: Bearer <user JWT>
// Body:
//   { op: 'snapshot', tenant_id, subject_ref, label?, content_sha256, retention_class? }
//   { op: 'hold',      tenant_id, subject_ref, reason?, active: boolean }
//
// Gate: evidence.advanced (ab Agency). Snapshots sind append-only + pro
// (tenant, subject) versioniert + über prev_hash verkettet + optional
// HMAC-signiert. Retention wird bei Anlage aus der Klasse berechnet
// (identisch zu src/lib/evidence/retention).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { audit } from '../_shared/auditLog.ts';
import { appendCustodyEvent } from '../_shared/provenanceCore.ts';

type RetentionClass = 'forever' | '7y' | '3y' | '1y' | '90d' | '30d' | '7d' | 'ephemeral';
const RET_CLASSES: RetentionClass[] = ['forever', '7y', '3y', '1y', '90d', '30d', '7d', 'ephemeral'];
const DAY_MS = 86400000;
const RET_DAYS: Record<string, number> = { '7y': 7 * 365, '3y': 3 * 365, '1y': 365, '90d': 90, '30d': 30, '7d': 7 };

function retainedUntil(cls: RetentionClass, fromMs: number): string | null {
  if (cls === 'forever') return null;
  if (cls === 'ephemeral') return new Date(fromMs).toISOString();
  return new Date(fromMs + RET_DAYS[cls] * DAY_MS).toISOString();
}

// ── Kanonik + Hash (identisch zu src/lib/provenance-Stil) ────────────────────
function normalizeHex(h: string): string { return h.trim().toLowerCase().replace(/^0x/, ''); }
function bufToHex(buf: Uint8Array): string { let o = ''; for (let i = 0; i < buf.length; i++) o += buf[i].toString(16).padStart(2, '0'); return o; }
async function sha256Hex(bytes: Uint8Array): Promise<string> { return bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))); }
async function snapshotHash(c: { subjectRef: string; version: number; contentSha256: string; retentionClass: string; timestamp: string; prevHash: string | null }): Promise<string> {
  const ordered = { subjectRef: c.subjectRef, version: c.version, contentSha256: normalizeHex(c.contentSha256), retentionClass: c.retentionClass, timestamp: c.timestamp, prevHash: c.prevHash === null ? null : normalizeHex(c.prevHash) };
  return sha256Hex(new TextEncoder().encode(JSON.stringify(ordered)));
}
async function signHash(eventHash: string): Promise<string | null> {
  const secret = Deno.env.get('EVIDENCE_VAULT_SIGNING_KEY') ?? Deno.env.get('PROVENANCE_SIGNING_SECRET');
  if (!secret) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bufToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(eventHash))));
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
  const subjectRef = String(body.subject_ref ?? '').trim();
  if (!['snapshot', 'hold'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'op must be snapshot|hold');
  if (!tenantId || !subjectRef) return jsonError(400, 'BAD_REQUEST', 'tenant_id and subject_ref required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin.from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    await gateFeature(admin, tenantId, 'evidence.advanced');
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(402, 'PAYMENT_REQUIRED', 'Evidence Vault Advanced ist erst ab Agency verfügbar.');
    return jsonError(500, 'INTERNAL', 'entitlement check failed');
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  try {
    if (op === 'hold') {
      const active = body.active === true;
      if (active) {
        await admin.from('evidence_legal_holds').insert({ tenant_id: tenantId, subject_ref: subjectRef, reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null, active: true, created_by: userId });
      } else {
        await admin.from('evidence_legal_holds').update({ active: false, released_at: nowIso }).eq('tenant_id', tenantId).eq('subject_ref', subjectRef).eq('active', true);
      }
      await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: active ? 'evidence.hold.set' : 'evidence.hold.release', target_type: 'evidence_subject', target_id: subjectRef, payload: {} });
      return jsonResponse({ ok: true, subject_ref: subjectRef, legal_hold: active });
    }

    // op === 'snapshot'
    const contentSha = String(body.content_sha256 ?? '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalizeHex(contentSha))) return jsonError(400, 'BAD_REQUEST', 'content_sha256 must be a 64-char hex digest');
    const retentionClass: RetentionClass = RET_CLASSES.includes(body.retention_class as RetentionClass) ? (body.retention_class as RetentionClass) : 'forever';

    // Version + prev_hash aus dem letzten Snapshot des Subjects.
    const { data: last } = await admin
      .from('evidence_snapshots').select('version, event_hash')
      .eq('tenant_id', tenantId).eq('subject_ref', subjectRef)
      .order('version', { ascending: false }).limit(1).maybeSingle<{ version: number; event_hash: string }>();
    const version = (last?.version ?? 0) + 1;
    const prevHash = last?.event_hash ?? null;

    const eventHash = await snapshotHash({ subjectRef, version, contentSha256: normalizeHex(contentSha), retentionClass, timestamp: nowIso, prevHash });
    const signature = await signHash(eventHash);
    const retUntil = retainedUntil(retentionClass, nowMs);

    const { data: created, error } = await admin.from('evidence_snapshots').insert({
      tenant_id: tenantId, subject_ref: subjectRef,
      label: typeof body.label === 'string' ? body.label.trim().slice(0, 200) || null : null,
      version, content_sha256: normalizeHex(contentSha), prev_hash: prevHash, event_hash: eventHash,
      signature, retention_class: retentionClass, retained_until: retUntil, created_by: userId,
      event_timestamp: nowIso,
    }).select('id').single();
    if (error || !created) return jsonError(500, 'INTERNAL', 'could not create snapshot');

    await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: 'evidence.snapshot', target_type: 'evidence_snapshot', target_id: created.id, payload: { subject_ref: subjectRef, version, retention_class: retentionClass, signed: signature !== null } });

    // Phase 2b — Auto-Erfassung im Herkunftsnachweis: jeder Snapshot hängt ein
    // Custody-Event an die Provenance-Kette desselben Subjects an. Best-effort:
    // der Snapshot (Primärfunktion) darf niemals hieran scheitern.
    let provenanceLinked = false;
    try {
      const r = await appendCustodyEvent(admin, {
        tenantId, assetRef: subjectRef, contentSha256: normalizeHex(contentSha),
        action: 'audited', issuer: `tenant:${tenantId}`, timestamp: nowIso,
      });
      provenanceLinked = true;
      await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: 'provenance.auto', target_type: 'provenance_manifest', target_id: subjectRef, payload: { seq: r.seq, source: 'evidence.snapshot', event_hash: r.eventHash, signed: r.signed } });
    } catch (provErr) {
      console.error(JSON.stringify({ level: 'warn', scope: 'provenance_auto_link_failed', subject_ref: subjectRef, error: (provErr as Error)?.message ?? String(provErr) }));
    }

    return jsonResponse({ ok: true, id: created.id, subject_ref: subjectRef, version, event_hash: eventHash, retained_until: retUntil, signed: signature !== null, provenance_linked: provenanceLinked });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'evidence_vault_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'evidence-vault operation failed');
  }
});
