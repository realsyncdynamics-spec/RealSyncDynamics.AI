// Öffentliches Kontaktformular einer SiteOS-Seite → Posteingang (PR C, Schritt 3).
//
// POST /functions/v1/inbox-form-submit
// Auth: keine (verify_jwt = false in config.toml) — die Seite ist öffentlich.
// Body (JSON):
//   site_ref           24 Zeichen, aus dem Binding (Schritt 1) — Pflicht
//   nonce              16–64 Zeichen [A-Za-z0-9_-], pro Formular zufällig — Pflicht
//   anliegen           ≤ 4000 Zeichen — Pflicht
//   kontakt_telefon / kontakt_email   mindestens eins — Pflicht
//   kontakt_name       ≤ 200, optional
//   terminwunsch       ≤ 500, optional — nur ein Wunsch, kein Termin
//   terminwunsch_zeit  ISO-Zeitpunkt, optional — nur ein Wunsch, kein Termin
//   company_website    Honeypot, muss leer bleiben
//
// Antworten (ohne Kontaktdaten, ohne interne IDs)
//   202 { ok: true }               angenommen (auch: Doppelabsendung, Honeypot)
//   400 BAD_REQUEST { field }      Eingabe ungültig
//   404 NOT_FOUND                  unbekannte, deaktivierte oder nicht live
//                                  geschaltete Seite bzw. Bot aus — einheitlich
//   413 PAYLOAD_TOO_LARGE
//   429 RATE_LIMITED
//   503 UNAVAILABLE                Schalter aus oder Datenbankfehler
//
// Nicht produktiv: Ohne `INBOX_FORM_SUBMIT_ENABLED=true` antwortet die
// Function mit 503 und schreibt nichts. Registereintrag `inbox-form-intake`
// (coming-soon) in src/product/implementation-status.ts.
//
// Kein KI-Aufruf. Mandant und Bot kommen nur aus `resolve_site_inbox`.
// Logik und Begründungen: ./logic.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { readCappedText } from '../_shared/readCappedBody.ts';
import {
  MAX_BODY_BYTES,
  checkFormRateLimit,
  formSubmitEnabled,
  isHoneypotTripped,
  resolveInbox,
  submitFormRequest,
  validateFormBody,
  type InboxDbClient,
} from './logic.ts';

/** IP nur als Hash im Arbeitsspeicher (Rate-Limit-Schlüssel), nie gespeichert. */
async function sourceHash(req: Request): Promise<string> {
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  if (!formSubmitEnabled(Deno.env.get('INBOX_FORM_SUBMIT_ENABLED'))) {
    return jsonError(503, 'UNAVAILABLE', 'Formular-Eingang ist nicht aktiv.');
  }

  const raw = await readCappedText(req, MAX_BODY_BYTES);
  if (!raw.ok) return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Anfrage zu groß.');

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw.text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  // Bots bekommen dieselbe Antwort wie Menschen, damit sie nichts lernen.
  if (isHoneypotTripped(body)) return jsonResponse({ ok: true }, 202);

  const validated = validateFormBody(body);
  if (!validated.ok) {
    return jsonResponse({ error: 'BAD_REQUEST', field: validated.field }, 400);
  }
  const input = validated.input;

  if (!checkFormRateLimit(await sourceHash(req), input.siteRef)) {
    return jsonError(429, 'RATE_LIMITED', 'Zu viele Anfragen. Bitte später erneut versuchen.');
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  ) as unknown as InboxDbClient;

  const resolved = await resolveInbox(db, input.siteRef);
  if (!resolved.ok) {
    if (resolved.reason === 'error') {
      console.error('inbox-form-submit: resolve failed', { code: resolved.code });
      return jsonError(503, 'UNAVAILABLE', 'Bitte später erneut versuchen.');
    }
    return jsonError(404, 'NOT_FOUND', 'Formular nicht gefunden.');
  }

  const result = await submitFormRequest(db, resolved.inbox, input, new Date());
  if (!result.ok) {
    console.error('inbox-form-submit: write failed', { stage: result.stage, code: result.code });
    return jsonError(503, 'UNAVAILABLE', 'Bitte später erneut versuchen.');
  }

  return jsonResponse({ ok: true }, 202);
});
