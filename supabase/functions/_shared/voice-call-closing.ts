// Telefon: Gesprächsabschluss vor dem harten Limit statt stummen Auflegens
// (Merge-Blocker PR #2044, unabhängig von Budget-Option A/B).
//
// Regeln:
//   * Neue Anrufe bei erschöpftem Budget: unverändert <Reject reason="busy"/>
//     (kostenvermeidend). Eine Ansage würde den Anruf annehmen und ist eine
//     offene Kostenentscheidung — hier bewusst NICHT umgesetzt.
//   * Laufender Anruf: kurze Abschlussansage, dann <Hangup/>. Die Ansage
//     verlängert das harte Limit nie:
//       - TwiML enthält nur <Say> + <Hangup/> (isFiniteClosingTwiml).
//       - Reicht die Restzeit nicht, wird ohne Ansage aufgelegt.
//       - Der Enforcer beendet den Anruf unabhängig davon per
//         Status=completed (bot-voice-enforcement.ts, Ebene 2).
//   * Rückrufwunsch: zuerst idempotent speichern (bot_voice_mark_callback),
//     erst danach als „erfasst“ ansagen. Speicherfehler → keine Zusage.
//   * Umleitung an einen Menschen: nicht umgesetzt (zusätzlicher
//     Ausgangsanruf = offene Kostenentscheidung).
//
// Budget: rechnet weder ab noch gibt frei.
// Ohne Deno-/jsr-Imports, damit Vitest das Modul laden kann.

import type { RpcAdmin } from './bot-budget.ts';
import {
  VOICE_ENFORCER_LEAD_SECONDS, enforceOverdueCalls, remainingCallSeconds, type EnforceSummary,
} from './bot-voice-enforcement.ts';
import {
  isValidAccountSid, replaceTwilioCallTwiml, type TwilioCallOptions,
} from './twilio-call-control.ts';

/**
 * Beginn der Abschlussphase: so viele Sekunden vor Reservierungsende.
 * VORLÄUFIG – technischer Parameter, kein Preis- oder Kundenwert. Muss größer
 * sein als der harte Vorlauf des Enforcers, damit (bei minütlichem Cron)
 * genau ein Lauf in das Ansagefenster fällt.
 */
export const VOICE_CLOSING_LEAD_SECONDS = 120;
/** Unterhalb dieser Restzeit wird ohne Ansage aufgelegt (Ansage passt nicht mehr). */
export const VOICE_CLOSING_MIN_SECONDS = 15;
/** Höchstzahl Ansagen je Enforcer-Lauf. */
export const VOICE_CLOSING_BATCH = 100;

export type ClosingReason = 'zeitlimit' | 'budget';
export type CallbackOutcome = 'captured' | 'no_number' | 'not_captured';

const SAY = (text: string) => `<Say language="de-DE">${text}</Say>`;

/**
 * Feste Ansagetexte (keine Nutzereingaben → kein Escaping nötig, keine
 * Einschleusung). Bewusst kurz, damit sie deutlich unter
 * VOICE_CLOSING_MIN_SECONDS bleiben.
 */
export const CLOSING_TEXT = {
  zeitlimit: 'Wir müssen das Gespräch jetzt leider beenden.',
  budget: 'Wir können das Gespräch gerade leider nicht fortsetzen.',
  captured: 'Ihr Rückrufwunsch ist erfasst.',
  retry: 'Bitte rufen Sie später noch einmal an.',
  bye: 'Auf Wiederhören.',
} as const;

/** TwiML-Rumpf (ohne <Response>) der Abschlussansage. */
export function closingTwimlBody(outcome: CallbackOutcome, reason: ClosingReason): string {
  const parts = [SAY(CLOSING_TEXT[reason])];
  // „erfasst“ nur, wenn die Speicherung nachweislich gelungen ist.
  parts.push(SAY(outcome === 'captured' ? CLOSING_TEXT.captured : CLOSING_TEXT.retry));
  parts.push(SAY(CLOSING_TEXT.bye));
  parts.push('<Hangup/>');
  return parts.join('');
}

