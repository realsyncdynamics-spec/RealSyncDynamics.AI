// Zentrale Input-Validierung fuer Edge Functions.
//
// Hintergrund (Systemcheck 2026-05-28): viele Functions parsen rohes
// `await req.json()` ohne Schema. Dieser Helper macht eine validierte,
// laengen-begrenzte Eingabe zum Einzeiler und liefert bei Verstoss eine
// saubere 422-Response (statt undefinierten Verhaltens weiter unten).
//
// Nutzung in einer Function:
//
//   import { z } from 'npm:zod@3';
//   import { parseJson, ValidationError } from '../_shared/validate.ts';
//
//   const Body = z.object({
//     email: z.string().email().max(254),
//     message: z.string().max(4000).optional(),
//   });
//
//   try {
//     const body = await parseJson(req, Body, { maxBytes: 8192 });
//     // ... body ist typisiert + validiert
//   } catch (e) {
//     if (e instanceof ValidationError) return e.response(corsHeaders);
//     throw e;
//   }

import { z } from 'npm:zod@3';

export class ValidationError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.details = details;
  }
  /** Fertige JSON-Response (mit optionalen CORS-Headern). */
  response(extraHeaders: Record<string, string> = {}): Response {
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'VALIDATION', message: this.message, details: this.details } }),
      { status: this.status, headers: { ...extraHeaders, 'content-type': 'application/json' } },
    );
  }
}

interface ParseOpts {
  /** Harte Obergrenze fuer die Request-Groesse (Schutz vor Overflow/DoS). Default 16 KB. */
  maxBytes?: number;
}

/**
 * Liest den Request-Body, erzwingt eine Groessen-Grenze, parst JSON und
 * validiert gegen das zod-Schema. Wirft ValidationError (422/400/413) bei
 * Verstoss — niemals einen unvalidierten Wert.
 */
export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
  opts: ParseOpts = {},
): Promise<T> {
  const maxBytes = opts.maxBytes ?? 16384;
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new ValidationError(413, `body too large (max ${maxBytes} bytes)`);
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ValidationError(400, 'invalid json');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(422, 'input validation failed', result.error.flatten());
  }
  return result.data;
}
