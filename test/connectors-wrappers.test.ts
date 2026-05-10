import { describe, it, expect, vi } from 'vitest';
import {
  logOpenAiChatCompletion,
  logOpenAiFileUpload,
  wrapOpenAiClient,
} from '../connectors/openai-wrapper';
import {
  logAnthropicMessage,
  wrapAnthropicClient,
} from '../connectors/anthropic-wrapper';

/**
 * Connector-Wrapper-Smoke-Tests.
 *
 * Pruefen, dass die Helper + Proxy-Wrapper:
 *   1. Telemetry-Calls korrekt mit Vendor + Model + Metadata absetzen
 *   2. Prompt-Text NICHT mit-senden (Privacy-Default)
 *   3. Auto-Wrap die original-Response unveraendert zurueckgibt
 *   4. Telemetry-Failures den Original-Call NICHT blocken
 */

function fakeTelemetry() {
  const calls: Array<Record<string, unknown>> = [];
  const trackAiEvent = vi.fn(async (e: Record<string, unknown>) => {
    calls.push(e);
    return { ok: true, eventId: `evt-${calls.length}` };
  });
  return { trackAiEvent, calls };
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

describe('logOpenAiChatCompletion', () => {
  it('emits a response_received event with vendor=openai + token counts', async () => {
    const tel = fakeTelemetry();
    const result = await logOpenAiChatCompletion({
      telemetry: tel as unknown as Parameters<typeof logOpenAiChatCompletion>[0]['telemetry'],
      request: { model: 'gpt-4.1', messages: [{ role: 'user', content: 'hi' }] },
      response: {
        usage: { prompt_tokens: 12, completion_tokens: 34 },
        choices: [{ finish_reason: 'stop' }],
      },
      latencyMs: 250,
      promptCategory: 'code_generation',
      dataClass: 'internal',
      userId: 'eva@example.com',
      team: 'Engineering',
    });

    expect(result.ok).toBe(true);
    expect(tel.calls).toHaveLength(1);
    const event = tel.calls[0];
    expect(event.vendor).toBe('openai');
    expect(event.model).toBe('gpt-4.1');
    expect(event.event_type).toBe('response_received');
    expect(event.prompt_tokens).toBe(12);
    expect(event.response_tokens).toBe(34);
    expect(event.latency_ms).toBe(250);
    expect(event.prompt_category).toBe('code_generation');
    expect(event.data_class).toBe('internal');
    expect(event.user_id).toBe('eva@example.com');
    expect(event.team).toBe('Engineering');
    // Privacy: no prompt content in event
    expect(JSON.stringify(event)).not.toContain('hi');
  });

  it('logOpenAiFileUpload sends file_upload event with extension extracted', async () => {
    const tel = fakeTelemetry();
    await logOpenAiFileUpload({
      telemetry: tel as unknown as Parameters<typeof logOpenAiFileUpload>[0]['telemetry'],
      filename: 'patient_records_2026.csv',
      sizeBytes: 1_234_567,
      purpose: 'assistants',
      dataClass: 'special_category',
    });
    const event = tel.calls[0];
    expect(event.event_type).toBe('file_upload');
    expect(event.vendor).toBe('openai');
    expect(event.risk_level).toBe('medium');
    expect((event.metadata as Record<string, unknown>).file_extension).toBe('csv');
    expect((event.metadata as Record<string, unknown>).size_bytes).toBe(1_234_567);
  });
});

describe('wrapOpenAiClient', () => {
  it('proxies chat.completions.create + emits telemetry but returns original response', async () => {
    const tel = fakeTelemetry();
    const fakeResponse = {
      id: 'cmpl-1',
      usage: { prompt_tokens: 7, completion_tokens: 9 },
      choices: [{ finish_reason: 'stop' }],
    };
    const fakeOpenAi = {
      chat: {
        completions: {
          create: vi.fn(async (..._args: unknown[]) => fakeResponse),
        },
      },
    };
    const wrapped = wrapOpenAiClient(fakeOpenAi, {
      telemetry: tel as unknown as Parameters<typeof wrapOpenAiClient>[1]['telemetry'],
      defaults: { dataClass: 'internal', team: 'Eng' },
    });
    const response = await wrapped.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'secret-prompt-xyz' }],
    });
    expect(response).toBe(fakeResponse);
    expect(tel.calls).toHaveLength(1);
    expect(tel.calls[0].vendor).toBe('openai');
    expect(tel.calls[0].model).toBe('gpt-4.1-mini');
    expect(tel.calls[0].team).toBe('Eng');
    // Privacy: secret prompt did NOT leak into telemetry
    expect(JSON.stringify(tel.calls[0])).not.toContain('secret-prompt-xyz');
  });

  it('does not break when telemetry fails — original call still returns', async () => {
    const tel = {
      trackAiEvent: vi.fn(async () => {
        throw new Error('network down');
      }),
    };
    const fakeOpenAi = {
      chat: {
        completions: {
          create: vi.fn(async (..._args: unknown[]) => ({ id: 'cmpl-2' })),
        },
      },
    };
    const wrapped = wrapOpenAiClient(fakeOpenAi, {
      telemetry: tel as unknown as Parameters<typeof wrapOpenAiClient>[1]['telemetry'],
    });
    const response = await wrapped.chat.completions.create({ model: 'gpt-4.1' });
    expect(response).toEqual({ id: 'cmpl-2' });
  });
});

// ─── Anthropic ───────────────────────────────────────────────────────────────

describe('logAnthropicMessage', () => {
  it('emits response_received with vendor=anthropic + input/output token mapping', async () => {
    const tel = fakeTelemetry();
    await logAnthropicMessage({
      telemetry: tel as unknown as Parameters<typeof logAnthropicMessage>[0]['telemetry'],
      request: {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'hi' }],
        system: 'You are helpful.',
      },
      response: {
        usage: { input_tokens: 8, output_tokens: 14 },
        stop_reason: 'end_turn',
      },
      latencyMs: 420,
      promptCategory: 'analysis',
      dataClass: 'confidential',
    });
    const event = tel.calls[0];
    expect(event.vendor).toBe('anthropic');
    expect(event.model).toBe('claude-opus-4-7');
    expect(event.prompt_tokens).toBe(8);
    expect(event.response_tokens).toBe(14);
    expect(event.latency_ms).toBe(420);
    expect((event.metadata as Record<string, unknown>).has_system_prompt).toBe(true);
    expect((event.metadata as Record<string, unknown>).stop_reason).toBe('end_turn');
  });
});

describe('wrapAnthropicClient', () => {
  it('proxies messages.create + telemetriert + returnt original response', async () => {
    const tel = fakeTelemetry();
    const fakeResponse = { usage: { input_tokens: 1, output_tokens: 2 }, stop_reason: 'stop' };
    const fakeClient = { messages: { create: vi.fn(async (..._args: unknown[]) => fakeResponse) } };
    const wrapped = wrapAnthropicClient(fakeClient, {
      telemetry: tel as unknown as Parameters<typeof wrapAnthropicClient>[1]['telemetry'],
    });
    const r = await wrapped.messages.create({ model: 'claude-sonnet-4-6' });
    expect(r).toBe(fakeResponse);
    expect(tel.calls[0].vendor).toBe('anthropic');
    expect(tel.calls[0].model).toBe('claude-sonnet-4-6');
  });
});
