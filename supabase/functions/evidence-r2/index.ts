// evidence-r2 — Evidence-Blobs im Cloudflare-R2-Bucket (EU-Jurisdiktion).
//
// POST /functions/v1/evidence-r2
// Auth: Authorization: Bearer <user JWT>
// Body:
//   { op: 'put', tenant_id, filename, mime_type, content_base64 }
//   { op: 'get', tenant_id, key }
//
// Gate: evidence.advanced (wie evidence-vault). Der zurückgegebene sha256 ist
// der content_sha256 für einen evidence-vault-Snapshot. Objekte sind
// write-once (If-None-Match: *); Löschung nur über die R2-Lifecycle-Regel.
// Secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// optional R2_BUCKET, R2_JURISDICTION (Default 'eu').

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { audit } from '../_shared/auditLog.ts';
import { readCappedText } from '../_shared/readCappedBody.ts';

const MAX_OBJECT_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = Math.ceil(MAX_OBJECT_BYTES * 4 / 3) + 64 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME_RE = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i;

function bufToHex(buf: Uint8Array): string { let o = ''; for (let i = 0; i < buf.length; i++) o += buf[i].toString(16).padStart(2, '0'); return o; }

function decodeBase64(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function safeFilename(name: string): string {
  return name.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(0, 120) || 'evidence.bin';
}

function r2Config() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const bucket = Deno.env.get('R2_BUCKET') ?? 'realsyncdynamics-evidence-vault';
  const jurisdiction = Deno.env.get('R2_JURISDICTION') ?? 'eu';
  const host = jurisdiction ? `${accountId}.${jurisdiction}.r2.cloudflarestorage.com` : `${accountId}.r2.cloudflarestorage.com`;
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
    objectUrl: (key: string) => `https://${host}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const raw = await readCappedText(req, MAX_BODY_BYTES);
  if (!raw.ok) return jsonError(413, 'PAYLOAD_TOO_LARGE', `max ${MAX_OBJECT_BYTES} bytes per object`);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw.text); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '');
  if (op !== 'put' && op !== 'get') return jsonError(400, 'BAD_REQUEST', 'op must be put|get');
  if (!UUID_RE.test(tenantId)) return jsonError(400, 'BAD_REQUEST', 'tenant_id must be a uuid');

  const r2 = r2Config();
  if (!r2) return jsonError(503, 'NOT_CONFIGURED', 'evidence storage not configured');

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

  try {
    if (op === 'put') {
      const mime = String(body.mime_type ?? 'application/octet-stream');
      if (!MIME_RE.test(mime)) return jsonError(400, 'BAD_REQUEST', 'invalid mime_type');
      const bytes = decodeBase64(String(body.content_base64 ?? ''));
      if (!bytes || bytes.length === 0) return jsonError(400, 'BAD_REQUEST', 'content_base64 must be non-empty base64');
      if (bytes.length > MAX_OBJECT_BYTES) return jsonError(413, 'PAYLOAD_TOO_LARGE', `max ${MAX_OBJECT_BYTES} bytes per object`);

      const sha256 = bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const filename = safeFilename(String(body.filename ?? ''));
      const key = `tenant/${tenantId}/${yyyy}/${mm}/${sha256}-${filename}`;

      const res = await r2.client.fetch(r2.objectUrl(key), {
        method: 'PUT',
        body: bytes,
        headers: {
          'content-type': mime,
          'if-none-match': '*',
          'x-amz-meta-tenant-id': tenantId,
          'x-amz-meta-uploaded-by': userId,
          'x-amz-meta-sha256': sha256,
        },
      });
      // 412 = Objekt existiert bereits; Key enthält den Hash, also identischer Inhalt.
      const alreadyStored = res.status === 412;
      if (!res.ok && !alreadyStored) {
        console.error(JSON.stringify({ level: 'error', scope: 'evidence_r2_put_failed', status: res.status }));
        return jsonError(502, 'STORAGE_ERROR', 'could not store evidence');
      }

      const putAudit = await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: 'evidence.blob.put', target_type: 'evidence_blob', target_id: key, payload: { sha256, size: bytes.length, mime_type: mime, deduplicated: alreadyStored } });
      // Retry ist idempotent (write-once, Key enthält den Hash).
      if (!putAudit.ok) return jsonError(500, 'AUDIT_FAILED', 'evidence stored but audit failed; retry');
      return jsonResponse({ ok: true, key, sha256, size: bytes.length, deduplicated: alreadyStored });
    }

    // op === 'get'
    const key = String(body.key ?? '');
    if (!key.startsWith(`tenant/${tenantId}/`) || key.includes('..') || key.length > 512) return jsonError(400, 'BAD_REQUEST', 'key does not belong to this tenant');

    const res = await r2.client.fetch(r2.objectUrl(key), { method: 'GET' });
    if (res.status === 404) return jsonError(404, 'NOT_FOUND', 'evidence not found');
    if (!res.ok) {
      console.error(JSON.stringify({ level: 'error', scope: 'evidence_r2_get_failed', status: res.status }));
      return jsonError(502, 'STORAGE_ERROR', 'could not read evidence');
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_OBJECT_BYTES) return jsonError(413, 'PAYLOAD_TOO_LARGE', 'object exceeds response limit');
    const sha256 = bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));

    const getAudit = await audit(admin, { tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail, action: 'evidence.blob.get', target_type: 'evidence_blob', target_id: key, payload: { sha256, size: bytes.length } });
    if (!getAudit.ok) return jsonError(500, 'AUDIT_FAILED', 'could not audit evidence read');
    return jsonResponse({ ok: true, key, sha256, size: bytes.length, mime_type: res.headers.get('content-type'), content_base64: encodeBase64(bytes) });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'evidence_r2_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'evidence-r2 operation failed');
  }
});
