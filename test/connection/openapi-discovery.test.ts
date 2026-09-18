import { describe, expect, it } from 'vitest';
import {
  assertSafeSpecUrl,
  defaultGrant,
  discoverFromDocument,
  discoverFromUrl,
} from '../../packages/connection-contract/src/index.ts';

const CRM_SPEC = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'CRM', version: '1.2.0' },
  servers: [{ url: 'https://crm.example/api' }],
  paths: {
    '/customers': {
      get: { operationId: 'listCustomers', summary: 'List customers' },
      post: { operationId: 'createCustomer' },
    },
    '/customers/{id}': {
      get: { operationId: 'getCustomer' },
      patch: { operationId: 'updateCustomer' },
      delete: { operationId: 'deleteCustomer' },
    },
    '/contacts': {
      get: { summary: 'List contacts' },
    },
  },
});

describe('OpenAPI discovery', () => {
  it('maps CRM paths with fail-closed writes', () => {
    const result = discoverFromDocument(CRM_SPEC, { provider: 'crm' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resources.sort()).toEqual(['contacts', 'customers']);
    const byOp = Object.fromEntries(result.capabilities.map((c) => [c.operation_id ?? c.operation, c]));
    expect(byOp.listCustomers.grant).toBe('allow');
    expect(byOp.createCustomer.grant).toBe('approval');
    expect(byOp.deleteCustomer.grant).toBe('deny');
    expect(byOp.listCustomers.tool_id).toBe('crm.customers.listCustomers');
  });

  it('rejects swagger 2, empty docs, unknown format',
    () => {
      expect(discoverFromDocument(JSON.stringify({ swagger: '2.0', paths: {} })).ok).toBe(false);
      expect(discoverFromDocument('').ok).toBe(false);
      expect(discoverFromDocument('hello world')).toMatchObject({ ok: false, error_code: 'UNKNOWN_FORMAT' });
    },
  );

  it('rejects unsafe spec URLs', () => {
    expect(assertSafeSpecUrl('file:///etc/passwd')).toMatchObject({ ok: false });
    expect(assertSafeSpecUrl('javascript:alert(1)')).toMatchObject({ ok: false });
  });

  it('discoverFromUrl is fail-closed on HTTP errors', async () => {
    const bad = await discoverFromUrl('https://example/openapi.json', async () => ({
      ok: false,
      status: 404,
      text: async () => '',
    }));
    expect(bad).toMatchObject({ ok: false, error_code: 'FETCH_HTTP' });
  });

  it('never auto-allows delete', () => {
    expect(defaultGrant('delete')).toBe('deny');
  });
});
