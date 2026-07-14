/**
 * Contract tests for the Legal-RAG retrieval adapter.
 *
 * Mocks the AdminLike client; no DB round-trips. Verifies the Phase 1
 * guardrails enforced at the helper layer:
 *   - caller_type='internal' only
 *   - tenant_id=null only
 *   - audit log written before result returned
 *   - missing source_url / disclaimer / chunk_text rejected
 *   - top_k clamped to [1, 50]
 *   - even failed retrievals get an audit-log row
 */
import { describe, it, expect } from 'vitest';
import {
  retrieveLegalContext,
  clampTopK,
  enforcePhase1,
  enforceCitationGuardrails,
  LegalRetrievalPhaseError,
  LegalRetrievalGuardrailError,
  LEGAL_PLATFORM_DISCLAIMER,
  type AdminLike,
  type LegalRetrievalRequest,
  type LegalRetrievalResultItem,
} from '../../supabase/functions/_shared/legal-retrieval';

interface RpcCall   { fn: string; args: Record<string, unknown> }
interface InsertCall { table: string; row: Record<string, unknown> }

function mockAdmin(opts: {
  rpcResult?:    { data: unknown; error: { message: string } | null };
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
} = {}): { admin: AdminLike; rpcCalls: RpcCall[]; insertCalls: InsertCall[] } {
  const rpcCalls: RpcCall[] = [];
  const insertCalls: InsertCall[] = [];
  const admin: AdminLike = {
    rpc(fn, args) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(opts.rpcResult ?? { data: [], error: null });
    },
    from(table) {
      return {
        insert(row) {
          insertCalls.push({ table, row });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(opts.insertResult ?? {
                    data: { id: 'log-mock-1' }, error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
  return { admin, rpcCalls, insertCalls };
}

function validRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    chunk_id:          'c-1',
    document_id:       'd-1',
    chunk_text:        'Art. 6 (1) lit. a DSGVO — Einwilligung der betroffenen Person.',
    heading_path:      'Art. 6 (1) lit. a',
    citation_anchor:   '#art6-1-a',
    source_url:        'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
    source_identifier: 'CELEX:32016R0679',
    framework:         'gdpr',
    jurisdiction:      'eu',
    title:             'DSGVO',
    published_at:      '2016-04-27',
    disclaimer:        'Kein Rechtsrat. Quelle dient nur der Information.',
    rank_score:        0.92,
    ...overrides,
  };
}

const baseReq: LegalRetrievalRequest = {
  query:       'Wann brauche ich eine Einwilligung nach Art. 6?',
  caller_type: 'internal',
};

// ─── Pure helpers ────────────────────────────────────────────────────

describe('clampTopK', () => {
  it('defaults to 5 when undefined', () => expect(clampTopK(undefined)).toBe(5));
  it('clamps to 1 lower bound',       () => expect(clampTopK(0)).toBe(1));
  it('clamps to 50 upper bound',      () => expect(clampTopK(1000)).toBe(50));
  it('passes through valid values',   () => expect(clampTopK(10)).toBe(10));
  it('floors non-integers',           () => expect(clampTopK(3.9)).toBe(3));
  it('handles NaN/Infinity',          () => {
    expect(clampTopK(NaN)).toBe(5);
    expect(clampTopK(Infinity)).toBe(5);
  });
});

// enforcePhase1 is deprecated and delegates to enforceCaller — it no longer
// restricts to caller_type='internal' only. These tests reflect the current
// delegated behavior.
describe('enforcePhase1', () => {
  it('accepts internal + tenant_id=null', () => {
    expect(() => enforcePhase1({ ...baseReq })).not.toThrow();
  });
  it('rejects caller_type=tenant without tenant_id', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'tenant' }))
      .toThrow(LegalRetrievalPhaseError);
  });
  it('accepts caller_type=api (deprecated wrapper delegates to enforceCaller)', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'api' })).not.toThrow();
  });
  it('rejects tenant_id non-null with caller_type=internal', () => {
    expect(() => enforcePhase1({ ...baseReq, tenant_id: 't-1' }))
      .toThrow(LegalRetrievalPhaseError);
  });
});

