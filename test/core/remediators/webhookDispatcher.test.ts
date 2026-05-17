import { describe, it, expect, vi } from 'vitest';
import { WebhookDispatcher } from '../../../src/core/remediators/webhookDispatcher';
import type { Remediation } from '../../../src/core/runtime/remediation';

function remediation(overrides: Partial<Remediation> = {}): Remediation {
  return {
    id: 'rem_42',
    tenant_id: 'tenant_1',
    problem: {
      governance_event: 'tracker.pre_consent.detected',
      severity: 'high',
      risk_level: 'high',
      target: 'kunde-1.de',
      description: 'Pre-consent GTM detected.',
    },
    action: {
      kind: 'remove_tracker',
      tracker: 'googletagmanager',
      selector: 'script[src*="googletagmanager.com"]',
    },
    delivery: 'webhook',
    status: 'approved',
    fingerprint: 'a'.repeat(64),
    drafted_at: '2026-05-16T03:22:11Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('WebhookDispatcher', () => {
  it('POSTs JSON with identity headers and echoes body fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'ext_1' }));
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await dispatcher.deliver(remediation());

    expect(result.ok).toBe(true);
    expect(result.external_id).toBe('ext_1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.example.com/r');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-rsd-remediation-id']).toBe('rem_42');
    expect(headers['x-rsd-fingerprint']).toBe('a'.repeat(64));
    expect(headers['x-rsd-tenant-id']).toBe('tenant_1');
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-rsd-signature']).toBeUndefined();

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      remediation_id: 'rem_42',
      fingerprint: 'a'.repeat(64),
      tenant_id: 'tenant_1',
      delivery: 'webhook',
      action: { kind: 'remove_tracker', tracker: 'googletagmanager' },
    });
  });

  it('attaches bearer token and HMAC signature when configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'ext_2' }));
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      bearerToken: 'tok_abc',
      signingSecret: 'shh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await dispatcher.deliver(remediation());

    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.authorization).toBe('Bearer tok_abc');
    expect(headers['x-rsd-signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('produces a stable signature for the same body', async () => {
    const captures: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const h = init.headers as Record<string, string>;
      captures.push(h['x-rsd-signature']);
      return jsonResponse({ id: 'x' });
    });
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      signingSecret: 'shh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await dispatcher.deliver(remediation());
    await dispatcher.deliver(remediation());

    expect(captures[0]).toBeDefined();
    expect(captures[0]).toBe(captures[1]);
  });

  it('returns http_<status> error on non-2xx responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('nope', { status: 503 }));
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await dispatcher.deliver(remediation());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('http_503');
    expect(result.error?.message).toBe('nope');
  });

  it('returns network_error on fetch rejection', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('connection reset'));
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await dispatcher.deliver(remediation());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('network_error');
  });

  it('reports timeout on AbortError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('The operation was aborted'));
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await dispatcher.deliver(remediation());
    expect(result.error?.code).toBe('timeout');
  });

  it('supports any action (webhook is a fan-out channel)', () => {
    const dispatcher = new WebhookDispatcher({ endpoint: 'https://x.example' });
    expect(dispatcher.supports({ kind: 'notify_human', reason: 'x' })).toBe(true);
    expect(
      dispatcher.supports({
        kind: 'remove_tracker',
        tracker: 'gtm',
        selector: 'script',
      }),
    ).toBe(true);
  });

  it('refuses construction without endpoint', () => {
    expect(() => new WebhookDispatcher({ endpoint: '' })).toThrow(/endpoint required/);
  });

  it('throws on bare construction without endpoint argument', () => {
    expect(
      () => new WebhookDispatcher({} as unknown as { endpoint: string }),
    ).toThrow(/endpoint required/);
  });

  it('merges custom headers without dropping required ones', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'x' }));
    const dispatcher = new WebhookDispatcher({
      endpoint: 'https://hooks.example.com/r',
      headers: { 'X-Source': 'rsd-runtime' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await dispatcher.deliver(remediation());
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers['x-source']).toBe('rsd-runtime');
    expect(headers['x-rsd-remediation-id']).toBe('rem_42');
  });
});
