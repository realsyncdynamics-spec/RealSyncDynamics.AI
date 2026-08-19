// Sales-Lead-Capture for public conversion forms.
//
// POST /functions/v1/sales-lead (verify_jwt = false — public endpoint)
// Body: { name?, email, company?, use_case?, message?, source?, intent?, tier?, path? }
//
// Public leads are rate-limited, stored in public.sales_leads and optionally
// forwarded to the configured team webhook. Website-builder leads that
// explicitly requested the Starter offer also receive the three-month-free
// offer by email via the existing Resend configuration.
//
// ── Warteliste (mode='waitlist') ────────────────────────────────────────────
// Zusätzlich bedient dieser Endpunkt die Warteliste der Landingpage
// /warteliste. Das ist bewusst KEINE eigene Edge Function: das Supabase-
// Projekt hat sein Function-Limit erreicht, und ein bestehender öffentlicher
// Lead-Endpunkt deckt denselben Anwendungsfall ab (Kontaktdaten aus einem
// Landingpage-Formular). Eine eigene Function liesse sich nicht deployen.
//
//   POST /functions/v1/sales-lead        { mode: 'waitlist', email, … }
//        → { ok: true, position, already_registered? }
//   GET  /functions/v1/sales-lead?mode=waitlist
//        → { ok: true, count }   (nur die Summe, nie Einzeldaten)
//
// Wartelisten-Anmeldungen landen ausschliesslich in public.waitlist_signups —
// nie in sales_leads. Beide Pfade haben getrennte Rate-Limit-Budgets, damit
// eine Wartelisten-Anmeldung keine Sales-Anfrage blockiert und umgekehrt.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

// Preflight muss GET mit abdecken (Wartelisten-Zähler). Die bestehenden
// POST-Antworten behalten `corsHeaders` — der Unterschied ist ausschliesslich
// `Access-Control-Allow-Methods`, und das wertet der Browser nur auf die
// Preflight-Antwort aus. Bestehende Aufrufer sehen also unverändertes Verhalten.
const cors = buildCorsHeaders('GET, POST, OPTIONS');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'alerts@realsyncdynamicsai.de';

/** Erlaubte Werte der Wartelisten-Spalten — Spiegel der CHECK-Constraints. */
// `bots` gehoert dazu, weil die Landingpage genau diesen Wert sendet
// (src/components/landing/WaitlistForm.tsx). Fehlte er hier, fiel jede
// Bot-Anmeldung auf `other` zurueck — ausgerechnet fuer das eine Modul, das
// noch nicht ausliefert und dessen Nachfrage gemessen werden sollte.
const WAITLIST_INTERESTS = ['runtime', 'siteos', 'evidence', 'provenance', 'audit', 'bots', 'other'];
const WAITLIST_TEAM_SIZES = ['1-9', '10-49', '50-249', '250-999', '1000+'];
/** Wartelisten-Anmeldungen pro IP-Hash und Stunde. */
const WAITLIST_RATE_LIMIT = 5;

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

/** Nur bekannte utm_*-Schlüssel übernehmen — kein Freitext-JSON aus dem Client. */
function pickUtm(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.trim()) out[key] = val.trim().slice(0, 120);
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req, cors); if (preflight) return preflight;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const url = new URL(req.url);

  // ── GET ?mode=waitlist — aggregierter Zähler für die Landingpage ──────────
  // Liefert nur die Summe. Die Seite blendet den Zähler aus, wenn dieser Call
  // fehlschlägt — es wird nie eine Zahl geraten.
  if (req.method === 'GET') {
    if (url.searchParams.get('mode') !== 'waitlist') {
      return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', cors);
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { count, error } = await admin
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'invited', 'converted']);
    if (error) return jsonError(500, 'INTERNAL', error.message, cors);
    return jsonResponse({ ok: true, count: count ?? 0 }, 200, cors);
  }

  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', cors);

  const text = await req.text();
  if (text.length > 8192) return jsonError(413, 'BODY_TOO_LARGE', 'max 8 KB');

  let body: { mode?: string; name?: string; email?: string; company?: string; use_case?: string; message?: string; source?: string; intent?: string; tier?: string; path?: string; role?: string; team_size?: string; note?: string; referrer?: string; utm?: unknown };
  try { body = JSON.parse(text); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  if (email.length > 254) return jsonError(400, 'INVALID_EMAIL', 'email too long');

  const cap = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : null);
  // Wie cap(), aber Leerstring → null. Nur im Wartelisten-Zweig verwendet;
  // cap() bleibt unverändert, damit der bestehende Sales-Pfad exakt gleich bleibt.
  const capOrNull = (s: unknown, max: number) => cap(s, max) || null;
  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // ── POST mode=waitlist — Anmeldung auf der Warteliste ─────────────────────
  // Eigener Zweig mit eigenem Rate-Limit-Budget; schreibt nie nach sales_leads,
  // damit die Sales-Pipeline nicht mit Wartelisten-Einträgen vermischt wird.
  if (body.mode === 'waitlist') {
    const { count: recent } = await admin
      .from('waitlist_signups').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
    if ((recent ?? 0) >= WAITLIST_RATE_LIMIT) {
      return jsonError(429, 'RATE_LIMITED', 'Zu viele Anmeldungen. Bitte später erneut versuchen.', cors);
    }

    const interestRaw = capOrNull(body.use_case, 32) ?? 'runtime';
    const interest = WAITLIST_INTERESTS.includes(interestRaw) ? interestRaw : 'other';
    const teamSizeRaw = capOrNull(body.team_size, 16);
    const teamSize = teamSizeRaw && WAITLIST_TEAM_SIZES.includes(teamSizeRaw) ? teamSizeRaw : null;

    // Idempotent: doppeltes Absenden ist kein Fehlerfall, sondern liefert die
    // bereits vergebene Position zurück.
    const { data: existing } = await admin
      .from('waitlist_signups').select('position')
      .eq('email', email).in('status', ['pending', 'invited', 'converted']).maybeSingle();
    if (existing) {
      return jsonResponse({ ok: true, position: existing.position, already_registered: true }, 200, cors);
    }

    const { data: row, error: wlError } = await admin.from('waitlist_signups').insert({
      email,
      company: capOrNull(body.company, 160),
      role: capOrNull(body.role, 120),
      interest,
      team_size: teamSize,
      note: capOrNull(body.note, 2000),
      source: capOrNull(body.source, 64) ?? 'warteliste',
      referrer: capOrNull(body.referrer, 500),
      utm: pickUtm(body.utm),
      ip_hash: ipHash,
      user_agent: capOrNull(req.headers.get('user-agent'), 500),
    }).select('position').single();

    if (wlError) {
      // Race: zwei parallele Requests derselben Adresse — der Unique-Index greift.
      if (wlError.code === '23505') {
        const { data: raced } = await admin
          .from('waitlist_signups').select('position')
          .eq('email', email).in('status', ['pending', 'invited', 'converted']).maybeSingle();
        if (raced) {
          return jsonResponse({ ok: true, position: raced.position, already_registered: true }, 200, cors);
        }
      }
      return jsonError(500, 'INTERNAL', wlError.message, cors);
    }

    return jsonResponse({ ok: true, position: row!.position }, 200, cors);
  }

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