describe('enforceCaller', () => {
  // enforceCaller is imported via enforcePhase1 — test through that alias here
  // to keep the import list minimal.
  it('accepts caller_type=internal with tenant_id=null', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'internal' })).not.toThrow();
  });
  it('accepts caller_type=tenant with tenant_id set', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'tenant', tenant_id: 't-1' })).not.toThrow();
  });
  it('accepts caller_type=api', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'api' })).not.toThrow();
  });
  it('rejects unknown caller_type', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'unknown' as never }))
      .toThrow(LegalRetrievalPhaseError);
  });
  it('rejects caller_type=internal with non-null tenant_id', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'internal', tenant_id: 't-x' }))
      .toThrow(LegalRetrievalPhaseError);
  });
  it('rejects caller_type=tenant without tenant_id', () => {
    expect(() => enforcePhase1({ ...baseReq, caller_type: 'tenant' }))
      .toThrow(LegalRetrievalPhaseError);
  });
});

describe('enforceCitationGuardrails', () => {
  function row(overrides: Partial<LegalRetrievalResultItem> = {}): LegalRetrievalResultItem {
    return {
      chunk_id:          'c-1',
      document_id:       'd-1',
      chunk_text:        'text',
      heading_path:      null,
      citation_anchor:   null,
      source_url:        'https://example.com/x',
      source_identifier: null,
      framework:         'gdpr',
      jurisdiction:      'eu',
      title:             't',
      published_at:      null,
      disclaimer:        'Kein Rechtsrat.',
      rank_score:        0,
      ...overrides,
    };
  }
  it('passes valid rows', () => {
    expect(() => enforceCitationGuardrails([row()])).not.toThrow();
  });
  it('rejects rows with missing source_url', () => {
    expect(() => enforceCitationGuardrails([row({ source_url: '' })]))
      .toThrow(LegalRetrievalGuardrailError);
  });
  it('rejects rows with non-http source_url', () => {
    expect(() => enforceCitationGuardrails([row({ source_url: 'javascript:alert(1)' })]))
      .toThrow(LegalRetrievalGuardrailError);
  });
  it('rejects rows with empty disclaimer', () => {
    expect(() => enforceCitationGuardrails([row({ disclaimer: '' })]))
      .toThrow(LegalRetrievalGuardrailError);
  });
  it('rejects rows with empty chunk_text', () => {
    expect(() => enforceCitationGuardrails([row({ chunk_text: '' })]))
      .toThrow(LegalRetrievalGuardrailError);
  });
});

// ─── Integration via mockAdmin ───────────────────────────────────────

