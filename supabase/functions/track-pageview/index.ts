// DSGVO-konformes Pageview-Tracking.
//
// POST /functions/v1/track-pageview
// Body: { path, referrer?, utm_source?, utm_medium?, utm_campaign? }
//
// Hashed visitor identification (no cookies, no localStorage). visitor_hash =
// sha256(ip + user-agent + UTC-day). Same visitor on same day = same hash.
// Different days = different hash, so we can't track across sessions — by design.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BOT_RE = /bot|spider|crawler|headless|lighthouse|gpt-|claude-|cohere|googlebot|bingbot/i;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: { path?: string; referrer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const path = (body.path ?? '').slice(0, 500);
  if (!path || !path.startsWith('/')) return jsonError(400, 'BAD_REQUEST', 'path required, must start with /');

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? '';
  const isBot = BOT_RE.test(ua);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const visitorHash = await sha256Hex(`${ipHeader}|${ua}|${today}`);
  const sessionHash = await sha256Hex(`${ipHeader}|${ua}`);

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
