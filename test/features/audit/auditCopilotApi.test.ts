import { describe, it, expect, vi } from 'vitest';
import {
  generateFixSnippet,
  generateRemediationPlan,
  AiGatewayEdgeError,
  type AuditFindingInput,
} from '../../../src/features/audit/auditCopilotApi';
import { AiGatewayEdgeClient } from '../../../src/core/ai-gateway/edgeClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeStubClient(envelope: unknown, status = 200): AiGatewayEdgeClient {
  const fetchImpl = vi.fn(async () => jsonResponse(envelope, status));
  return new AiGatewayEdgeClient({
    supabaseUrl: 'https://test.supabase.co',
    apiKey: 'anon',
    fetchImpl,
  });
}

const FINDING: AuditFindingInput = {
  id: 'F-001',
  severity: 'high',
  title: 'Google Fonts wird ohne Consent geladen',
  detail: 'CSS-Anfrage an fonts.googleapis.com vor Cookie-Consent.',
  paragraph_ref: 'TTDSG § 25',
};

describe('generateFixSnippet', () => {
  it('returns the parsed FixSnippet on success', async () => {
    const envelope = {
      ok: true,
      provider: 'lm_studio',
      model: 'qwen-7b',
      profile: 'strict-json',
      output: {
        cms: 'wordpress',
        language: 'php',
        snippet: 'add_filter("style_loader_src", ...);',
        notes: 'Verhindert das Laden von Google-Fonts ohne Consent.',
      },
      trace_id: 't-1',
      latency_ms: 50,
    };
    const client = makeStubClient(envelope);

    const result = await generateFixSnippet(FINDING, 'wordpress', { client });

    expect(result.cms).toBe('wordpress');
    expect(result.language).toBe('php');
    expect(result.snippet).toContain('style_loader_src');
    expect(result.notes).toMatch(/Google-Fonts/);
  });

  it('throws AiGatewayEdgeError on upstream failure', async () => {
    const envelope = {
      ok: false,
      error: { code: 'UPSTREAM_UNAVAILABLE', message: 'No LM Studio model available' },
    };
    const client = makeStubClient(envelope, 502);

    await expect(generateFixSnippet(FINDING, 'wordpress', { client }))
      .rejects.toMatchObject({
        name: 'AiGatewayEdgeError',
        code: 'UPSTREAM_UNAVAILABLE',
      });
  });

  it('sends the right request shape to ai-gateway', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true, provider: 'lm_studio', model: 'm', profile: 'strict-json',
      output: { cms: 'shopify', language: 'liquid', snippet: '...', notes: '' },
      trace_id: 't', latency_ms: 1,
    }));
    const client = new AiGatewayEdgeClient({
      supabaseUrl: 'https://test.supabase.co',
      apiKey: 'anon',
      fetchImpl,
    });

    await generateFixSnippet(FINDING, 'shopify', { client });

    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    if (!call) throw new Error('expected fetch to be called');
    const [url, init] = call;
    expect(url).toBe('https://test.supabase.co/functions/v1/ai-gateway');
    const body = JSON.parse(init.body as string);
    expect(body.op).toBe('extract_json');
    expect(body.model_profile).toBe('strict-json');
    expect(body.feature).toBe('audit_copilot.fix_snippet');
    expect(body.input).toContain('F-001');
    expect(body.input).toContain('Ziel-Plattform: shopify');
    expect(body.metadata).toEqual({ cms: 'shopify' });
  });

  it('errors when Supabase config is missing', async () => {
    await expect(generateFixSnippet(FINDING, 'wordpress', {
      supabaseUrl: '',
      supabaseAnonKey: '',
    })).rejects.toMatchObject({
      name: 'AiGatewayEdgeError',
      code: 'AI_GATEWAY_NOT_CONFIGURED',
    });
  });
});

describe('generateRemediationPlan', () => {
  it('returns the parsed RemediationPlan', async () => {
    const envelope = {
      ok: true,
      provider: 'lm_studio',
      model: 'm',
      profile: 'strict-json',
      output: {
        summary: 'Drei Punkte priorisieren.',
        steps: [
          { title: 'Consent-Banner', detail: 'Banner blockt Tracker bis OK.' },
          { title: 'Google Fonts lokal', detail: 'Fonts self-hosten.' },
          { title: 'Audit-Trail', detail: 'Consent-Events loggen.' },
        ],
        legal_reference: 'DSGVO Art. 6 Abs. 1 lit. a + TTDSG § 25',
      },
      trace_id: 't', latency_ms: 1,
    };
    const client = makeStubClient(envelope);

    const result = await generateRemediationPlan([FINDING], { client });

    expect(result.steps).toHaveLength(3);
    expect(result.legal_reference).toMatch(/DSGVO/);
  });

  it('rejects empty findings list', async () => {
    await expect(generateRemediationPlan([], {
      client: makeStubClient({ ok: true }),
    })).rejects.toMatchObject({
      name: 'AiGatewayEdgeError',
      code: 'BAD_REQUEST',
    });
  });

  it('folds multiple findings into the input', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true, provider: 'lm_studio', model: 'm', profile: 'strict-json',
      output: { summary: 's', steps: [], legal_reference: '' },
      trace_id: 't', latency_ms: 1,
    }));
    const client = new AiGatewayEdgeClient({
      supabaseUrl: 'https://t.supabase.co',
      apiKey: 'k',
      fetchImpl,
    });

    await generateRemediationPlan([FINDING, { ...FINDING, id: 'F-002', title: 'Zweiter' }], { client });

    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    if (!call) throw new Error('expected fetch to be called');
    const body = JSON.parse(call[1].body as string);
    expect(body.input).toContain('Befund 1:');
    expect(body.input).toContain('Befund 2:');
    expect(body.metadata).toEqual({ finding_count: 2 });
  });
});