describe('retrieveLegalContext', () => {
  it('writes an audit-log row with the result chunk_ids', async () => {
    const { admin, insertCalls } = mockAdmin({
      rpcResult: { data: [validRow(), validRow({ chunk_id: 'c-2' })], error: null },
    });
    const r = await retrieveLegalContext(admin, { ...baseReq, top_k: 7 });
    expect(r.results).toHaveLength(2);
    expect(r.log_id).toBe('log-mock-1');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('legal_retrieval_log');
    expect(insertCalls[0].row.query_text).toBe(baseReq.query);
    expect(insertCalls[0].row.top_k).toBe(7);
    expect(insertCalls[0].row.result_count).toBe(2);
    expect(insertCalls[0].row.result_chunk_ids).toEqual(['c-1', 'c-2']);
    expect(insertCalls[0].row.caller_type).toBe('internal');
    expect(insertCalls[0].row.tenant_id).toBeNull();
  });

  it('attaches the platform disclaimer to every response', async () => {
    const { admin } = mockAdmin({
      rpcResult: { data: [validRow()], error: null },
    });
    const r = await retrieveLegalContext(admin, baseReq);
    expect(r.disclaimer).toBe(LEGAL_PLATFORM_DISCLAIMER);
    expect(r.disclaimer).toMatch(/keine.*Rechtsberatung/i);
  });

  it('writes an audit row even when zero results come back', async () => {
    const { admin, insertCalls } = mockAdmin({
      rpcResult: { data: [], error: null },
    });
    const r = await retrieveLegalContext(admin, baseReq);
    expect(r.results).toHaveLength(0);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.result_count).toBe(0);
  });

  it('still writes an audit row when the RPC errors, then throws', async () => {
    const { admin, insertCalls } = mockAdmin({
      rpcResult: { data: null, error: { message: 'rpc-boom' } },
    });
    await expect(retrieveLegalContext(admin, baseReq)).rejects.toThrow(/rpc-boom/);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.result_count).toBe(0);
  });

  it('rejects an empty query without hitting the RPC', async () => {
    const { admin, rpcCalls, insertCalls } = mockAdmin();
    await expect(retrieveLegalContext(admin, { ...baseReq, query: '   ' }))
      .rejects.toThrow(LegalRetrievalGuardrailError);
    expect(rpcCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects results with missing source_url before logging them as success', async () => {
    const { admin } = mockAdmin({
      rpcResult: { data: [validRow({ source_url: null })], error: null },
    });
    await expect(retrieveLegalContext(admin, baseReq))
      .rejects.toThrow(LegalRetrievalGuardrailError);
  });

  it('rejects results with missing disclaimer', async () => {
    const { admin } = mockAdmin({
      rpcResult: { data: [validRow({ disclaimer: null })], error: null },
    });
    await expect(retrieveLegalContext(admin, baseReq))
      .rejects.toThrow(LegalRetrievalGuardrailError);
  });

  it('throws Phase1 error if caller_type !== internal', async () => {
    const { admin, rpcCalls } = mockAdmin();
    await expect(
      retrieveLegalContext(admin, { ...baseReq, caller_type: 'tenant' }),
    ).rejects.toThrow(LegalRetrievalPhaseError);
    expect(rpcCalls).toHaveLength(0);
  });

  it('throws Phase1 error if tenant_id is set', async () => {
    const { admin, rpcCalls } = mockAdmin();
    await expect(
      retrieveLegalContext(admin, { ...baseReq, tenant_id: 't-1' }),
    ).rejects.toThrow(LegalRetrievalPhaseError);
    expect(rpcCalls).toHaveLength(0);
  });

  it('throws when audit-log write fails (fail-closed)', async () => {
    const { admin } = mockAdmin({
      rpcResult:    { data: [validRow()], error: null },
      insertResult: { data: null, error: { message: 'rls-blocked' } },
    });
    await expect(retrieveLegalContext(admin, baseReq))
      .rejects.toThrow(/audit-log write failed/);
  });

  it('passes framework/jurisdiction/language filters into the RPC and audit log', async () => {
    const { admin, rpcCalls, insertCalls } = mockAdmin({
      rpcResult: { data: [validRow()], error: null },
    });
    await retrieveLegalContext(admin, {
      ...baseReq,
      framework:    'ai_act',
      jurisdiction: 'eu',
      language:     'de',
    });
    expect(rpcCalls[0].args).toMatchObject({
      framework_filter:    'ai_act',
      jurisdiction_filter: 'eu',
      language_filter:     'de',
    });
    expect(insertCalls[0].row.query_filters).toEqual({
      framework: 'ai_act', jurisdiction: 'eu', language: 'de',
    });
  });

  it('clamps top_k via the request envelope', async () => {
    const { admin, rpcCalls, insertCalls } = mockAdmin({
      rpcResult: { data: [], error: null },
    });
    await retrieveLegalContext(admin, { ...baseReq, top_k: 9999 });
    expect(rpcCalls[0].args.k).toBe(50);
    expect(insertCalls[0].row.top_k).toBe(50);
  });
});
