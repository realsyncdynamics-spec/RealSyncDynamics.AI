import { describe, expect, it, vi } from 'vitest';
import { takeRateLimit } from '../../src/lib/company-voice/endpoint';
import { handleCompanyVoiceLiveRequest, startGrokRelay, type RelaySocket } from '../../src/lib/company-voice/grok-relay';
import {
  base64PcmSeconds,
  DAY_RECORD_TTL_SECONDS,
  liveDayKey,
  readDayRecord,
  recordLiveSessionEnd,
  reserveLiveSession,
  resolveDailyLimit,
} from '../../src/lib/company-voice/live-ledger';
import type { CompanyVoiceEnv, LiveVoiceKv } from '../../src/lib/company-voice/types';

class FakeKv implements LiveVoiceKv {
  data = new Map<string, string>();
  ttls: number[] = [];
  failGet = false;
  failPut = false;
  async get(key: string): Promise<string | null> {
    if (this.failGet) throw new Error('kv down');
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    if (this.failPut) throw new Error('kv down');
    this.data.set(key, value);
    if (options?.expirationTtl) this.ttls.push(options.expirationTtl);
  }
}

class FakeSocket implements RelaySocket {
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  accepted = false;
  private listeners: Record<string, Array<(event: { data?: unknown }) => void>> = {};
  send(data: string): void {
    if (this.closed) throw new Error('closed');
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(): void {
    this.closed = true;
  }
  accept(): void {
    this.accepted = true;
  }
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: 'message' | 'close' | 'error', data?: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener({ data: typeof data === 'string' || data === undefined ? data : JSON.stringify(data) });
  }
}

const DAY = Date.UTC(2026, 10, 17, 12, 0, 0);

function env(kv: FakeKv, extra: CompanyVoiceEnv = {}): CompanyVoiceEnv {
  return { COMPANY_VOICE_GROK_ENABLED: 'true', XAI_API_KEY: 'xai-test-secret', COMPANY_VOICE_LIVE_KV: kv, ...extra };
}

const upgradeRequest = (ip = '203.0.113.7') =>
  new Request('https://realsyncdynamicsai.de/api/company-voice/live', {
    headers: { upgrade: 'websocket', origin: 'https://realsyncdynamicsai.de', 'cf-connecting-ip': ip },
  });