/** Vollständiges TwiML-Dokument (für das Ersetzen eines laufenden Anrufs). */
export function closingTwimlDocument(outcome: CallbackOutcome, reason: ClosingReason): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${closingTwimlBody(outcome, reason)}</Response>`;
}

export type TurnDecision = 'continue' | 'closing' | 'hangup';

/**
 * Entscheidung je Gesprächsschritt (Ebene 3).
 *   continue — normaler KI-Schritt
 *   closing  — Abschlussansage statt KI-Antwort
 *   hangup   — Restzeit zu kurz für eine Ansage oder Reservierung geschlossen
 */
export function voiceTurnDecision(
  clock: { createdAt: Date; reservedSeconds: number; status: string },
  now: Date,
): TurnDecision {
  if (clock.status !== 'open') return 'hangup';
  const remaining = remainingCallSeconds(clock, now);
  if (remaining < VOICE_CLOSING_MIN_SECONDS) return 'hangup';
  if (remaining <= VOICE_CLOSING_LEAD_SECONDS) return 'closing';
  return 'continue';
}

function log(level: 'warn' | 'error' | 'info', scope: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ level, scope, ...fields }));
}

/**
 * Speichert den Rückrufwunsch idempotent am Gespräch. Wirft nie:
 * Jeder Fehler ergibt 'not_captured' (→ keine Zusage in der Ansage).
 */
export async function markCallbackRequested(
  rpc: RpcAdmin,
  args: { tenantId: string; callRef: string; reason: ClosingReason },
): Promise<CallbackOutcome> {
  try {
    const { data, error } = await rpc.rpc('bot_voice_mark_callback', {
      p_tenant_id: args.tenantId, p_call_ref: args.callRef, p_reason: args.reason,
    });
    if (error) {
      log('warn', 'bot_voice_callback_store_failed', { error: error.message });
      return 'not_captured';
    }
    const result = typeof data === 'string' ? data : '';
    if (result === 'captured' || result === 'already_captured') return 'captured';
    if (result === 'no_number') return 'no_number';
    return 'not_captured';
  } catch (e) {
    log('warn', 'bot_voice_callback_store_failed', { error: (e as Error).message });
    return 'not_captured';
  }
}

export interface ClosingDeps {
  rpc: RpcAdmin;
  authToken: string;
  fetchImpl?: typeof fetch;
}

export interface ClosingSummary {
  checked: number;
  announced: number;
  claimedElsewhere: number;
  failed: number;
  skipped: number;
}

interface ClosingRow {
  reservation_id: string;
  tenant_id: string;
  call_ref: string;
  account_sid: string | null;
}

async function recordClosing(rpc: RpcAdmin, reservationId: string, result: string): Promise<void> {
  try {
    const { error } = await rpc.rpc('bot_voice_record_closing', { p_reservation_id: reservationId, p_result: result });
    if (error) log('warn', 'bot_voice_record_closing_failed', { reservation_id: reservationId, error: error.message });
  } catch (e) {
    log('warn', 'bot_voice_record_closing_failed', { reservation_id: reservationId, error: (e as Error).message });
  }
}

/**
 * Enforcer-Schritt nach dem harten Abbruch: Abschlussansage für Anrufe im
 * Fenster [Ende − VOICE_CLOSING_LEAD_SECONDS, Ende − VOICE_ENFORCER_LEAD_SECONDS).
 * Je Anruf höchstens einmal (bot_voice_claim_closing). Scheitert die Ansage,
 * beendet der nächste harte Lauf den Anruf trotzdem.
 */
export async function announceClosingCalls(
  deps: ClosingDeps,
  opts: { closingLeadSeconds?: number; hardLeadSeconds?: number; limit?: number } = {},
): Promise<ClosingSummary> {
  const summary: ClosingSummary = { checked: 0, announced: 0, claimedElsewhere: 0, failed: 0, skipped: 0 };
  const { data, error } = await deps.rpc.rpc('bot_voice_closing_calls', {
    p_closing_lead_seconds: opts.closingLeadSeconds ?? VOICE_CLOSING_LEAD_SECONDS,
    p_hard_lead_seconds: opts.hardLeadSeconds ?? VOICE_ENFORCER_LEAD_SECONDS,
    p_limit: opts.limit ?? VOICE_CLOSING_BATCH,
  });
  if (error) throw new Error(`bot_voice_closing_calls failed: ${error.message}`);
  const rows = (Array.isArray(data) ? data : []) as ClosingRow[];

  for (const row of rows) {
    summary.checked++;
    if (!isValidAccountSid(row.account_sid) || !deps.authToken) {
      summary.skipped++;
      continue; // harter Abbruch bleibt zuständig
    }
    // Erst beanspruchen, dann ansagen: zwei Worker sagen nie doppelt an.
    const claim = await deps.rpc.rpc('bot_voice_claim_closing', { p_reservation_id: row.reservation_id });
    if (claim.error || claim.data !== true) {
      summary.claimedElsewhere++;
      continue;
    }
    const outcome = await markCallbackRequested(deps.rpc, {
      tenantId: row.tenant_id, callRef: row.call_ref, reason: 'zeitlimit',
    });
    const opts2: TwilioCallOptions = { fetchImpl: deps.fetchImpl, timeoutMs: 5000 };
    const res = await replaceTwilioCallTwiml(
      { accountSid: row.account_sid, authToken: deps.authToken },
      row.call_ref,
      closingTwimlDocument(outcome, 'zeitlimit'),
      opts2,
    );
    if (res.ok) {
      summary.announced++;
      await recordClosing(deps.rpc, row.reservation_id, `announced:${outcome}`);
    } else {
      summary.failed++;
      log('warn', 'bot_voice_closing_failed', { reservation_id: row.reservation_id, kind: res.kind, status: res.status });
      await recordClosing(deps.rpc, row.reservation_id, `failed:${res.kind}`);
    }
  }
  return summary;
}

export interface TickResult {
  hard: EnforceSummary;
  closing: ClosingSummary | null;
  closingError?: string;
}

/**
 * Ein Enforcer-Lauf. Reihenfolge ist Absicht: Zuerst der harte Abbruch
 * (Status=completed, unverändert aus Gate 1), danach die Ansagen. Ein Fehler
 * in der Ansagephase kann den harten Abbruch weder verhindern noch verzögern.
 */
export async function runVoiceEnforcementTick(deps: ClosingDeps): Promise<TickResult> {
  const hard = await enforceOverdueCalls(deps);
  try {
    const closing = await announceClosingCalls(deps);
    return { hard, closing };
  } catch (e) {
    log('error', 'bot_voice_closing_run_failed', { error: (e as Error).message });
    return { hard, closing: null, closingError: (e as Error).message };
  }
}
