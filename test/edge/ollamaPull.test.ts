/**
 * Auto-Pull-Guard fuer Ollama-Modelle.
 *
 * Was hier bewiesen wird:
 *   1) Modell vorhanden → 'present', kein Pull-Trigger
 *   2) Modell fehlt → 'provisioning', Pull wird genau einmal getriggert,
 *      Cache wird invalidiert (naechster Call holt frische /api/tags)
 *   3) /api/tags HTTP-Fehler → 'unchecked' (fall-open, kein Pull)
 *   4) /api/tags Netzwerkfehler → 'unchecked'
 *   5) Cache verhindert wiederholten /api/tags-Call innerhalb der TTL
 *   6) Nach Ablauf der TTL wird /api/tags erneut gefragt
 *   7) Ollama-Tags-Response mit `model`-Feld (statt `name`) wird auch akzeptiert
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureOllamaModel,
  createOllamaPullGuardState,
  type OllamaPullGuardState,
} from '../../supabase/functions/_shared/ollamaPull';

interface FakeFetchCall {
  url: string;
  method: string;
}

function makeFetch(
  responder: (url: string, method: string) => { status: number; body?: unknown; throws?: Error },
): { fetchImpl: typeof fetch; calls: FakeFetchCall[] } {
  const calls: FakeFetchCall[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method });
    const r = responder(url, method);
    if (r.throws) throw r.throws;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body ?? {},
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const BASE = 'http://ollama.test';
const HEADERS = { Authorization: 'Basic dGVzdA==' };

let state: OllamaPullGuardState;
let triggered: string[];
let clock: number;

beforeEach(() => {
  state = createOllamaPullGuardState();
  triggered = [];
  clock = 1_700_000_000_000;
});

const recordingTriggerPull = (model: string) => { triggered.push(model); };

describe('ensureOllamaModel', () => {
  it('returns "present" when the model is in /api/tags', async () => {
    const { fetchImpl, calls } = makeFetch(() => ({
      status: 200,
      body: { models: [{ name: 'gemma3:4b' }, { name: 'qwen3:4b' }] },
    }));

    const result = await ensureOllamaModel({
      baseUrl: BASE,
      headers: HEADERS,
      model: 'gemma3:4b',
      fetchImpl,
      now: () => clock,
      state,
      triggerPull: recordingTriggerPull,
    });

    expect(result).toEqual({ status: 'present' });
    expect(triggered).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}/api/tags`);
    expect(calls[0].method).toBe('GET');
  });

  it('returns "provisioning" and triggers a pull when the model is missing', async () => {
    const { fetchImpl } = makeFetch(() => ({
      status: 200,
      body: { models: [{ name: 'qwen3:4b' }] },
    }));

    const result = await ensureOllamaModel({
      baseUrl: BASE,
      headers: HEADERS,
      model: 'gemma3:4b',
      fetchImpl,
      now: () => clock,
      state,
      triggerPull: recordingTriggerPull,
    });

    expect(result).toEqual({ status: 'provisioning', model: 'gemma3:4b' });
    expect(triggered).toEqual(['gemma3:4b']);
    // Cache wurde invalidiert, damit der naechste Call frische Tags holt.
    expect(state.tagsCache).toBeNull();
  });

  it('returns "unchecked" when /api/tags responds non-2xx (fall-open)', async () => {
    const { fetchImpl } = makeFetch(() => ({ status: 503, body: { error: 'down' } }));

    const result = await ensureOllamaModel({
      baseUrl: BASE,
      headers: HEADERS,
      model: 'gemma3:4b',
      fetchImpl,
      now: () => clock,
      state,
      triggerPull: recordingTriggerPull,
    });

    expect(result).toEqual({ status: 'unchecked' });
    expect(triggered).toEqual([]);
  });

  it('returns "unchecked" when /api/tags fetch throws (network error)', async () => {
    const { fetchImpl } = makeFetch(() => ({ status: 0, throws: new Error('ECONNREFUSED') }));

    const result = await ensureOllamaModel({
      baseUrl: BASE,
      headers: HEADERS,
      model: 'gemma3:4b',
      fetchImpl,
      now: () => clock,
      state,
      triggerPull: recordingTriggerPull,
    });

    expect(result).toEqual({ status: 'unchecked' });
  });

  it('caches /api/tags within the TTL window', async () => {
    const { fetchImpl, calls } = makeFetch(() => ({
      status: 200,
      body: { models: [{ name: 'gemma3:4b' }] },
    }));

    await ensureOllamaModel({
      baseUrl: BASE, headers: HEADERS, model: 'gemma3:4b',
      fetchImpl, now: () => clock, state, triggerPull: recordingTriggerPull,
    });
    clock += 30_000; // 30s vorgespult, noch in der 60s-TTL
    const second = await ensureOllamaModel({
      baseUrl: BASE, headers: HEADERS, model: 'gemma3:4b',
      fetchImpl, now: () => clock, state, triggerPull: recordingTriggerPull,
    });

    expect(second).toEqual({ status: 'present' });
    expect(calls).toHaveLength(1); // /api/tags wurde nur einmal gefragt
  });

  it('refreshes /api/tags after the TTL window expires', async () => {
    const { fetchImpl, calls } = makeFetch(() => ({
      status: 200,
      body: { models: [{ name: 'gemma3:4b' }] },
    }));

    await ensureOllamaModel({
      baseUrl: BASE, headers: HEADERS, model: 'gemma3:4b',
      fetchImpl, now: () => clock, state, triggerPull: recordingTriggerPull,
    });
    clock += 61_000; // TTL ueberschritten
    await ensureOllamaModel({
      baseUrl: BASE, headers: HEADERS, model: 'gemma3:4b',
      fetchImpl, now: () => clock, state, triggerPull: recordingTriggerPull,
    });

    expect(calls).toHaveLength(2);
  });

  it('accepts ollama tags responses that use `model` instead of `name`', async () => {
    const { fetchImpl } = makeFetch(() => ({
      status: 200,
      body: { models: [{ model: 'gemma3:4b' }] },
    }));

    const result = await ensureOllamaModel({
      baseUrl: BASE, headers: HEADERS, model: 'gemma3:4b',
      fetchImpl, now: () => clock, state, triggerPull: recordingTriggerPull,
    });

    expect(result).toEqual({ status: 'present' });
  });
});
