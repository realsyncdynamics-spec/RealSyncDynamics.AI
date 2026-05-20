/**
 * Vertragstest fuer das Anon-Tool start_audit_scan.
 *
 * Phase 3 (Hostinger-Pattern): das Tool ist Mock-Queued.
 * Was hier garantiert wird:
 *   - Der Body enthaelt op='start_audit_scan' (uniform LLM-Tool-Pfad)
 *   - Erfolgs-Payload trifft das Schema (audit_id, status='queued',
 *     url_normalized, hint)
 *   - 429 mapped auf kind='rate_limited' (kein Crash)
 *   - 400 mapped auf kind='invalid' (kein Network-Error)
 *   - Wie bei chat_anon: kein tenant_id-Leak im Request-Body
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockInvokeCall {
  fn: string;
  body: Record<string, unknown>;
}

const invokeCalls: MockInvokeCall[] = [];
let nextResponse: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
        invokeCalls.push({ fn, body: opts.body });
        return Promise.resolve(nextResponse);
      },
    },
  }),
}));

import { startAuditScanAnon } from '../../../../src/features/governance/AgentWidget/agentApi';

beforeEach(() => {
  invokeCalls.length = 0;
  nextResponse = { data: null, error: null };
});

describe('startAuditScanAnon — Phase-3-Tool-Vertrag', () => {
  it('ruft governance-agent mit op=start_audit_scan + {url,email}', async () => {
    nextResponse = {
      data: {
        ok: true,
        status: 'queued',
        audit_id: 'mock-abc',
        url_normalized: 'https://kanzlei-mueller.de',
        hint: 'Demo-Response',
      },
      error: null,
    };

    const r = await startAuditScanAnon({ url: 'kanzlei-mueller.de', email: 't@example.de' });
    expect(r.kind).toBe('ok');
    expect(invokeCalls.length).toBe(1);
    expect(invokeCalls[0].fn).toBe('governance-agent');
    expect(invokeCalls[0].body.op).toBe('start_audit_scan');
    expect(invokeCalls[0].body.url).toBe('kanzlei-mueller.de');
    expect(invokeCalls[0].body.email).toBe('t@example.de');
  });

  it('Erfolgs-Payload trifft das queued-Schema', async () => {
    nextResponse = {
      data: {
        ok: true,
        status: 'queued',
        audit_id: 'mock-xyz',
        url_normalized: 'https://example.de',
        hint: 'Demo-Response — kein echter Scan ausgelöst.',
      },
      error: null,
    };

    const r = await startAuditScanAnon({ url: 'example.de', email: 't@example.de' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.data.status).toBe('queued');
      expect(r.data.audit_id).toMatch(/^mock-/);
      expect(r.data.url_normalized.startsWith('https://')).toBe(true);
      expect(r.data.hint).toBeTruthy();
    }
  });

  it('429 → kind="rate_limited"', async () => {
    nextResponse = {
      data: null,
      error: { message: 'rate', context: { status: 429 } },
    };
    const r = await startAuditScanAnon({ url: 'x.de', email: 't@example.de' });
    expect(r.kind).toBe('rate_limited');
  });

  it('400 → kind="invalid"', async () => {
    nextResponse = {
      data: null,
      error: { message: 'email invalid', context: { status: 400 } },
    };
    const r = await startAuditScanAnon({ url: 'x.de', email: 'kaputt' });
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') {
      expect(r.error.code).toBe('BAD_REQUEST');
    }
  });

  it('kein tenant_id / tool_calls / mutation im Request-Body', async () => {
    nextResponse = {
      data: { ok: true, status: 'queued', audit_id: 'mock-1', url_normalized: 'https://x.de', hint: '' },
      error: null,
    };
    await startAuditScanAnon({ url: 'x.de', email: 't@example.de' });
    const body = invokeCalls[0].body;
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_calls');
    expect(body).not.toHaveProperty('mutation');

    const allowedKeys = new Set(['op', 'url', 'email']);
    for (const key of Object.keys(body)) {
      expect(allowedKeys.has(key), `unerlaubter Feld-Leak: "${key}"`).toBe(true);
    }
  });
});
