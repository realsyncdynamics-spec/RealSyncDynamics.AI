// Gestreamte Aufrufe müssen Tokens liefern, sonst bucht der ai-gateway
// nur den Aufruf, nicht den Verbrauch (#1646, Codex-Review auf #1653).

import { describe, it, expect } from 'vitest';
import { LMStudioAdapter } from '../../supabase/functions/_shared/aiGateway/lmStudioAdapter.ts';
import type { AiGatewayRequest } from '../../supabase/functions/_shared/aiGateway/types.ts';

function sse(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const l of lines) c.enqueue(enc.encode(`${l}\n\n`));
      c.close();
    },
  });
}

describe('LMStudioAdapter.generateStream (Edge)', () => {
  it('fordert usage an und reicht sie im done-Ereignis weiter', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(sse([
        'data: {"choices":[{"delta":{"content":"Hal"}}]}',
        'data: {"choices":[{"delta":{"content":"lo"}}]}',
        'data: {"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":2,"total_tokens":13}}',
        'data: [DONE]',
      ]), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new LMStudioAdapter({ baseUrl: 'http://lm.local/v1', defaultModel: 'm1', fetchImpl });
    const req = { feature: 'f', task_type: 'chat', model_profile: 'fast-local', input: 'Hi' } as AiGatewayRequest;
    const chunks = [];
    for await (const c of adapter.generateStream(req)) chunks.push(c);

    expect(bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(chunks.filter((c) => c.event === 'delta').map((c) => c.text).join('')).toBe('Hallo');
    expect(chunks.at(-1)).toMatchObject({ event: 'done', usage: { input_tokens: 11, output_tokens: 2, total_tokens: 13 } });
  });
});
