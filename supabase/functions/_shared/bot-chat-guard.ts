// Schranken für den öffentlichen Chat-Endpoint `bot-chat`.
//
// ## Warum
//
// `bot-chat` läuft mit `verify_jwt = false`: Das Web-Widget eines Kunden ruft
// ihn ohne Anmeldung auf. Bis 2026-10-16 genügte das Paar (tenant_id, bot_id)
// — beides steht im Quelltext jeder Seite, die das Widget einbettet. Wer es
// kannte, konnte in Schleife Nachrichten schicken. Jede verbuchte eine Einheit
// `limit.bot_messages_monthly` und löste einen bezahlten Modellaufruf aus. Ein
// einzelnes Skript konnte so das Monatskontingent eines Mandanten leeren und
// seinen Bot für echte Besucher abschalten.
//
// ## Was hier entschieden wird (rein, ohne Netzwerk)
//
// 1. Eingaben: Kennungen sind UUIDs, Freitextfelder haben Längengrenzen —
//    bevor irgendetwas in eine Abfrage geht.
// 2. Herkunft: Trägt der Bot `config.allowed_origins`, muss der
//    `Origin`-Header exakt passen. Ohne Liste bleibt der Bot erreichbar wie
//    bisher (bestehende Einbettungen brechen nicht), die Antwort meldet das
//    aber als `origin_unrestricted`.
// 3. Takt: Nachrichten je Konversation und je Mandant pro Minute, gezählt aus
//    `bot_messages` — also über Isolate und Kaltstarts hinweg. Dazu kommt die
//    Bremse je Quelle aus `anonRateLimit.ts` (nur im Arbeitsspeicher).
//
// Grenze: Ein verteilter Angriff von vielen Adressen bleibt bis zur
// Mandantengrenze möglich. Die Mandantengrenze deckelt aber, wie schnell das
// Monatskontingent leerlaufen kann.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_RE = /^[A-Za-z0-9._:-]+$/;

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_CONVERSATION_REF_CHARS = 128;
export const MAX_CONTACT_LABEL_CHARS = 200;

/** Nachrichten je Konversation und Minute. Ein Mensch tippt nicht schneller. */
export const CONVERSATION_MESSAGES_PER_MINUTE = 10;
/** Nachrichten je Mandant und Minute, über alle Bots und Besucher. */
export const TENANT_MESSAGES_PER_MINUTE = 120;
/** Anfragen je Quelle (IP-Hash) und Minute — Bremse im Arbeitsspeicher. */
export const SOURCE_REQUESTS_PER_MINUTE = 20;

export interface BotChatInput {
  tenantId: string;
  botId: string;
  message: string;
  conversationRef: string | null;
  contactLabel: string | null;
}

export type InputCheck =
  | { ok: true; value: BotChatInput }
  | { ok: false; message: string };

export function parseBotChatInput(body: Record<string, unknown>): InputCheck {
  const tenantId = body.tenant_id;
  const botId = body.bot_id;
  if (typeof tenantId !== 'string' || !UUID_RE.test(tenantId)) return { ok: false, message: 'tenant_id must be a uuid' };
  if (typeof botId !== 'string' || !UUID_RE.test(botId)) return { ok: false, message: 'bot_id must be a uuid' };

  const message = typeof body.message === 'string' ? body.message : '';
  if (!message.trim()) return { ok: false, message: 'message required' };
  if (message.length > MAX_MESSAGE_CHARS) return { ok: false, message: `message too long (>${MAX_MESSAGE_CHARS} chars)` };

  let conversationRef: string | null = null;
  if (body.conversation_ref !== undefined && body.conversation_ref !== null && body.conversation_ref !== '') {
    if (typeof body.conversation_ref !== 'string'
      || body.conversation_ref.length > MAX_CONVERSATION_REF_CHARS
      || !REF_RE.test(body.conversation_ref)) {
      return { ok: false, message: `conversation_ref must be 1-${MAX_CONVERSATION_REF_CHARS} chars of [A-Za-z0-9._:-]` };
    }
    conversationRef = body.conversation_ref;
  }

  let contactLabel: string | null = null;
  if (body.contact_label !== undefined && body.contact_label !== null && body.contact_label !== '') {
    if (typeof body.contact_label !== 'string' || body.contact_label.length > MAX_CONTACT_LABEL_CHARS) {
      return { ok: false, message: `contact_label must be a string of at most ${MAX_CONTACT_LABEL_CHARS} chars` };
    }
    contactLabel = body.contact_label.trim() || null;
  }

  return { ok: true, value: { tenantId, botId, message, conversationRef, contactLabel } };
}

/** `https://Shop.Example.de:443/` → `https://shop.example.de`. Ungültiges → null. */
export function normalizeOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

export type OriginDecision =
  | { allowed: true; restricted: boolean }
  | { allowed: false };

/**
 * Herkunftsprüfung gegen `bots.config.allowed_origins`.
 *
 * Eine konfigurierte, aber leere oder ungültige Liste gilt als **gesperrt**,
 * nicht als offen: Wer eine Liste anlegt, will einschränken. Nur ein Bot
 * ganz ohne Eintrag bleibt offen.
 */
export function decideOrigin(requestOrigin: string | null, config: unknown): OriginDecision {
  const raw = config && typeof config === 'object'
    ? (config as Record<string, unknown>).allowed_origins
    : undefined;
  if (raw === undefined || raw === null) return { allowed: true, restricted: false };

  const allowed = Array.isArray(raw)
    ? raw.map(normalizeOrigin).filter((o): o is string => o !== null)
    : [];
  const origin = normalizeOrigin(requestOrigin);
  if (origin !== null && allowed.includes(origin)) return { allowed: true, restricted: true };
  return { allowed: false };
}

export type RateScope = 'conversation' | 'tenant';

export function exceededScope(counts: { conversation: number; tenant: number }): RateScope | null {
  if (counts.conversation >= CONVERSATION_MESSAGES_PER_MINUTE) return 'conversation';
  if (counts.tenant >= TENANT_MESSAGES_PER_MINUTE) return 'tenant';
  return null;
}
