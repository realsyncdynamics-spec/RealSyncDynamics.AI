// mcp-api-key-manager — Lebenszyklus der MCP-Server-API-Keys.
//
// POST /functions/v1/mcp-api-key-manager
// Auth: Authorization: Bearer <user JWT>
// Body:
//   { op: 'generate', tenant_id, name?, scopes?, expires_in_days? }
//   { op: 'list',     tenant_id }
//   { op: 'revoke',   tenant_id, key_id }
//
// Sicherheitsrelevanz: Diese Funktion vergibt Zugriff auf den MCP Governance
// Server (Evidence Vault, Governance-Status). Der Klartext-Key existiert genau
// einmal — in der Antwort auf 'generate'. Gespeichert wird nur der SHA-256-Hash,
// ein verlorener Key kann also nicht wiederhergestellt, nur ersetzt werden.
//
// Bewusst NICHT enthalten: eine 'validate'-Operation. Der MCP Server prüft Keys
// über die RPC mcp_key_is_valid mit service_role. Ein öffentlich erreichbarer
// Validierungs-Endpunkt wäre ein Orakel, an dem sich gestohlene Hashes
// gefahrlos durchprobieren ließen.
//
// EU AI Act / DSGVO: Jede Key-Vergabe und jeder Widerruf ist ein
// Zugriffsereignis auf Compliance-Nachweise und wird doppelt protokolliert —
// im Prüfpfad (audit) und über den DB-Trigger in mcp_key_usage.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

const KEY_PREFIX = 'rsmcp_';
/** Anzahl Hex-Zeichen des Keys nach dem Präfix (32 Byte Entropie). */
const KEY_BYTES = 32;
/** Für die UI sichtbarer Anfang: Präfix + 8 Hex-Zeichen. */
const DISPLAY_PREFIX_LEN = KEY_PREFIX.length + 8;

const ALLOWED_SCOPES = ['evidence.read', 'governance.read', 'runtime.read'] as const;
const DEFAULT_SCOPES = ['evidence.read', 'governance.read'];
const MAX_EXPIRY_DAYS = 365;

function bufToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}

function generateApiKey(): string {
  return KEY_PREFIX + bufToHex(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bufToHex(new Uint8Array(digest));
}

/** Unbekannte Scopes werden verworfen, statt sie ungeprüft zu speichern. */
function sanitizeScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_SCOPES;
  const valid = raw.filter(
    (s): s is string => typeof s === 'string' && (ALLOWED_SCOPES as readonly string[]).includes(s),
  );
  return valid.length > 0 ? [...new Set(valid)] : DEFAULT_SCOPES;
}

function expiryFromDays(raw: unknown): string | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  const days = Math.min(Math.floor(raw), MAX_EXPIRY_DAYS);
  return new Date(Date.now() + days * 86400000).toISOString();
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '');
  if (!['generate', 'list', 'revoke'].includes(op)) {
    return jsonError(400, 'BAD_REQUEST', 'op must be generate|list|revoke');
  }
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Tenant-Zugehörigkeit prüfen — ohne sie darf niemand Keys für einen fremden
  // Workspace ausstellen oder einsehen.
  const { data: member } = await admin
    .from('memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    if (op === 'generate') {
      const plainKey = generateApiKey();
      const keyHash = await sha256Hex(plainKey);
      const keyPrefix = plainKey.slice(0, DISPLAY_PREFIX_LEN);
      const scopes = sanitizeScopes(body.scopes);
      const expiresAt = expiryFromDays(body.expires_in_days);
      const name =
        typeof body.name === 'string' && body.name.trim()
          ? body.name.trim().slice(0, 120)
          : `MCP Key ${new Date().toISOString().slice(0, 10)}`;

      const { data: created, error: insertErr } = await admin
        .from('mcp_api_keys')
        .insert({
          tenant_id: tenantId,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          name,
          scopes,
          expires_at: expiresAt,
          created_by: userId,
        })
        .select('id, key_prefix, name, scopes, created_at, expires_at')
        .single();

      if (insertErr || !created) {
        return jsonError(500, 'INTERNAL', 'could not create key');
      }

      await audit(admin, {
        tenant_id: tenantId,
        actor_user_id: userId,
        actor_email: userEmail,
        action: 'mcp.api_key.created',
        target_type: 'mcp_api_key',
        target_id: created.id,
        payload: { key_prefix: keyPrefix, scopes, expires_at: expiresAt },
      });

      // key steht hier zum einzigen Mal im Klartext — danach nur noch der Hash.
      return jsonResponse({ ok: true, key: plainKey, ...created });
    }

    if (op === 'list') {
      const { data: keys, error: listErr } = await admin
        .from('mcp_api_keys')
        .select('id, key_prefix, name, scopes, active, created_at, expires_at, last_used_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (listErr) return jsonError(500, 'INTERNAL', 'could not list keys');
      return jsonResponse({ ok: true, keys: keys ?? [] });
    }

    // op === 'revoke'
    const keyId = String(body.key_id ?? '');
    if (!keyId) return jsonError(400, 'BAD_REQUEST', 'key_id required');

    // tenant_id im UPDATE-Filter: ein Key aus einem fremden Workspace bleibt
    // unangetastet, auch wenn seine ID erraten wurde.
    const { data: revoked, error: revokeErr } = await admin
      .from('mcp_api_keys')
      .update({ active: false })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
      .select('id, key_prefix')
      .maybeSingle();

    if (revokeErr) return jsonError(500, 'INTERNAL', 'could not revoke key');
    if (!revoked) return jsonError(404, 'NOT_FOUND', 'key not found in this tenant');

    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_email: userEmail,
      action: 'mcp.api_key.revoked',
      target_type: 'mcp_api_key',
      target_id: revoked.id,
      payload: { key_prefix: revoked.key_prefix },
    });

    return jsonResponse({ ok: true, id: revoked.id, active: false });
  } catch (_e) {
    return jsonError(500, 'INTERNAL', 'unexpected error');
  }
});
