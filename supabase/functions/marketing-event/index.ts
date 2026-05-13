// Marketing Performance Analytics — Event-Ingestion.
//
// POST /functions/v1/marketing-event
// Body: MarketingEvent (siehe src/core/marketing-analytics/types.ts)
//
// Server-seitig wird die Metadata defensiv NOCHMAL gefiltert (defense-in-
// depth), selbst wenn der Client das schon getan hat. Keine IP, kein
// User-Agent-Rohwert, keine E-Mail darf in die DB wandern.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_EVENTS = new Set([
  'page_view',
  'lead_captured',
  'audit_started',
  'audit_completed',
  'pricing_viewed',
  'checkout_started',
  'checkout_completed',
  'subscription_cancelled',
]);

const MAX_METADATA_BYTES = 4096;
const MAX_STRING_LEN = 200;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/i;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const UA_HINT = /(mozilla|chrome|safari|firefox|edge|opera|webkit|trident|gecko)/i;
const FORBIDDEN_KEYS = new Set([
  'ip', 'ipv4', 'ipv6', 'remote_addr', 'x_forwarded_for',
  'email', 'mail', 'e_mail',
  'user_agent', 'useragent', 'ua',
  'password', 'token', 'api_key', 'secret', 'authorization',
  'cookie', 'session_id', 'sid',
  'first_name', 'last_name', 'phone', 'phone_number',
]);

function looksLikePII(value: string): boolean {
  if (IPV4.test(value) || IPV6.test(value) || EMAIL.test(value)) return true;
  if (value.length > 40 && UA_HINT.test(value)) return true;
  return false;
}

function sanitizeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (FORBIDDEN_KEYS.has(key) || key.length > 64) continue;
    if (typeof rawValue === 'string') {
      if (looksLikePII(rawValue)) continue;
      out[key] = rawValue.slice(0, MAX_STRING_LEN);
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      out[key] = rawValue;
    } else if (typeof rawValue === 'boolean') {
      out[key] = rawValue;
    }
  }
  while (Object.keys(out).length > 0 &&
         new TextEncoder().encode(JSON.stringify(out)).length > MAX_METADATA_BYTES) {
    const k = Object.keys(out).pop();
    if (k) delete out[k];
  }
  return out;
}

function stripHost(value: string | undefined): string | null {
  if (!value) return null;
  try { return new URL(value.startsWith('http') ? value : `https://${value}`).host.slice(0, 200); }
  catch { return value.slice(0, 200); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const event_name = String(body.event_name ?? '');
  if (!VALID_EVENTS.has(event_name)) {
    return jsonError(400, 'BAD_REQUEST', `unknown event_name: ${event_name}`);
  }

  const event_value = typeof body.event_value === 'number' && Number.isFinite(body.event_value)
    ? Math.round(body.event_value * 100) / 100
    : null;

  const currency = typeof body.currency === 'string'
    ? body.currency.toUpperCase().slice(0, 3)
    : 'EUR';

  const sessionHash = typeof body.session_hash === 'string'
    ? body.session_hash.slice(0, 128)
    : null;

  const userId = typeof body.user_id === 'string' && /^[0-9a-f-]{36}$/.test(body.user_id)
    ? body.user_id
    : null;

  const tenantId = typeof body.tenant_id === 'string' && /^[0-9a-f-]{36}$/.test(body.tenant_id)
    ? body.tenant_id
    : null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { error } = await admin.from('marketing_events').insert({
    tenant_id: tenantId,
    event_name,
    event_value,
    currency,
    plan_key: typeof body.plan_key === 'string' ? body.plan_key.slice(0, 64) : null,
    utm_source: typeof body.utm_source === 'string' ? body.utm_source.slice(0, 100) : null,
    utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium.slice(0, 100) : null,
    utm_campaign: typeof body.utm_campaign === 'string' ? body.utm_campaign.slice(0, 100) : null,
    referrer_host: stripHost(typeof body.referrer_host === 'string' ? body.referrer_host : undefined),
    session_hash: sessionHash,
    user_id: userId,
    metadata: sanitizeMetadata(body.metadata),
  });
  if (error) return jsonError(500, 'INTERNAL', error.message);

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
