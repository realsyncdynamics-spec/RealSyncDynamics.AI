/**
 * Vertragstest fuer die Phase-4 audit-copilot Tools.
 *
 * explainFindingAnon / generateFixSnippetAnon — Mock-Queued in Phase 4.
 * Pflichtfelder: audit_id, finding_id. Optional: finding_payload, cms.
 *
 * 6 Cases (3 pro Tool):
 *   - op + Pflichtfelder im Body
 *   - 429 -> rate_limited
 *   - 400 -> invalid
 *   - kein tenant-Leak im Body
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

import {
  explainFindingAnon,
  generateFixSnippetAnon,
} from '../../../../src/features/governance/AgentWidget/agentApi';

beforeEach(() => {
  invokeCalls.length = 0;
  nextResponse = { data: null, error: null };
});

describe('Phase 4 — audit-copilot Tools im anon-Mode', () => {
  // ── explain_finding ──────────────────────────────────────────────────────

  it('explain_finding: ruft governance-agent mit op=explain_finding + Pflichtfeldern', async () => {
    nextResponse = {
      data: {
        ok: true,
        audit_id: 'aud-1',
        finding_id: 'pre_consent_tracker_01',
        explanation: {
          summary: 'Demo-Erklaerung',
          technical: 'Mock',
          legal_hint: 'Art. 6 DSGVO',
          disclaimer: 'Hinweis, keine Rechtsberatung.',
        },
        hint: 'Demo-Response',
      },
      error: null,
    };

    const r = await explainFindingAnon({
      audit_id: 'aud-1',
      finding_id: 'pre_consent_tracker_01',
      finding_payload: { id: 'pre_consent_tracker_01', severity: 'high', title: 'Tracker vor Consent' },
    });
    expect(r.kind).toBe('ok');
    expect(invokeCalls[0].fn).toBe('governance-agent');
    expect(invokeCalls[0].body.op).toBe('explain_finding');
    expect(invokeCalls[0].body.audit_id).toBe('aud-1');
    expect(invokeCalls[0].body.finding_id).toBe('pre_consent_tracker_01');
  });

  it('explain_finding: 429 -> rate_limited / 400 -> invalid', async () => {
    nextResponse = { data: null, error: { message: 'rate', context: { status: 429 } } };
    let r = await explainFindingAnon({ audit_id: 'a', finding_id: 'f' });
    expect(r.kind).toBe('rate_limited');

    nextResponse = { data: null, error: { message: 'audit_id required', context: { status: 400 } } };
    r = await explainFindingAnon({ audit_id: '', finding_id: 'f' });
    expect(r.kind).toBe('invalid');
  });

  it('explain_finding: keine tenant- oder tool_calls-Felder im Body', async () => {
    nextResponse = {
      data: { ok: true, audit_id: 'a', finding_id: 'f', explanation: { summary: '', technical: '', legal_hint: '', disclaimer: '' }, hint: '' },
      error: null,
    };
    await explainFindingAnon({ audit_id: 'a', finding_id: 'f' });
    const body = invokeCalls[0].body;
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_calls');
    expect(body).not.toHaveProperty('mutation');

    const allowedKeys = new Set(['op', 'audit_id', 'finding_id', 'finding_payload']);
    for (const key of Object.keys(body)) {
      expect(allowedKeys.has(key), `unerlaubter Feld-Leak: "${key}"`).toBe(true);
    }
  });

  // ── generate_fix_snippet ─────────────────────────────────────────────────

  it('generate_fix_snippet: ruft governance-agent mit op + cms + Pflichtfeldern', async () => {
    nextResponse = {
      data: {
        ok: true,
        audit_id: 'aud-1',
        finding_id: 'f1',
        snippet: { cms: 'wordpress', language: 'php', snippet: '<!-- demo -->', notes: 'mock' },
        hint: 'Demo',
      },
      error: null,
    };

    const r = await generateFixSnippetAnon({
      audit_id: 'aud-1',
      finding_id: 'f1',
      cms: 'wordpress',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.data.snippet.cms).toBe('wordpress');
      expect(r.data.snippet.language).toBe('php');
    }
    expect(invokeCalls[0].body.op).toBe('generate_fix_snippet');
    expect(invokeCalls[0].body.cms).toBe('wordpress');
  });

  it('generate_fix_snippet: 429 -> rate_limited / 400 -> invalid', async () => {
    nextResponse = { data: null, error: { message: 'rate', context: { status: 429 } } };
    let r = await generateFixSnippetAnon({ audit_id: 'a', finding_id: 'f' });
    expect(r.kind).toBe('rate_limited');

    nextResponse = { data: null, error: { message: 'finding_id required', context: { status: 400 } } };
    r = await generateFixSnippetAnon({ audit_id: 'a', finding_id: '' });
    expect(r.kind).toBe('invalid');
  });

  it('generate_fix_snippet: kein tenant_id im Body', async () => {
    nextResponse = {
      data: { ok: true, audit_id: 'a', finding_id: 'f', snippet: { cms: 'custom-html', language: 'html', snippet: '', notes: '' }, hint: '' },
      error: null,
    };
    await generateFixSnippetAnon({ audit_id: 'a', finding_id: 'f' });
    const body = invokeCalls[0].body;
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('tenantId');

    const allowedKeys = new Set(['op', 'audit_id', 'finding_id', 'cms', 'finding_payload']);
    for (const key of Object.keys(body)) {
      expect(allowedKeys.has(key), `unerlaubter Feld-Leak: "${key}"`).toBe(true);
    }
  });
});
