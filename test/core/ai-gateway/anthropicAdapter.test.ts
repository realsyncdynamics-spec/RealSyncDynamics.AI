import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AnthropicAdapter,
  supportsSamplingParams,
} from '../../../src/core/ai-gateway/providers/anthropicAdapter';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

function req(over: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'cloud-fallback',
    input: 'Was deckt der DSGVO-Audit ab?',
    ...over,
  };
}

function fakeFetch(opts: { ok?: boolean; status?: number; body?: unknown } = {}): typeof fetch {
  const ok = opts.ok ?? true;
  const status = opts.status ?? 200;
  const body = opts.body ?? {
    id:    'msg_1',
    model: 'claude-haiku-4-5',
    content: [{ type: 'text', text: 'hi back' }],
    usage:   { input_tokens: 10, output_tokens: 4 },
  };
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  } as unknown as Response)) as unknown as typeof fetch;
}

function bodyOf(f: typeof fetch): Record<string, unknown> {
  const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('AnthropicAdapter.health', () => {
  it('returns ok=true when an API key is present', async () => {
    const a = new AnthropicAdapter({ apiKey: 'sk-ant-...', model: 'claude-haiku-4-5' });
    expect(await a.health()).toEqual({ ok: true, models: ['claude-haiku-4-5'] });
  });

  it('returns ok=false when API key is empty', async () => {
    const a = new AnthropicAdapter({ apiKey: '', model: 'claude-haiku-4-5' });
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.error).toMatch(/not set/);
  });
});

describe('AnthropicAdapter.generate', () => {
  it('POSTs to /v1/messages with x-api-key + anthropic-version headers', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'sk-ant-test', model: 'claude-haiku-4-5', fetchImpl: f });
    await a.generate(req());

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('returns the assistant text + usage', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg_2', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'Antwort A' }, { type: 'text', text: 'Antwort B' }],
        usage: { input_tokens: 12, output_tokens: 8, cache_creation_input_tokens: 4 },
      }}),
    });
    const out = await a.generate(req());
    expect(out.provider).toBe('anthropic');
    expect(out.output).toBe('Antwort A\nAntwort B');
    expect(out.usage?.input_tokens).toBe(12 + 4);     // cache-creation counts toward input
    expect(out.usage?.output_tokens).toBe(8);
  });

  it('omits temperature on a model that removed sampling (would be HTTP 400)', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-opus-4-7', fetchImpl: f });
    await a.generate(req({ temperature: 0.5 }));
    expect('temperature' in bodyOf(f)).toBe(false);
  });

  it('passes temperature on a model that still supports sampling', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5-20251001', fetchImpl: f });
    await a.generate(req({ temperature: 0.7 }));
    expect(bodyOf(f).temperature).toBe(0.7);
  });

  it('throws when the API returns an error envelope', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ ok: false, status: 401, body: { error: { message: 'invalid x-api-key' } } }),
    });
    await expect(a.generate(req())).rejects.toThrow(/invalid x-api-key/);
  });

  it('attaches system_prompt with cache_control: ephemeral', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5', fetchImpl: f });
    await a.generate(req({ system_prompt: 'You are the RealSync compliance assistant.' }));
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toEqual([
      { type: 'text', text: 'You are the RealSync compliance assistant.', cache_control: { type: 'ephemeral' } },
    ]);
  });
});

describe('AnthropicAdapter.extractJson', () => {
  it('returns parsed JSON when the model emits valid JSON', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: '{"verdict":"compliant","score":92}' }],
        usage: { input_tokens: 5, output_tokens: 6 },
      }}),
    });
    const out = await a.extractJson<{ verdict: string; score: number }>(req({ task_type: 'extract_json' }));
    expect(out.output).toEqual({ verdict: 'compliant', score: 92 });
  });

  it('throws when the response is not valid JSON', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'I think it is mostly compliant.' }],
        usage: { input_tokens: 5, output_tokens: 6 },
      }}),
    });
    await expect(a.extractJson(req({ task_type: 'extract_json' }))).rejects.toThrow(/invalid JSON/);
  });
});

describe('AnthropicAdapter.embed', () => {
  it('throws — Anthropic offers no embeddings API', async () => {
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5' });
    await expect(a.embed(req({ task_type: 'embed' }))).rejects.toThrow(/no embeddings API/);
  });
});

