// Fehlerbericht des ai-gateway: stabiler Fehlercode für die Antwort und eine
// gekürzte, bereinigte Logzeile. Ergänzt mapInferenceError (openaiCompat.ts,
// Spiegel des Frontends, bleibt unverändert) um feinere Codes für den Fall,
// dass der Catch-all bisher nur INFERENCE_ERROR lieferte — und schreibt den
// Fehlertext endlich ins Log (vorher: 500 ohne jede Spur, siehe Brief-Cron).
//
// Keine Deno-/jsr-Importe (vitest-importierbar).

import { mapInferenceError } from './openaiCompat.ts';

export const LOG_MESSAGE_MAX_CHARS = 300;
export const CLIENT_MESSAGE_MAX_CHARS = 200;

/**
 * Entfernt alles, was nach Credential aussieht, und kürzt. Provider-
 * Fehlermeldungen enthalten normalerweise keine Prompts; gekürzt wird
 * trotzdem, damit ein Echo des Inputs nicht vollständig im Log landet.
 */
export function sanitizeErrorText(text: string, max = LOG_MESSAGE_MAX_CHARS): string {
  const cleaned = text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]+/g, '[jwt]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[key]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{8,}/g, '[key]')
    .replace(/\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g, '[key]')
    .replace(/(api[_-]?key|x-api-key|token|secret|password)(["'\s:=]+)[^\s"',}]+/gi, '$1$2[redacted]')
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[cred]@')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

export interface InferenceErrorReport {
  status: number;
  /** Stabiler, maschinenlesbarer Code für Aufrufer. */
  code: string;
  /** Bereinigte, gekürzte Meldung für die Antwort. */
  message: string;
  /** Bereinigte, gekürzte Meldung für das Log. */
  logMessage: string;
}

/**
 * Stabile Codes:
 *   UPSTREAM_BAD_OUTPUT      502  Provider lieferte kein gültiges JSON
 *   UPSTREAM_UNAVAILABLE     502  Provider nicht erreichbar / 5xx / kein lokales Modell
 *   LOCAL_PROVIDER_UNREACHABLE 503 lokale Base-URL in der Cloud nicht erreichbar
 *   PROVIDER_NOT_CONFIGURED  503  Profil ohne konfigurierten Provider
 *   UPSTREAM_AUTH_FAILED     502  Provider lehnt Zugangsdaten ab
 *   UPSTREAM_QUOTA           502  Provider-Kontingent/Guthaben erschöpft
 *   UPSTREAM_REJECTED        502  Provider lehnt die Anfrage ab (4xx-Validierung)
 *   INFERENCE_ERROR          500  unklassifiziert (Catch-all)
 */
export function reportInferenceError(error: unknown): InferenceErrorReport {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown error';
  const logMessage = sanitizeErrorText(raw, LOG_MESSAGE_MAX_CHARS);
  const message = sanitizeErrorText(raw, CLIENT_MESSAGE_MAX_CHARS);
  const base = mapInferenceError(error);

  if (/local provider unreachable/i.test(raw)) {
    return { status: 503, code: 'LOCAL_PROVIDER_UNREACHABLE', message, logMessage };
  }
  if (base.code !== 'INFERENCE_ERROR') {
    return { status: base.status, code: base.code, message, logMessage };
  }
  if (/Provider not configured/i.test(raw)) {
    return { status: 503, code: 'PROVIDER_NOT_CONFIGURED', message, logMessage };
  }
  if (/invalid x-api-key|authentication|unauthori[sz]ed|incorrect api key|invalid api key|permission/i.test(raw)) {
    return { status: 502, code: 'UPSTREAM_AUTH_FAILED', message, logMessage };
  }
  if (/credit balance|insufficient_quota|quota|billing/i.test(raw)) {
    return { status: 502, code: 'UPSTREAM_QUOTA', message, logMessage };
  }
  if (/HTTP 4\d\d|invalid_request|Input should|messages\.|content|must be|expected|invalid type|not found|model/i.test(raw)) {
    return { status: 502, code: 'UPSTREAM_REJECTED', message, logMessage };
  }
  return { status: 500, code: 'INFERENCE_ERROR', message, logMessage };
}
