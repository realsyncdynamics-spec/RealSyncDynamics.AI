import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createRestaurantWebhookAdapter,
  normalizeRestaurantWebhookCredentials,
  RestaurantWebhookError,
  signRestaurantWebhook,
} from '../../supabase/functions/_shared/restaurant-webhook';
import { restaurantExecutionCustomerNote } from '../../supabase/functions/_shared/restaurant-execution-runtime';
import type { RestaurantExecutionOrder } from '../../supabase/functions/_shared/restaurant-execution';

const credentials = {
  url: 'https://pos.example.com/realsync',
  secret: '1234567890abcdef',
};

const order: RestaurantExecutionOrder = {
  order_id: '00000000-0000-5000-8000-000000000001',
  tenant_id: 'tenant-1',
  bot_id: 'bot-1',
  customer_name: 'Max Mustermann',
  contact: '+491234567',
  items: [{ item_id: 'pizza', name: 'Pizza', qty: 1, unit_price: 12.9, line_total: 12.9 }],
  total_amount: 12.9,
  currency: 'EUR',
  fulfillment: 'pickup',
  delivery_address: null,
  notes: 'ohne Zwiebeln',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function expectWebhookError(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error('expected RestaurantWebhookError');
  } catch (error) {
    expect(error).toBeInstanceOf(RestaurantWebhookError);
    expect((error as RestaurantWebhookError).code).toBe(code);
  }
}

describe('restaurant webhook credential boundary', () => {
  it('accepts only normalized HTTPS credentials with a sufficiently long secret', () => {
    expect(normalizeRestaurantWebhookCredentials({
      webhook_url: 'https://pos.example.com/realsync',
      secret: '1234567890abcdef',
      ignored: 'not persisted by normalizer',
    })).toEqual(credentials);
  });

  it('rejects insecure, local, credential-bearing and non-standard-port URLs', () => {
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'http://pos.example.com', secret: '1234567890abcdef' }),
      'WEBHOOK_HTTPS_REQUIRED',
    );
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'https://localhost/hook', secret: '1234567890abcdef' }),
      'WEBHOOK_HOST_FORBIDDEN',
    );
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'https://service.internal/hook', secret: '1234567890abcdef' }),
      'WEBHOOK_HOST_FORBIDDEN',
    );
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'https://127.0.0.1/hook', secret: '1234567890abcdef' }),
      'WEBHOOK_IP_LITERAL_FORBIDDEN',
    );
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'https://user:pass@pos.example.com/hook', secret: '1234567890abcdef' }),
      'WEBHOOK_USERINFO_FORBIDDEN',
    );
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'https://pos.example.com:8443/hook', secret: '1234567890abcdef' }),
      'WEBHOOK_PORT_FORBIDDEN',
    );
  });

  it('rejects short secrets before they can be sealed', () => {
    expectWebhookError(
      () => normalizeRestaurantWebhookCredentials({ url: 'https://pos.example.com/hook', secret: 'too-short' }),
      'WEBHOOK_SECRET_TOO_SHORT',
    );
  });
});

describe('restaurant webhook protocol', () => {
  it('signs timestamp + dot + exact body with HMAC-SHA256', async () => {
    const timestamp = '2026-09-22T21:00:00.000Z';
    const body = '{"hello":"world"}';
    const expected = createHmac('sha256', credentials.secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    await expect(signRestaurantWebhook(credentials.secret, timestamp, body))
      .resolves.toBe(`sha256=${expected}`);
  });

  it('uses separate idempotent submit and verify events', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const payload = JSON.parse(String(init?.body ?? '{}')) as { event?: string };
      if (payload.event === 'restaurant.order.submit') {
        return new Response(JSON.stringify({
          submission_id: 'sub-1',
          external_id: 'pos-42',
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        status: 'accepted',
        external_id: 'pos-42',
      }), { status: 200 });
    }));

    const adapter = createRestaurantWebhookAdapter('webhook:pos', 'pos', credentials);
    const submission = await adapter.submit(order);
    const verification = await adapter.verify(order, submission);

    expect(submission).toEqual({ submission_id: 'sub-1', external_id: 'pos-42' });
    expect(verification.status).toBe('accepted');
    expect(calls).toHaveLength(2);

    const submitHeaders = new Headers(calls[0].init.headers);
    const verifyHeaders = new Headers(calls[1].init.headers);
    expect(submitHeaders.get('x-rsd-event')).toBe('restaurant.order.submit');
    expect(submitHeaders.get('idempotency-key')).toBe(`${order.order_id}:pos:submit`);
    expect(submitHeaders.get('x-rsd-signature')).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(submitHeaders.get('x-rsd-timestamp')).toBeTruthy();
    expect(verifyHeaders.get('x-rsd-event')).toBe('restaurant.order.verify');
    expect(verifyHeaders.get('idempotency-key')).toBe(`${order.order_id}:pos:verify:sub-1`);
  });

  it('rejects submit success without a submission id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })));

    const adapter = createRestaurantWebhookAdapter('webhook:pos', 'pos', credentials);
    await expect(adapter.submit(order)).rejects.toMatchObject({
      code: 'WEBHOOK_SUBMISSION_ID_MISSING',
    });
  });

  it('rejects an unknown verification status', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1;
      return call === 1
        ? new Response(JSON.stringify({ submission_id: 'sub-1' }), { status: 200 })
        : new Response(JSON.stringify({ status: 'maybe' }), { status: 200 });
    }));

    const adapter = createRestaurantWebhookAdapter('webhook:kitchen', 'kitchen', credentials);
    const submission = await adapter.submit(order);
    await expect(adapter.verify(order, submission)).rejects.toMatchObject({
      code: 'WEBHOOK_VERIFY_STATUS_INVALID',
    });
  });
});

