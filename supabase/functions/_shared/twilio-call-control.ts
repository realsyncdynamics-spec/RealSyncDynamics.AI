// Twilio REST: laufenden Anruf begrenzen oder beenden (Gate 1, PR #2044).
//
// Geprüft gegen die offizielle OpenAPI-Spezifikation twilio/twilio-oai
// (spec/json/twilio_api_v2010.json, POST /2010-04-01/Accounts/{AccountSid}/
// Calls/{Sid}.json): Request-Parameter `Status` (Enum: canceled | completed)
// und `TimeLimit` („maximum duration of the call in seconds. Constraints
// depend on account and configuration.“). GET derselben Ressource liefert
// `status`.
//
// NICHT live verifiziert: ob `TimeLimit` per Update auf einen bereits
// angenommenen eingehenden Anruf wirkt. Deshalb ist TimeLimit nur die erste
// Ebene; die zweite ist bot-voice-enforcer (Status=completed), die dritte
// die Zeitprüfung je Gesprächsschritt im Webhook.
//
// Ohne Deno-/jsr-Imports, damit Vitest das Modul laden kann.

export interface TwilioCreds {
  accountSid: string;
  authToken: string;
}

export type TwilioCallResult =
  | { ok: true; status: number }
  // not_active: Anruf existiert nicht (mehr) oder ist nicht mehr änderbar.
  // rejected:   Anfrage abgewiesen (Parameter, Konto) — nicht automatisch wiederholen.
  // auth:       Zugangsdaten falsch — Betrieb muss eingreifen.
  // unavailable: Netzwerk/Timeout/5xx/429 — Ergebnis unklar, später erneut.
  | { ok: false; kind: 'not_active' | 'rejected' | 'auth' | 'unavailable' | 'invalid_input'; status?: number; code?: number };

export interface TwilioCallOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

const ACCOUNT_SID_RE = /^AC[0-9a-f]{32}$/;
const CALL_SID_RE = /^CA[0-9a-f]{32}$/;

export function isValidAccountSid(v: string | null | undefined): v is string {
  return typeof v === 'string' && ACCOUNT_SID_RE.test(v);
}

export function isValidCallSid(v: string | null | undefined): v is string {
  return typeof v === 'string' && CALL_SID_RE.test(v);
}

function basicAuth(creds: TwilioCreds): string {
  return `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}`;
}

function callUrl(creds: TwilioCreds, callSid: string, baseUrl: string): string {
  return `${baseUrl}/2010-04-01/Accounts/${creds.accountSid}/Calls/${callSid}.json`;
}

async function request(
  creds: TwilioCreds,
  callSid: string,
  init: { method: 'GET' | 'POST'; form?: Record<string, string> },
  opts: TwilioCallOptions,
): Promise<{ result: TwilioCallResult; body: Record<string, unknown> | null }> {
  if (!isValidAccountSid(creds.accountSid) || !isValidCallSid(callSid) || !creds.authToken) {
    return { result: { ok: false, kind: 'invalid_input' }, body: null };
  }
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000);
  let res: Response;
  try {
    res = await f(callUrl(creds, callSid, opts.baseUrl ?? 'https://api.twilio.com'), {
      method: init.method,
      headers: {
        Authorization: basicAuth(creds),
        ...(init.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: init.form ? new URLSearchParams(init.form).toString() : undefined,
      signal: ctrl.signal,
    });
  } catch {
    // Timeout oder Netzwerkfehler: ob Twilio die Änderung übernommen hat,
    // ist unbekannt → nicht als Erfolg werten.
    return { result: { ok: false, kind: 'unavailable' }, body: null };
  } finally {
    clearTimeout(timer);
  }

  let body: Record<string, unknown> | null = null;
  try { body = (await res.json()) as Record<string, unknown>; } catch { body = null; }
  const code = typeof body?.code === 'number' ? body.code : undefined;

  if (res.ok) return { result: { ok: true, status: res.status }, body };
  if (res.status === 401 || res.status === 403) return { result: { ok: false, kind: 'auth', status: res.status, code }, body };
  if (res.status === 404) return { result: { ok: false, kind: 'not_active', status: res.status, code }, body };
  if (res.status === 429 || res.status >= 500) return { result: { ok: false, kind: 'unavailable', status: res.status, code }, body };
  return { result: { ok: false, kind: 'rejected', status: res.status, code }, body };
}

/** Setzt die Höchstdauer eines laufenden Anrufs (Sekunden, ≥ 1). */
export async function limitTwilioCall(
  creds: TwilioCreds,
  callSid: string,
  seconds: number,
  opts: TwilioCallOptions = {},
): Promise<TwilioCallResult> {
  const s = Math.floor(seconds);
  if (!Number.isFinite(s) || s < 1) return { ok: false, kind: 'invalid_input' };
  return (await request(creds, callSid, { method: 'POST', form: { TimeLimit: String(s) } }, opts)).result;
}

/** Beendet einen laufenden Anruf (Status=completed). */
export async function endTwilioCall(
  creds: TwilioCreds,
  callSid: string,
  opts: TwilioCallOptions = {},
): Promise<TwilioCallResult> {
  return (await request(creds, callSid, { method: 'POST', form: { Status: 'completed' } }, opts)).result;
}

/** Twilio-Endzustände eines Anrufs. */
const TERMINAL = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled']);

/**
 * Liest den Anrufstatus. 'ended' = Endzustand laut Twilio, 'active' = läuft
 * noch, 'unknown' = nicht feststellbar.
 */
export async function twilioCallState(
  creds: TwilioCreds,
  callSid: string,
  opts: TwilioCallOptions = {},
): Promise<'ended' | 'active' | 'unknown'> {
  const { result, body } = await request(creds, callSid, { method: 'GET' }, opts);
  if (!result.ok) return result.kind === 'not_active' ? 'ended' : 'unknown';
  const status = typeof body?.status === 'string' ? body.status : '';
  if (TERMINAL.has(status)) return 'ended';
  return status ? 'active' : 'unknown';
}
