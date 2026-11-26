// audit-share-get — Ersatz für das anonyme RPC public.audit_share_get(uuid).
//
// POST /functions/v1/audit-share-get
// Body: { token: string }
// verify_jwt = false. Öffentlicher Vertrag: "token", nicht "p_id"/"audit_id".
// Intern wird die bestehende SECURITY-DEFINER-Funktion mit service_role
// aufgerufen (Migration 20260506230000, nur is_shareable = true).
// Dafür muss service_role EXECUTE haben — siehe
// sql/companion-service-role-grants-for-replacements.sql (nicht in v2).
// Rate-Limit über vorhandenes bot_rate_hit.
//
// Ist-Schema: Es gibt keine eigene share_token-Spalte. Die RPC gibt
// gdpr_audits.id als share_token zurück. Ein vom Primärschlüssel getrenntes
// Token wäre neues Schema und ist in diesem Entwurf nicht erfunden.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import {
  PUBLIC_SHARE_RATE, enforceAnonIpLimit, rateLimitedResponse,
} from '../_shared/public-anon-limit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RATE_LIMIT_SECRET = Deno.env.get('BOT_RATE_LIMIT_SALT') || SERVICE_ROLE;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json body');
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!UUID_RE.test(token)) return jsonError(400, 'BAD_REQUEST', 'token must be a uuid');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const limited = await enforceAnonIpLimit(
    admin, req, 'public:audit-share:ip', PUBLIC_SHARE_RATE, RATE_LIMIT_SECRET,
  );
  if (!limited.allowed) return rateLimitedResponse(jsonError, limited);

  const { data, error } = await admin.rpc('audit_share_get', { p_id: token });
  if (error) return jsonError(500, 'INTERNAL', error.message);
  const rows = Array.isArray(data) ? data : [];
  return jsonResponse(rows);
});
