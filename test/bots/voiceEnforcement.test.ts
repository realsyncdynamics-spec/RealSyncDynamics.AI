/**
 * Gate 1 (PR #2044) — hartes Telefonlimit beim Anbieter.
 *
 * Simulierter Twilio-Anbieter (fetch-Attrappe) und simulierte RPCs. Die
 * SQL-Seite (welche Anrufe überfällig sind, Protokollierung ohne Buchung)
 * prüft test/runtime/db/bot-usage-channel-limits.db.test.ts.
 *
 *   - Anruf endet beim Anbieter, auch wenn kein weiterer Gesprächsschritt kommt
 *   - Limit während eines laufenden Gesprächsschritts: TimeLimit = Restzeit
 *   - doppelter Abbruch ist harmlos (kein Fehler, keine Buchung)
 *   - Timeout beim Anbieter gibt kein Budget frei
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyProviderTimeLimit, enforceOverdueCalls, remainingCallSeconds,
} from '../../supabase/functions/_shared/bot-voice-enforcement';
import {
  endTwilioCall, isValidCallSid, limitTwilioCall, twilioCallState,
} from '../../supabase/functions/_shared/twilio-call-control';

const ACCOUNT = 'AC' + 'a'.repeat(32);
const CALL = 'CA' + 'b'.repeat(32);
const TOKEN = 'test-token';

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown } | 'timeout';

/** Simulierter Twilio-Anbieter mit Anrufzustand. */
function fakeTwilio(initial: Record<string, string> = { [CALL]: 'in-progress' }, override?: Handler) {
  const calls = new Map(Object.entries(initial));
  const requests: Array<{ method: string; url: string; form: Record<string, string>; auth: string | null }> = [];
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const form = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')));
    const headers = new Headers(init?.headers);
    requests.push({ method: init?.method ?? 'GET', url: u, form, auth: headers.get('Authorization') });
    const o = override?.(u, init ?? {});
    if (o === 'timeout') throw new DOMException('aborted', 'AbortError');
    if (o) return new Response(JSON.stringify(o.body ?? {}), { status: o.status });
    const sid = u.match(/Calls\/(CA[0-9a-f]{32})\.json$/)?.[1] ?? '';
    const state = calls.get(sid);
    if (!state) return new Response(JSON.stringify({ code: 20404 }), { status: 404 });
    if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ sid, status: state }), { status: 200 });
    if (form.Status === 'completed') {
      if (state !== 'in-progress') return new Response(JSON.stringify({ code: 21220 }), { status: 400 });
      calls.set(sid, 'completed');
    }
    return new Response(JSON.stringify({ sid, status: calls.get(sid) }), { status: 200 });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests, calls };
}

/** Simulierte DB-RPCs: überfällige Anrufe + Protokoll. Keine Budget-RPCs erlaubt. */
function fakeRpc(rows: Array<{ reservation_id: string; call_ref: string; account_sid: string | null }>) {
  const log: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const done = new Set<string>();
  return {
    log,
    rpc: {
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        log.push({ fn, args });
        if (fn === 'bot_voice_overdue_calls') {
          return {
            data: rows.filter((r) => !done.has(r.reservation_id))
              .map((r) => ({ ...r, tenant_id: 't1', attempts: 0 })),
            error: null,
          };
        }
        if (fn === 'bot_voice_record_hangup') {
          if (args.p_done) done.add(String(args.p_reservation_id));
          return { data: true, error: null };
        }
        throw new Error(`unerwarteter RPC ${fn}`);
      }),
    },
  };
}

