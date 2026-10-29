// Telefon: hartes Zeitlimit beim Anbieter durchsetzen (Gate 1, PR #2044).
//
// Drei Ebenen, jede unabhängig von weiteren Gesprächsschritten des Anrufers:
//   1. applyProviderTimeLimit — direkt nach Annahme setzt der Webhook die
//      Höchstdauer des Anrufs bei Twilio (TimeLimit) auf die Restzeit der
//      Reservierung.
//   2. enforceOverdueCalls — bot-voice-enforcer (pg_cron, jede Minute)
//      beendet jeden offenen Anruf, dessen reservierte Dauer abzüglich
//      Vorlauf erreicht ist (Status=completed), auch wenn kein weiterer
//      Webhook mehr eintrifft.
//   3. voiceTurnAllowed (bot-budget.ts) — jeder Gesprächsschritt prüft die
//      Zeitgrenze serverseitig und legt sonst auf.
//
// Budget: Keine dieser Funktionen rechnet ab oder gibt frei. Abgerechnet
// wird über den Status-Callback (gemessen) oder den Aufräumjob (geschätzt
// zum Höchstbetrag). Ein Timeout beim Beenden gibt kein Budget frei.
//
// Ohne Deno-/jsr-Imports, damit Vitest das Modul laden kann.

import type { RpcAdmin } from './bot-budget.ts';
import {
  endTwilioCall, isValidAccountSid, limitTwilioCall, twilioCallState,
  type TwilioCallOptions, type TwilioCallResult,
} from './twilio-call-control.ts';

/** Vorlauf: Der Enforcer beendet Anrufe so viele Sekunden vor Reservierungsende. */
export const VOICE_ENFORCER_LEAD_SECONDS = 60;
/** Höchstzahl Beendigungsversuche je Anruf, danach nur noch Aufräumjob. */
export const VOICE_ENFORCER_MAX_ATTEMPTS = 5;
/** Höchstzahl Anrufe je Lauf. */
export const VOICE_ENFORCER_BATCH = 100;

function log(level: 'warn' | 'error' | 'info', scope: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ level, scope, ...fields }));
}

/**
 * Restsekunden einer Reservierung zum Zeitpunkt `now` (abgerundet). Dient als
 * TimeLimit, damit der Anruf spätestens mit Reservierungsende endet.
 */
export function remainingCallSeconds(
  reservation: { createdAt: Date; reservedSeconds: number },
  now: Date,
): number {
  const end = reservation.createdAt.getTime() + reservation.reservedSeconds * 1000;
  return Math.floor((end - now.getTime()) / 1000);
}

export interface ApplyTimeLimitDeps {
  authToken: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Setzt TimeLimit auf die Restzeit. Läuft nach der ersten TwiML-Antwort
 * (EdgeRuntime.waitUntil), damit der Anruf bereits angenommen ist.
 * Höchstens zwei Versuche; Fehlschlag ist kein Abbruchgrund für den Anruf —
 * dann greifen Ebene 2 und 3.
 */
export async function applyProviderTimeLimit(
  deps: ApplyTimeLimitDeps,
  args: { accountSid: string | null; callSid: string; createdAt: Date; reservedSeconds: number; delayMs?: number },
): Promise<TwilioCallResult | { ok: false; kind: 'skipped' }> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => new Date());
  if (!isValidAccountSid(args.accountSid) || !deps.authToken) {
    log('warn', 'bot_voice_timelimit_skipped', { reason: 'missing_credentials' });
    return { ok: false, kind: 'skipped' };
  }
  const creds = { accountSid: args.accountSid, authToken: deps.authToken };
  const opts: TwilioCallOptions = { fetchImpl: deps.fetchImpl, timeoutMs: 5000 };

  let last: TwilioCallResult = { ok: false, kind: 'unavailable' };
  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(attempt === 0 ? (args.delayMs ?? 2000) : 3000);
    const remaining = remainingCallSeconds(args, now());
    if (remaining < 1) {
      // Zeit schon abgelaufen → sofort beenden statt begrenzen.
      return endTwilioCall(creds, args.callSid, opts);
    }
    last = await limitTwilioCall(creds, args.callSid, remaining, opts);
    if (last.ok || last.kind === 'not_active' || last.kind === 'auth' || last.kind === 'invalid_input') break;
  }
  if (!last.ok) {
    log('warn', 'bot_voice_timelimit_failed', { kind: last.kind, status: last.status, code: last.code });
  }
  return last;
}