describe('Tageslimit', () => {
  it('liest das Limit streng aus der Umgebung', () => {
    expect(resolveDailyLimit({})).toBe(30);
    expect(resolveDailyLimit({ COMPANY_VOICE_GROK_DAILY_SESSIONS: ' 5 ' })).toBe(5);
    expect(resolveDailyLimit({ COMPANY_VOICE_GROK_DAILY_SESSIONS: '1000' })).toBe(1000);
    expect(resolveDailyLimit({ COMPANY_VOICE_GROK_DAILY_SESSIONS: '0' })).toBeNull();
    expect(resolveDailyLimit({ COMPANY_VOICE_GROK_DAILY_SESSIONS: '1001' })).toBeNull();
    expect(resolveDailyLimit({ COMPANY_VOICE_GROK_DAILY_SESSIONS: '2.5' })).toBeNull();
    expect(resolveDailyLimit({ COMPANY_VOICE_GROK_DAILY_SESSIONS: '-1' })).toBeNull();
  });

  it('zählt je UTC-Tag und stoppt am Limit', async () => {
    const kv = new FakeKv();
    const limited = env(kv, { COMPANY_VOICE_GROK_DAILY_SESSIONS: '2' });
    expect(await reserveLiveSession(limited, DAY)).toEqual({ ok: true, day: '2026-11-17', used: 1, limit: 2 });
    expect(await reserveLiveSession(limited, DAY + 1)).toMatchObject({ ok: true, used: 2 });
    expect(await reserveLiveSession(limited, DAY + 2)).toEqual({ ok: false, code: 'DAILY_LIMIT' });
    expect(await reserveLiveSession(limited, DAY + 24 * 3_600_000)).toMatchObject({ ok: true, day: '2026-11-18', used: 1 });
    expect(kv.ttls.every((ttl) => ttl === DAY_RECORD_TTL_SECONDS)).toBe(true);
  });

  it('bleibt bei KV-Fehlern und beschädigten Daten zu (fail-closed)', async () => {
    const down = new FakeKv();
    down.failGet = true;
    expect(await reserveLiveSession(env(down), DAY)).toEqual({ ok: false, code: 'LIMIT_UNAVAILABLE' });

    const readOnly = new FakeKv();
    readOnly.failPut = true;
    expect(await reserveLiveSession(env(readOnly), DAY)).toEqual({ ok: false, code: 'LIMIT_UNAVAILABLE' });

    const corrupt = new FakeKv();
    corrupt.data.set(liveDayKey(DAY), '{kaputt');
    expect(await reserveLiveSession(env(corrupt), DAY)).toEqual({ ok: false, code: 'LIMIT_UNAVAILABLE' });

    expect(await reserveLiveSession({ COMPANY_VOICE_GROK_ENABLED: 'true', XAI_API_KEY: 'k' }, DAY)).toEqual({
      ok: false,
      code: 'LIMIT_UNAVAILABLE',
    });
  });

  it('lehnt am Tageslimit oder ohne KV ab, bevor der Provider angesprochen wird', async () => {
    const kv = new FakeKv();
    kv.data.set(liveDayKey(DAY), JSON.stringify({ sessions: 3 }));
    const fetchImpl = vi.fn();
    const lines: string[] = [];
    const deps = { fetchImpl, store: new Map<string, number[]>(), counter: { active: 0 }, now: () => DAY, log: (line: string) => lines.push(line) };

    const full = await handleCompanyVoiceLiveRequest(upgradeRequest(), env(kv, { COMPANY_VOICE_GROK_DAILY_SESSIONS: '3' }), deps);
    expect(full.status).toBe(429);
    expect((await full.json()).error.code).toBe('DAILY_LIMIT');

    kv.failGet = true;
    const down = await handleCompanyVoiceLiveRequest(upgradeRequest('203.0.113.8'), env(kv), deps);
    expect(down.status).toBe(503);
    expect((await down.json()).error.code).toBe('LIMIT_UNAVAILABLE');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { event: 'company_voice.live', phase: 'rejected', code: 'DAILY_LIMIT' },
      { event: 'company_voice.live', phase: 'rejected', code: 'LIMIT_UNAVAILABLE' },
    ]);
    expect(lines.join('\n')).not.toContain('203.0.113');
  });
});

