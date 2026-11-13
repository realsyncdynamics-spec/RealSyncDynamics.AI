import { describe, expect, it, vi } from 'vitest';
import {
  decideCheckoutProvision,
  enqueueCheckoutProvision,
} from '../../supabase/functions/_shared/checkout-provision';

describe('decideCheckoutProvision', () => {
  it('überspringt Live-Events (Livemode-Schutz)', () => {
    expect(decideCheckoutProvision({ livemode: true, tenantId: 'ten_1' })).toBe('skip_live');
  });

  it('überspringt Events ohne tenant_id', () => {
    expect(decideCheckoutProvision({ livemode: false, tenantId: null })).toBe('skip_no_tenant');
    expect(decideCheckoutProvision({ livemode: false, tenantId: '  ' })).toBe('skip_no_tenant');
  });

  it('reiht nur Testmodus-Events mit tenant_id ein', () => {
    expect(decideCheckoutProvision({ livemode: false, tenantId: 'ten_1' })).toBe('enqueue');
  });
});

describe('enqueueCheckoutProvision', () => {
  it('ruft provision-tenant mit trigger checkout und Service-Role auf', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, status: 'partial' }), { status: 200 }));
    const result = await enqueueCheckoutProvision({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-test',
      tenantId: 'ten_1',
      stripeEventId: 'evt_test_1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, status: 200, conflict: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe('https://example.supabase.co/functions/v1/provision-tenant');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer service-role-test');
    expect(JSON.parse(String(init.body))).toEqual({
      tenant_id: 'ten_1',
      trigger: 'checkout',
      stripe_event_id: 'evt_test_1',
    });
  });

  it('behandelt 409 als idempotenten Erfolg', async () => {
    const fetchImpl = vi.fn(async () => new Response('BOOT_IN_PROGRESS', { status: 409 }));
    const result = await enqueueCheckoutProvision({
      supabaseUrl: 'https://example.supabase.co/',
      serviceRoleKey: 'service-role-test',
      tenantId: 'ten_1',
      stripeEventId: 'evt_test_2',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.conflict).toBe(true);
  });

  it('wirft bei anderen Fehlerstatus, damit der Webhook retried', async () => {
    const fetchImpl = vi.fn(async () => new Response('INTERNAL', { status: 500 }));
    await expect(
      enqueueCheckoutProvision({
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role-test',
        tenantId: 'ten_1',
        stripeEventId: 'evt_test_3',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/provision-tenant 500/);
  });
});