export interface EnforceDeps {
  rpc: RpcAdmin;
  authToken: string;
  fetchImpl?: typeof fetch;
}

export interface EnforceSummary {
  checked: number;
  ended: number;
  alreadyEnded: number;
  failed: number;
  skipped: number;
}

interface OverdueRow {
  reservation_id: string;
  tenant_id: string;
  call_ref: string;
  account_sid: string | null;
  attempts: number;
}

async function record(rpc: RpcAdmin, reservationId: string, done: boolean, result: string): Promise<void> {
  const { error } = await rpc.rpc('bot_voice_record_hangup', {
    p_reservation_id: reservationId, p_done: done, p_result: result,
  });
  if (error) log('warn', 'bot_voice_record_hangup_failed', { reservation_id: reservationId, error: error.message });
}

/**
 * Beendet überfällige Anrufe beim Anbieter. Idempotent: Ein bereits
 * beendeter Anruf wird als erledigt protokolliert, ohne Fehler und ohne
 * Buchung. Status, Betrag und Ledger der Reservierung bleiben unberührt.
 */
export async function enforceOverdueCalls(
  deps: EnforceDeps,
  opts: { leadSeconds?: number; maxAttempts?: number; limit?: number } = {},
): Promise<EnforceSummary> {
  const summary: EnforceSummary = { checked: 0, ended: 0, alreadyEnded: 0, failed: 0, skipped: 0 };
  const { data, error } = await deps.rpc.rpc('bot_voice_overdue_calls', {
    p_lead_seconds: opts.leadSeconds ?? VOICE_ENFORCER_LEAD_SECONDS,
    p_max_attempts: opts.maxAttempts ?? VOICE_ENFORCER_MAX_ATTEMPTS,
    p_limit: opts.limit ?? VOICE_ENFORCER_BATCH,
  });
  if (error) throw new Error(`bot_voice_overdue_calls failed: ${error.message}`);
  const rows = (Array.isArray(data) ? data : []) as OverdueRow[];

  for (const row of rows) {
    summary.checked++;
    if (!isValidAccountSid(row.account_sid) || !deps.authToken) {
      // Ohne Konto-ID kein Anbieteraufruf möglich; Versuch zählen, damit der
      // Datensatz nicht endlos auftaucht. Aufräumjob rechnet später ab.
      summary.skipped++;
      await record(deps.rpc, row.reservation_id, false, 'missing_account_sid');
      continue;
    }
    const creds = { accountSid: row.account_sid, authToken: deps.authToken };
    const opts2: TwilioCallOptions = { fetchImpl: deps.fetchImpl, timeoutMs: 5000 };
    const res = await endTwilioCall(creds, row.call_ref, opts2);
    if (res.ok) {
      summary.ended++;
      await record(deps.rpc, row.reservation_id, true, 'ended');
      continue;
    }
    // Nicht beendet: Liegt das daran, dass der Anruf schon vorbei ist?
    const state = res.kind === 'auth' || res.kind === 'invalid_input'
      ? 'unknown'
      : await twilioCallState(creds, row.call_ref, opts2);
    if (state === 'ended') {
      summary.alreadyEnded++;
      await record(deps.rpc, row.reservation_id, true, 'already_ended');
    } else {
      summary.failed++;
      log('error', 'bot_voice_enforce_failed', {
        reservation_id: row.reservation_id, kind: res.kind, status: res.status, code: res.code, state,
      });
      await record(deps.rpc, row.reservation_id, false, `failed:${res.kind}`);
    }
  }
  return summary;
}