describe('Prüfpfad', () => {
  it('schreibt Beginn und Ende je Gespräch ohne IP, Key, Audio oder Transkript', async () => {
    const kv = new FakeKv();
    const upstream = new FakeSocket();
    const server = new FakeSocket();
    const lines: string[] = [];
    const pending: Array<Promise<unknown>> = [];
    let clock = DAY;
    const response = await handleCompanyVoiceLiveRequest(upgradeRequest(), env(kv), {
      fetchImpl: vi.fn(async () => ({ webSocket: upstream }) as unknown as Response),
      store: new Map(),
      counter: { active: 0 },
      now: () => clock,
      createPair: () => ['browser-side', server] as [unknown, FakeSocket],
      upgradeResponse: () => new Response(null, { status: 200 }),
      relay: startGrokRelay,
      log: (line) => lines.push(line),
      waitUntil: (promise) => pending.push(promise),
      newSessionId: () => 'sess-1',
    });
    expect(response.status).toBe(200);

    upstream.emit('message', { type: 'session.updated' });
    const audio = 'A'.repeat(64_000); // 48 000 Byte PCM16 = 1 s bei 24 kHz
    server.emit('message', { type: 'audio', audio });
    upstream.emit('message', { type: 'conversation.item.input_audio_transcription.completed', transcript: 'Mein Name ist Max' });
    upstream.emit('message', { type: 'response.output_audio_transcript.done', transcript: 'Geheime Antwort' });
    clock = DAY + 42_400;
    server.emit('message', { type: 'stop' });
    await Promise.all(pending);

    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events[0]).toEqual({
      event: 'company_voice.live',
      phase: 'started',
      sessionId: 'sess-1',
      day: '2026-11-17',
      used: 1,
      limit: 30,
      model: 'grok-voice-latest',
      voice: 'eve',
    });
    expect(events[1]).toEqual({
      event: 'company_voice.live',
      phase: 'ended',
      sessionId: 'sess-1',
      reason: 'client_closed',
      clientAudioSeconds: 1,
      durationSeconds: 42,
      model: 'grok-voice-latest',
      voice: 'eve',
    });
    const all = lines.join('\n');
    for (const secret of ['203.0.113', 'xai-test-secret', 'Max', 'Geheime', audio.slice(0, 32)]) expect(all).not.toContain(secret);

    const record = await readDayRecord(kv, DAY);
    expect(record).toEqual({ day: '2026-11-17', sessions: 1, seconds: 42, audioSeconds: 1, ended: { client_closed: 1 } });
    expect(JSON.stringify([...kv.data.values()])).not.toMatch(/Max|Geheime|203\.0\.113/);
  });

  it('verbucht einen nicht erreichbaren Provider als eigenes Ende', async () => {
    const kv = new FakeKv();
    const pending: Array<Promise<unknown>> = [];
    const response = await handleCompanyVoiceLiveRequest(upgradeRequest(), env(kv), {
      fetchImpl: vi.fn(async () => {
        throw new Error('boom');
      }),
      store: new Map(),
      counter: { active: 0 },
      now: () => DAY,
      log: () => undefined,
      waitUntil: (promise) => pending.push(promise),
    });
    expect(response.status).toBe(502);
    await Promise.all(pending);
    expect(await readDayRecord(kv, DAY)).toMatchObject({ sessions: 1, ended: { provider_unavailable: 1 } });
  });

  it('wirft beim Nachtragen nie, auch wenn KV ausfällt', async () => {
    const kv = new FakeKv();
    kv.failPut = true;
    await expect(
      recordLiveSessionEnd(env(kv), {
        sessionId: 's',
        startedAt: DAY,
        endedAt: DAY + 1_000,
        reason: 'time_limit',
        clientAudioSeconds: 1,
        model: 'm',
        voice: 'v',
      }),
    ).resolves.toBeUndefined();
  });

  it('rechnet Base64-PCM16 in Sekunden um', () => {
    expect(base64PcmSeconds(64_000, 24_000)).toBe(1);
    expect(base64PcmSeconds(0, 24_000)).toBe(0);
  });
});

describe('Missbrauchsbremse', () => {
  it('hält keine IP länger als das Zeitfenster im Speicher', () => {
    const store = new Map<string, number[]>();
    expect(takeRateLimit('198.51.100.1', 0, store, 3, 600_000)).toBe(true);
    expect(takeRateLimit('198.51.100.2', 599_999, store, 3, 600_000)).toBe(true);
    expect([...store.keys()]).toEqual(['198.51.100.1', '198.51.100.2']);
    expect(takeRateLimit('198.51.100.3', 600_000, store, 3, 600_000)).toBe(true);
    expect([...store.keys()]).toEqual(['198.51.100.2', '198.51.100.3']);
  });

  it('zählt weiter korrekt je Schlüssel', () => {
    const store = new Map<string, number[]>();
    expect(takeRateLimit('a', 0, store, 2, 1_000)).toBe(true);
    expect(takeRateLimit('a', 1, store, 2, 1_000)).toBe(true);
    expect(takeRateLimit('a', 2, store, 2, 1_000)).toBe(false);
    expect(takeRateLimit('a', 1_001, store, 2, 1_000)).toBe(true);
  });
});
