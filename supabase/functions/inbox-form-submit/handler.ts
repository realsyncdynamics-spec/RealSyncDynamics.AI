// inbox-form-submit — Handler (kein Deno, kein jsr). Getestet in
// test/edge/inbox-form-submit.test.ts gegen ein In-Memory-Repo.
//
// Ablauf (fail-closed, kein KI-Aufruf):
//   OPTIONS → CORS · nur POST · Salt vorhanden? sonst 503, nichts geschrieben
//   Body ≤ 16 KB, JSON · Honeypot → 400 ohne Schreiben
//   Validierung (site_ref, nonce, Anliegen, Kontakt, Einwilligung)
//   IP-Hash (HMAC) · Isolate-Rate-Limit (5/min)
//   → EINE atomare RPC inbox_form_submit_intake: Auflösung (sonst not_found →
//     404), Duplikat (bot_id + external_ref 'form:<site_ref>:<nonce>' → 200),
//     Kontingente je ip_hash (10/h) und je Binding (60/h, IP-unabhängig) →
//     429, sonst Konversation + Intake + Nachricht in einer Transaktion → 201.
//
// Die Antwort enthält nie tenant_id, bot_id oder Binding-Daten.

import { buildCorsHeaders, handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../_shared/gateway.ts';
import { readCappedText } from '../_shared/readCappedBody.ts';
import { checkAnonRateLimit } from '../_shared/anonRateLimit.ts';
import type { InboxRepo } from './repo.ts';
import {
  BODY_MAX_BYTES,
  clientIp,
  contactLabel,
  hashIp,
  isHoneypotTripped,
  parseSubmit,
} from './logic.ts';

export const RATE_LIMIT_PER_MINUTE = 5;
export const RATE_LIMIT_PER_HOUR = 10;
/**
 * IP-unabhängiges Kontingent je Seite (Binding) und Stunde. Greift auch, wenn
 * ein Angreifer die Absenderadresse wechselt. Für einen Handwerksbetrieb sind
 * 60 echte Formularanfragen pro Stunde weit jenseits des Normalbetriebs.
 */
export const RATE_LIMIT_PER_SITE_PER_HOUR = 60;

export interface HandlerDeps {
  repo: InboxRepo;
  /** Function-Secret INBOX_FORM_HASH_SALT. Leer → 503, nichts wird geschrieben. */
  hashSalt: string;
  now?: () => Date;
  /** Isolate-Zähler, injizierbar für Tests. */
  anonLimit?: (ipHash: string) => { allowed: boolean };
}

const cors = buildCorsHeaders('POST, OPTIONS');

export async function handleInboxFormSubmit(req: Request, deps: HandlerDeps): Promise<Response> {
  const preflight = handleOptions(req, cors);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed(cors);

  if (!deps.hashSalt) {
    return jsonError(503, 'NOT_CONFIGURED', 'form intake not configured', cors);
  }

  const body = await readCappedText(req, BODY_MAX_BYTES);
  if (!body.ok) return jsonError(413, 'BODY_TOO_LARGE', `max ${BODY_MAX_BYTES} bytes`, cors);

  let raw: unknown;
  try {
    raw = JSON.parse(body.text);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', cors);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return jsonError(400, 'BAD_REQUEST', 'invalid body', cors);
  }

  // Honeypot vor jeder weiteren Arbeit: gleiche Antwort wie ungültige Eingabe.
  if (isHoneypotTripped(raw as Record<string, unknown>)) {
    return jsonError(400, 'BAD_REQUEST', 'invalid request', cors);
  }

  const parsed = parseSubmit(raw);
  if (!parsed.ok) return jsonError(400, parsed.code, parsed.message, cors);
  const input = parsed.input;

  const ipHash = await hashIp(clientIp(req.headers), deps.hashSalt);

  const limiter = deps.anonLimit ?? ((h: string) =>
    checkAnonRateLimit(h, { max: RATE_LIMIT_PER_MINUTE, windowMs: 60_000, bucket: 'inbox-form' }));
  if (!limiter(ipHash).allowed) {
    return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later', { ...cors, 'Retry-After': '60' });
  }

  // Alles Weitere atomar in der Datenbank (siehe repo.ts / Migration Abschnitt 7).
  let result: Awaited<ReturnType<InboxRepo['submit']>>;
  try {
    result = await deps.repo.submit({
    site_ref: input.site_ref,
    nonce: input.nonce,
    ip_hash: ipHash,
    anliegen: input.anliegen,
    kontakt_name: input.kontakt_name,
    kontakt_telefon: input.kontakt_telefon,
    kontakt_email: input.kontakt_email,
    terminwunsch: input.terminwunsch,
    contact_label: contactLabel(input),
    ip_limit: RATE_LIMIT_PER_HOUR,
    site_limit: RATE_LIMIT_PER_SITE_PER_HOUR,
    });
  } catch {
    // Technischer Fehler (DB nicht erreichbar, RPC fehlt): keine Details nach
    // aussen, keine Erfolgsmeldung. Die Transaktion hat nichts hinterlassen.
    return jsonError(500, 'INTERNAL', 'could not store request', cors);
  }

  switch (result.status) {
    case 'not_found':
      // Unbekannt, deaktiviert, Seite nicht live oder Bot aus — nichts geschrieben.
      return jsonError(404, 'NOT_FOUND', 'unknown site', cors);
    case 'rate_limited':
      return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later', { ...cors, 'Retry-After': '3600' });
    case 'duplicate':
      return jsonResponse({ ok: true, status: 'duplicate', reference: result.conversation_id.slice(0, 8) }, 200, cors);
    case 'received':
      return jsonResponse({ ok: true, status: 'received', reference: result.conversation_id.slice(0, 8) }, 201, cors);
  }
}
