// Sales-Lead-Capture for public conversion forms.
//
// POST /functions/v1/sales-lead (verify_jwt = false — public endpoint)
// Body: { name?, email, company?, use_case?, message?, source?, intent?, tier?, path? }
//
// Public leads are rate-limited, stored in public.sales_leads and optionally
// forwarded to the configured team webhook. Website-builder leads that
// explicitly requested the Starter offer also receive the three-month-free
// offer by email via the existing Resend configuration.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'alerts@realsyncdynamicsai.de';

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendStarterOffer(email: string, name?: string | null, company?: string | null): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const greeting = name ? `Hallo ${name},` : 'Hallo,';
  const companyLine = company ? `<p>für <strong>${company}</strong> haben wir bereits den Website-Scan vorbereitet.</p>` : '';

  const html = `
    <html><body style="margin:0;background:#030712;color:#e5e7eb;font-family:Arial,sans-serif;line-height:1.6">
      <div style="max-width:620px;margin:0 auto;padding:32px 24px">
        <div style="border:1px solid #164e63;border-radius:16px;padding:28px;background:#07111f">
          <p style="color:#22d3ee;font-size:12px;letter-spacing:2px;font-weight:700">REALSYNCDYNAMICS.AI</p>
          <h1 style="font-size:30px;line-height:1.15;margin:18px 0 12px;color:#fff">Ihr Starter-Angebot: 3 Monate gratis</h1>
          <p>${greeting}</p>
          ${companyLine}
          <p>Sie haben Ihre Website prüfen lassen. Als nächsten Schritt bieten wir Ihnen das <strong>Starter-Paket für 3 Monate kostenlos</strong> an.</p>
          <p>Damit können Sie die nächsten Schritte aus dem Scan umsetzen und RealSyncDynamics.AI im laufenden Betrieb kennenlernen.</p>
          <p style="margin:28px 0"><a href="https://realsyncdynamicsai.de/pricing?offer=starter-3-months-free&utm_source=website-builder&utm_medium=email" style="display:inline-block;background:#22d3ee;color:#030712;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">Starter-Angebot ansehen</a></p>
          <p style="font-size:13px;color:#94a3b8">Wenn Sie diese E-Mails nicht mehr erhalten möchten, antworten Sie bitte auf diese Nachricht mit „Abmelden“.</p>
        </div>
        <p style="font-size:11px;color:#64748b;text-align:center;margin-top:18px">RealSync Dynamics.AI · EU-Hosting · DSGVO · EU AI Act</p>
      </div>
    </body></html>`;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: email, subject: 'Ihr Starter-Angebot: 3 Monate gratis', html }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status} - ${await response.text()}`);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const text = await req.text();
  if (text.length > 8192) return jsonError(413, 'BODY_TOO_LARGE', 'max 8 KB');

  let body: { name?: string; email?: string; company?: string; use_case?: string; message?: string; source?: string; intent?: string; tier?: string; path?: string };
  try { body = JSON.parse(text); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  if (email.length > 254) return jsonError(400, 'INVALID_EMAIL', 'email too long');

  const cap = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : null);
  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from('sales_leads').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
  if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later');

  const intent = cap(body.intent, 100);
  const tier = cap(body.tier, 50);
  const name = cap(body.name, 200);
  const company = cap(body.company, 200);

  const { data, error } = await admin.from('sales_leads').insert({
    name,
    email,
    company,
    use_case: cap(body.use_case, 50),
    message: cap(body.message, 4000),
    source: cap(body.source, 200),
    path: cap(body.path, 500),
    user_agent: cap(req.headers.get('user-agent'), 500),
    ip_hash: ipHash,
    metadata: { ...(intent ? { intent } : {}), ...(tier ? { tier } : {}), ...(body.source === 'unified-entry' ? { marketing_consent: true } : {}) },
  }).select('id, created_at').single();

  if (error) return jsonError(500, 'INTERNAL', error.message);

  if (body.source === 'unified-entry' && intent === 'starter_3_months_free' && tier === 'starter') {
    try {
      await sendStarterOffer(email, name, company);
    } catch (emailError) {
      console.error('starter offer email failed:', emailError);
      // The lead is already safely captured. Do not turn an email-provider
      // failure into a lost lead or a duplicate form submission.
    }
  }

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
            (intent ? `Intent: ${intent}\n` : '') +
            (tier ? `Tier: ${tier}\n` : '') +
            (body.path ? `Path: ${body.path}\n` : ''),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      console.error('webhook failed:', (e as Error).message);
    }
  }

  return jsonResponse({ ok: true, id: data?.id, created_at: data?.created_at, offer_email_queued: body.source === 'unified-entry' && intent === 'starter_3_months_free' });
});
