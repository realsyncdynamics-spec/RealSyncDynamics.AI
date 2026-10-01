// HTTP-Hilfen des Cloudflare-Executors — derselbe Vertrag wie
// deploy/playwright-scanner/server.ts (Antwortform, Fehlercodes, Grenzen).

import { ExecutorError } from '../../../deploy/playwright-scanner/session-core.js';

export const MAX_BODY_BYTES = 1_000_000;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/**
 * Fehler → Antwort. ExecutorError trägt nur feste Codes und Extras aus
 * session-core (current_url, blocked_origin); alles andere wird zu INTERNAL,
 * ohne Meldungstext (Playwright-Meldungen können Eingaben enthalten).
 */
export function errorResponse(err: unknown, log: (event: Record<string, unknown>) => void): Response {
  if (err instanceof ExecutorError) return json(err.status, { ok: false, error: err.code, ...err.extra });
  log({ event: 'internal_error', error_type: err instanceof Error ? err.name : typeof err });
  return json(500, { ok: false, error: 'INTERNAL' });
}

/** JSON-Body mit Größenbremse; Fehler als ExecutorError. */
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new ExecutorError('BODY_TOO_LARGE', 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new ExecutorError('BODY_TOO_LARGE', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new ExecutorError('INVALID_JSON', 400);
  }
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/**
 * Schlüsselvergleich in konstanter Zeit: verglichen werden die SHA-256-Digests
 * (gleiche Länge unabhängig von der Eingabe), Byte für Byte ohne frühen Abbruch.
 */
export async function apiKeyMatches(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Bearer-Token oder x-api-key (wie der Node-Executor). */
export function presentedKey(request: Request): string | null {
  const header = request.headers.get('x-api-key');
  if (header) return header;
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return m ? m[1]! : null;
}

export function sessionIdOf(body: unknown): string {
  const id = (body as { session_id?: unknown } | null)?.session_id;
  if (typeof id !== 'string' || id.length < 16 || id.length > 200) throw new ExecutorError('INVALID_SESSION');
  return id;
}
