import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendQuickChat,
  __resetQuickChatStateForTests,
  QUICK_CHAT_LIMITS,
} from '../../../src/features/assistant/assistantQuickChatApi';
import { AiGatewayEdgeClient } from '../../../src/core/ai-gateway/edgeClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeStubClient(envelope: unknown, status = 200): AiGatewayEdgeClient {
  return new AiGatewayEdgeClient({
    supabaseUrl: 'https://test.supabase.co',
    apiKey: 'anon',
    fetchImpl: vi.fn(async () => jsonResponse(envelope, status)),
  });
}

function successClient(reply: string): AiGatewayEdgeClient {
  return makeStubClient({
    ok: true,
    provider: 'lm_studio',
    model: 'qwen-7b',
    profile: 'fast-local',
    output: reply,
    usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
    trace_id: 't-1',
    latency_ms: 30,
  });
}

beforeEach(() => {
  __resetQuickChatStateForTests();
});

describe('sendQuickChat — success path', () => {
  it('returns the assistant reply and an updated history', async () => {
    const result = await sendQuickChat({
      message: 'Was ist EU-lokale KI?',
      history: [],
    }, { client: successClient('EU-lokale KI läuft auf Hostinger in Deutschland.') });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.reply).toMatch(/EU-lokale/);
    expect(result.history).toHaveLength(2);
    expect(result.history[0]).toEqual({ role: 'user', content: 'Was ist EU-lokale KI?' });
    expect(result.history[1]?.role).toBe('assistant');
  });

  it('folds previous history into the prompt as Besucher/Assistent blocks', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true, provider: 'lm_studio', model: 'm', profile: 'fast-local',
      output: 'kurz', trace_id: 't', latency_ms: 1,
    }));
    const client = new AiGatewayEdgeClient({
      supabaseUrl: 'https://t.supabase.co',
      apiKey: 'k',
      fetchImpl,
    });

    await sendQuickChat({
      message: 'Frage 2',
      history: [
        { role: 'user', content: 'Frage 1' },
        { role: 'assistant', content: 'Antwort 1' },
      ],
    }, { client });

    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    if (!call) throw new Error('expected fetch');
    const body = JSON.parse(call[1].body as string);
    expect(body.feature).toBe('assistant_chip_quick_chat');
    expect(body.model_profile).toBe('fast-local');
    expect(body.input).toContain('Besucher: Frage 1');
    expect(body.input).toContain('Assistent: Antwort 1');
    expect(body.input).toContain('Besucher: Frage 2');
  });
});

describe('sendQuickChat — abuse guards', () => {
  it('blocks messages over the length cap without calling the gateway', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const client = new AiGatewayEdgeClient({
      supabaseUrl: 'https://t.supabase.co', apiKey: 'k', fetchImpl,
    });

    const result = await sendQuickChat({
      message: 'x'.repeat(QUICK_CHAT_LIMITS.maxMessageLength + 1),
      history: [],
    }, { client });

    expect(result.kind).toBe('too_long');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks once the turn cap is reached', async () => {
    const history = Array.from({ length: QUICK_CHAT_LIMITS.maxTurns }, (_, i) => ({
      role: 'user' as const, content: `Q${i}`,
    }));
    const result = await sendQuickChat(
      { message: 'one more', history },
      { client: successClient('ignored') },
    );
    expect(result.kind).toBe('turn_cap');
  });

  it('blocks an email PII pattern', async () => {
    const result = await sendQuickChat(
      { message: 'Schreib mir an test@example.com.', history: [] },
      { client: successClient('ignored') },
    );
    expect(result.kind).toBe('pii_blocked');
    if (result.kind !== 'pii_blocked') throw new Error('expected pii_blocked');
    expect(result.pattern).toBe('email');
  });

  it('blocks a phone-number PII pattern', async () => {
    const result = await sendQuickChat(
      { message: 'Ruf mich an +49 176 4013 2161.', history: [] },
      { client: successClient('ignored') },
    );
    expect(result.kind).toBe('pii_blocked');
  });

  it('rate-limits after configured number of sends in a 60 s window', async () => {
    const client = successClient('ok');
    let t = 1_000_000;
    const now = () => t;

    for (let i = 0; i < QUICK_CHAT_LIMITS.rateLimitPerMinute; i++) {
      const r = await sendQuickChat({ message: `frage ${i}`, history: [] }, { client, now });
      expect(r.kind).toBe('ok');
      t += 1000;
    }

    const blocked = await sendQuickChat({ message: 'eine zuviel', history: [] }, { client, now });
    expect(blocked.kind).toBe('rate_limited');
    if (blocked.kind !== 'rate_limited') throw new Error('expected rate_limited');
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    // After 60 s the window slides and a new send goes through.
    t += 60_000;
    const okAgain = await sendQuickChat({ message: 'jetzt', history: [] }, { client, now });
    expect(okAgain.kind).toBe('ok');
  });
});

describe('sendQuickChat — gateway errors', () => {
  it('maps an upstream error envelope to a structured error result', async () => {
    const envelope = { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'down' } };
    const client = makeStubClient(envelope, 502);

    const result = await sendQuickChat({ message: 'ping', history: [] }, { client });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') throw new Error('expected error');
    expect(result.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('returns a config error when Supabase env is missing', async () => {
    const result = await sendQuickChat({ message: 'ping', history: [] }, {
      supabaseUrl: '',
      supabaseAnonKey: '',
    }).catch((e) => e);

    expect(result).toMatchObject({ name: 'AiGatewayEdgeError', code: 'AI_GATEWAY_NOT_CONFIGURED' });
  });
});
