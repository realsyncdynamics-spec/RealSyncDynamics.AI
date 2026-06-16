// Gemeinsame Gateway-Helfer fuer Edge Functions: CORS, JSON-Responses,
// Method-Guards. Bisher hatte praktisch jede der ~70 Functions ihre eigene
// Kopie von `corsHeaders` + Boilerplate fuer OPTIONS/JSON — dieser Helfer
// macht das zu einem Einzeiler und vereinheitlicht das Response-Format.
//
// Migration ist inkrementell: bestehende Functions mit eigenem corsHeaders
// bleiben funktionsfaehig, neue/angefasste Functions nutzen diesen Helfer.

export type CorsHeaders = Record<string, string>;

/** Standard-CORS-Header. `methods` z.B. 'GET, OPTIONS' oder 'POST, OPTIONS'. */
export function buildCorsHeaders(methods = 'POST, OPTIONS'): CorsHeaders {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': methods,
  };
}

/** Default-Header fuer POST-Endpoints (haeufigster Fall). */
export const corsHeaders: CorsHeaders = buildCorsHeaders();

/**
 * Behandelt CORS-Preflight. Gibt eine `Response` zurueck, wenn `req` ein
 * OPTIONS-Request ist — sonst `null` (Caller faehrt normal fort).
 *
 *   const preflight = handleOptions(req, corsHeaders);
 *   if (preflight) return preflight;
 */
export function handleOptions(req: Request, headers: CorsHeaders = corsHeaders): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers }) : null;
}

/** JSON-Response mit CORS-Headern. */
export function jsonResponse(body: unknown, status = 200, headers: CorsHeaders = corsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json' },
  });
}

/** Einheitliches Error-Format: `{ ok: false, error: { code, message, details? } }`. */
export function jsonError(
  status: number,
  code: string,
  message: string,
  headers: CorsHeaders = corsHeaders,
  details?: unknown,
): Response {
  return jsonResponse(
    { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    status,
    headers,
  );
}

/** 405-Response fuer nicht erlaubte HTTP-Methoden. */
export function methodNotAllowed(headers: CorsHeaders = corsHeaders): Response {
  return jsonError(405, 'METHOD_NOT_ALLOWED', 'method not allowed', headers);
}