describe('twilio-call-control', () => {
  it('beendet per Status=completed mit Basic-Auth am offiziellen Pfad', async () => {
    const t = fakeTwilio();
    expect(await endTwilioCall({ accountSid: ACCOUNT, authToken: TOKEN }, CALL, { fetchImpl: t.fetchImpl })).toEqual({ ok: true, status: 200 });
    expect(t.requests[0]!.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT}/Calls/${CALL}.json`);
    expect(t.requests[0]!.form).toEqual({ Status: 'completed' });
    expect(t.requests[0]!.auth).toBe(`Basic ${btoa(`${ACCOUNT}:${TOKEN}`)}`);
  });

  it('setzt TimeLimit in ganzen Sekunden und lehnt < 1 ab', async () => {
    const t = fakeTwilio();
    await limitTwilioCall({ accountSid: ACCOUNT, authToken: TOKEN }, CALL, 245.9, { fetchImpl: t.fetchImpl });
    expect(t.requests[0]!.form).toEqual({ TimeLimit: '245' });
    expect(await limitTwilioCall({ accountSid: ACCOUNT, authToken: TOKEN }, CALL, 0.5, { fetchImpl: t.fetchImpl }))
      .toEqual({ ok: false, kind: 'invalid_input' });
    expect(t.requests).toHaveLength(1);
  });

  it('keine Anfrage bei ungültigen SIDs (kein Pfad-Einschleusen)', async () => {
    const t = fakeTwilio();
    expect(isValidCallSid('CA../../x')).toBe(false);
    expect(await endTwilioCall({ accountSid: ACCOUNT, authToken: TOKEN }, '../Calls', { fetchImpl: t.fetchImpl }))
      .toEqual({ ok: false, kind: 'invalid_input' });
    expect(await endTwilioCall({ accountSid: 'ACevil', authToken: TOKEN }, CALL, { fetchImpl: t.fetchImpl }))
      .toEqual({ ok: false, kind: 'invalid_input' });
    expect(t.requests).toHaveLength(0);
  });

  it('Timeout → unavailable (nie Erfolg); 401 → auth; 5xx/429 → unavailable', async () => {
    const creds = { accountSid: ACCOUNT, authToken: TOKEN };
    expect((await endTwilioCall(creds, CALL, { fetchImpl: fakeTwilio({}, () => 'timeout').fetchImpl })).ok).toBe(false);
    expect(await endTwilioCall(creds, CALL, { fetchImpl: fakeTwilio({}, () => 'timeout').fetchImpl }))
      .toMatchObject({ kind: 'unavailable' });
    expect(await endTwilioCall(creds, CALL, { fetchImpl: fakeTwilio({}, () => ({ status: 401 })).fetchImpl }))
      .toMatchObject({ kind: 'auth' });
    expect(await endTwilioCall(creds, CALL, { fetchImpl: fakeTwilio({}, () => ({ status: 503 })).fetchImpl }))
      .toMatchObject({ kind: 'unavailable' });
    expect(await endTwilioCall(creds, CALL, { fetchImpl: fakeTwilio({}, () => ({ status: 429 })).fetchImpl }))
      .toMatchObject({ kind: 'unavailable' });
  });

  it('Anrufstatus: Endzustand → ended, laufend → active, unbekannt → unknown', async () => {
    const creds = { accountSid: ACCOUNT, authToken: TOKEN };
    expect(await twilioCallState(creds, CALL, { fetchImpl: fakeTwilio({ [CALL]: 'completed' }).fetchImpl })).toBe('ended');
    expect(await twilioCallState(creds, CALL, { fetchImpl: fakeTwilio({ [CALL]: 'in-progress' }).fetchImpl })).toBe('active');
    expect(await twilioCallState(creds, CALL, { fetchImpl: fakeTwilio({}, () => 'timeout').fetchImpl })).toBe('unknown');
  });
});

describe('Gate 1 — Ebene 2: Enforcer beendet überfällige Anrufe ohne weiteren Gesprächsschritt', () => {
  it('überfälliger Anruf wird beim Anbieter beendet und als erledigt protokolliert', async () => {
    const t = fakeTwilio();
    const db = fakeRpc([{ reservation_id: 'r1', call_ref: CALL, account_sid: ACCOUNT }]);
    const s = await enforceOverdueCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s).toEqual({ checked: 1, ended: 1, alreadyEnded: 0, failed: 0, skipped: 0 });
    expect(t.calls.get(CALL)).toBe('completed');
    expect(db.log.find((l) => l.fn === 'bot_voice_record_hangup')!.args).toMatchObject({ p_reservation_id: 'r1', p_done: true, p_result: 'ended' });
    // Weder Abrechnung noch Freigabe.
    expect(db.log.map((l) => l.fn)).not.toEqual(expect.arrayContaining(['bot_usage_settle', 'bot_usage_release']));
  });

  it('doppelter Abbruch (zweiter Lauf / zweiter Worker) ist harmlos', async () => {
    const t = fakeTwilio({ [CALL]: 'completed' });
    const db = fakeRpc([{ reservation_id: 'r1', call_ref: CALL, account_sid: ACCOUNT }]);
    const s = await enforceOverdueCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s).toEqual({ checked: 1, ended: 0, alreadyEnded: 1, failed: 0, skipped: 0 });
    expect(db.log.find((l) => l.fn === 'bot_voice_record_hangup')!.args).toMatchObject({ p_done: true, p_result: 'already_ended' });
    // Zweiter Lauf findet nichts mehr.
    const s2 = await enforceOverdueCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s2.checked).toBe(0);
  });

  it('Timeout beim Anbieter: kein Erfolg, Versuch gezählt, Budget nicht freigegeben', async () => {
    const t = fakeTwilio({}, () => 'timeout');
    const db = fakeRpc([{ reservation_id: 'r1', call_ref: CALL, account_sid: ACCOUNT }]);
    const s = await enforceOverdueCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s).toEqual({ checked: 1, ended: 0, alreadyEnded: 0, failed: 1, skipped: 0 });
    expect(db.log.find((l) => l.fn === 'bot_voice_record_hangup')!.args).toMatchObject({ p_done: false });
    expect(db.log.map((l) => l.fn).sort()).toEqual(['bot_voice_overdue_calls', 'bot_voice_record_hangup']);
  });

  it('ohne AccountSid kein Anbieteraufruf, Versuch gezählt', async () => {
    const t = fakeTwilio();
    const db = fakeRpc([{ reservation_id: 'r1', call_ref: CALL, account_sid: null }]);
    const s = await enforceOverdueCalls({ rpc: db.rpc, authToken: TOKEN, fetchImpl: t.fetchImpl });
    expect(s.skipped).toBe(1);
    expect(t.requests).toHaveLength(0);
  });
});

describe('Gate 1 — Ebene 1: Höchstdauer beim Anbieter direkt nach Annahme', () => {
  const noSleep = async () => {};

  it('TimeLimit = Restzeit der Reservierung (Limit greift auch mitten im Gesprächsschritt)', async () => {
    const t = fakeTwilio();
    const created = new Date('2026-10-27T10:00:00Z');
    const res = await applyProviderTimeLimit(
      { authToken: TOKEN, fetchImpl: t.fetchImpl, sleep: noSleep, now: () => new Date('2026-10-27T10:00:02Z') },
      { accountSid: ACCOUNT, callSid: CALL, createdAt: created, reservedSeconds: 600 },
    );
    expect(res).toEqual({ ok: true, status: 200 });
    expect(t.requests[0]!.form).toEqual({ TimeLimit: '598' });
  });

  it('Restzeit abgelaufen → sofort beenden statt begrenzen', async () => {
    const t = fakeTwilio();
    await applyProviderTimeLimit(
      { authToken: TOKEN, fetchImpl: t.fetchImpl, sleep: noSleep, now: () => new Date('2026-10-27T10:11:00Z') },
      { accountSid: ACCOUNT, callSid: CALL, createdAt: new Date('2026-10-27T10:00:00Z'), reservedSeconds: 600 },
    );
    expect(t.requests[0]!.form).toEqual({ Status: 'completed' });
    expect(t.calls.get(CALL)).toBe('completed');
  });

  it('Fehlschlag: höchstens zwei Versuche, kein Wurf', async () => {
    const t = fakeTwilio({}, () => ({ status: 503 }));
    const res = await applyProviderTimeLimit(
      { authToken: TOKEN, fetchImpl: t.fetchImpl, sleep: noSleep },
      { accountSid: ACCOUNT, callSid: CALL, createdAt: new Date(), reservedSeconds: 300 },
    );
    expect(res).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(t.requests).toHaveLength(2);
  });

  it('ohne AccountSid oder Token: übersprungen, kein Anbieteraufruf', async () => {
    const t = fakeTwilio();
    expect(await applyProviderTimeLimit(
      { authToken: TOKEN, fetchImpl: t.fetchImpl, sleep: noSleep },
      { accountSid: null, callSid: CALL, createdAt: new Date(), reservedSeconds: 300 },
    )).toEqual({ ok: false, kind: 'skipped' });
    expect(t.requests).toHaveLength(0);
  });

  it('remainingCallSeconds rundet ab', () => {
    expect(remainingCallSeconds({ createdAt: new Date(0), reservedSeconds: 10 }, new Date(500))).toBe(9);
  });
});

describe('Verdrahtung', () => {
  const webhook = readFileSync('supabase/functions/bot-voice-webhook/index.ts', 'utf8');
  const enforcer = readFileSync('supabase/functions/bot-voice-enforcer/index.ts', 'utf8');
  const config = readFileSync('supabase/config.toml', 'utf8');

  it('Webhook speichert AccountSid an der Reservierung und setzt TimeLimit nur beim ersten Hit', () => {
    expect(webhook).toMatch(/reserveVoiceCall\([^)]*accountSid/s);
    const existing = webhook.indexOf('if (reservation.existing)');
    const apply = webhook.indexOf('applyProviderTimeLimit(');
    expect(existing).toBeGreaterThan(0);
    expect(apply).toBeGreaterThan(existing);
    expect(webhook.slice(existing, apply)).toContain('} else {');
  });

  it('Enforcer: fail-closed ohne Secret, konstantzeitiger Vergleich, kein Service-Role-Vergleich', () => {
    expect(enforcer).toContain("jsonError(500, 'CRON_KEY_MISSING'");
    expect(enforcer).toContain('timingSafeEqual(token, CRON_KEY)');
    expect(enforcer).not.toMatch(/timingSafeEqual\([^)]*SERVICE_ROLE/);
    expect(config).toMatch(/\[functions\.bot-voice-enforcer\]\s*\nverify_jwt = false/);
  });
});