describe('restaurant execution evidence semantics', () => {
  it('only tells the customer external handoff is confirmed when all configured targets are accepted', () => {
    const accepted = {
      version: 1 as const,
      pos: {
        status: 'accepted' as const,
        adapter_id: 'a',
        external_id: '1',
        submitted_at: 'x',
        verified_at: 'y',
        error_code: null,
      },
      kitchen: {
        status: 'accepted' as const,
        adapter_id: 'b',
        external_id: '2',
        submitted_at: 'x',
        verified_at: 'y',
        error_code: null,
      },
    };
    expect(restaurantExecutionCustomerNote(accepted)).toContain('POS und Küche');
    expect(restaurantExecutionCustomerNote(accepted)).toContain('bestätigt');

    expect(restaurantExecutionCustomerNote({
      ...accepted,
      kitchen: { ...accepted.kitchen, status: 'pending' as const, verified_at: null },
    })).toContain('noch nicht vollständig bestätigt');
  });

  it('writes pending evidence before outbound execution and falls back to pending if final evidence write fails', () => {
    const source = readFileSync(
      resolve(__dirname, '../../supabase/functions/_shared/restaurant-execution-runtime.ts'),
      'utf8',
    );
    const preflightWrite = source.indexOf("update({ metadata: { ...metadata, execution: preflight } })");
    const execute = source.indexOf('const result = await executeRestaurantOrder(');
    const finalWrite = source.indexOf("update({ metadata: { ...metadata, execution: result } })");

    expect(preflightWrite).toBeGreaterThan(-1);
    expect(execute).toBeGreaterThan(preflightWrite);
    expect(finalWrite).toBeGreaterThan(execute);
    expect(source).toContain('return finalEvidenceError ? preflight : result');
  });

  it('keeps URL and secret out of bots.config types', () => {
    const types = readFileSync(
      resolve(__dirname, '../../src/features/bots/types.ts'),
      'utf8',
    );
    const start = types.indexOf('export interface RestaurantExecutionConfig');
    const end = types.indexOf('}', start);
    const executionConfig = types.slice(start, end + 1);

    expect(executionConfig).toContain('integration_config_id');
    expect(executionConfig).toContain('pos_enabled');
    expect(executionConfig).toContain('kitchen_enabled');
    expect(executionConfig).not.toMatch(/url|secret|token|credential/i);
  });
});

describe('restaurant integration governance wiring', () => {
  const integrationCredentials = readFileSync(
    resolve(__dirname, '../../supabase/functions/integration-credentials/index.ts'),
    'utf8',
  );
  const migration = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260922214500_restaurant_webhook_integration.sql'),
    'utf8',
  );

  it('keeps configure and test owner/admin-only through the existing auth boundary', () => {
    expect(integrationCredentials).toContain(
      "requireAuthAndTenant(req, body.tenant_id as string, ['owner', 'admin'])",
    );
    expect(integrationCredentials).toContain("op !== 'configure' && op !== 'remove' && op !== 'test'");
  });

  it('registers webhook connections as custom_api instead of overstating enforcement authority', () => {
    expect(integrationCredentials).toContain("system_type: 'custom_api'");
    expect(integrationCredentials).toContain("auth_kind: 'webhook'");
    expect(integrationCredentials).toContain("source_table: 'integration_configs'");
  });

  it('marks a connector connected only in the signed test path', () => {
    const testStart = integrationCredentials.indexOf("if (op === 'test')");
    const connected = integrationCredentials.indexOf("status: 'connected'", testStart);
    expect(testStart).toBeGreaterThan(-1);
    expect(connected).toBeGreaterThan(testStart);
  });

  it('adds only a catalog entry and no new credential table', () => {
    expect(migration).toContain("'restaurant-webhook'");
    expect(migration).toContain("auth_type");
    expect(migration).not.toMatch(/CREATE\s+TABLE/i);
  });
});
