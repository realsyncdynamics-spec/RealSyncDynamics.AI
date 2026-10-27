/**
 * Telefon: Gesprächsabschluss vor dem harten Limit (Merge-Blocker PR #2044,
 * „kein stummes Auflegen“, unabhängig von Budget-Option A/B).
 *
 * Simulierter Twilio-Anbieter und simulierte RPCs. Die SQL-Seite
 * (Ansagefenster, einmalige Beanspruchung, Rückrufstatus idempotent,
 * Mandantentrennung) prüft test/runtime/db/voice-closing-callback.db.test.ts.
 *
 *   V1  Neuer Anruf bei erschöpftem Budget → <Reject>, keine Annahme/Ansage
 *   V2  Laufender Anruf → Ansage nur mit <Say> + <Hangup/>, nie verlängernd;
 *       Restzeit zu kurz → Auflegen ohne Ansage; Enforcer bricht hart ab,
 *       auch wenn die Ansage scheitert
 *   V3  Rückrufwunsch erst speichern, dann „erfasst“ ansagen; Fehler →
 *       keine Zusage; unterdrückte Nummer → keine Zusage
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  CLOSING_TEXT, VOICE_CLOSING_LEAD_SECONDS, VOICE_CLOSING_MIN_SECONDS,
  announceClosingCalls, closingTwimlBody, closingTwimlDocument, markCallbackRequested,
  runVoiceEnforcementTick, voiceTurnDecision,
} from '../../supabase/functions/_shared/voice-call-closing';
import { VOICE_ENFORCER_LEAD_SECONDS } from '../../supabase/functions/_shared/bot-voice-enforcement';
import {
  isFiniteClosingTwiml, replaceTwilioCallTwiml,
} from '../../supabase/functions/_shared/twilio-call-control';
import {
  TWILIO_TERMINAL_STATUSES, planSecondsFromEntitlement,
} from '../../supabase/functions/_shared/bot-budget';

const ACCOUNT = 'AC' + 'a'.repeat(32);
const CALL = 'CA' + 'b'.repeat(32);
const TOKEN = 'test-token';
const creds = { accountSid: ACCOUNT, authToken: TOKEN };

type Req = { method: string; url: string; form: Record<string, string> };

function fakeTwilio(behaviour: 'ok' | 'timeout' | 503 | 404 = 'ok') {
  const requests: Req[] = [];
  const state = new Map([[CALL, 'in-progress']]);
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const form = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')));
    requests.push({ method: init?.method ?? 'GET', url: String(url), form });
    if (behaviour === 'timeout') throw new DOMException('aborted', 'AbortError');
    if (typeof behaviour === 'number') return new Response('{}', { status: behaviour });
    if (form.Status === 'completed') state.set(CALL, 'completed');
    return new Response(JSON.stringify({ sid: CALL, status: state.get(CALL) }), { status: 200 });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests, state };
}

const BUDGET_RPCS = ['bot_usage_settle', 'bot_usage_release', 'bot_usage_reserve', 'bot_ai_budget_reserve', 'bot_voice_call_reserve'];

// ─────────────────────────────────────────────────────────────────────────
describe('V2 — Ansage-TwiML kann das Limit nicht verlängern', () => {
  it.each([
    ['captured', 'zeitlimit'], ['captured', 'budget'], ['no_number', 'zeitlimit'], ['not_captured', 'budget'],
  ] as const)('%s/%s: nur <Say> + genau ein abschließendes <Hangup/>', (outcome, reason) => {
    const doc = closingTwimlDocument(outcome, reason);
    expect(isFiniteClosingTwiml(doc)).toBe(true);
    expect(doc).not.toMatch(/<(Gather|Dial|Redirect|Pause|Enqueue|Record|Connect|Play)\b/);
    expect(doc.trim().endsWith('<Hangup/></Response>')).toBe(true);
  });

  it('lehnt offene Verben ab (Gather, Dial, Redirect, Pause) und fehlendes Hangup', () => {
    const wrap = (b: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`;
    expect(isFiniteClosingTwiml(wrap('<Say>x</Say><Gather input="dtmf"/><Hangup/>'))).toBe(false);
    expect(isFiniteClosingTwiml(wrap('<Say>x</Say><Dial>+49301</Dial><Hangup/>'))).toBe(false);
    expect(isFiniteClosingTwiml(wrap('<Redirect>https://x</Redirect><Hangup/>'))).toBe(false);
    expect(isFiniteClosingTwiml(wrap('<Pause length="600"/><Hangup/>'))).toBe(false);
    expect(isFiniteClosingTwiml(wrap('<Say>x</Say>'))).toBe(false);
    expect(isFiniteClosingTwiml(wrap('<Hangup/><Say>x</Say><Hangup/>'))).toBe(false);
  });

  it('replaceTwilioCallTwiml sendet den dokumentierten Parameter Twiml, verweigert offene TwiML ohne Anfrage', async () => {
    const t = fakeTwilio();
    const doc = closingTwimlDocument('captured', 'zeitlimit');
    expect(await replaceTwilioCallTwiml(creds, CALL, doc, { fetchImpl: t.fetchImpl })).toEqual({ ok: true, status: 200 });
    expect(t.requests[0]!.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT}/Calls/${CALL}.json`);
    expect(t.requests[0]!.form).toEqual({ Twiml: doc });
    const bad = '<?xml version="1.0"?><Response><Say>x</Say><Gather/><Hangup/></Response>';
    expect(await replaceTwilioCallTwiml(creds, CALL, bad, { fetchImpl: t.fetchImpl })).toEqual({ ok: false, kind: 'invalid_input' });
    expect(t.requests).toHaveLength(1);
  });

  it('Ansagetexte sind kurz (passen deutlich unter die Mindestrestzeit)', () => {
    // ~2,5 Wörter/s Sprechtempo → 15 s ≈ 37 Wörter. Längster Fall < 20 Wörter.
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const longest = words(`${CLOSING_TEXT.budget} ${CLOSING_TEXT.retry} ${CLOSING_TEXT.bye}`);
    expect(longest).toBeLessThan(20);
    expect(VOICE_CLOSING_MIN_SECONDS).toBeGreaterThanOrEqual(15);
  });

  it('Ansagefenster liegt vor dem harten Abbruch (genau ein Cron-Lauf passt hinein)', () => {
    expect(VOICE_CLOSING_LEAD_SECONDS - VOICE_ENFORCER_LEAD_SECONDS).toBeGreaterThanOrEqual(60);
  });

  // Gegenprobe Cron-Takt (BEKANNTE GRENZE, keine Zusage): Fenster
  // [Ende−120, Ende−60) relativ zum Anrufbeginn, Läufe im 60-s-Raster.
  const windowHit = (startOffset: number, reserved: number, ticks: number[]) => ticks.some((t) => {
    const age = t - startOffset;
    return age >= Math.max(reserved - VOICE_CLOSING_LEAD_SECONDS, 0) && age < Math.max(reserved - VOICE_ENFORCER_LEAD_SECONDS, 0);
  });
  const grid = (n: number, delay: Record<number, number> = {}) => Array.from({ length: n }, (_, i) => i * 60 + (delay[i] ?? 0));

  it('Gegenprobe: pünktliche Minutenläufe treffen das Fenster bei jedem Anrufbeginn', () => {
    for (let start = 0; start < 60; start++) expect(windowHit(start, 600, grid(20))).toBe(true);
  });

  it('Gegenprobe: ein verspäteter Lauf kann das Fenster überspringen → Abbruch ohne Ansage', () => {
    // Anruf beginnt bei t=0, Fenster [480, 540). Lauf 8 (t=480) um 61 s verspätet.
    expect(windowHit(0, 600, grid(20, { 8: 61 }))).toBe(false);
  });

  it('Gegenprobe: Reservierung ≤ 60 s hat kein Fenster → nie Ansage über den Enforcer', () => {
    expect(windowHit(0, 60, grid(5))).toBe(false);
    expect(windowHit(0, 45, grid(5))).toBe(false);
  });
});

describe('V2 — Entscheidung je Gesprächsschritt', () => {
  const created = new Date('2026-10-27T10:00:00Z');
  const clock = { createdAt: created, reservedSeconds: 600, status: 'open' };
  const at = (s: number) => new Date(created.getTime() + s * 1000);

  it('Restzeit > Abschlussvorlauf → normaler Schritt', () => {
    expect(voiceTurnDecision(clock, at(600 - VOICE_CLOSING_LEAD_SECONDS - 1))).toBe('continue');
  });
  it('Abschlussphase → Ansage', () => {
    expect(voiceTurnDecision(clock, at(600 - VOICE_CLOSING_LEAD_SECONDS))).toBe('closing');
    expect(voiceTurnDecision(clock, at(600 - VOICE_CLOSING_MIN_SECONDS))).toBe('closing');
  });
  it('Restzeit zu kurz für die Ansage → auflegen ohne Ansage', () => {
    expect(voiceTurnDecision(clock, at(600 - VOICE_CLOSING_MIN_SECONDS + 1))).toBe('hangup');
    expect(voiceTurnDecision(clock, at(700))).toBe('hangup');
  });
  it('Reservierung geschlossen → auflegen', () => {
    expect(voiceTurnDecision({ ...clock, status: 'settled' }, at(10))).toBe('hangup');
  });
});

describe('V3 — Rückrufwunsch: erst speichern, dann bestätigen', () => {
  const rpcReturning = (r: { data?: unknown; error?: { message: string } | null } | 'throw') => ({
    rpc: vi.fn(async () => {
      if (r === 'throw') throw new Error('network');
      return { data: r.data ?? null, error: r.error ?? null };
    }),
  });

  it.each([
    ['captured', 'captured'], ['already_captured', 'captured'], ['no_number', 'no_number'], ['no_conversation', 'not_captured'],
  ])('RPC %s → %s', async (db, outcome) => {
    expect(await markCallbackRequested(rpcReturning({ data: db }), { tenantId: 't', callRef: CALL, reason: 'zeitlimit' })).toBe(outcome);
  });

  it('DB-Fehler oder Ausnahme → not_captured, wirft nie', async () => {
    expect(await markCallbackRequested(rpcReturning({ error: { message: 'down' } }), { tenantId: 't', callRef: CALL, reason: 'budget' })).toBe('not_captured');
    expect(await markCallbackRequested(rpcReturning('throw'), { tenantId: 't', callRef: CALL, reason: 'budget' })).toBe('not_captured');
  });

  it('„erfasst“ nur bei captured; sonst Bitte um erneuten Anruf', () => {
    expect(closingTwimlBody('captured', 'zeitlimit')).toContain(CLOSING_TEXT.captured);
    for (const o of ['no_number', 'not_captured'] as const) {
      expect(closingTwimlBody(o, 'zeitlimit')).not.toContain('erfasst');
      expect(closingTwimlBody(o, 'zeitlimit')).toContain(CLOSING_TEXT.retry);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
function fakeDb(rows: Array<{ reservation_id: string; call_ref: string; account_sid: string | null }>, opts: {
  callback?: string | 'error'; claim?: boolean; closingThrows?: boolean;
} = {}) {
  const log: string[] = [];
  const claimed = new Set<string>();
  return {
    log,
    rpc: {
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        log.push(fn);
        switch (fn) {
          case 'bot_voice_overdue_calls': return { data: [], error: null };
          case 'bot_voice_closing_calls':
            if (opts.closingThrows) return { data: null, error: { message: 'boom' } };
            return { data: rows.filter((r) => !claimed.has(r.reservation_id)).map((r) => ({ ...r, tenant_id: 't1' })), error: null };
          case 'bot_voice_claim_closing': {
            const id = String(args.p_reservation_id);
            if (opts.claim === false || claimed.has(id)) return { data: false, error: null };
            claimed.add(id);
            return { data: true, error: null };
          }
          case 'bot_voice_mark_callback':
            if (opts.callback === 'error') return { data: null, error: { message: 'down' } };
            return { data: opts.callback ?? 'captured', error: null };
          case 'bot_voice_record_closing': return { data: true, error: null };
          default: throw new Error(`unerwarteter RPC ${fn}`);
        }
      }),
    },
  };
}

describe('V2/V3 — Enforcer: Abschlussansage im Fenster vor dem harten Abbruch', () => {
  const row = { reservation_id: 'r1', call_ref: CALL, account_sid: ACCOUNT };

  it('beansprucht, speichert Rückruf, sagt „erfasst“ an — in dieser Reihenfolge', async () => {
    const t = fakeTwilio();
    const db = fakeDb([row]);
    const s = await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s).toEqual({ checked: 1, announced: 1, claimedElsewhere: 0, failed: 0, skipped: 0 });
    expect(db.log).toEqual(['bot_voice_closing_calls', 'bot_voice_claim_closing', 'bot_voice_mark_callback', 'bot_voice_record_closing']);
    expect(t.requests).toHaveLength(1);
    expect(t.requests[0]!.form.Twiml).toContain(CLOSING_TEXT.captured);
    expect(t.requests[0]!.form.Status).toBeUndefined();
    expect(db.log.filter((f) => BUDGET_RPCS.includes(f))).toEqual([]);
  });

  it('Rückruf-Speicherung scheitert → Ansage ohne Zusage', async () => {
    const t = fakeTwilio();
    const db = fakeDb([row], { callback: 'error' });
    await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(t.requests[0]!.form.Twiml).not.toContain('erfasst');
    expect(t.requests[0]!.form.Twiml).toContain(CLOSING_TEXT.retry);
  });

  it('unterdrückte Nummer → Ansage ohne Zusage', async () => {
    const t = fakeTwilio();
    const db = fakeDb([row], { callback: 'no_number' });
    await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(t.requests[0]!.form.Twiml).not.toContain('erfasst');
  });

  it('bereits beansprucht (zweiter Worker / zweiter Lauf) → keine zweite Ansage', async () => {
    const t = fakeTwilio();
    const db = fakeDb([row]);
    await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    const s2 = await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s2.checked).toBe(0);
    expect(t.requests).toHaveLength(1);
    const lost = fakeDb([row], { claim: false });
    const s3 = await announceClosingCalls({ rpc: lost.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s3.claimedElsewhere).toBe(1);
    expect(lost.log).not.toContain('bot_voice_mark_callback');
    expect(t.requests).toHaveLength(1);
  });

  it('Anbieter-Timeout bei der Ansage → kein Wurf, protokolliert, kein Budgetaufruf', async () => {
    const t = fakeTwilio('timeout');
    const db = fakeDb([row]);
    const s = await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s.failed).toBe(1);
    expect(db.log.filter((f) => BUDGET_RPCS.includes(f))).toEqual([]);
  });

  it('ohne AccountSid keine Ansage (harter Abbruch bleibt zuständig)', async () => {
    const t = fakeTwilio();
    const db = fakeDb([{ ...row, account_sid: null }]);
    const s = await announceClosingCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s.skipped).toBe(1);
    expect(t.requests).toHaveLength(0);
    expect(db.log).not.toContain('bot_voice_claim_closing');
  });
});

describe('V2 — Enforcer-Lauf: harter Abbruch zuerst, Ansagefehler verhindern ihn nicht', () => {
  it('Reihenfolge: overdue (Status=completed) vor closing', async () => {
    const t = fakeTwilio();
    const db = fakeDb([]);
    await runVoiceEnforcementTick({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(db.log.indexOf('bot_voice_overdue_calls')).toBe(0);
    expect(db.log.indexOf('bot_voice_closing_calls')).toBeGreaterThan(0);
  });

  it('Ansagephase wirft → harter Teil ist schon gelaufen, Ergebnis meldet den Fehler', async () => {
    const t = fakeTwilio();
    const db = fakeDb([], { closingThrows: true });
    const r = await runVoiceEnforcementTick({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(r.hard.checked).toBe(0);
    expect(r.closing).toBeNull();
    expect(r.closingError).toContain('bot_voice_closing_calls');
    expect(db.log[0]).toBe('bot_voice_overdue_calls');
  });

  it('Ansage gescheitert, Anruf läuft weiter → nächster harter Lauf beendet ihn per Status=completed', async () => {
    const { enforceOverdueCalls } = await import('../../supabase/functions/_shared/bot-voice-enforcement');
    const t = fakeTwilio();
    const rpc = {
      rpc: vi.fn(async (fn: string) => fn === 'bot_voice_overdue_calls'
        ? { data: [{ reservation_id: 'r1', tenant_id: 't1', call_ref: CALL, account_sid: ACCOUNT, attempts: 0 }], error: null }
        : { data: true, error: null }),
    };
    const s = await enforceOverdueCalls({ rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s.ended).toBe(1);
    expect(t.requests[0]!.form).toEqual({ Status: 'completed' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Echter Webhook-Handler (transpiliert), Abhängigkeiten simuliert.
// ─────────────────────────────────────────────────────────────────────────
interface Scenario {
  reservation: { ok: true; existing: boolean; reservationId: string; reservedSeconds: number } | { ok: false; reason: string };
  clockAgeSeconds?: number;     // Sekunden seit Reservierungsbeginn
  reservedSeconds?: number;
  speech?: string;
  callback?: string | 'error';
  aiError?: 'budget';
}

class AiInvokeError extends Error {
  constructor(public code: string) { super(code); }
}
class BotError extends Error { status = 400; code = 'X'; }
class EntitlementError extends Error { code = 'X'; }

async function runWebhook(sc: Scenario) {
  const events: string[] = [];
  const reservedSeconds = sc.reservedSeconds ?? 600;
  const createdAt = new Date(Date.now() - (sc.clockAgeSeconds ?? 0) * 1000).toISOString();
  const admin = {
    rpc: vi.fn(async (fn: string) => {
      events.push(`rpc:${fn}`);
      if (fn === 'tenant_entitlements') return { data: [{ key: 'limit.bot_voice_minutes_monthly', value: 100 }], error: null };
      if (fn === 'bot_voice_mark_callback') {
        if (sc.callback === 'error') return { data: null, error: { message: 'down' } };
        return { data: sc.callback ?? 'captured', error: null };
      }
      throw new Error(`unerwarteter RPC ${fn}`);
    }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { created_at: createdAt, reserved_amount: reservedSeconds, status: 'open' }, error: null,
    }) }) }) }),
  };
  let handler!: (req: Request) => Promise<Response>;
  const source = readFileSync('supabase/functions/bot-voice-webhook/index.ts', 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];$/gm, '');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
    Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: (k: string) => ({ TWILIO_AUTH_TOKEN: 'tok', TWILIO_WEBHOOK_URL: 'https://x.test/hook' } as Record<string, string>)[k] ?? 'x' } },
    console, URL, URLSearchParams, Response, Date, Number, Object, Math, JSON, Error,
    createClient: () => admin,
    handleOptions: () => null,
    jsonResponse: (v: unknown) => Response.json(v),
    jsonError: (s: number, c: string) => new Response(c, { status: s }),
    gateFeature: async () => {}, EntitlementError,
    recordUsage: async () => {},
    runAiTool: async () => {
      events.push('ai');
      if (sc.aiError === 'budget') throw new AiInvokeError('BOT_BUDGET_EXCEEDED');
      return { output: 'KI-Antwort', runId: 'r', inputTokens: 1, outputTokens: 1, costUsd: 0, durationMs: 1 };
    },
    AiInvokeError,
    enforceBotMessage: async () => ({ allowed: true }),
    requireAuthAndTenant: async () => new Response('no', { status: 401 }),
    verifyTwilioSignature: async () => true,
    resolveVoiceNumberBinding: async () => ({ tenant_id: 'tenant-1', bot_id: 'bot-1' }),
    runRestaurantConversationTurn: async () => null,
    TWILIO_TERMINAL_STATUSES,
    createBotAiBudgetGuard: () => ({}),
    planSecondsFromEntitlement,
    reserveVoiceCall: async () => { events.push('reserve'); return sc.reservation; },
    settleVoiceCall: async () => ({ duplicate: false }),
    applyProviderTimeLimit: async () => { events.push('timelimit'); return { ok: true, status: 200 }; },
    closingTwimlBody, markCallbackRequested, voiceTurnDecision,
    resolveBot: async () => ({ id: 'bot-1', tenant_id: 'tenant-1', name: 'Empfang', greeting: 'Hallo', persona: '', config: {}, capabilities: {} }),
    upsertConversation: async () => 'conv-1',
    insertMessage: async () => {},
    loadRecentHistory: async () => [{ role: 'user', content: 'x' }],
    buildBotPrompt: () => 'prompt',
    BotError,
  });
  const form = new URLSearchParams({
    To: '+4930123456', From: '+491701234567', CallSid: CALL, AccountSid: ACCOUNT, CallStatus: 'in-progress',
    ...(sc.speech ? { SpeechResult: sc.speech } : {}),
  });
  const res = await handler(new Request('https://x.test/hook', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString(),
  }));
  return { body: await res.text(), status: res.status, events };
}

const existing = { ok: true as const, existing: true, reservationId: 'res-1', reservedSeconds: 600 };

describe('Webhook — V1: neue Anrufe bei erschöpftem Budget bleiben Besetzt', () => {
  it('erster Hit abgelehnt → <Reject> als einziges Verb, keine Ansage, kein Rückruf-Schreiben', async () => {
    const r = await runWebhook({ reservation: { ok: false, reason: 'budget_exceeded' } });
    expect(r.body).toMatch(/<Response><Reject reason="busy"\/><\/Response>$/);
    expect(r.body).not.toContain('<Say');
    expect(r.events).not.toContain('rpc:bot_voice_mark_callback');
    expect(r.events).not.toContain('ai');
  });
});

describe('Webhook — V2/V3: laufender Anruf wird nicht stumm aufgelegt', () => {
  it('normaler Schritt bleibt unverändert (KI-Antwort + Gather)', async () => {
    const r = await runWebhook({ reservation: existing, clockAgeSeconds: 60, speech: 'Hallo' });
    expect(r.body).toContain('KI-Antwort');
    expect(r.body).toContain('<Gather');
    expect(r.events).not.toContain('rpc:bot_voice_mark_callback');
  });

  it('Abschlussphase → Rückruf gespeichert, dann „erfasst“ + Hangup, kein KI-Aufruf', async () => {
    const r = await runWebhook({ reservation: existing, clockAgeSeconds: 600 - 60, speech: 'Noch was' });
    expect(r.events).toContain('rpc:bot_voice_mark_callback');
    expect(r.events).not.toContain('ai');
    expect(r.body).toContain(CLOSING_TEXT.zeitlimit);
    expect(r.body).toContain(CLOSING_TEXT.captured);
    expect(r.body).toMatch(/<Hangup\/><\/Response>$/);
    expect(r.body).not.toContain('<Gather');
  });

  it('Speicherung scheitert → keine Zusage', async () => {
    const r = await runWebhook({ reservation: existing, clockAgeSeconds: 540, speech: 'x', callback: 'error' });
    expect(r.body).not.toContain('erfasst');
    expect(r.body).toContain(CLOSING_TEXT.retry);
  });

  it('unterdrückte Nummer → keine Zusage', async () => {
    const r = await runWebhook({ reservation: existing, clockAgeSeconds: 540, speech: 'x', callback: 'no_number' });
    expect(r.body).not.toContain('erfasst');
  });

  it('BEKANNTE GRENZE: Restzeit < 15 s → stummes <Hangup/> (Ansage würde das Limit überschreiten)', async () => {
    const r = await runWebhook({ reservation: existing, clockAgeSeconds: 600 - 5, speech: 'x' });
    expect(r.body).toMatch(/<Response><Hangup\/><\/Response>$/);
    expect(r.events).not.toContain('rpc:bot_voice_mark_callback');
  });

  it('KI-Budget mitten im Anruf erschöpft → Budget-Ansage statt stummen Auflegens', async () => {
    const r = await runWebhook({ reservation: existing, clockAgeSeconds: 60, speech: 'x', aiError: 'budget' });
    expect(r.events.indexOf('ai')).toBeLessThan(r.events.indexOf('rpc:bot_voice_mark_callback'));
    expect(r.body).toContain(CLOSING_TEXT.budget);
    expect(r.body).toContain(CLOSING_TEXT.captured);
    expect(r.body).toMatch(/<Hangup\/><\/Response>$/);
  });

  it('Folge-Hit, Reservierung abgelehnt → Budget-Ansage statt stummen Auflegens', async () => {
    const r = await runWebhook({ reservation: { ok: false, reason: 'budget_exceeded' }, speech: 'x' });
    expect(r.body).toContain(CLOSING_TEXT.budget);
    expect(r.body).not.toContain('<Reject');
  });

  it('kein Antwortpfad bei Zeit-/Budgetende enthält offene Verben', async () => {
    for (const sc of [
      { reservation: existing, clockAgeSeconds: 540, speech: 'x' },
      { reservation: existing, clockAgeSeconds: 60, speech: 'x', aiError: 'budget' as const },
    ]) {
      const r = await runWebhook(sc);
      expect(isFiniteClosingTwiml(r.body)).toBe(true);
    }
  });
});
