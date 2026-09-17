import { describe, expect, it, vi } from 'vitest';
import { OpenAIAdapter } from '../../src/core/ai-gateway/providers/openaiAdapter';
import { parseOpenAiSse, parseAnthropicSse } from '../../src/core/ai-gateway/streamParse';
import { packBuilderPrompt } from '../../src/features/app-builder/gateway';
import type { AiGatewayRequest } from '../../src/core/ai-gateway/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function req(): AiGatewayRequest {
  return {
    feature: 'app_builder_code',
    task_type: 'chat',
    model_profile: 'cloud-fallback',
    input: 'Baue ein Dashboard',
  };
}

function sseStream(payload: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

describe('OpenAI adapter generateStream', () => {
  it('yields token deltas then done', async () => {
    const sse =
      'data: {"model":"gpt-4.1-mini","choices":[{"delta":{"content":"<bolt"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"Artifact>"}}]}\n\n' +
      'data: [DONE]\n\n';
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean };
      expect(body.stream).toBe(true);
      return {
        ok: true,
        status: 200,
        body: sseStream(sse),
        json: async () => ({}),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const adapter = new OpenAIAdapter({ apiKey: 'sk-test', model: 'gpt-4.1-mini', fetchImpl });
    const chunks: string[] = [];
    let done = false;
    for await (const c of adapter.generateStream(req())) {
      if (c.event === 'delta' && c.text) chunks.push(c.text);
      if (c.event === 'done') done = true;
    }
    expect(chunks.join('')).toBe('<boltArtifact>');
    expect(done).toBe(true);
  });
});

describe('SSE parsers', () => {
  it('parses OpenAI deltas', async () => {
    const body = sseStream('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n');
    const texts: string[] = [];
    for await (const ev of parseOpenAiSse(body)) if (ev.text) texts.push(ev.text);
    expect(texts).toEqual(['Hi']);
  });

  it('parses Anthropic text_delta events', async () => {
    const body = sseStream(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hallo"}}\n\n',
    );
    const texts: string[] = [];
    for await (const ev of parseAnthropicSse(body)) if (ev.text) texts.push(ev.text);
    expect(texts).toEqual(['Hallo']);
  });
});

describe('builder gateway packing', () => {
  it('does not dump 16×6000 blindly — uses context-pack', () => {
    const packed = packBuilderPrompt({
      prompt: 'Füge extra-12.js an',
      files: Array.from({ length: 30 }, (_, i) => ({
        path: i === 0 ? 'index.html' : `extra-${i}.js`,
        content: 'y'.repeat(4000),
      })),
    });
    expect(packed.length).toBeLessThanOrEqual(24_000);
    expect(packed).toMatch(/index\.html/);
    expect(packed).toMatch(/Nicht im Kontext|extra-12\.js/);
  });
});

describe('ai-gateway stream op is registered', () => {
  it('allows op stream and generateStream on the Edge Function', () => {
    const src = readFileSync(resolve(__dirname, '../../supabase/functions/ai-gateway/index.ts'), 'utf8');
    expect(src).toMatch(/'stream'/);
    expect(src).toMatch(/generateStream/);
    expect(src).toMatch(/application\/x-ndjson/);
    expect(src).toMatch(/body\.stream === true/);
    expect(src).toMatch(/streamOpenAiCompat/);
  });

  it('gates app_builder_code with membership and siteos.builder before the provider', () => {
    const src = readFileSync(resolve(__dirname, '../../supabase/functions/ai-gateway/index.ts'), 'utf8');
    expect(src).toMatch(/BUILDER_FEATURE = 'app_builder_code'/);
    expect(src).toMatch(/requireAuthAndTenant/);
    expect(src).toMatch(/gateFeature\(auth\.admin, auth\.tenantId, 'siteos\.builder'\)/);
    const gateAt = src.indexOf('requireBuilderIfNeeded');
    const generateAt = src.indexOf('gateway.generate');
    const streamAt = src.indexOf('streamNdjson');
    expect(gateAt).toBeGreaterThan(-1);
    expect(generateAt).toBeGreaterThan(gateAt);
    expect(streamAt).toBeGreaterThan(gateAt);
  });
});
