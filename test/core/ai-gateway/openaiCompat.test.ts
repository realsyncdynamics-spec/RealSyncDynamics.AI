import { describe, it, expect } from 'vitest';
import {
  routeOf,
  modelsResponse,
  parseChatRequest,
  formatChatResponse,
  mapInferenceError,
  KNOWN_PROFILES,
} from '../../../src/core/ai-gateway/openaiCompat';
import type { AiGatewayResponse } from '../../../src/core/ai-gateway/types';

describe('routeOf', () => {
  it.each([
    ['https://x.supabase.co/functions/v1/ai-gateway',                     '/'],
    ['https://x.supabase.co/functions/v1/ai-gateway/',                    '/'],
    ['https://x.supabase.co/functions/v1/ai-gateway/v1/models',           '/v1/models'],
    ['https://x.supabase.co/functions/v1/ai-gateway/v1/chat/completions', '/v1/chat/completions'],
    ['http://localhost:54321/functions/v1/ai-gateway/v1/models',          '/v1/models'],
    ['https://x.supabase.co/functions/v1/ai-gateway/v1/models?foo=bar',   '/v1/models'],
  ])('maps %s → %s', (input, expected) => {
    expect(routeOf(input)).toBe(expected);
  });

  it('returns the raw path when the route does not pass through ai-gateway', () => {
    expect(routeOf('https://x.supabase.co/functions/v1/other-func/v1/models'))
      .toBe('/functions/v1/other-func/v1/models');
  });
});

describe('modelsResponse', () => {
  it('lists every known profile as an OpenAI model entry', () => {
    const res = modelsResponse(1_700_000_000_000);
    expect(res.object).toBe('list');
    expect(res.data).toHaveLength(KNOWN_PROFILES.length);
    for (const profile of KNOWN_PROFILES) {
      const entry = res.data.find((d) => d.id === profile);
      expect(entry).toBeDefined();
      expect(entry?.object).toBe('model');
      expect(entry?.owned_by).toBe('realsyncdynamics');
      expect(entry?.created).toBe(1_700_000_000);
    }
  });
});

