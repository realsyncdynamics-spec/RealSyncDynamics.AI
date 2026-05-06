// Newsletter Double-Opt-In Subscribe.
//
// POST /functions/v1/newsletter-subscribe   (verify_jwt = false; public)
// Body: { email: string, source?: string }
//
// 1. Rate-limit (5/h per IP)
// 2. Insert pending subscriber
// 3. Send DOI-Email via Resend (graceful no-op ohne Key)
// 4. Return ok regardless of email-send (don't expose IF email exists)

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
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SRK);

  let body: { email?: string; source?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  }
  const source = (body.source ?? 'direct').slice(0, 64);

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  // Rate-limit: 5 subscriptions per ip_hash per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supa
    .from('newsletter_subscribers').select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
  if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED', 'too many subscriptions, retry later');

  // Idempotent insert: if email exists, just resend the DOI mail with existing token
  const { data: existing } = await supa.from('newsletter_subscribers')
    .select('confirm_token, status')
    .eq('email', email)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();

  let confirmToken: string;
  if (existing) {
    if (existing.status === 'confirmed') {
      return json({ ok: true, already_confirmed: true });
    }
    confirmToken = existing.confirm_token;
  } else {
    const { data: row, error: insErr } = await supa.from('newsletter_subscribers').insert({
      email,
      source,
      ip_hash: ipHash,
      user_agent: req.headers.get('user-agent')?.slice(0, 500),
    }).select('confirm_token').single();
    if (insErr) return jsonError(500, 'INTERNAL', insErr.message);
    confirmToken = row!.confirm_token;
  }

  // Send DOI email via Resend (graceful no-op without key)
  const apiKey = await getResendKey(supa);
  if (apiKey) {
    const fromAddr = Deno.env.get('NEWSLETTER_EMAIL_FROM') ?? 'newsletter@realsyncdynamicsai.de';
    const confirmUrl = `https://realsyncdynamicsai.de/newsletter/confirm?token=${confirmToken}`;
    const html = renderDoiEmail(email, confirmUrl);
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `RealSync Dynamics <${fromAddr}>`,
        to: [email],
        subject: 'Bitte bestätige Deine Newsletter-Anmeldung',
        html,
        reply_to: 'kontakt@realsyncdynamicsai.de',
        tags: [{ name: 'category', value: 'newsletter_doi' }],
      }),
    }).catch(() => { /* swallow — user gets ok status anyway */ });
  }

  return json({ ok: true });
});

async function getResendKey(supa: ReturnType<typeof createClient>): Promise<string | null> {
  const env = Deno.env.get('RESEND_API_KEY');
  if (env && env.startsWith('re_')) return env;
  try {
    const { data } = await supa.rpc('get_app_secret', { name: 'resend_api_key' });
    if (typeof data === 'string' && data.startsWith('re_')) return data;
  } catch { /* RPC may not exist */ }
  return null;
}

function renderDoiEmail(email: string, confirmUrl: string): string {
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#18181b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 8px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
      <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:11px;color:#71717a;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">RealSyncDynamics.AI</div>
        <h1 style="margin:8px 0 4px;font-size:22px;">Bestätige Deine Anmeldung</h1>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hallo,</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">jemand hat ${escapeHtml(email)} für unseren DSGVO+AI-Act-Newsletter angemeldet. Falls Du das warst, bestätige bitte hier:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Anmeldung bestätigen</a>
        </div>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#52525b;">Falls der Button nicht funktioniert, kopiere diesen Link: <br><span style="word-break:break-all;color:#0284c7;">${escapeHtml(confirmUrl)}</span></p>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#52525b;">Falls Du das NICHT warst, ignoriere diese Email — wir senden Dir nichts ohne Bestätigung.</p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;line-height:1.6;">
        <p style="margin:0 0 6px;">Diese Email ist Teil des Double-Opt-In-Verfahrens nach § 7 UWG.</p>
        <p style="margin:0;">RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt) · <a href="https://realsyncdynamicsai.de/legal/privacy" style="color:#0284c7;">Datenschutz</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
