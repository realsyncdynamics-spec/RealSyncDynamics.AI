/**
 * PR A — Bot-Budget, Telefon-Zeitgrenze, Rate-Limit-Helfer, Meta-Signatur.
 *
 * Die atomaren Entscheidungen liegen in Postgres und sind in
 * test/runtime/db/bot-usage-budget.db.test.ts geprüft. Hier geht es um die
 * TypeScript-Seite: wann reserviert, gemessen abgerechnet, geschätzt oder
 * freigegeben wird — und dass ohne Freigabe kein Anbieteraufruf passiert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

// ── runAiTool-Abhängigkeiten mocken (nur für den Integrationsblock) ──────
const callProvider = vi.fn();
vi.mock('../../supabase/functions/_shared/providers.ts', () => {
  class ProviderError extends Error {
    code: string;
    constructor(message: string, code = 'PROVIDER_ERROR') { super(message); this.code = code; }
  }
  return { callProvider: (...a: unknown[]) => callProvider(...a), ProviderError };
});
vi.mock('../../supabase/functions/_shared/entitlements.ts', () => ({
  gateFeature: vi.fn(async () => undefined),
  EntitlementError: class extends Error { code = 'X'; },
}));
vi.mock('../../supabase/functions/_shared/providerCost.ts', () => ({
  NO_USAGE: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  // 1 USD je 1000 Tokens — gut nachrechenbar.
  providerCostUsd: (_p: string, _m: string, u: { input: number; output: number }) => (u.input + u.output) / 1000,
}));
vi.mock('../../supabase/functions/_shared/residencyGuard.ts', () => ({
  requireVerifiedAiResidency: () => 'cloud',
}));
vi.mock('../../supabase/functions/_shared/cost-cap.ts', () => ({
  reserveLlmBudget: vi.fn(async () => ({ decision: 'allow', reservationId: null })),
  settleLlmBudget: vi.fn(async () => ({ ledgerRowId: 1 })),
  CostCapError: class extends Error {},
}));

import {
  BotBudgetError, aiFailureWasNotSent, checkBotRateLimit, checkIpRateLimit, clientIpFromHeaders,
  createBotAiBudgetGuard, hashClientIp, inputTokenUpperBound, originAllowed,
  planSecondsFromEntitlement, reserveVoiceCall, settleVoiceCall, voiceTurnAllowed,
  type AiBudgetGuard,
} from '../../supabase/functions/_shared/bot-budget';
import { verifyMetaSignature } from '../../supabase/functions/_shared/meta-signature';
import { runAiTool } from '../../supabase/functions/_shared/ai';

type RpcCall = { fn: string; args: Record<string, unknown> };

function rpcAdmin(responder: (c: RpcCall) => { data: unknown; error: { message: string } | null }) {
  const calls: RpcCall[] = [];
  return {
    calls,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const c = { fn, args };
      calls.push(c);
      return responder(c);
    },
  };
}

// ── Meta-Signatur (K9) ────────────────────────────────────────────────
describe('Meta-Signatur (K9: fail-closed)', () => {
  const secret = 'meta_app_secret';
  const body = '{"entry":[]}';
  const valid = 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  it('akzeptiert eine gültige Signatur (unabhängige node:crypto-Referenz)', async () => {
    expect(await verifyMetaSignature(secret, body, valid)).toBe(true);
  });
  it.each([
    ['fehlendes Secret', undefined, valid],
    ['leeres Secret', '', valid],
    ['fehlender Header', secret, null],
    ['falsches Präfix', secret, valid.replace('sha256=', 'sha1=')],
    ['falsche Länge', secret, 'sha256=abcd'],
    ['manipulierter Body-Hash', secret, valid.slice(0, -1) + (valid.endsWith('0') ? '1' : '0')],
  ])('lehnt ab: %s', async (_l, s, h) => {
    expect(await verifyMetaSignature(s as string | undefined, body, h as string | null)).toBe(false);
  });
  it('lehnt einen anderen Body mit alter Signatur ab', async () => {
    expect(await verifyMetaSignature(secret, '{"entry":[1]}', valid)).toBe(false);
  });

  it('whatsapp-webhook weist ohne Secret ab, bevor irgendetwas gelesen oder verarbeitet wird', () => {
    const src = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf8');
    const guard = src.indexOf("if (!APP_SECRET) {\n    return new Response('Service Unavailable', { status: 503 });");
    expect(guard).toBeGreaterThan(-1);
    expect(src.indexOf('await req.text()')).toBeGreaterThan(guard);
    expect(src.indexOf('createClient(SUPABASE_URL')).toBeGreaterThan(src.indexOf("return new Response('Unauthorized', { status: 401 })"));
    expect(src).not.toContain('if (!APP_SECRET) return true');
  });
});

// ── Hilfsfunktionen ───────────────────────────────────────────────────
describe('Hilfsfunktionen', () => {
  it('Eingabe-Obergrenze in UTF-8-Bytes (≥ Zeichen/4-Schätzung)', () => {
    expect(inputTokenUpperBound('abcd')).toBe(4);
    expect(inputTokenUpperBound('ä', null, 'ö')).toBe(4);
    expect(inputTokenUpperBound('x'.repeat(400))).toBeGreaterThanOrEqual(400 / 4);
  });

  it('Freigabe nur für nachweislich nicht gesendete Anfragen', () => {
    for (const c of ['PROVIDER_NOT_CONFIGURED', 'PROVIDER_UNSUPPORTED', 'PROVIDER_NOT_IMPLEMENTED', 'PROVIDER_UNPAID_TIER_BLOCKED']) {
      expect(aiFailureWasNotSent(c)).toBe(true);
    }
    for (const c of ['PROVIDER_ERROR', 'INTERNAL', 'QUOTA_EXCEEDED', '', null, undefined]) {
      expect(aiFailureWasNotSent(c as string)).toBe(false);
    }
  });

  it('Planminuten → Sekunden: -1 unbegrenzt, fehlend/0 fail-closed', () => {
    expect(planSecondsFromEntitlement(-1)).toBeNull();
    expect(planSecondsFromEntitlement(10)).toBe(600);
    expect(planSecondsFromEntitlement(undefined)).toBe(0);
    expect(planSecondsFromEntitlement(0)).toBe(0);
    expect(planSecondsFromEntitlement(Number.NaN)).toBe(0);
  });

  it('K4: Zeitgrenze je Gesprächsschritt (serverseitig, mit Sicherheitsabstand)', () => {
    const createdAt = new Date('2026-10-27T10:00:00Z');
    const r = { createdAt, reservedSeconds: 300, status: 'open' };
    expect(voiceTurnAllowed(r, new Date('2026-10-27T10:04:29Z'))).toBe(true);
    expect(voiceTurnAllowed(r, new Date('2026-10-27T10:04:30Z'))).toBe(false);
    expect(voiceTurnAllowed({ ...r, status: 'settled' }, new Date('2026-10-27T10:00:01Z'))).toBe(false);
  });

  it('Client-IP: cf-connecting-ip vor x-real-ip vor x-forwarded-for, sonst gemeinsamer Eimer', () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(clientIpFromHeaders(h({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.1.1.1');
    expect(clientIpFromHeaders(h({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '9.9.9.9' }))).toBe('2.2.2.2');
    expect(clientIpFromHeaders(h({ 'x-forwarded-for': '3.3.3.3, 10.0.0.1' }))).toBe('3.3.3.3');
    expect(clientIpFromHeaders(h({}))).toBe('unknown');
  });

  it('IP-Hash: gesalzen, tagesgebunden, keine Klar-IP', async () => {
    const d1 = new Date('2026-10-27T10:00:00Z');
    const a = await hashClientIp('1.2.3.4', 's', d1);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain('1.2.3.4');
    expect(await hashClientIp('1.2.3.4', 's', d1)).toBe(a);
    expect(await hashClientIp('1.2.3.4', 's', new Date('2026-10-28T10:00:00Z'))).not.toBe(a);
    expect(await hashClientIp('1.2.3.4', 't', d1)).not.toBe(a);
    await expect(hashClientIp('1.2.3.4', '', d1)).rejects.toThrow();
  });

  it('K8: Origin-Prüfung nur als Zusatzhürde, wenn konfiguriert', () => {
    expect(originAllowed(null, {})).toBe(true);
    expect(originAllowed('https://x.de', { allowed_origins: [] })).toBe(true);
    expect(originAllowed('https://kunde.de', { allowed_origins: ['https://kunde.de/'] })).toBe(true);
    expect(originAllowed('https://evil.de', { allowed_origins: ['https://kunde.de'] })).toBe(false);
    expect(originAllowed(null, { allowed_origins: ['https://kunde.de'] })).toBe(false);
  });
});

// ── Rate-Limit-RPC (K8) ───────────────────────────────────────────────
describe('Rate-Limit über DB-Zähler (K8)', () => {
  it('IP-Schranke zuerst; DB-Fehler → fail-closed', async () => {
    const ok = rpcAdmin(() => ({ data: [{ allowed: true, hits: 1 }], error: null }));
    expect(await checkIpRateLimit(ok, 'h')).toEqual({ allowed: true });
    expect(ok.calls[0].args.p_bucket_key).toBe('chat:ip:h');

    const deny = rpcAdmin(() => ({ data: [{ allowed: false, hits: 99 }], error: null }));
    expect(await checkIpRateLimit(deny, 'h')).toEqual({ allowed: false, scope: 'ip' });

    const broken = rpcAdmin(() => ({ data: null, error: { message: 'down' } }));
    expect(await checkIpRateLimit(broken, 'h')).toEqual({ allowed: false, scope: 'unavailable' });
  });

  it('IP+Bot vor Bot gesamt', async () => {
    const seen: string[] = [];
    const admin = rpcAdmin((c) => {
      seen.push(String(c.args.p_bucket_key));
      return { data: [{ allowed: !String(c.args.p_bucket_key).startsWith('chat:bot:') }], error: null };
    });
    expect(await checkBotRateLimit(admin, 'h', 'b1')).toEqual({ allowed: false, scope: 'bot' });
    expect(seen).toEqual(['chat:ipbot:h:b1', 'chat:bot:b1']);
  });

  it('bot-chat prüft das IP-Limit vor dem Bot-Lookup und vor jeder KI', () => {
    const src = readFileSync('supabase/functions/bot-chat/index.ts', 'utf8');
    const ip = src.indexOf('await checkIpRateLimit(');
    const resolve = src.indexOf('await resolveBot(');
    const botRl = src.indexOf('await checkBotRateLimit(');
    const ai = src.indexOf('await runAiTool(');
    expect(ip).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(ip);
    expect(botRl).toBeGreaterThan(resolve);
    expect(ai).toBeGreaterThan(botRl);
    expect(src).toContain('budget: aiBudget');
  });
});

// ── Guard (K6) ────────────────────────────────────────────────────────
describe('createBotAiBudgetGuard (K6)', () => {
  it('reserviert Höchstbetrag; nur "allow" deckt den Aufruf', async () => {
    const admin = rpcAdmin(() => ({ data: [{ decision: 'allow', reservation_id: 'r1' }], error: null }));
    const g = createBotAiBudgetGuard(admin, { tenantId: 't', botId: 'b', channel: 'chat' });
    expect(await g.reserve(0.1234567)).toBe('r1');
    expect(admin.calls[0].fn).toBe('bot_ai_budget_reserve');
    expect(admin.calls[0].args.p_max_usd).toBe(0.123457);
    expect(String(admin.calls[0].args.p_request_ref)).toMatch(/^chat:/);
  });

  it.each([
    ['deny', { decision: 'deny', reservation_id: null, reason: 'daily_budget' }, 'daily_budget'],
    ['existing', { decision: 'existing', reservation_id: 'r0', reason: 'open' }, 'open'],
  ])('wirft BotBudgetError bei %s', async (_l, row, reason) => {
    const g = createBotAiBudgetGuard(rpcAdmin(() => ({ data: [row], error: null })), { tenantId: 't', botId: 'b', channel: 'chat' });
    await expect(g.reserve(1)).rejects.toMatchObject({ code: 'BOT_BUDGET_EXCEEDED', reason });
  });

  it('DB-Fehler → fail-closed (kein KI-Aufruf ohne Budgetprüfung)', async () => {
    const g = createBotAiBudgetGuard(rpcAdmin(() => ({ data: null, error: { message: 'x' } })), { tenantId: 't', botId: null, channel: 'chat' });
    await expect(g.reserve(1)).rejects.toBeInstanceOf(BotBudgetError);
  });

  it('0 USD (lokale Inferenz) → keine Reservierung', async () => {
    const admin = rpcAdmin(() => ({ data: null, error: null }));
    expect(await createBotAiBudgetGuard(admin, { tenantId: 't', botId: null, channel: 'chat' }).reserve(0)).toBeNull();
    expect(admin.calls).toHaveLength(0);
  });
});

// ── Telefon-RPC (K1, K2) ──────────────────────────────────────────────
describe('Telefon-Reservierung und -Abrechnung', () => {
  it('ohne Planminuten keine DB-Reservierung, Ablehnung', async () => {
    const admin = rpcAdmin(() => ({ data: null, error: null }));
    expect(await reserveVoiceCall(admin, { tenantId: 't', botId: 'b', provider: 'twilio', callRef: 'CA1', planSeconds: 0 }))
      .toEqual({ ok: false, reason: 'no_plan_minutes' });
    expect(admin.calls).toHaveLength(0);
  });

  it('K2: Abrechnung trägt Call-ID + Ereignis als Idempotenzschlüssel', async () => {
    const admin = rpcAdmin(() => ({ data: [{ duplicate: true }], error: null }));
    expect(await settleVoiceCall(admin, { tenantId: 't', provider: 'twilio', callRef: 'CA9', seconds: 61.7, status: 'completed' }))
      .toEqual({ duplicate: true });
    expect(admin.calls[0].args.p_event_key).toBe('twilio:CA9:terminal');
    expect(admin.calls[0].args.p_amount).toBe(61);
  });

  it('K5: bot-voice-webhook lehnt vor Annahme ab (<Reject> als erstes Verb) und ruft danach keine KI', () => {
    const src = readFileSync('supabase/functions/bot-voice-webhook/index.ts', 'utf8');
    expect(src).toContain(`twiml('<Reject reason="busy"/>')`);
    const reserve = src.indexOf('await reserveVoiceCall(');
    const greet = src.indexOf('return speakAndGather(actionUrl, greeting)');
    const reply = src.indexOf('await replyForVoice(admin, bot, conversationId, speech');
    expect(reserve).toBeGreaterThan(-1);
    expect(greet).toBeGreaterThan(reserve);
    expect(reply).toBeGreaterThan(reserve);
    // Status-Callback wird vor resolveBot abgerechnet.
    expect(src.indexOf('await settleVoiceCall(')).toBeLessThan(src.indexOf('bot = await resolveBot('));
  });
});

// ── runAiTool mit Budget (K6) ─────────────────────────────────────────
describe('runAiTool mit Bot-Budget (K6)', () => {
  const tool = {
    id: 'tool1', key: 'bot_reply', model_provider: 'anthropic', model_id: 'm', ollama_model_id: null,
    system_prompt: 'sys', max_tokens: 500, temperature: 0, required_entitlement_key: null, enabled: true,
  };

  function admin() {
    const chain = {
      select: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: tool, error: null }),
      single: async () => ({ data: { id: 'run1' }, error: null }),
      insert: () => chain,
      then: (r: (v: unknown) => unknown) => r({ data: null, error: null }),
    };
    return {
      from: () => chain,
      rpc: async (fn: string) => {
        if (fn === 'tenant_entitlements') return { data: [], error: null };
        if (fn === 'resolve_ai_residency') return { data: 'cloud', error: null };
        return { data: null, error: null };
      },
    };
  }

  function guard(reserveResult: string | Error = 'res1') {
    const g = {
      reserve: vi.fn(async (_usd: number) => {
        if (reserveResult instanceof Error) throw reserveResult;
        return reserveResult;
      }),
      settleMeasured: vi.fn(async () => undefined),
      settleUnknown: vi.fn(async () => undefined),
      release: vi.fn(async () => undefined),
    };
    return g as typeof g & AiBudgetGuard;
  }

  beforeEach(() => { callProvider.mockReset(); });

  it('reserviert Eingabe-Obergrenze + max_tokens vor dem Anbieter und übergibt dasselbe Ausgabelimit', async () => {
    const g = guard();
    callProvider.mockResolvedValue({ text: 'ok', inputTokens: 10, outputTokens: 20, cachedTokens: 0, pricedUsage: { input: 10, output: 20 } });
    const input = 'x'.repeat(100);
    await runAiTool(admin() as never, 't', null, 'bot_reply', input, { budget: g });
    // (3 Bytes System + 100 Bytes Eingabe + 500 max_tokens) / 1000
    expect(g.reserve).toHaveBeenCalledWith(0.603);
    expect(g.reserve.mock.invocationCallOrder[0]).toBeLessThan(callProvider.mock.invocationCallOrder[0]);
    expect(callProvider.mock.calls[0][0]).toMatchObject({ maxTokens: 500 });
    expect(g.settleMeasured).toHaveBeenCalledWith('res1', 0.03, expect.any(Object));
    expect(g.settleUnknown).not.toHaveBeenCalled();
    expect(g.release).not.toHaveBeenCalled();
  });

  it('Ablehnung → kein Anbieteraufruf, Fehlercode BOT_BUDGET_EXCEEDED', async () => {
    const g = guard(new BotBudgetError('daily_budget'));
    await expect(runAiTool(admin() as never, 't', null, 'bot_reply', 'hi', { budget: g }))
      .rejects.toMatchObject({ code: 'BOT_BUDGET_EXCEEDED', status: 429 });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('Timeout/HTTP-Fehler → unklar → Höchstbetrag als estimated', async () => {
    const { ProviderError } = await import('../../supabase/functions/_shared/providers.ts') as unknown as {
      ProviderError: new (m: string, c?: string) => Error;
    };
    const g = guard();
    callProvider.mockRejectedValue(new ProviderError('timeout', 'PROVIDER_ERROR'));
    await expect(runAiTool(admin() as never, 't', null, 'bot_reply', 'hi', { budget: g })).rejects.toBeTruthy();
    expect(g.settleUnknown).toHaveBeenCalledWith('res1', expect.objectContaining({ error_code: 'PROVIDER_ERROR' }));
    expect(g.release).not.toHaveBeenCalled();
    expect(g.settleMeasured).not.toHaveBeenCalled();
  });

  it('nachweislich nicht gesendet (Anbieter nicht konfiguriert) → Freigabe', async () => {
    const { ProviderError } = await import('../../supabase/functions/_shared/providers.ts') as unknown as {
      ProviderError: new (m: string, c?: string) => Error;
    };
    const g = guard();
    callProvider.mockRejectedValue(new ProviderError('no key', 'PROVIDER_NOT_CONFIGURED'));
    await expect(runAiTool(admin() as never, 't', null, 'bot_reply', 'hi', { budget: g })).rejects.toBeTruthy();
    expect(g.release).toHaveBeenCalledWith('res1', 'not_sent:PROVIDER_NOT_CONFIGURED');
    expect(g.settleUnknown).not.toHaveBeenCalled();
  });

  it('ohne Budget-Option unverändertes Verhalten (andere Aufrufer)', async () => {
    callProvider.mockResolvedValue({ text: 'ok', inputTokens: 1, outputTokens: 1, cachedTokens: 0, pricedUsage: { input: 1, output: 1 } });
    const r = await runAiTool(admin() as never, 't', null, 'bot_reply', 'hi');
    expect(r.output).toBe('ok');
  });
});
