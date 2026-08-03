// DSGVO-konformes Pageview-Tracking.
//
// POST /functions/v1/track-pageview
// Body: { path, referrer?, utm_source?, utm_medium?, utm_campaign? }
//
// Hashed visitor identification (no cookies, no localStorage). visitor_hash und
// session_hash = HMAC-SHA256(PAGEVIEW_HASH_SALT, scope + ip + user-agent + UTC-day).
// Same visitor on same day = same hash. Different days = different hash, so we
// can't track across sessions — by design. Ableitung in `_shared/visitor-hash.ts`.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { computeVisitorHashes } from '../_shared/visitor-hash.ts';

const BOT_RE = /bot|spider|crawler|headless|lighthouse|gpt-|claude-|cohere|googlebot|bingbot/i;

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Fail closed: ohne Salt würden ungesalzene, praktisch umkehrbare Hashes
  // geschrieben. Lieber kein Pageview als ein schwach pseudonymisierter.
  const HASH_SALT = Deno.env.get('PAGEVIEW_HASH_SALT') ?? '';
  if (!HASH_SALT) {
    console.error('track-pageview: PAGEVIEW_HASH_SALT is not set — refusing to write unsalted hashes');
    return jsonError(500, 'CONFIG', 'PAGEVIEW_HASH_SALT is not configured');
  }

  let body: { path?: string; referrer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const path = (body.path ?? '').slice(0, 500);
  if (!path || !path.startsWith('/')) return jsonError(400, 'BAD_REQUEST', 'path required, must start with /');

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? '';
  const isBot = BOT_RE.test(ua);
  const { visitor_hash: visitorHash, session_hash: sessionHash } = await computeVisitorHashes({
    ip: ipHeader,
    userAgent: ua,
    at: new Date(),
    salt: HASH_SALT,
  });

  // Anonymize referrer: strip query strings + fragments, keep only origin+path
  let refClean: string | null = null;
  if (body.referrer) {
    try {
      const u = new URL(body.referrer);
      refClean = `${u.origin}${u.pathname}`.slice(0, 500);
    } catch { /* invalid URL — drop */ }
  }

  const country = req.headers.get('cf-ipcountry')?.slice(0, 2) ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { error } = await admin.from('page_views').insert({
    path,
    referrer: refClean,
    visitor_hash: visitorHash,
    session_hash: sessionHash,
    utm_source: body.utm_source?.slice(0, 100) || null,
    utm_medium: body.utm_medium?.slice(0, 100) || null,
    utm_campaign: body.utm_campaign?.slice(0, 100) || null,
    is_bot: isBot,
    country,
  });
  if (error) return jsonError(500, 'INTERNAL', error.message);

  return jsonResponse({ ok: true });
});

