// Bot-Kanal-Auth für browserseitige Endpunkte (bot-chat, appointment-book,
// order-intake). Erfindet keine neue Kryptographie: HMAC-SHA256 kommt aus
// meta-signature.ts (dieselbe Routine wie X-Hub-Signature-256), der
// konstantzeitige Vergleich aus timingSafeEqual.ts, das Secret-Lookup im
// aufrufenden Edge-Handler über resolveCronKey (env, sonst Vault, fail-closed).
//
// Token-Format (kein JWT, keine neue Bibliothek):
//   v1.<payloadHex>.<hmacHex>
// payload (UTF-8, dann Hex):
//   v1\n<tenant_id>\n<bot_id>\n<normalized-origin>\n<exp_unix>
// HMAC über die Zeichenkette "v1.<payloadHex>" mit BOT_WIDGET_SIGNING_KEY
// bzw. Vault-Secret "bot_widget_signing_key".
//
// Deno-frei, damit Vitest denselben Code prüft.

import { computeMetaSignatureHex } from './meta-signature.ts';
import { timingSafeEqual } from './timingSafeEqual.ts';
import { originAllowed } from './bot-budget.ts';

export const WIDGET_TOKEN_VERSION = 'v1';
export const WIDGET_TOKEN_DEFAULT_TTL_SEC = 3600;
export const WIDGET_TOKEN_MAX_TTL_SEC = 24 * 3600;
export const WIDGET_TOKEN_HEADER = 'x-rsd-bot-widget-token';

export type WidgetAuthFailure = {
  ok: false;
  status: 401 | 403 | 500;
  code: string;
  message: string;
};

export type WidgetAuthSuccess = { ok: true };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(out);
}

export function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, '');
}

function canonicalPayload(tenantId: string, botId: string, origin: string, exp: number): string {
  return `${WIDGET_TOKEN_VERSION}\n${tenantId}\n${botId}\n${normalizeOrigin(origin)}\n${exp}`;
}

export async function mintWidgetToken(args: {
  secret: string;
  tenantId: string;
  botId: string;
  origin: string;
  now?: Date;
  ttlSec?: number;
}): Promise<string> {
  const secret = args.secret.trim();
  if (!secret) throw new Error('mintWidgetToken: empty secret');
  const origin = args.origin.trim();
  if (!origin) throw new Error('mintWidgetToken: origin required');
  const ttl = Math.min(
    Math.max(1, args.ttlSec ?? WIDGET_TOKEN_DEFAULT_TTL_SEC),
    WIDGET_TOKEN_MAX_TTL_SEC,
  );
  const exp = Math.floor((args.now ?? new Date()).getTime() / 1000) + ttl;
  const payloadHex = toHex(new TextEncoder().encode(
    canonicalPayload(args.tenantId, args.botId, origin, exp),
  ));
  const signed = `${WIDGET_TOKEN_VERSION}.${payloadHex}`;
  const hmacHex = await computeMetaSignatureHex(secret, signed);
  return `${signed}.${hmacHex}`;
}

export async function verifyWidgetToken(args: {
  secret: string;
  token: string;
  tenantId: string;
  botId: string;
  origin: string | null;
  now?: Date;
}): Promise<{ ok: true; exp: number } | { ok: false; reason: string }> {
  const secret = args.secret.trim();
  if (!secret) return { ok: false, reason: 'empty_secret' };
  const token = args.token.trim();
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [version, payloadHex, hmacHex] = parts;
  if (version !== WIDGET_TOKEN_VERSION) return { ok: false, reason: 'version' };
  if (!/^[0-9a-f]+$/i.test(payloadHex) || payloadHex.length % 2 !== 0) {
    return { ok: false, reason: 'payload' };
  }
  if (!/^[0-9a-f]{64}$/i.test(hmacHex)) return { ok: false, reason: 'hmac' };

  const expected = await computeMetaSignatureHex(secret, `${version}.${payloadHex}`);
  if (!timingSafeEqual(hmacHex.toLowerCase(), expected)) {
    return { ok: false, reason: 'signature' };
  }

  const payload = fromHex(payloadHex.toLowerCase());
  if (payload === null) return { ok: false, reason: 'payload' };
  const fields = payload.split('\n');
  if (fields.length !== 5 || fields[0] !== WIDGET_TOKEN_VERSION) {
    return { ok: false, reason: 'payload' };
  }
  const [, tid, bid, tokOrigin, expRaw] = fields;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp <= 0) return { ok: false, reason: 'exp' };
  const nowSec = Math.floor((args.now ?? new Date()).getTime() / 1000);
  if (exp <= nowSec) return { ok: false, reason: 'expired' };
  if (tid !== args.tenantId || bid !== args.botId) return { ok: false, reason: 'binding' };
  if (!args.origin) return { ok: false, reason: 'origin_missing' };
  if (normalizeOrigin(args.origin) !== tokOrigin) return { ok: false, reason: 'origin_mismatch' };
  return { ok: true, exp };
}

export function readWidgetToken(req: Request, body: Record<string, unknown>): string {
  const header = req.headers.get(WIDGET_TOKEN_HEADER) ?? req.headers.get('X-RSD-Bot-Widget-Token') ?? '';
  if (header.trim()) return header.trim();
  const fromBody = body.widget_token;
  return typeof fromBody === 'string' ? fromBody.trim() : '';
}

/**
 * Pflichtprüfung für die drei Browser-Endpunkte:
 * 1. Signatur-Secret muss gesetzt sein (sonst 500, fail-closed).
 * 2. Widget-Token muss vorliegen und zur Anfrage (tenant, bot, Origin) passen.
 * 3. Origin muss in bot.config.allowed_origins stehen (leere Liste = Ablehnung).
 */
export async function assertBotBrowserAccess(args: {
  secret: string;
  req: Request;
  body: Record<string, unknown>;
  tenantId: string;
  botId: string;
  botConfig: Record<string, unknown> | null | undefined;
  now?: Date;
}): Promise<WidgetAuthSuccess | WidgetAuthFailure> {
  const secret = args.secret.trim();
  if (!secret) {
    return {
      ok: false,
      status: 500,
      code: 'WIDGET_SIGNING_KEY_MISSING',
      message: 'widget signing key is not configured',
    };
  }

  const origin = args.req.headers.get('origin');
  if (!originAllowed(origin, args.botConfig)) {
    return {
      ok: false,
      status: 403,
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'origin not allowed for this bot',
    };
  }

  const token = readWidgetToken(args.req, args.body);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'WIDGET_TOKEN_REQUIRED',
      message: 'widget token required',
    };
  }

  const verified = await verifyWidgetToken({
    secret,
    token,
    tenantId: args.tenantId,
    botId: args.botId,
    origin,
    now: args.now,
  });
  if (!verified.ok) {
    return {
      ok: false,
      status: 401,
      code: 'WIDGET_TOKEN_INVALID',
      message: 'widget token invalid',
    };
  }
  return { ok: true };
}

/** CORS-Zusatzheader, damit Browser den Token-Header im Preflight senden dürfen. */
export const BOT_WIDGET_CORS_EXTRA_HEADERS = [WIDGET_TOKEN_HEADER] as const;
