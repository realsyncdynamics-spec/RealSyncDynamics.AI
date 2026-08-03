/**
 * exportEvidenceBundle() wraps the `evidence-vault-export` edge function,
 * which authenticates via `x-rsd-tenant-key` (not Bearer-JWT like the rest
 * of the vault ops) and has its own 403 semantics: this function has no
 * membership check, so a 403 always means PLAN_REQUIRED, never "not a
 * tenant member." mapExportError() must reflect that distinction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let invokeResponse: { data: unknown; error: unknown };
let lastInvokeArgs: { name: string; options: unknown } | null;

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: (name: string, options: unknown) => {
        lastInvokeArgs = { name, options };
        return Promise.resolve(invokeResponse);
      },
    },
  }),
}));

import { exportEvidenceBundle, type EvidenceExportBundle } from '../../../src/features/evidence-vault/evidenceVaultApi';

function makeBundle(overrides: Partial<EvidenceExportBundle> = {}): EvidenceExportBundle {
  return {
    tenant_id: 'tenant-1',
    exported_at: '2026-08-02T00:00:00Z',
    range: { from: '2026-05-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
    count: 0,
    redaction: { policy: 'always', hits_total: 0, hits_by_category: {}, note: '' },
    events: [],
    tip: null,
    verifier: {
      algorithm: 'sha256-chain + hmac-sha256',
      hash_payload: '',
      signature_payload: '',
      instructions: [],
      key_handover: '',
    },
    ...overrides,
  };
}

describe('exportEvidenceBundle', () => {
  beforeEach(() => {
    invokeResponse = { data: null, error: null };
    lastInvokeArgs = null;
  });

  it('sends the tenant id as x-rsd-tenant-key, not in the body', async () => {
    invokeResponse = { data: { bundle: makeBundle() }, error: null };
    await exportEvidenceBundle({ tenant_id: 'tenant-abc', from: '2026-01-01T00:00:00Z' });

    expect(lastInvokeArgs?.name).toBe('evidence-vault-export');
    const options = lastInvokeArgs?.options as { headers: Record<string, string>; body: Record<string, unknown> };
    expect(options.headers['x-rsd-tenant-key']).toBe('tenant-abc');
    expect(options.body).toEqual({ from: '2026-01-01T00:00:00Z' });
    expect(options.body.tenant_id).toBeUndefined();
  });

  it('returns the bundle on success', async () => {
    const bundle = makeBundle({ count: 3 });
    invokeResponse = { data: { bundle }, error: null };

    const result = await exportEvidenceBundle({ tenant_id: 'tenant-1' });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.data.count).toBe(3);
  });

  it('maps a 403 to payment_required with the Starter-tier message (not "forbidden")', async () => {
    invokeResponse = { data: null, error: { context: { status: 403 }, message: 'Edge Function returned a non-2xx status code' } };

    const result = await exportEvidenceBundle({ tenant_id: 'tenant-1' });

    expect(result.kind).toBe('payment_required');
    if (result.kind === 'payment_required') {
      expect(result.message).toContain('Starter');
    }
  });

  it('falls back to generic error mapping for non-403 failures', async () => {
    invokeResponse = { data: null, error: { context: { status: 500 }, message: 'boom' } };

    const result = await exportEvidenceBundle({ tenant_id: 'tenant-1' });

    expect(result.kind).toBe('error');
  });
});
