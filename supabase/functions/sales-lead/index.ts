// Sales-Lead-Capture für die /contact-sales-Form auf Apex und /agencies.
//
// POST /functions/v1/sales-lead   (verify_jwt = false — public endpoint)
// Body: { name?, email, company?, use_case?, message?, source?, path? }
//
// 1. Validate email + cap field lengths (no overflow attacks)
// 2. Hash X-Forwarded-For → ip_hash for rate-limiting without storing PII
// 3. Reject if > 5 leads from same ip_hash in last hour (rate-limit)
// 4. INSERT into public.sales_leads via service-role
// 5. Optional: fire Slack/Discord webhook (env SALES_LEAD_WEBHOOK_URL) for
//    immediate notification — failures don't block the lead capture

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const text = await req.text();
  if (text.length > 8192) return jsonError(413, 'BODY_TOO_LARGE', 'max 8 KB');

  let body: { name?: string; email?: string; company?: string; use_case?: string; message?: string; source?: string; path?: string };
  try { body = JSON.parse(text); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  if (email.length > 254) return jsonError(400, 'INVALID_EMAIL', 'email too long');

  const cap = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : null);

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Rate-limit: 5 leads per ip_hash per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('sales_leads').select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
  if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later');

  const { data, error } = await admin.from('sales_leads').insert({
    name: cap(body.name, 200),
    email,
    company: cap(body.company, 200),
    use_case: cap(body.use_case, 50),
    message: cap(body.message, 4000),
    source: cap(body.source, 200),
    path: cap(body.path, 500),
    user_agent: cap(req.headers.get('user-agent'), 500),
    ip_hash: ipHash,
  }).select('id, created_at').single();

  if (error) return jsonError(500, 'INTERNAL', error.message);

  // Optional Slack/Discord webhook for instant team notification
  const webhook = Deno.env.get('SALES_LEAD_WEBHOOK_URL');
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🎯 New sales lead\nEmail: ${email}\n` +
            (body.name ? `Name: ${body.name}\n` : '') +
            (body.company ? `Company: ${body.company}\n` : '') +
            (body.use_case ? `Use case: ${body.use_case}\n` : '') +
            (body.message ? `Message: ${body.message.slice(0, 500)}\n` : '') +
            (body.source ? `Source: ${body.source}\n` : '') +
            (body.path ? `Path: ${body.path}\n` : ''),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      console.error('webhook failed:', (e as Error).message);
    }
  }

  return json({ ok: true, id: data?.id, created_at: data?.created_at });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
