// Cloudflare Turnstile — serverseitige Prüfung (Siteverify) für den
// öffentlichen Audit-Copilot (ai-gateway `mode: 'audit_anon'`).
//
// Entscheidung Dominik (26.09., 00:35): Turnstile NUR auf dem anon-Pfad,
// fail-closed, VOR Rate-Limit-Zählung und VOR Provider-Aufruf. Der
// eingeloggte Pfad bleibt unverändert.
//
// Codes:
//   400 TURNSTILE_MISSING       kein/leerer/zu langer Token im Body
//   403 TURNSTILE_FAILED        success=false, Hostname/Action passt nicht,
//                               HTTP-/Netzwerkfehler, Timeout, kaputte Antwort
//   503 TURNSTILE_UNCONFIGURED  Env TURNSTILE_SECRET_KEY fehlt
//
// Keine Deno-/jsr-Importe (vitest-importierbar). Das Secret wird nie
// geloggt oder zurückgegeben.
//
// Quelle: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// (POST …/siteverify, JSON oder Form; Felder secret/response/remoteip;
// Token max. 2048 Zeichen, 300 s gültig, einmal verwendbar; Antwort mit
// success/hostname/action/error-codes).

import type { Rejection } from './access.ts';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TOKEN_MAX_CHARS = 2048;
export const TURNSTILE_TIMEOUT_MS = 5_000;
/** Erwartete Action, falls das Widget eine setzt (data-action="audit_copilot"). */
export const TURNSTILE_EXPECTED_ACTION = 'audit_copilot';
/** Standard-Hostnamen; per Env TURNSTILE_ALLOWED_HOSTNAMES (kommagetrennt) überschreibbar. */
export const TURNSTILE_DEFAULT_HOSTNAMES = ['realsyncdynamicsai.de', 'www.realsyncdynamicsai.de'] as const;

export type TurnstileResult =
  | { ok: true; hostname: string | null; action: string | null }
  | (Rejection & { ok: false; reason: string });

function fail(status: number, code: string, reason: string, message: string): TurnstileResult {
  return { ok: false, status, code, message, reason };
}

/** Liest `turnstile_token` aus dem Body (oberste Ebene). */
export function readTurnstileToken(body: unknown): string | null {
  const t = body && typeof body === 'object' ? (body as { turnstile_token?: unknown }).turnstile_token : undefined;
  if (typeof t !== 'string') return null;
  const s = t.trim();
  if (s.length === 0 || s.length > TURNSTILE_TOKEN_MAX_CHARS) return null;
  return s;
}

export function allowedHostnames(env: (name: string) => string | undefined): string[] {
  const raw = env('TURNSTILE_ALLOWED_HOSTNAMES');
  const list = (raw ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 ? list : [...TURNSTILE_DEFAULT_HOSTNAMES];
}

export interface VerifyTurnstileArgs {
  body: unknown;
  /** CF-Connecting-IP der Anfrage; fehlt sie, wird remoteip weggelassen (optional laut API). */
  remoteIp: string | null;
  env: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Prüft den Token fail-closed. Reihenfolge: Token vorhanden → Secret
 * vorhanden → Siteverify (mit Timeout) → success → Hostname → Action.
 */
export async function verifyTurnstile(args: VerifyTurnstileArgs): Promise<TurnstileResult> {
  const token = readTurnstileToken(args.body);
  if (!token) {
    return fail(400, 'TURNSTILE_MISSING', 'missing', 'turnstile_token is required');
  }
  const secret = args.env('TURNSTILE_SECRET_KEY');
  if (!secret) {
    return fail(503, 'TURNSTILE_UNCONFIGURED', 'unconfigured', 'Bot-Schutz ist nicht konfiguriert.');
  }

  const payload: Record<string, string> = { secret, response: token };
  if (args.remoteIp) payload.remoteip = args.remoteIp;

  const fetchImpl = args.fetchImpl ?? fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? TURNSTILE_TIMEOUT_MS);
  let data: { success?: unknown; hostname?: unknown; action?: unknown; 'error-codes'?: unknown };
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return fail(403, 'TURNSTILE_FAILED', `http_${res.status}`, 'Bot-Prüfung fehlgeschlagen.');
    data = await res.json();
  } catch (e) {
    const reason = (e as Error)?.name === 'AbortError' ? 'timeout' : 'network';
    return fail(403, 'TURNSTILE_FAILED', reason, 'Bot-Prüfung fehlgeschlagen.');
  } finally {
    clearTimeout(timer);
  }

  if (!data || typeof data !== 'object' || data.success !== true) {
    const codes = Array.isArray(data?.['error-codes']) ? (data['error-codes'] as unknown[]).map(String).join(',') : '';
    return fail(403, 'TURNSTILE_FAILED', codes ? `rejected:${codes}` : 'rejected', 'Bot-Prüfung fehlgeschlagen.');
  }
  const hostname = typeof data.hostname === 'string' ? data.hostname.toLowerCase() : null;
  if (!hostname || !allowedHostnames(args.env).includes(hostname)) {
    return fail(403, 'TURNSTILE_FAILED', 'hostname_mismatch', 'Bot-Prüfung fehlgeschlagen.');
  }
  const action = typeof data.action === 'string' && data.action !== '' ? data.action : null;
  if (action !== null && action !== TURNSTILE_EXPECTED_ACTION) {
    return fail(403, 'TURNSTILE_FAILED', 'action_mismatch', 'Bot-Prüfung fehlgeschlagen.');
  }
  return { ok: true, hostname, action };
}
