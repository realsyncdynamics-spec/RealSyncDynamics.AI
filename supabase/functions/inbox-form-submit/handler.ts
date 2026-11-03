// inbox-form-submit — Handler (kein Deno, kein jsr). Getestet in
// test/edge/inbox-form-submit.test.ts gegen ein In-Memory-Repo.
//
// Ablauf (fail-closed, kein KI-Aufruf):
//   OPTIONS → CORS · nur POST · Salt vorhanden? sonst 503, nichts geschrieben
//   Body ≤ 16 KB, JSON · Honeypot → 400 ohne Schreiben
//   Validierung (site_ref, nonce, Anliegen, Kontakt, Einwilligung)
//   IP-Hash (HMAC) · Isolate-Rate-Limit · resolve_site_inbox → sonst 404
//   DB-Rate-Limit je ip_hash/Mandant (1 h) · INSERT Konversation
//   (Idempotenz: bot_id + external_ref 'form:<site_ref>:<nonce>')
//   → Intake → Nachricht. Scheitert Intake/Nachricht: Konversation löschen.
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
  externalRef,
  hashIp,
  isHoneypotTripped,
  parseSubmit,
} from './logic.ts';

export const RATE_LIMIT_PER_MINUTE = 5;
export const RATE_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

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

  const now = deps.now ? deps.now() : new Date();
  const ipHash = await hashIp(clientIp(req.headers), deps.hashSalt);

  const limiter = deps.anonLimit ?? ((h: string) =>
    checkAnonRateLimit(h, { max: RATE_LIMIT_PER_MINUTE, windowMs: 60_000, bucket: 'inbox-form' }));
  if (!limiter(ipHash).allowed) {
    return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later', { ...cors, 'Retry-After': '60' });
  }

  // Fail-closed: unbekannt, deaktiviert, Seite nicht live oder Bot aus → 404,
  // nichts wird geschrieben.
  const inbox = await deps.repo.resolveSiteInbox(input.site_ref);
  if (!inbox) return jsonError(404, 'NOT_FOUND', 'unknown site', cors);

  const since = new Date(now.getTime() - HOUR_MS).toISOString();
  const recent = await deps.repo.countRecentByIpHash(inbox.tenant_id, ipHash, since);
  if (recent >= RATE_LIMIT_PER_HOUR) {
    return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later', { ...cors, 'Retry-After': '3600' });
  }

  const nowIso = now.toISOString();
  const created = await deps.repo.insertConversation({
    tenant_id: inbox.tenant_id,
    bot_id: inbox.bot_id,
    external_ref: externalRef(input.site_ref, input.nonce),
    contact_label: contactLabel(input),
    metadata: {
      source: 'site_form',
      site_ref: input.site_ref,
      binding_id: inbox.binding_id,
      website_project_id: inbox.website_project_id,
      ip_hash: ipHash,
    },
    now: nowIso,
  });

  if (!created.ok) {
    if (created.reason === 'duplicate') {
      return jsonResponse({ ok: true, status: 'duplicate', reference: created.id.slice(0, 8) }, 200, cors);
    }
    return jsonError(500, 'INTERNAL', 'could not store request', cors);
  }

  const intake = await deps.repo.insertIntake({
    conversation_id: created.id,
    tenant_id: inbox.tenant_id,
    anliegen: input.anliegen,
    kontakt_name: input.kontakt_name,
    kontakt_telefon: input.kontakt_telefon,
    kontakt_email: input.kontakt_email,
    terminwunsch: input.terminwunsch,
    einwilligung_at: nowIso,
  });
  if (!intake.ok) {
    await deps.repo.deleteConversation(created.id);
    return jsonError(500, 'INTERNAL', 'could not store request', cors);
  }

  const msg = await deps.repo.insertUserMessage({
    tenant_id: inbox.tenant_id,
    conversation_id: created.id,
    bot_id: inbox.bot_id,
    content: input.anliegen,
  });
  if (!msg.ok) {
    await deps.repo.deleteConversation(created.id);
    return jsonError(500, 'INTERNAL', 'could not store request', cors);
  }

  return jsonResponse({ ok: true, status: 'received', reference: created.id.slice(0, 8) }, 201, cors);
}
