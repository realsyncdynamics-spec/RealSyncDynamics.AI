import { describe, expect, it } from 'vitest';
import {
  isVoiceProviderId,
  normalizeProviderToolCall,
  type ProviderToolCall,
} from '../../packages/agent-runtime-contracts/src/index';

const ctx = {
  requestId: 'req-1',
  sessionId: 'sess-1',
  tenantId: 'tenant-server-side',
  agentId: 'reception-agent-v1',
  offeredTools: ['lookup_kb', 'schedule_appointment', 'handoff_human'],
  now: '2026-09-27T10:00:00.000Z',
};

function call(partial: Partial<ProviderToolCall>): ProviderToolCall {
  return { callId: 'call-1', name: 'schedule_appointment', arguments: {}, ...partial };
}

describe('normalizeProviderToolCall — fail-closed', () => {
  it('übersetzt einen angebotenen Tool-Call in einen ToolRequest', () => {
    const out = normalizeProviderToolCall(
      call({ arguments: '{"time":"14:00","date":"2026-10-08","customer_name":"Max"}' }),
      ctx,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.request).toMatchObject({
      requestId: 'req-1',
      sessionId: 'sess-1',
      tenantId: 'tenant-server-side',
      agentId: 'reception-agent-v1',
      tool: 'schedule_appointment',
      proposedBy: 'llm',
    });
    expect(out.argumentKeys).toEqual(['customer_name', 'date', 'time']);
  });

  it('übernimmt Tenant nie aus den Argumenten des Modells', () => {
    const out = normalizeProviderToolCall(
      call({ arguments: { tenant_id: 'fremder-tenant', date: '2026-10-08' } }),
      ctx,
    );
    expect(out.ok && out.request.tenantId).toBe('tenant-server-side');
  });

  it('lehnt unbekannte Tools ab (halluzinierter Tool-Name)', () => {
    expect(normalizeProviderToolCall(call({ name: 'delete_customer' }), ctx))
      .toEqual({ ok: false, callId: 'call-1', reason: 'unknown_tool' });
  });

  it('lehnt bekannte, aber nicht angebotene Tools ab', () => {
    expect(normalizeProviderToolCall(call({ name: 'export_transcript' }), ctx))
      .toEqual({ ok: false, callId: 'call-1', reason: 'tool_not_offered' });
  });

  it.each([
    ['kaputtes JSON', '{"date":'],
    ['Array', ['2026-10-08']],
    ['Primitive', 42],
    ['JSON-String mit Array', '[1,2]'],
  ])('lehnt ungültige Argumente ab: %s', (_label, args) => {
    const out = normalizeProviderToolCall(call({ arguments: args }), ctx);
    expect(out).toEqual({ ok: false, callId: 'call-1', reason: 'invalid_arguments' });
  });

  it('verlangt eine Call-ID des Providers', () => {
    expect(normalizeProviderToolCall(call({ callId: '  ' }), ctx))
      .toEqual({ ok: false, callId: null, reason: 'missing_call_id' });
  });
});

describe('isVoiceProviderId', () => {
  it('kennt die austauschbaren Provider', () => {
    for (const id of ['grok', 'openai', 'gemini', 'claude', 'custom']) {
      expect(isVoiceProviderId(id)).toBe(true);
    }
    expect(isVoiceProviderId('xai')).toBe(false);
    expect(isVoiceProviderId(undefined)).toBe(false);
  });
});
