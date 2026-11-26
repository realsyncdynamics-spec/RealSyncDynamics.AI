// appointment-book — Request-Handler mit austauschbaren Abhängigkeiten.
//
// Reihenfolge (fail-closed):
//   1. Methode, JSON, Eingabeprüfung (validate.ts)
//   2. Rate-Limit je IP-Hash, vor jedem Bot-Lookup
//   3. Bot auflösen über das Paar (tenant_id, bot_id), enabled
//   4. Origin (nur wenn der Bot allowed_origins pflegt)
//   5. Rate-Limit je IP+Bot und je Bot
//   6. Capability des Bots, danach Entitlement-Gate des Plans
//   7. Doppelte Anfrage derselben Konversation → bestehenden Termin zurückgeben
//   8. Termin anlegen; Konflikt am Unique-Index (gleichzeitige Anfragen)
//      → bestehenden Termin zurückgeben (atomar über die Datenbank)
// Interne Fehlertexte gehen nie an den Client.

import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../_shared/gateway.ts';
import { parseAppointmentInput, type AppointmentInput } from './validate.ts';

export interface AppointmentBot {
  id: string;
  tenant_id: string;
  config?: Record<string, unknown> | null;
  capabilities?: { appointments?: boolean } | null;
}

export type RateDecision = { allowed: true } | { allowed: false; scope: string };
export type GateResult = 'ok' | 'missing';
export interface StoredAppointment { id: string; status: string }
/** Insert-Ergebnis: angelegt oder Konflikt am Unique-Index (Duplikat). */
export type InsertResult = StoredAppointment | { conflict: true };

export interface AppointmentDeps {
  hashIp(req: Request): Promise<string>;
  rateIp(ipHash: string): Promise<RateDecision>;
  rateBot(ipHash: string, botId: string): Promise<RateDecision>;
  /** Wirft BotErrorLike (status/code) bei unbekanntem oder deaktiviertem Bot. */
  resolveBot(tenantId: string, botId: string): Promise<AppointmentBot>;
  originAllowed(origin: string | null, config: AppointmentBot['config']): boolean;
  hasCapability(bot: AppointmentBot): boolean;
  gate(bot: AppointmentBot): Promise<GateResult>;
  upsertConversation(bot: AppointmentBot, externalRef: string, contactLabel: string): Promise<string>;
  findDuplicate(bot: AppointmentBot, conversationId: string, input: AppointmentInput): Promise<StoredAppointment | null>;
  insertAppointment(bot: AppointmentBot, conversationId: string | null, input: AppointmentInput): Promise<InsertResult>;
  logError(scope: string, err: unknown): void;
  now(): Date;
}

interface BotErrorLike { status: number; code: string; message: string }

function isBotError(e: unknown): e is BotErrorLike {
  return typeof e === 'object' && e !== null
    && typeof (e as BotErrorLike).status === 'number'
    && typeof (e as BotErrorLike).code === 'string';
}

function rateLimited(scope: string): Response {
  const unavailable = scope === 'unavailable';
  const res = jsonError(
    unavailable ? 503 : 429,
    unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED',
    'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
  );
  if (!unavailable) res.headers.set('Retry-After', '60');
  return res;
}

export function createAppointmentHandler(deps: AppointmentDeps) {
  return async (req: Request): Promise<Response> => {
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (req.method !== 'POST') return methodNotAllowed();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'BAD_REQUEST', 'invalid json body');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return jsonError(400, 'BAD_REQUEST', 'invalid json body');
    }

    const parsed = parseAppointmentInput(body as Record<string, unknown>, deps.now());
    if (!parsed.ok) return jsonError(400, 'BAD_REQUEST', parsed.message);
    const input = parsed.value;

    try {
      const ipHash = await deps.hashIp(req);
      const ipDecision = await deps.rateIp(ipHash);
      if (!ipDecision.allowed) return rateLimited(ipDecision.scope);

      let bot: AppointmentBot;
      try {
        bot = await deps.resolveBot(input.tenantId, input.botId);
      } catch (e) {
        if (isBotError(e) && e.status < 500) return jsonError(e.status, e.code, e.message);
        throw e;
      }

      if (!deps.originAllowed(req.headers.get('origin'), bot.config)) {
        return jsonError(403, 'ORIGIN_NOT_ALLOWED', 'origin not allowed for this bot');
      }
      const botDecision = await deps.rateBot(ipHash, bot.id);
      if (!botDecision.allowed) return rateLimited(botDecision.scope);

      if (!deps.hasCapability(bot)) {
        return jsonError(403, 'CAPABILITY_DISABLED', 'this bot cannot book appointments');
      }
      if ((await deps.gate(bot)) !== 'ok') {
        return jsonError(403, 'ENTITLEMENT_MISSING', 'Terminbuchung ist im Plan dieses Arbeitsbereichs nicht enthalten (bots.appointments).');
      }

      const conversationId = input.conversationRef
        ? await deps.upsertConversation(bot, input.conversationRef, input.customerName)
        : null;

      if (conversationId) {
        const existing = await deps.findDuplicate(bot, conversationId, input);
        if (existing) {
          return jsonResponse({ ok: true, appointment_id: existing.id, status: existing.status, duplicate: true });
        }
      }

      const row = await deps.insertAppointment(bot, conversationId, input);
      if ('conflict' in row) {
        // Gleichzeitige Anfrage hat gewonnen: deren Termin zurückgeben.
        const winner = conversationId ? await deps.findDuplicate(bot, conversationId, input) : null;
        if (winner) {
          return jsonResponse({ ok: true, appointment_id: winner.id, status: winner.status, duplicate: true });
        }
        return jsonError(409, 'CONFLICT', 'appointment request already exists');
      }
      return jsonResponse({ ok: true, appointment_id: row.id, status: row.status });
    } catch (e) {
      deps.logError('appointment_book_failed', e);
      return jsonError(500, 'INTERNAL', 'internal error');
    }
  };
}
