/**
 * Contract tests for the `legal_context` agent tool added to
 * supabase/functions/_shared/agent-tools.ts.
 *
 * The tool wraps `retrieveLegalContext` and enforces:
 *   - query is non-empty (otherwise structured error, not throw)
 *   - top_k clamped 1..10
 *   - source_url + disclaimer + chunk_text on every returned passage
 *   - audit log row is written via the helper
 *   - LegalRetrievalGuardrailError / LegalRetrievalPhaseError caught
 *     and converted to structured { error, detail } envelopes
 *
 * Mocks the AdminLike client (rpc + insert).
 */
import { describe, it, expect } from 'vitest';
import { dispatchTool, AGENT_TOOLS } from '../../supabase/functions/_shared/agent-tools';

interface RpcCall    { fn: string; args: Record<string, unknown> }
interface InsertCall { table: string; row: Record<string, unknown> }

function mockAdmin(opts: {
  rpcResult?:    { data: unknown; error: { message: string } | null };
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
} = {}) {
  const rpcCalls: RpcCall[] = [];
  const insertCalls: InsertCall[] = [];
  // deno-lint-ignore no-explicit-any
  const admin: any = {
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(opts.rpcResult ?? { data: [], error: null });
    },
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          insertCalls.push({ table, row });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(opts.insertResult ?? {
                    data: { id: 'log-1' }, error: null,
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

function validChunkRow(overrides: Record<string, unknown> = {}) {
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
    disclaimer:        'Kein Rechtsrat.',
    rank_score:        0.95,
    ...overrides,
  };
}

const baseCtx = {
  name:    'legal_context',
  input:   { query: 'Wann brauche ich Einwilligung nach Art. 6?' },
  bearerAuth: 'Bearer test',
  tenantId:   't-1',
  userId:     'u-7',
  userEmail:  'auditor@example.de',
};

describe('AGENT_TOOLS catalogue', () => {
  it('includes legal_context with required query parameter', () => {
    const t = AGENT_TOOLS.find((x) => x.name === 'legal_context');
    expect(t).toBeDefined();
    // deno-lint-ignore no-explicit-any
    const schema = t?.input_schema as any;
    expect(schema.required).toContain('query');
    expect(schema.properties.framework.enum).toContain('gdpr');
    expect(schema.properties.framework.enum).toContain('ai_act');
  });
});

describe('legal_context dispatch', () => {
  it('returns structured results with source_url + disclaimer on each row', async () => {
    const { admin, rpcCalls, insertCalls } = mockAdmin({
      rpcResult: { data: [validChunkRow(), validChunkRow({ chunk_id: 'c-2' })], error: null },
    });
    const r = await dispatchTool({ ...baseCtx, admin }) as {
      query: string;
      log_id: string;
      platform_disclaimer: string;
      results: Array<Record<string, unknown>>;
    };
    expect(r.query).toBe(baseCtx.input.query);
    expect(r.log_id).toBe('log-1');
    expect(r.platform_disclaimer).toMatch(/keine.*Rechtsberatung/i);
    expect(r.results).toHaveLength(2);
    for (const p of r.results) {
      expect(p.source_url).toMatch(/^https?:\/\//);
      expect((p.disclaimer as string).length).toBeGreaterThan(5);
      expect((p.chunk_text as string).length).toBeGreaterThan(5);
    }
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('legal_retrieve_chunks');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('legal_retrieval_log');
  });

  it('rejects empty query without hitting the helper', async () => {
    const { admin, rpcCalls } = mockAdmin();
    const r = await dispatchTool({
      ...baseCtx, admin, input: { query: '   ' },
    }) as { error: string };
    expect(r.error).toMatch(/query/);
    expect(rpcCalls).toHaveLength(0);
  });

  it('clamps top_k to 10', async () => {
    const { admin, rpcCalls } = mockAdmin({
      rpcResult: { data: [validChunkRow()], error: null },
    });
    await dispatchTool({
      ...baseCtx, admin, input: { ...baseCtx.input, top_k: 9999 },
    });
    expect(rpcCalls[0].args.k).toBe(10);
  });

  it('clamps top_k to minimum 1', async () => {
    const { admin, rpcCalls } = mockAdmin({
      rpcResult: { data: [validChunkRow()], error: null },
    });
    await dispatchTool({
      ...baseCtx, admin, input: { ...baseCtx.input, top_k: 0 },
    });
    expect(rpcCalls[0].args.k).toBe(1);
  });

  it('passes framework + jurisdiction filters into the RPC', async () => {
    const { admin, rpcCalls } = mockAdmin({
      rpcResult: { data: [], error: null },
    });
    await dispatchTool({
      ...baseCtx, admin,
      input: { ...baseCtx.input, framework: 'ai_act', jurisdiction: 'eu' },
    });
    expect(rpcCalls[0].args).toMatchObject({
      framework_filter: 'ai_act', jurisdiction_filter: 'eu',
    });
  });

  it('converts guardrail violation into a structured error envelope', async () => {
    // Row with no source_url triggers a guardrail throw in the helper.
    const { admin } = mockAdmin({
      rpcResult: { data: [validChunkRow({ source_url: null })], error: null },
    });
    const r = await dispatchTool({ ...baseCtx, admin }) as { error: string; detail: string };
    expect(r.error).toMatch(/guardrail/);
    expect(r.detail).toMatch(/source_url/);
  });

  it('returns structured error when the RPC itself fails', async () => {
    const { admin } = mockAdmin({
      rpcResult: { data: null, error: { message: 'rpc-down' } },
    });
    const r = await dispatchTool({ ...baseCtx, admin }) as { error: string; detail: string };
    expect(r.error).toMatch(/failed/i);
    expect(r.detail).toMatch(/rpc-down/);
  });

  it('attaches the legal-advice reminder note to every successful response', async () => {
    const { admin } = mockAdmin({
      rpcResult: { data: [validChunkRow()], error: null },
    });
    const r = await dispatchTool({ ...baseCtx, admin }) as { note: string };
    expect(r.note).toMatch(/source_url/);
    expect(r.note).toMatch(/Rechtsbeistand/);
  });
});
