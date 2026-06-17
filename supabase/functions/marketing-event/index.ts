// Marketing Performance Analytics — Event-Ingestion.
//
// POST /functions/v1/marketing-event
// Body: MarketingEvent (siehe src/core/marketing-analytics/types.ts)
//
// Hardening:
//   - Per-IP-Hash Rate-Limit (20 req/min, in-memory wie cookie-scan).
//   - tenant_id NIE aus dem Body — wird aus dem JWT (Authorization-Header)
//     ueber memberships abgeleitet. Anonym = NULL.
//   - Server-side conversion events (checkout_completed, subscription_cancelled)
//     vom Client NICHT erlaubt — die kommen aus stripe-webhook.
//   - event_value von Client-Events wird auf 0..10000 EUR gecappt
//     (Pollution-Schutz fuer Revenue-Attribution).
//   - Defense-in-depth Metadata-Sanitizer (kein IP, kein UA, keine E-Mail).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

// Vom Client erlaubte Events. checkout_completed + subscription_cancelled
// werden ausschliesslich von vertrauenswuerdigen Server-Pfaden geschrieben
// (stripe-webhook), niemals akzeptieren wir sie hier.
const CLIENT_ALLOWED_EVENTS = new Set([
  'page_view',
  'lead_captured',
  'audit_started',
  'audit_completed',
  'pricing_viewed',
  'checkout_started',
]);

const MAX_EVENT_VALUE = 10_000; // EUR — sanity cap fuer client-supplied Werte

// Per-IP-Hash Rate-Limit (in-memory, wie cookie-scan).
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const rec = RATE_LIMIT.get(ipHash);
  if (!rec || now > rec.reset) {
    RATE_LIMIT.set(ipHash, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX) return false;
  rec.count++;
  return true;
}

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

/** Resolve tenant_id from the user's JWT (anon = null). */
async function resolveTenantFromJwt(
  url: string,
  anonKey: string,
  authHeader: string | null,
): Promise<{ user_id: string | null; tenant_id: string | null }> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { user_id: null, tenant_id: null };
  }
  const token = authHeader.slice(7).trim();
  if (!token) return { user_id: null, tenant_id: null };

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return { user_id: null, tenant_id: null };

  const userId = userRes.user.id;
  // First membership (single-tenant assumption is used elsewhere in the
  // codebase; see CheckoutPage's auth flow).
  const { data: mem } = await userClient
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return { user_id: userId, tenant_id: mem?.tenant_id ?? null };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);
  if (!checkRateLimit(ipHash)) {
    return jsonError(429, 'RATE_LIMITED', 'too many requests');
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const event_name = String(body.event_name ?? '');
  if (!CLIENT_ALLOWED_EVENTS.has(event_name)) {
    return jsonError(400, 'BAD_REQUEST', `event_name not allowed from client: ${event_name}`);
  }

  const rawValue = typeof body.event_value === 'number' && Number.isFinite(body.event_value)
    ? body.event_value
    : null;
  const event_value = rawValue == null
    ? null
    : Math.max(0, Math.min(MAX_EVENT_VALUE, Math.round(rawValue * 100) / 100));

  const currency = typeof body.currency === 'string'
    ? body.currency.toUpperCase().slice(0, 3)
    : 'EUR';

  const sessionHash = typeof body.session_hash === 'string'
    ? body.session_hash.slice(0, 128)
    : null;

  // tenant_id NIE aus body — immer aus JWT ableiten. Anon = null.
  const { user_id, tenant_id } = await resolveTenantFromJwt(
    SUPABASE_URL,
    ANON,
    req.headers.get('authorization'),
  );

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { error } = await admin.from('marketing_events').insert({
    tenant_id,
    event_name,
    event_value,
    currency,
    plan_key: typeof body.plan_key === 'string' ? body.plan_key.slice(0, 64) : null,
    utm_source: typeof body.utm_source === 'string' ? body.utm_source.slice(0, 100) : null,
    utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium.slice(0, 100) : null,
    utm_campaign: typeof body.utm_campaign === 'string' ? body.utm_campaign.slice(0, 100) : null,
    referrer_host: stripHost(typeof body.referrer_host === 'string' ? body.referrer_host : undefined),
    session_hash: sessionHash,
    user_id,
    metadata: sanitizeMetadata(body.metadata),
  });
  if (error) return jsonError(500, 'INTERNAL', error.message);

  return jsonResponse({ ok: true });
});