describe('parseChatRequest', () => {
  it('rejects an unknown model profile', () => {
    const r = parseChatRequest({
      model: 'gpt-9000-ultra',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.status).toBe(400);
      expect(r.code).toBe('BAD_REQUEST');
      expect(r.message).toMatch(/model must be one of/);
    }
  });

  it('rejects an empty / missing messages array', () => {
    const a = parseChatRequest({ model: 'fast-local' });
    expect(a.ok).toBe(false);
    if (a.ok === false) {
      expect(a.status).toBe(400);
      expect(a.message).toMatch(/messages\[\] required/);
    }
    const b = parseChatRequest({ model: 'fast-local', messages: [] });
    expect(b.ok).toBe(false);
    if (b.ok === false) {
      expect(b.status).toBe(400);
      expect(b.message).toMatch(/messages\[\] required/);
    }
  });

  it('rejects messages without any user role', () => {
    const r = parseChatRequest({
      model: 'fast-local',
      messages: [{ role: 'system', content: 'be helpful' }],
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/no user message/);
    }
  });

  it('uses the LAST user message as input', () => {
    const r = parseChatRequest({
      model: 'fast-local',
      messages: [
        { role: 'user', content: 'first user msg' },
        { role: 'assistant', content: 'ack' },
        { role: 'user', content: 'second user msg — this one' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.input).toBe('second user msg — this one');
  });

  it('concatenates all system messages into system_prompt', () => {
    const r = parseChatRequest({
      model: 'fast-local',
      messages: [
        { role: 'system', content: 'part one' },
        { role: 'system', content: 'part two' },
        { role: 'user', content: 'go' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.system_prompt).toBe('part one\n\npart two');
  });

  it('routes response_format=json_object → task_type=extract_json + wantsJson=true', () => {
    const r = parseChatRequest({
      model: 'strict-json',
      messages: [{ role: 'user', content: 'json me' }],
      response_format: { type: 'json_object' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wantsJson).toBe(true);
      expect(r.request.task_type).toBe('extract_json');
    }
  });

  it('defaults to task_type=chat + wantsJson=false when response_format is text or absent', () => {
    const r = parseChatRequest({
      model: 'fast-local',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wantsJson).toBe(false);
      expect(r.request.task_type).toBe('chat');
    }
  });

  it('forwards max_tokens / temperature / user', () => {
    const r = parseChatRequest({
      model: 'fast-local',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 64,
      temperature: 0.7,
      user: 'user-abc',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.max_tokens).toBe(64);
      expect(r.request.temperature).toBe(0.7);
      expect(r.request.user_id).toBe('user-abc');
    }
  });

  it('feature is always openai_compat (analytics tag)', () => {
    const r = parseChatRequest({ model: 'fast-local', messages: [{ role: 'user', content: 'x' }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.feature).toBe('openai_compat');
  });
});

describe('formatChatResponse', () => {
  function fakeResponse(overrides: Partial<AiGatewayResponse<unknown>> = {}): AiGatewayResponse<unknown> {
    return {
      provider:   'lm_studio',
      model:      'qwen2.5-7b-instruct',
      profile:    'fast-local',
      output:     'Hello from the gateway.',
      trace_id:   'trace-abc-123',
      latency_ms: 412,
      usage: { input_tokens: 11, output_tokens: 5, total_tokens: 16 },
      ...overrides,
    };
  }

  it('wraps a string output into choices[0].message.content', () => {
    const out = formatChatResponse(fakeResponse(), 'fast-local', 1_700_000_000_000);
    expect(out.object).toBe('chat.completion');
    expect(out.id).toBe('chatcmpl-trace-abc-123');
    expect(out.created).toBe(1_700_000_000);
    expect(out.model).toBe('fast-local');
    expect(out.choices).toHaveLength(1);
    expect(out.choices[0].message).toEqual({ role: 'assistant', content: 'Hello from the gateway.' });
    expect(out.choices[0].finish_reason).toBe('stop');
  });

  it('JSON-stringifies a non-string output (extract_json path)', () => {
    const out = formatChatResponse(
      fakeResponse({ output: { risk_class: 'limited', score: 42 } }),
      'strict-json',
    );
    expect(JSON.parse(out.choices[0].message.content)).toEqual({ risk_class: 'limited', score: 42 });
  });

  it('maps usage tokens into the OpenAI usage shape (with 0 fallbacks)', () => {
    const out = formatChatResponse(fakeResponse({ usage: undefined }), 'fast-local');
    expect(out.usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  });

  it('exposes provider / latency / trace_id in the _gateway debug field', () => {
    const out = formatChatResponse(fakeResponse(), 'fast-local');
    expect(out._gateway).toEqual({
      provider:   'lm_studio',
      profile:    'fast-local',
      model:      'qwen2.5-7b-instruct',
      trace_id:   'trace-abc-123',
      latency_ms: 412,
    });
  });
});

describe('mapInferenceError', () => {
  it.each([
    ['No LM Studio model available',                  502, 'UPSTREAM_UNAVAILABLE'],
    ['LM Studio HTTP 503',                            502, 'UPSTREAM_UNAVAILABLE'],
    ['fetch failed',                                  502, 'UPSTREAM_UNAVAILABLE'],
    ['HTTP 502 Bad Gateway',                          502, 'UPSTREAM_UNAVAILABLE'],
    ['LM Studio returned invalid JSON',               502, 'UPSTREAM_BAD_OUTPUT'],
    ['totally unrelated runtime error',               500, 'INFERENCE_ERROR'],
  ])('maps "%s" → HTTP %i %s', (msg, status, code) => {
    const r = mapInferenceError(new Error(msg));
    expect(r.status).toBe(status);
    expect(r.code).toBe(code);
    expect(r.message).toBe(msg);
  });

  it('handles a non-Error throwable', () => {
    const r = mapInferenceError('plain string error');
    expect(r.status).toBe(500);
    expect(r.code).toBe('INFERENCE_ERROR');
    expect(r.message).toBe('unknown error');
  });
});