// ── Sampling-parameter compatibility ──────────────────────────────
//
// Anthropic removed `temperature` / `top_p` / `top_k` with the 4.7
// generation. Sending one to such a model fails the request with HTTP 400;
// omitting one where it is supported silently drops the caller's intent.
// Every Anthropic model id actually configured anywhere in this repository
// is pinned below, plus the current cloud ids the gateway can be pointed at.

const SAMPLING_SUPPORTED = [
  // configured in this repo today
  'claude-sonnet-4-6',
  'claude-sonnet-4-6-20250514',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-1-20250805',
  'claude-opus-4',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet',
  'claude-3.5-sonnet',
  // boundary: last generation before the removal
  'claude-opus-4-6',
];

const SAMPLING_REMOVED = [
  // configured in this repo today
  'claude-opus-4-7',
  // current cloud ids the gateway may be pointed at
  'claude-opus-4-8',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-fable-5',
  'claude-fable-5-1',
  'claude-mythos-5-1',
  // unknown / future ids default to "removed": a dropped sampling default
  // is recoverable, a rejected request is not
  'claude-haiku-5',
  'claude-something-new',
  'gpt-4o',
];

describe('supportsSamplingParams', () => {
  it.each(SAMPLING_SUPPORTED)('allows sampling for %s', (model) => {
    expect(supportsSamplingParams(model)).toBe(true);
  });

  it.each(SAMPLING_REMOVED)('suppresses sampling for %s', (model) => {
    expect(supportsSamplingParams(model)).toBe(false);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(supportsSamplingParams('  CLAUDE-Haiku-4-5  ')).toBe(true);
    expect(supportsSamplingParams('  Claude-Opus-5  ')).toBe(false);
  });
});

describe('AnthropicAdapter sampling params per configured model', () => {
  it.each(SAMPLING_SUPPORTED)('sends temperature to %s', async (model) => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model, fetchImpl: f });
    await a.generate(req({ temperature: 0.3 }));
    expect(bodyOf(f).temperature).toBe(0.3);
  });

  it.each(SAMPLING_REMOVED)('never sends temperature to %s', async (model) => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model, fetchImpl: f });
    await a.generate(req({ temperature: 0.3 }));
    expect('temperature' in bodyOf(f)).toBe(false);
  });

  it('defaults to 0.2 on a sampling model when the caller sets none', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-sonnet-4-6', fetchImpl: f });
    await a.generate(req());
    expect(bodyOf(f).temperature).toBe(0.2);
  });

  // The regression this suite exists for: extractJson() pins temperature to 0
  // for deterministic JSON. The old `^claude-(opus|sonnet|haiku)-4` heuristic
  // classified every configured 4.x model as "no sampling" and dropped it.
  it('lets extractJson pin temperature to 0 on a sampling model', async () => {
    const f = fakeFetch({ body: {
      id: 'msg', model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 3, output_tokens: 3 },
    }});
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-sonnet-4-6', fetchImpl: f });
    await a.extractJson(req({ task_type: 'extract_json' }));
    expect(bodyOf(f).temperature).toBe(0);
  });

  it('still extracts JSON on a model that cannot take temperature', async () => {
    const f = fakeFetch({ body: {
      id: 'msg', model: 'claude-opus-5',
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 3, output_tokens: 3 },
    }});
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-opus-5', fetchImpl: f });
    const out = await a.extractJson<{ ok: boolean }>(req({ task_type: 'extract_json' }));
    expect(out.output).toEqual({ ok: true });
    expect('temperature' in bodyOf(f)).toBe(false);
  });
});

// The Edge Function bundle cannot import from src/, so the adapter is kept as
// two byte-compatible mirrors. Vitest only exercises the src/ copy — this
// guard fails when the Deno copy drifts away from it.
describe('anthropicAdapter mirror parity', () => {
  it('keeps supportsSamplingParams identical in the Deno mirror', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const extract = (p: string) => {
      const body = readFileSync(path.join(root, p), 'utf8');
      const m = /export function supportsSamplingParams[\s\S]*?\n}\n/.exec(body);
      if (!m) throw new Error(`supportsSamplingParams not found in ${p}`);
      return m[0];
    };
    expect(extract('supabase/functions/_shared/aiGateway/anthropicAdapter.ts'))
      .toBe(extract('src/core/ai-gateway/providers/anthropicAdapter.ts'));
  });
});
