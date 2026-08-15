// Warteliste — öffentliche Anmeldung für frühen Modul-Zugang.
//
// POST /functions/v1/waitlist-join   (verify_jwt = false; public)
// Body: { email, company?, role?, interest?, team_size?, note?, source?,
//         referrer?, utm?: Record<string,string> }
// → 200 { ok: true, position: number, already_registered?: boolean }
//
// GET  /functions/v1/waitlist-join   → { ok: true, count: number }
//   Nur die aggregierte Anzahl, nie Einzeldaten. Die Landingpage blendet den
//   Zähler aus, wenn der Call fehlschlägt — es wird nie eine Zahl geraten.
//
// Sicherheits-/Compliance-Bezug:
//   • Service-Role-Key bleibt serverseitig; die Tabelle hat bewusst keine
//     Anon-Insert-Policy, damit Validierung und Rate-Limit nicht umgehbar sind.
//   • DSGVO Art. 5 Abs. 1 lit. c (Datenminimierung): Die Client-IP wird nur als
//     SHA-256-Hash gespeichert — genug für Missbrauchsabwehr, nicht mehr.
//   • Die Einwilligung wird über consent_at + ip_hash + user_agent nachweisbar
//     dokumentiert (Rechenschaftspflicht, Art. 5 Abs. 2).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const cors = buildCorsHeaders('GET, POST, OPTIONS');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERESTS = ['runtime', 'siteos', 'evidence', 'provenance', 'audit', 'other'] as const;
const TEAM_SIZES = ['1-9', '10-49', '50-249', '250-999', '1000+'] as const;

/** Anmeldungen pro IP-Hash und Stunde. */
const RATE_LIMIT = 5;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Nur bekannte utm_*-Schlüssel übernehmen — kein Freitext-JSON aus dem Client. */
function pickUtm(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const val = clean((raw as Record<string, unknown>)[key], 120);
    if (val) out[key] = val;
  }
  return out;
}

interface WaitlistBody {
  email?: unknown;
  company?: unknown;
  role?: unknown;
  interest?: unknown;
  team_size?: unknown;
  note?: unknown;
  source?: unknown;
  referrer?: unknown;
  utm?: unknown;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, cors);
  if (preflight) return preflight;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SRK) {
    return jsonError(500, 'NOT_CONFIGURED', 'supabase env missing', cors);
  }
  const supa = createClient(SUPABASE_URL, SRK);

  // ── GET: aggregierter Zähler für die Landingpage ──────────────────────────
  if (req.method === 'GET') {
    const { count, error } = await supa
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'invited', 'converted']);
    if (error) return jsonError(500, 'INTERNAL', error.message, cors);
    return jsonResponse({ ok: true, count: count ?? 0 }, 200, cors);
  }

  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'GET or POST only', cors);

  let body: WaitlistBody;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', cors);
  }

  const email = (clean(body.email, 254) ?? '').toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return jsonError(400, 'INVALID_EMAIL', 'Bitte eine gültige E-Mail-Adresse angeben.', cors);
  }

  const interestRaw = clean(body.interest, 32) ?? 'runtime';
  const interest = (INTERESTS as readonly string[]).includes(interestRaw) ? interestRaw : 'other';

  const teamSizeRaw = clean(body.team_size, 16);
  const teamSize = teamSizeRaw && (TEAM_SIZES as readonly string[]).includes(teamSizeRaw)
    ? teamSizeRaw
    : null;

  const ipHeader = req.headers.get('x-forwarded-for')
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await supa
    .from('waitlist_signups')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', oneHourAgo);
  if ((recent ?? 0) >= RATE_LIMIT) {
    return jsonError(429, 'RATE_LIMITED', 'Zu viele Anmeldungen. Bitte später erneut versuchen.', cors);
  }

  // Idempotent: eine bereits vorhandene Anmeldung gibt ihre Position zurück,
  // statt einen Fehler zu werfen — doppeltes Absenden ist kein Fehlerfall.
  const { data: existing } = await supa
    .from('waitlist_signups')
    .select('position')
    .eq('email', email)
    .in('status', ['pending', 'invited', 'converted'])
    .maybeSingle();
  if (existing) {
    return jsonResponse(
      { ok: true, position: existing.position, already_registered: true },
      200,
      cors,
    );
  }

  const { data: row, error: insErr } = await supa
    .from('waitlist_signups')
    .insert({
      email,
      company: clean(body.company, 160),
      role: clean(body.role, 120),
      interest,
      team_size: teamSize,
      note: clean(body.note, 2000),
      source: clean(body.source, 64) ?? 'warteliste',
      referrer: clean(body.referrer, 500),
      utm: pickUtm(body.utm),
      ip_hash: ipHash,
      user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    })
    .select('position')
    .single();

  if (insErr) {
    // Race: zwei parallele Requests derselben Adresse — der Unique-Index greift.
    if (insErr.code === '23505') {
      const { data: raced } = await supa
        .from('waitlist_signups')
        .select('position')
        .eq('email', email)
        .in('status', ['pending', 'invited', 'converted'])
        .maybeSingle();
      if (raced) {
        return jsonResponse({ ok: true, position: raced.position, already_registered: true }, 200, cors);
      }
    }
    return jsonError(500, 'INTERNAL', insErr.message, cors);
  }

  return jsonResponse({ ok: true, position: row!.position }, 200, cors);
});
