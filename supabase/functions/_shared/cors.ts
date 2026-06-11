// Shared CORS-Helper für alle Edge Functions.
//
// Ersetzt das pauschale `Access-Control-Allow-Origin: '*'`-Pattern durch
// eine Origin-Allowlist. Browser-Aufrufe von der eigenen Domain werden
// erlaubt, alles andere bekommt den Default-Origin (realsyncdynamicsai.de),
// was reflektiv keinen Cross-Origin-Zugriff freischaltet.
//
// Header-Werte werden über `Vary: Origin` korrekt cache-getrennt.
//
// Server-zu-Server-Calls (z. B. cron → Edge Function) und Edge-zu-Edge-
// Calls (z. B. tenant-audit → gdpr-audit) brauchen kein CORS, da kein
// Origin-Header gesetzt wird; der Helper liefert dann den Default-Origin
// und der Browser-Check entfällt.

const ALLOWED_ORIGINS = new Set<string>([
  'https://realsyncdynamicsai.de',
  'https://www.realsyncdynamicsai.de',
  // Vite-Dev + Preview
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

const DEFAULT_ORIGIN = 'https://realsyncdynamicsai.de';

const DEFAULT_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-tenant-id';

const DEFAULT_METHODS = 'POST, OPTIONS';

export interface CorsOptions {
  /** Optional zusätzliche Origins (z. B. Preview-Branches). */
  extraOrigins?: string[];
  /** Allow-Headers (kommagetrennt). Default deckt Supabase + Tenant-Header ab. */
  allowHeaders?: string;
  /** Allow-Methods. Default `POST, OPTIONS`. */
  allowMethods?: string;
}

/**
 * Liefert ein Header-Objekt für die Response. Origin wird gegen die
 * Allowlist gematcht; bei Miss wird der Default-Origin gesetzt (was
 * dem Browser CORS effektiv verweigert).
 */
export function corsHeaders(
  req: Request,
  options: CorsOptions = {},
): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = matchOrigin(origin, options.extraOrigins);
  return {
    'Access-Control-Allow-Origin': allowed,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': options.allowHeaders ?? DEFAULT_HEADERS,
    'Access-Control-Allow-Methods': options.allowMethods ?? DEFAULT_METHODS,
  };
}

/**
 * Pre-flight-Antwort (HTTP 200 + Allow-Header). Im Handler:
 *
 *     if (req.method === 'OPTIONS') return corsPreflight(req);
 */
export function corsPreflight(req: Request, options: CorsOptions = {}): Response {
  return new Response('ok', { headers: corsHeaders(req, options) });
}

/** Intern + für Tests exponiert. */
export function matchOrigin(origin: string, extra?: string[]): string {
  if (!origin) return DEFAULT_ORIGIN;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (extra && extra.includes(origin)) return origin;
  return DEFAULT_ORIGIN;
}

/**
 * Factory für Edge-Functions: gibt vorgebundene Antwort-Helfer zurück,
 * die alle CORS-Header korrekt setzen. Spart Boilerplate gegenüber der
 * früheren Module-Scope-`corsHeaders`-Konstante.
 *
 * Verwendung:
 *
 *     Deno.serve((req) => {
 *       const { json, jsonError, preflight } = withCors(req);
 *       if (req.method === 'OPTIONS') return preflight();
 *       if (!ok) return jsonError(400, 'BAD_REQUEST', 'missing field');
 *       return json({ ok: true });
 *     });
 */
export function withCors(req: Request, options: CorsOptions = {}) {
  const headers = corsHeaders(req, options);
  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, 'content-type': 'application/json' },
    });
  }
  return {
    corsHeaders: headers,
    json,
    jsonError(status: number, code: string, message: string): Response {
      return json({ ok: false, error: { code, message } }, status);
    },
    preflight(): Response {
      return new Response('ok', { headers });
    },
  };
}

export const __test = { ALLOWED_ORIGINS, DEFAULT_ORIGIN, matchOrigin };
